/* 分镜镜头 第 09 组：主歌B2 第27—32句——窗纸童年、路标无人、剑落晨崖、灰烬五座、太阳雨童戏、檐下坠壶 */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;
  const ss = (a, b, x) => smooth((x - a) / (b - a));
  const glow = (g, x, y, r, col, a) => { if (a > 0.004) A.glow(g, x, y, r, col, a); };
  const add = (g, fn) => K.lighter(g, fn);

  // 真实逐字时间（镜头内秒）——取不到 c.charT 时的后备
  const CT = {
    vb23_window: [0.2, 0.62, 1.02, 1.44, 1.86, 2.24],
    vb24_signpost: [0.22, 0.66, 1.1, 1.44, 1.86, 2.38, 2.68, 3.14],
    vb25_cliff: [0.25, 0.67, 1.05, 1.37, 1.89, 2.27, 2.71],
    vb26_ashring: [0.29, 0.65, 1.03, 1.35, 1.93, 2.27, 2.77],
    vb27_sunshower: [0.18, 0.54, 1.14, 1.84, 2.26, 2.74, 3.12],
    vb28_gourdfall: [0.21, 0.53, 1.59],
  };
  // 本句第 k 个字在镜头内唱出的时刻
  const chr = (c, id, k) => {
    const v = c.charT ? c.charT(k) : null;
    return v != null ? v + 0.06 - (c.t - c.lt) : CT[id][k];
  };
  // 两段式手臂：肩 S、手 Hd、上臂 a、前臂 b，肘向 bend 一侧弯
  function elbow(S, Hd, a, b, bend) {
    const dx = Hd[0] - S[0], dy = Hd[1] - S[1], d = Math.max(1, Math.hypot(dx, dy));
    const dd = Math.min(d, a + b - 0.5), cosA = clamp((a * a + dd * dd - b * b) / (2 * a * dd), -1, 1);
    const base = Math.atan2(dy, dx), ang = base + bend * Math.acos(cosA);
    return [S[0] + Math.cos(ang) * a, S[1] + Math.sin(ang) * a];
  }
  // 草叶：两头尖的填充叶片，随风摆
  function blade(g, x, y, len, w, bend, col) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - w, y);
    g.quadraticCurveTo(x + bend * 0.2 - w * 0.5, y - len * 0.55, x + bend, y - len + Math.abs(bend) * 0.3);
    g.quadraticCurveTo(x + bend * 0.2 + w * 0.5, y - len * 0.55, x + w, y);
    g.closePath(); g.fill();
  }

  // 木剑（孩子玩具）：握把在原点，剑身沿 -y
  function woodSword(g, x, y, ang, s, sw) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    g.fillStyle = '#5e3a1e'; g.fillRect(-2, -1, 4, 12);
    g.fillStyle = '#7e5028'; g.fillRect(-7.5, -4.5, 15, 4);
    g.fillStyle = K.lin(g, -3.5, 0, 3.5, 0, [[0, '#f0cf92'], [1, '#b08048']]);
    g.beginPath(); g.moveTo(-3.4, -4.5); g.lineTo(-3, -42); g.lineTo(0, -49); g.lineTo(3, -42); g.lineTo(3.4, -4.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(70,40,20,0.65)'; g.lineWidth = 0.9; g.stroke();
    const k = sw || 0;
    g.strokeStyle = '#d0342a'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 11); g.quadraticCurveTo(-3 + k * 3, 17, -2 + k * 6, 24); g.moveTo(0, 11); g.quadraticCurveTo(2 + k * 3, 18, 3 + k * 6, 23); g.stroke();
    g.restore();
  }

  // 铁剑（蜀山长剑）：剑格在原点，剑身沿 -y，len 剑身长；gl 剑身微光 0..1
  function steelSword(g, x, y, ang, len, gl, t) {
    g.save(); g.translate(x, y); g.rotate(ang);
    if (gl > 0.01) add(g, () => {
      glow(g, 0, -len * 0.5, len * 0.75, '#bfe6ff', 0.32 * gl);
      for (let k = 0; k < 4; k++) glow(g, 0, -len * (0.15 + k * 0.25), 16 + 6 * gl, '#e8f6ff', 0.5 * gl);
    });
    g.fillStyle = K.lin(g, -3.2, 0, 3.2, 0, [[0, '#f4f8fb'], [0.5, '#aeb9c2'], [1, '#5f6a74']]);
    g.beginPath(); g.moveTo(-3.2, -2); g.lineTo(-2.6, -len + 10); g.lineTo(0, -len); g.lineTo(2.6, -len + 10); g.lineTo(3.2, -2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,46,54,0.7)'; g.lineWidth = 0.8; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -len + 12); g.stroke();
    g.fillStyle = '#6a5430'; g.fillRect(-11, -3, 22, 5);
    g.fillStyle = '#2a2220'; g.fillRect(-2.6, 2, 5.2, 20);
    g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(0, 24, 3.2, 0, TAU); g.fill();
    const sw = Math.sin((t || 0) * 3.1) * 3;
    g.strokeStyle = '#c8322a'; g.lineWidth = 1.8; g.lineCap = 'round';
    g.beginPath();
    for (let k = -1; k <= 1; k++) { g.moveTo(0, 26); g.quadraticCurveTo(k * 2 + sw * 0.4, 34, k * 3 + sw, 44); }
    g.stroke();
    g.restore();
  }

  // =====================================================================
  // 第27句 第11句 —— 窗纸童年：窗纸上婶婶揪着小逍遥的耳朵，窗外的白发人先笑后哭
  // =====================================================================
  const WN = { x0: 238, x1: 806, y0: 166, y1: 504 };
  const LAMP = [470, 318], HOLE = [764, 489], SILL = WN.y1 + 28, BAND = 38;
  const BEAM_A = Math.atan2(HOLE[1] - LAMP[1], HOLE[0] - LAMP[0]);
  const MAN23 = [923, 704, 2.25];
  function vb23Back() {
    return K.cache('g09_vb23_back3', W, H, 1, (q) => {
      q.fillStyle = K.lin(q, 0, 0, 0, H, [[0, '#060a14'], [0.6, '#101a2c'], [1, '#0a101a']]); q.fillRect(0, 0, W, H);
      // 墙角外的远巷：夜雾里两重马头墙，一盏远灯
      q.save(); q.beginPath(); q.rect(1099, 0, 190, 660); q.clip();
      E.jiangnanTown(q, { t: 0, y: 500, x0: 960, x1: 1440, scale: 0.7, color: '#24324c', roof: '#0c1220', haze: '#141e32', hazeA: 0.45, seed: 31, smoke: 0, bank: false });
      q.fillStyle = 'rgba(20,30,50,0.5)'; q.fillRect(1099, 300, 190, 360);
      E.jiangnanTown(q, { t: 0, y: 640, x0: 940, x1: 1460, scale: 1.25, color: '#1a2438', roof: '#05070d', haze: '#0e1422', hazeA: 0.15, seed: 37, smoke: 0, bank: false });
      q.fillStyle = K.lin(q, 0, 420, 0, 660, [[0, 'rgba(34,48,76,0)'], [1, 'rgba(34,48,76,0.6)']]); q.fillRect(1099, 420, 190, 240);
      E.lantern(q, { x: 1196, y: 398, s: 0.55, t: 0, swing: 0, cord: 10, glowColor: '#ff9a4a' });
      q.restore();
      // 粉墙：冷蓝夜色里的白墙，雨水流痕
      q.fillStyle = K.lin(q, 0, 130, 0, 660, [[0, '#26324a'], [0.45, '#303d56'], [1, '#232e42']]); q.fillRect(-10, 120, 1110, 545);
      const r = A.rng(23);
      for (let i = 0; i < 90; i++) {
        const x = r() * 1090, y0 = 140 + r() * 60, len = 80 + r() * 420;
        q.fillStyle = rgba(r() < 0.6 ? '#141a28' : '#6a7c98', 0.05 + r() * 0.06);
        q.fillRect(x, y0, 1 + r() * 3, len);
      }
      for (let i = 0; i < 26; i++) { q.fillStyle = rgba('#10141e', 0.08 + r() * 0.08); q.beginPath(); q.ellipse(r() * 1090, 610 + r() * 50, 30 + r() * 80, 8 + r() * 14, 0, 0, TAU); q.fill(); }
      // 窗光漫到墙上（静态部分烘焙进底图）
      q.globalCompositeOperation = 'lighter';
      q.fillStyle = K.rad(q, 522, 335, 120, 600, [[0, 'rgba(255,140,60,0.34)'], [0.45, 'rgba(255,120,50,0.13)'], [1, 'rgba(255,120,50,0)']]); q.fillRect(-10, 120, 1110, 545);
      q.fillStyle = K.rad(q, LAMP[0], LAMP[1], 0, 330, [[0, 'rgba(255,170,90,0.12)'], [1, 'rgba(255,150,70,0)']]); q.fillRect(-10, 120, 1110, 545);
      q.globalCompositeOperation = 'source-over';
      // 墙角
      q.fillStyle = K.lin(q, 1064, 0, 1100, 0, [[0, 'rgba(6,8,16,0)'], [1, 'rgba(6,8,16,0.6)']]); q.fillRect(1064, 120, 36, 545);
      q.fillStyle = 'rgba(140,160,200,0.22)'; q.fillRect(1098, 120, 2, 545);
      q.fillStyle = K.lin(q, 0, 118, 0, 210, [[0, 'rgba(4,6,12,0.9)'], [1, 'rgba(4,6,12,0)']]); q.fillRect(-10, 118, 1112, 92);
      // 屋檐：瓦垄、瓦当与滴水
      q.fillStyle = K.lin(q, 0, 0, 0, 122, [[0, '#05070e'], [1, '#10151f']]); q.fillRect(-20, 0, 1122, 122);
      for (let x = -20; x < 1110; x += 22) {
        q.fillStyle = 'rgba(120,140,170,0.09)'; q.fillRect(x, 0, 9, 110);
        q.fillStyle = 'rgba(0,0,0,0.35)'; q.fillRect(x + 9, 0, 3, 110);
      }
      for (let x = -12; x < 1110; x += 44) {
        q.fillStyle = '#181e2a'; q.beginPath(); q.arc(x, 116, 9, 0, TAU); q.fill();
        q.strokeStyle = 'rgba(150,170,200,0.3)'; q.lineWidth = 1; q.beginPath(); q.arc(x, 116, 9, PI * 1.1, PI * 1.9); q.stroke();
        q.fillStyle = '#0e131c'; q.beginPath(); q.moveTo(x + 10, 112); q.lineTo(x + 34, 112); q.lineTo(x + 22, 132); q.closePath(); q.fill();
        if (x > 150 && x < 900) { q.fillStyle = 'rgba(255,170,100,0.2)'; q.fillRect(x + 14, 124, 16, 2); }
      }
      // 窗洞凹槽、窗台（窗台面受窗光一条暖边）
      q.fillStyle = '#0c0806'; q.fillRect(WN.x0 - 32, WN.y0 - 32, WN.x1 - WN.x0 + 64, WN.y1 - WN.y0 + 60);
      q.fillStyle = '#2a1a12'; q.fillRect(WN.x0 - 48, SILL, WN.x1 - WN.x0 + 96, 16);
      q.fillStyle = K.lin(q, 0, SILL - 6, 0, SILL + 3, [[0, 'rgba(255,170,100,0)'], [1, 'rgba(255,170,100,0.5)']]); q.fillRect(WN.x0 - 48, SILL - 6, WN.x1 - WN.x0 + 96, 9);
      q.fillStyle = 'rgba(255,190,120,0.55)'; q.fillRect(WN.x0 - 48, SILL, WN.x1 - WN.x0 + 96, 2);
      q.fillStyle = 'rgba(0,0,0,0.4)'; q.fillRect(WN.x0 - 40, SILL + 16, WN.x1 - WN.x0 + 80, 10);
      // 地面：湿青石板，窗光、远灯在水膜上拖成长影
      q.fillStyle = K.lin(q, 0, 652, 0, H, [[0, '#141c2a'], [1, '#080c14']]); q.fillRect(-10, 652, W + 20, 80);
      q.strokeStyle = 'rgba(0,0,0,0.5)'; q.lineWidth = 1.2;
      for (let k = 0; k < 4; k++) { const yy = 656 + k * k * 6; q.beginPath(); q.moveTo(-10, yy); q.lineTo(W + 10, yy); q.stroke(); }
      for (let k = -8; k < 16; k++) { q.beginPath(); q.moveTo(80 * k + 40, 656); q.lineTo(80 * k - 10 + (k - 4) * 14, H); q.stroke(); }
      q.globalCompositeOperation = 'lighter';
      const streak = (x, y, w, h, col, a) => { q.save(); q.translate(x, y); q.scale(1, h / w); q.fillStyle = K.rad(q, 0, 0, 0, w, [[0, rgba(col, a)], [1, rgba(col, 0)]]); q.fillRect(-w, -w, w * 2, w * 2); q.restore(); };
      q.save(); q.beginPath(); q.rect(WN.x0 - 30, 656, WN.x1 - WN.x0 + 60, 70); q.clip();
      for (let i = 0; i < 26; i++) {
        const x = WN.x0 + (i / 25) * (WN.x1 - WN.x0), w = 26 + r() * 30;
        streak(x + (r() - 0.5) * 30, 672 + r() * 22, w, 9 + r() * 12, '#ff9646', 0.07 + r() * 0.06);
      }
      q.restore();
      streak(1196, 684, 7, 40, '#ff9a4a', 0.35);
      q.fillStyle = K.rad(q, 522, 668, 10, 360, [[0, 'rgba(255,130,60,0.22)'], [1, 'rgba(255,130,60,0)']]); q.fillRect(-10, 652, W + 20, 80);
      q.globalCompositeOperation = 'source-over';
      q.fillStyle = 'rgba(150,170,200,0.12)'; q.fillRect(-10, 652, W + 20, 2);
      // 窗纸（静态部分）直接烘进底图
      q.drawImage(vb23Paper(), WN.x0, WN.y0, WN.x1 - WN.x0, WN.y1 - WN.y0);
    });
  }
  function vb23Paper() {
    return K.cache('g09_vb23_paper2', WN.x1 - WN.x0, WN.y1 - WN.y0, 1, (q) => {
      const w = WN.x1 - WN.x0, h = WN.y1 - WN.y0, lx = LAMP[0] - WN.x0, ly = LAMP[1] - WN.y0;
      q.fillStyle = K.rad(q, lx, ly, 0, 620, [[0, '#ffe8ae'], [0.15, '#ffc068'], [0.48, '#ea873c'], [1, '#9e4416']]); q.fillRect(0, 0, w, h);
      const r = A.rng(5);
      for (let i = 0; i < 260; i++) { q.strokeStyle = rgba(r() < 0.5 ? '#fff0c8' : '#8a3a10', 0.04 + r() * 0.06); q.lineWidth = 0.6 + r(); const x = r() * w, y = r() * h, a = r() * PI; q.beginPath(); q.moveTo(x, y); q.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); q.stroke(); }
      // 补过的一块窗纸
      q.fillStyle = 'rgba(255,236,190,0.10)'; q.fillRect(w * 0.12, h * 0.62, 44, 34);
      q.strokeStyle = 'rgba(130,60,20,0.2)'; q.strokeRect(w * 0.12, h * 0.62, 44, 34);
    });
  }
  // 灯笼框窗棂：中间一大块空窗（好映影子），四周一圈步步锦，四角方胜
  const LATP = 24;
  function vb23Lattice() {
    const w = WN.x1 - WN.x0 + LATP * 2, h = WN.y1 - WN.y0 + LATP * 2;
    return K.cache('g09_vb23_lat2', w, h, 1, (q) => {
      q.translate(LATP - WN.x0, LATP - WN.y0);
      const { x0, x1, y0, y1 } = WN, B = BAND, T = 4.2, m = B / 2;
      const ix0 = x0 + B, ix1 = x1 - B, iy0 = y0 + B, iy1 = y1 - B;
      const bars = [];
      const H_ = (xa, xb, y) => bars.push([xa, y - T / 2, xb - xa, T]), V_ = (x, ya, yb) => bars.push([x - T / 2, ya, T, yb - ya]);
      // 内框与带中线
      H_(ix0, ix1, iy0); H_(ix0, ix1, iy1); V_(ix0, iy0, iy1); V_(ix1, iy0, iy1);
      H_(x0 + m, x1 - m, y0 + m); H_(x0 + m, x1 - m, y1 - m); V_(x0 + m, y0 + m, y1 - m); V_(x1 - m, y0 + m, y1 - m);
      // 步步锦：外侧短棂与内侧短棂错开半格
      const step = 34;
      for (let x = ix0 + 12; x < ix1 - 6; x += step) { V_(x, y0, y0 + m); V_(x + step / 2, y0 + m, iy0); V_(x, y1 - m, y1); V_(x + step / 2, iy1, y1 - m); }
      for (let y = iy0 + 14; y < iy1 - 6; y += step) { H_(x0, x0 + m, y); H_(x0 + m, ix0, y + step / 2); H_(x1 - m, x1, y); H_(ix1, x1 - m, y + step / 2); }
      q.fillStyle = '#24140c';
      for (const b of bars) q.fillRect(b[0], b[1], b[2], b[3]);
      // 四角：方胜（两个相套的斜方）
      for (const [cx, cy] of [[x0 + m, y0 + m], [x1 - m, y0 + m], [x0 + m, y1 - m], [x1 - m, y1 - m]]) {
        q.save(); q.translate(cx, cy); q.rotate(PI / 4);
        q.strokeStyle = '#24140c'; q.lineWidth = T; q.strokeRect(-9, -9, 18, 18); q.strokeRect(-3, -3, 6, 6);
        q.restore();
      }
      // 内框四边中点的卡子花
      for (const [cx, cy] of [[(ix0 + ix1) / 2, iy0], [(ix0 + ix1) / 2, iy1], [ix0, (iy0 + iy1) / 2], [ix1, (iy0 + iy1) / 2]]) {
        q.fillStyle = '#24140c'; q.beginPath();
        for (let k = 0; k < 4; k++) { const a = k * PI / 2; q.moveTo(cx + Math.cos(a) * 9 + 4, cy + Math.sin(a) * 9); q.arc(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 4, 0, TAU); }
        q.fill(); q.beginPath(); q.arc(cx, cy, 5.5, 0, TAU); q.fill();
      }
      // 外框
      q.fillStyle = '#24140c';
      q.fillRect(x0 - 22, y0 - 22, x1 - x0 + 44, 22); q.fillRect(x0 - 22, y1, x1 - x0 + 44, 22);
      q.fillRect(x0 - 22, y0 - 22, 22, y1 - y0 + 44); q.fillRect(x1, y0 - 22, 22, y1 - y0 + 44);
      // 棂条受窗纸照亮的一侧
      q.fillStyle = 'rgba(255,170,90,0.4)';
      for (const b of bars) { if (b[2] > b[3]) q.fillRect(b[0], b[1] + b[3] - 1, b[2], 1); else q.fillRect(b[0] + b[2] - 1, b[1], 1, b[3]); }
      q.fillStyle = 'rgba(255,160,80,0.55)';
      q.fillRect(x0 - 2, y0, 2, y1 - y0); q.fillRect(x1, y0, 2, y1 - y0); q.fillRect(x0, y0 - 2, x1 - x0, 2); q.fillRect(x0, y1, x1 - x0, 2);
      q.fillStyle = 'rgba(140,160,200,0.3)';
      q.fillRect(x0 - 22, y0 - 22, x1 - x0 + 44, 1.5); q.fillRect(x1 + 20.5, y0 - 22, 1.5, y1 - y0 + 44);
    });
  }
  // 小孔漏出的一束光：烘焙在世界坐标的小贴图里，逐帧只改透明度
  const BMX = HOLE[0] - 12, BMY = HOLE[1] - 40, BMW = 420, BMH = 260;
  function vb23Beam() {
    return K.cache('g09_vb23_beam', BMW, BMH, 1, (q) => {
      q.translate(-BMX, -BMY);
      q.globalCompositeOperation = 'lighter';
      q.save(); q.translate(HOLE[0], HOLE[1]); q.rotate(BEAM_A);
      const L = 360;
      for (const [w0, w1, a] of [[3, 34, 0.22], [1.5, 16, 0.3]]) {
        q.fillStyle = K.lin(q, 0, 0, L, 0, [[0, `rgba(255,214,150,${a})`], [0.55, `rgba(255,170,90,${a * 0.45})`], [1, 'rgba(255,150,70,0)']]);
        q.beginPath(); q.moveTo(0, -w0); q.lineTo(L, -w1); q.lineTo(L, w1); q.lineTo(0, w0); q.closePath(); q.fill();
      }
      q.restore();
      // 光落在湿地上的一小片暖斑
      const ex = HOLE[0] + Math.cos(BEAM_A) * 318, ey = 664;
      q.save(); q.translate(ex, ey); q.scale(1, 0.22);
      q.fillStyle = K.rad(q, 0, 0, 0, 70, [[0, 'rgba(255,190,120,0.5)'], [1, 'rgba(255,150,70,0)']]); q.fillRect(-70, -70, 140, 140);
      q.restore();
    });
  }
  // 芭蕉叶（前景左下）：贴图，原点在左下
  function vb23Banana() {
    return K.cache('g09_vb23_banana', 360, 320, 1, (q) => {
      const leaf = (bx, by, ang, len, wd, col, rim) => {
        q.save(); q.translate(bx, by); q.rotate(ang);
        q.fillStyle = col;
        q.beginPath(); q.moveTo(0, 0);
        q.bezierCurveTo(len * 0.25, -wd, len * 0.75, -wd * 0.9, len, -wd * 0.1);
        q.bezierCurveTo(len * 0.7, wd * 0.5, len * 0.3, wd * 0.6, 0, 0); q.fill();
        q.strokeStyle = rgba(rim, 0.5); q.lineWidth = 1.6;
        q.beginPath(); q.moveTo(len * 0.05, -wd * 0.3); q.bezierCurveTo(len * 0.3, -wd * 1.0, len * 0.72, -wd * 0.92, len, -wd * 0.1); q.stroke();
        q.strokeStyle = 'rgba(0,0,0,0.5)'; q.lineWidth = 1;
        q.beginPath(); q.moveTo(0, 0); q.quadraticCurveTo(len * 0.5, -wd * 0.35, len, -wd * 0.1); q.stroke();
        for (let k = 1; k < 9; k++) { const u = k / 9; q.beginPath(); q.moveTo(len * u, -wd * 0.3 * Math.sin(u * PI)); q.lineTo(len * u + 10, -wd * 0.85 * Math.sin(u * PI)); q.stroke(); }
        q.restore();
      };
      leaf(40, 320, -1.15, 300, 70, '#081014', '#ffa060');
      leaf(70, 320, -0.62, 280, 64, '#0b1519', '#ff9450');
      leaf(20, 320, -1.55, 240, 56, '#070d10', '#7f98bc');
      leaf(110, 320, -0.25, 230, 52, '#0d181c', '#ff9858');
    });
  }
  // 窗纸上的男孩剪影（局部坐标：原点在两脚之间的地面，朝右为正，y 向上为负）
  // st: hop 离地高度, tuck 屈膝, lean 前倾, arms 'flail'|'press', ph 甩手相位, ear 揪耳拉长 0..1, walk 迈步相位
  function boyGeo(st) {
    const lean = st.lean || 0, tuck = st.tuck || 0, hop = st.hop || 0;
    const hip = [2, -70 - hop];
    const nk = [hip[0] + Math.sin(lean) * 42, hip[1] - Math.cos(lean) * 42];
    const hc = [nk[0] + 4 + Math.sin(lean) * 12, nk[1] - 22];
    const body = new Path2D();
    body.moveTo(hc[0] + 20, hc[1]); body.arc(hc[0], hc[1], 20, 0, TAU);
    body.moveTo(hc[0] + 3, hc[1] - 24); body.ellipse(hc[0] - 3, hc[1] - 24, 7, 8, -0.3, 0, TAU);
    body.moveTo(hc[0] + 17, hc[1] - 5); body.lineTo(hc[0] + 25, hc[1] + 3); body.lineTo(hc[0] + 17, hc[1] + 8);
    const ex = hc[0] - 15 - st.ear * 9, ey = hc[1] - 1 - st.ear * 8;
    body.moveTo(ex + 6, ey); body.ellipse(ex, ey, 6 + st.ear * 3, 5, -0.7 * st.ear, 0, TAU);
    body.moveTo(nk[0] - 7, nk[1] + 4); body.lineTo(nk[0] - 6, nk[1] - 8); body.lineTo(nk[0] + 8, nk[1] - 8); body.lineTo(nk[0] + 9, nk[1] + 4); body.closePath();
    // 短襦：肩宽，下摆微张
    body.moveTo(nk[0] - 13, nk[1] + 2); body.quadraticCurveTo(nk[0] + 2, nk[1] - 4, nk[0] + 14, nk[1] + 2);
    body.lineTo(hip[0] + 17, hip[1] + 8); body.lineTo(hip[0] - 16, hip[1] + 8); body.closePath();
    // 腿与脚尖：踮脚，屈膝随跳起
    const limbs = new Path2D(), feet = new Path2D();
    const wk = st.walk;
    for (const side of [1, -1]) {
      const hx = hip[0] + side * 5;
      let kx = hx + side * 2 + tuck * 12, ky = hip[1] + 34 - tuck * 6, ax = hx + side * 3 - tuck * 4, ay = -12 - hop + tuck * 6;
      if (wk != null) { const s = Math.sin(wk + (side > 0 ? 0 : PI)); kx = hx + s * 14; ky = hip[1] + 33; ax = hx + s * 22; ay = -10 - Math.max(0, -s) * 8 - hop; }
      limbs.moveTo(hx, hip[1] + 4); limbs.lineTo(kx, ky); limbs.lineTo(ax, ay);
      feet.moveTo(ax - 5, ay - 2); feet.lineTo(ax + 6, ay - 3); feet.lineTo(ax + 8, ay + 12); feet.closePath();
    }
    // 手臂
    const sh = [nk[0] + 1, nk[1] + 6], arms = new Path2D();
    const arm = (h, e) => { arms.moveTo(sh[0], sh[1]); arms.lineTo(e[0], e[1]); arms.lineTo(h[0], h[1]); };
    if (st.arms === 'press') {
      arm([hc[0] + 22, hc[1] - 10], [nk[0] + 20, nk[1] + 14]);
      arm([hc[0] + 21, hc[1] + 14], [nk[0] + 14, nk[1] + 22]);
    } else {
      const p = st.ph || 0;
      // 一只手去护被揪的耳朵，一只手往前乱扑
      arm([ex + 4 + 3 * Math.sin(p * 1.3), ey + 4], [sh[0] - 14, sh[1] - 4 + 5 * Math.sin(p)]);
      arm([sh[0] + 30 + 8 * Math.sin(p * 1.7), sh[1] - 10 - 16 * Math.sin(p * 1.1 + 1)], [sh[0] + 16, sh[1] + 6 - 6 * Math.sin(p * 1.7)]);
    }
    return { body, limbs, feet, arms, ear: [ex - 4, ey - 2], head: hc };
  }
  function vb23Shadows(g, c, lt, fl, beatK, rel, press, rest) {
    const col = 'rgba(62,22,6,0.76)';
    // 婶婶：发髻、叉腰，揪耳的手跟着男孩一起跳
    const AX = 506;
    const aunt = new Path2D();
    aunt.ellipse(AX + 6, 250, 27, 31, 0.15, 0, TAU);
    aunt.moveTo(AX - 4, 226); aunt.arc(AX - 16, 222, 18, 0, TAU);
    aunt.moveTo(AX + 30, 246); aunt.lineTo(AX + 40, 258); aunt.lineTo(AX + 30, 264);
    aunt.moveTo(AX - 8, 276); aunt.lineTo(AX + 18, 276); aunt.lineTo(AX + 18, 304); aunt.lineTo(AX - 8, 304); aunt.closePath();
    aunt.moveTo(AX - 76, WN.y1 + 4); aunt.lineTo(AX - 64, 326); aunt.quadraticCurveTo(AX - 54, 300, AX - 24, 296); aunt.lineTo(AX + 32, 296);
    aunt.quadraticCurveTo(AX + 60, 304, AX + 64, 330); aunt.lineTo(AX + 74, WN.y1 + 4); aunt.closePath();
    aunt.moveTo(AX - 70, 434); aunt.ellipse(AX - 82, 426, 14, 8, -0.5, 0, TAU);
    // 男孩：揪着时每拍踮脚一跳（影子跟着向灯靠近、变大变虚）；松手后跑到窗边，贴着窗纸
    const hop = (1 - rel) * 28 * beatK, tuck = (1 - rel) * beatK;
    const BX = lerp(640, 728, easeInOut(rel)), FL = WN.y1 - 2;
    const k = 1.32 * (1 + 0.08 * beatK * (1 - rel)) * lerp(1, 0.95, press);
    const st = { hop, tuck, lean: rel > 0 ? lerp(0.05, 0.16, press) : 0.08 + 0.05 * beatK, arms: press > 0.5 ? 'press' : 'flail', ph: lt * 11, ear: (1 - rel) * (0.6 + 0.4 * beatK), walk: rel > 0.02 && rel < 0.98 ? lt * 26 : null };
    const B = boyGeo(st);
    const toW = (p) => [BX + p[0] * k, FL + p[1] * k];
    const E = toW(B.ear), SA = [AX + 42, 314];
    const hand = [lerp(E[0], AX + 50, rest), lerp(E[1], 430, rest)];
    const elA = elbow(SA, hand, 64, 60, 1);
    const auntArms = new Path2D();
    auntArms.moveTo(AX - 50, 314); auntArms.lineTo(AX - 96, 374); auntArms.lineTo(AX - 62, 418);
    auntArms.moveTo(SA[0], SA[1]); auntArms.lineTo(elA[0], elA[1]); auntArms.lineTo(hand[0], hand[1]);
    g.save();
    g.beginPath(); g.rect(WN.x0, WN.y0, WN.x1 - WN.x0, WN.y1 - WN.y0); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'round';
    // 先画半影（两圈宽而淡的描边），再填实；离窗纸越远半影越宽
    const drawB = (mode, lw) => {
      g.save(); g.translate(BX, FL); g.scale(k, k);
      if (mode === 'fill') { g.fill(B.body); g.fill(B.feet); g.lineWidth = 12; g.stroke(B.limbs); g.lineWidth = 9; g.stroke(B.arms); }
      else { g.lineWidth = lw; g.stroke(B.body); g.lineWidth = lw + 12; g.stroke(B.limbs); g.lineWidth = lw + 9; g.stroke(B.arms); }
      g.restore();
    };
    const pen = lerp(1, 0.45, press) * (1 + 0.5 * beatK * (1 - rel)) * (0.94 + 0.06 * fl);
    for (const [lw, a] of [[26, 0.07], [12, 0.12]]) {
      g.strokeStyle = `rgba(62,22,6,${a})`;
      g.lineWidth = lw; g.stroke(aunt); g.lineWidth = lw + 17; g.stroke(auntArms);
      drawB('pen', lw * pen);
    }
    g.fillStyle = col; g.strokeStyle = col;
    g.fill(aunt); g.lineWidth = 17; g.stroke(auntArms);
    g.beginPath(); g.arc(hand[0], hand[1], 10, 0, TAU); g.fill();
    g.fillStyle = press > 0.5 ? 'rgba(58,18,4,0.86)' : col; g.strokeStyle = g.fillStyle;
    drawB('fill');
    g.restore();
    return toW(B.head);
  }
  XYT.registerShot('vb23_window', {
    name: '窗纸童年', zone: 'top', night: true, text: '#e9f1f6', shadow: 'rgba(8,12,26,0.92)', accent: '#ffb36a', bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = Math.max(0, c.lt), id = 'vb23_window';
      const c2 = chr(c, id, 2), c4 = chr(c, id, 4), c5 = chr(c, id, 5);
      g.drawImage(vb23Back(), 0, 0, W, H);
      const fl = 0.9 + 0.1 * noise1(t * 7.3, 3) + 0.03 * Math.sin(t * 23);
      // 灯焰一跳一跳：只在窗纸上叠一层平涂的亮
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,150,70,${(0.03 + 0.5 * (fl - 0.86) * 0.25).toFixed(3)})`;
      g.fillRect(WN.x0, WN.y0, WN.x1 - WN.x0, WN.y1 - WN.y0); g.restore();
      // 影子戏：命运——揪耳跳脚；幽默——松手，男孩跑到窗边贴住窗纸
      const bs = c.b.since != null ? c.b.since : (lt * 2.4) % 0.42;
      const beatK = Math.sin(PI * clamp(bs / 0.3));
      const rel = ss(c4 - 0.02, c4 + 0.34, lt), press = ss(c4 + 0.3, c4 + 0.42, lt), rest = ss(c4, c4 + 0.3, lt);
      vb23Shadows(g, c, lt, fl, beatK, rel, press, rest);
      g.drawImage(vb23Lattice(), WN.x0 - LATP, WN.y0 - LATP);
      // 窗纸上孩子戳的小洞：灯光从洞里斜射出来，穿过潮气照到他的衣摆和湿地上
      add(g, () => {
        glow(g, HOLE[0], HOLE[1], 14, '#fff2d0', 0.9);
        glow(g, HOLE[0], HOLE[1], 3.5, '#ffffff', 1);
      });
      // 老年逍遥：先望着窗纸；“自”字笑出声，后仰捧腹；“幽”字笑变成哭，掩面把额头抵上窗框
      const [mx, my, ms] = MAN23;
      let fo;
      const base = { stage: 'old', facing: -1, prop: 'none', wind: 0.14, windDir: 1, tone: 'silhouette', ink: '#151a22', whiteHair: true, rim: '#ffae68', light: [600, 340], rimAlpha: 1, rimWidth: 2.5 };
      if (lt < c2) fo = Object.assign({ pose: 'stand', head: 0.04 }, base);
      else if (lt < c4) fo = Object.assign({ pose: 'laugh' }, base);
      else {
        const sob = 0.05 * Math.sin(TAU * 2 * (lt - c4)) * ss(c4, c4 + 0.15, lt);
        fo = Object.assign({ pose: 'whisper', lean: 0.18 + sob, head: 0.34 + sob * 1.2 }, base);
      }
      F.draw(g, 'xiaoyao', mx, my, ms, t, fo);
      // 光束照在他身上
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.8 + 0.2 * fl;
      g.drawImage(vb23Beam(), BMX, BMY); g.restore();
      V.dust(g, c, { n: 22, light: { x: HOLE[0], y: HOLE[1], angle: BEAM_A, spread: 0.1, len: 330, start: 0.05 }, size: [0.8, 2.2], color: '#ffd6a0', alpha: 0.75, seed: 23, beat: 0.2 });
      if (lt >= c4) {
        const P = F.points('xiaoyao', mx, my, ms, t, fo);
        // 额头与窗框相抵处一点暖光；默字一滴泪
        add(g, () => glow(g, 830, P.head[1] - 6, 40, '#ffc890', 0.22 * ss(c4, c4 + 0.3, lt) * fl));
        // 一滴泪从掩面的指缝间渗出，“默”字落下，迎着窗光一闪
        const tf = lt - (c5 - 0.16);
        if (tf > 0) {
          const hx = P.handN[0] - 4, hy = P.handN[1] + 10, fall = Math.max(0, tf - 0.16);
          const ty = hy + 0.5 * 1500 * fall * fall, r0 = 2.6 * easeOut(clamp(tf / 0.16));
          if (ty < SILL) {
            add(g, () => { glow(g, hx, ty, 16, '#ffc890', 0.5); glow(g, hx, ty, 5, '#fff4e0', 0.9); });
            g.fillStyle = 'rgba(255,240,220,0.95)'; g.beginPath(); g.ellipse(hx, ty, r0 * 0.8, r0 * (1 + Math.min(1, fall * 8)), 0, 0, TAU); g.fill();
          }
        }
      }
      // 屋檐滴水：每拍一滴正好落在暖光的窗台上溅开，另有几滴落到地上
      const GRAV = 1900, yT = 132, TF = Math.sqrt((2 * (SILL - yT)) / GRAV);
      const dropAt = (x, y, warm) => {
        add(g, () => glow(g, x, y, 9, warm ? '#ffc890' : '#b8d0f0', 0.5));
        g.fillStyle = warm ? 'rgba(255,224,180,0.95)' : 'rgba(205,222,246,0.85)';
        g.beginPath(); g.moveTo(x, y - 6.5); g.quadraticCurveTo(x + 1.6, y, x + 1.5, y + 2); g.arc(x, y + 2, 1.5, 0, PI); g.quadraticCurveTo(x - 1.6, y, x, y - 6.5); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(x - 0.6, y + 0.6, 1.2, 1.2);
      };
      for (let k = -1; k <= 2; k++) {
        const bi = c.b.i + k, tL = c.grid ? c.grid.time(bi) : (bi * 0.42), age = t - tL;
        const x = 300 + 44 * Math.floor(h2(bi, 77) * 11) + 22;
        if (age < -TF || age > 0.6) continue;
        if (age < 0) {
          const u = age + TF, y = yT + 0.5 * GRAV * u * u;
          dropAt(x, y, y > WN.y0 - 30);
        } else {
          // 落在窗台上溅成一圈细珠
          const e = 1 - age / 0.6;
          add(g, () => glow(g, x, SILL, 16, '#ffcf9a', 0.55 * e));
          g.fillStyle = `rgba(255,226,190,${(0.9 * e).toFixed(3)})`;
          for (let i = 0; i < 6; i++) {
            const a = PI * (0.15 + 0.7 * h2(i, bi)), v = 50 + 50 * h2(i, bi + 3);
            const dx = Math.cos(a) * v * age, dy = -Math.sin(a) * v * age + 260 * age * age;
            if (dy < 1) { g.beginPath(); g.arc(x + dx, SILL + dy, 1.3, 0, TAU); g.fill(); }
          }
          g.strokeStyle = `rgba(255,214,170,${(0.6 * e).toFixed(3)})`; g.lineWidth = 1;
          g.beginPath(); g.ellipse(x, SILL + 1, 4 + age * 40, 1 + age * 5, 0, 0, TAU); g.stroke();
        }
      }
      for (let k = 0; k < 4; k++) {
        const P = 0.62 + 0.3 * h2(k, 3), u = ((t / P + h2(k, 4)) % 1) * P, x = [78, 166, 1012, 1060][k] + 22;
        const y = yT + 0.5 * GRAV * u * u;
        if (y < 652) dropAt(x, y, false);
        else E.ripples(g, { x, y: 668, t, t0: t - (u - Math.sqrt((2 * (652 - yT)) / GRAV)), life: 0.9, scale: 0.35, color: '#c8d8f0', alpha: 0.5, rings: 2 });
      }
      // 远灯微闪
      add(g, () => glow(g, 1196, 418, 26, '#ff9a50', 0.25 * fl));
      // 前景芭蕉
      g.save(); g.translate(-34, 726); g.rotate(0.02 * Math.sin(t * 0.9));
      g.drawImage(vb23Banana(), 0, -320, 360, 320); g.restore();
      E.mist(g, { t, y: 640, h: 90, color: '#4a5a7a', alpha: 0.22, speed: 7 });
    },
  });

  // =====================================================================
  // 第28句 第12句 —— 路标无人：阴雨岔路，低机位；“由”字一阵风卷走他的纸伞
  // =====================================================================
  const HZ24 = 538;
  // 岔路：主路在脚下分成两股，弯弯地没进雾里（二次曲线段，画与取样共用）
  const ROAD24 = [
    [[330, 742], [470, 642], [588, 614]], [[588, 614], [420, 574], [250, HZ24 + 3]], [[250, HZ24 + 3], [259, HZ24 + 3], [268, HZ24 + 3]],
    [[268, HZ24 + 3], [470, 566], [640, 600]], [[640, 600], [760, 568], [842, HZ24 + 2]], [[842, HZ24 + 2], [851, HZ24 + 2], [860, HZ24 + 2]],
    [[860, HZ24 + 2], [770, 590], [702, 618]], [[702, 618], [790, 664], [872, 742]],
  ];
  const qb = (s, u) => [(1 - u) * (1 - u) * s[0][0] + 2 * u * (1 - u) * s[1][0] + u * u * s[2][0], (1 - u) * (1 - u) * s[0][1] + 2 * u * (1 - u) * s[1][1] + u * u * s[2][1]];
  const PUD24 = [[560, 700, 96, 13], [700, 664, 46, 7], [470, 612, 30, 4], [752, 590, 22, 3.2], [650, 730, 70, 9]];
  const FIG24 = { x: 1046, y: 600, s: 2.3 };
  // 书法字是否就绪（就绪后不再变，记下来免得每帧查询）
  const fontOk = {};
  const fontKey = (txt) => {
    if (fontOk[txt]) return 'f';
    try { if (document.fonts && document.fonts.check('32px "Ma Shan Zheng"', txt)) { fontOk[txt] = 1; return 'f'; } } catch (e) { /* 无字体接口 */ }
    return 'n';
  };
  try { if (document.fonts && document.fonts.load) document.fonts.load('64px "Ma Shan Zheng"', '余杭蜀山酒').catch(() => {}); } catch (e) { /* 无字体接口 */ }
  function vb24Back() {
    return K.cache('g09_vb24_back3', W, H, 1, (q) => {
      q.fillStyle = K.lin(q, 0, 0, 0, HZ24, [[0, '#5f707a'], [0.5, '#93a5a6'], [1, '#c6d1cb']]); q.fillRect(0, 0, W, HZ24 + 4);
      E.clouds(q, { t: 0, y: 170, color: '#8696a0', shade: '#56666e', alpha: 0.6, n: 5, seed: 28, scale: 1.3, speed: 0 });
      E.clouds(q, { t: 0, y: 330, color: '#a8b6b6', shade: '#7a8a8e', alpha: 0.45, n: 4, seed: 29, scale: 0.9, speed: 0 });
      E.mountains(q, { t: 0, lightDir: 1, layers: [
        { kind: 'far', color: '#a4b4b0', alpha: 0.7, y: HZ24 - 4, scaleY: 0.3, seed: 7, soft: true },
        { kind: 'mid', color: '#83968f', alpha: 0.85, y: HZ24 + 2, scaleY: 0.2, seed: 11, fog: '#c6d1cb', fogA: 0.55 },
      ] });
      // 地面：湿草坡
      q.fillStyle = K.lin(q, 0, HZ24, 0, H, [[0, '#7a8a7c'], [0.35, '#55665a'], [1, '#26322c']]); q.fillRect(0, HZ24, W, H - HZ24);
      const r = A.rng(24);
      for (let i = 0; i < 1100; i++) {
        const y = HZ24 + Math.pow(r(), 1.5) * (H - HZ24), k = (y - HZ24) / (H - HZ24), x = r() * W;
        q.strokeStyle = rgba(r() < 0.55 ? '#25332a' : '#98a896', 0.22 + 0.3 * k); q.lineWidth = 0.6 + k * 1.6;
        q.beginPath(); q.moveTo(x, y); q.lineTo(x + 1 + k * 3, y - 2 - k * 14); q.stroke();
      }
      // 岔路：先一圈湿泥的暗边（羽化），再铺路面，路面上压两道车辙
      const road = () => { q.beginPath(); q.moveTo(ROAD24[0][0][0], ROAD24[0][0][1]); for (const s of ROAD24) q.quadraticCurveTo(s[1][0], s[1][1], s[2][0], s[2][1]); q.closePath(); };
      q.lineJoin = 'round';
      for (const [w, a] of [[26, 0.12], [14, 0.22], [6, 0.3]]) { q.strokeStyle = `rgba(44,46,34,${a})`; q.lineWidth = w; road(); q.stroke(); }
      q.fillStyle = K.lin(q, 0, HZ24, 0, H, [[0, '#a6ada2'], [0.35, '#8a8e80'], [1, '#5c5c50']]); road(); q.fill();
      q.save(); road(); q.clip();
      for (let i = 0; i < 160; i++) {
        const y = HZ24 + Math.pow(r(), 1.3) * (H - HZ24), k = (y - HZ24) / (H - HZ24);
        q.fillStyle = rgba(r() < 0.5 ? '#4a4a3e' : '#c8d0c8', 0.08 + 0.1 * r()); q.fillRect(r() * W, y, 10 + k * 60 * r(), 1 + k * 3);
      }
      // 车辙：顺着路弯
      q.strokeStyle = 'rgba(52,50,40,0.32)'; q.lineCap = 'round';
      for (const [a, cc, b, w] of [[[440, 742], [560, 650], [610, 616], 4], [[770, 742], [700, 650], [668, 618], 4], [[600, 614], [440, 580], [262, HZ24 + 3], 2], [[680, 612], [770, 582], [851, HZ24 + 2], 2]]) {
        q.lineWidth = w; q.beginPath(); q.moveTo(a[0], a[1]); q.quadraticCurveTo(cc[0], cc[1], b[0], b[1]); q.stroke();
      }
      // 路沿内侧的湿泥
      q.strokeStyle = 'rgba(60,58,44,0.35)'; q.lineWidth = 10; road(); q.stroke();
      q.restore();
      // 路边的乱草压住路沿：沿曲线取样，断断续续
      for (const s of ROAD24) {
        if (s[0][1] > 730 && s[2][1] > 730) continue;
        const n = Math.round(Math.hypot(s[2][0] - s[0][0], s[2][1] - s[0][1]) / 2.6);
        for (let i = 0; i < n; i++) {
          if (h2(i, Math.round(s[0][0])) < 0.3) continue;
          const [x0, y0] = qb(s, i / n), x = x0 + (r() - 0.5) * 8, y = y0 + (r() - 0.5) * 4, k = clamp((y - HZ24) / (H - HZ24));
          const len = 2 + k * 20 * (0.4 + r()), b = (r() - 0.6) * len * 0.7;
          q.strokeStyle = rgba(r() < 0.6 ? '#2a382e' : '#62735e', 0.75); q.lineWidth = 0.6 + k * 1.5;
          q.beginPath(); q.moveTo(x, y + 1); q.quadraticCurveTo(x + b * 0.3, y - len * 0.6, x + b, y - len); q.stroke();
        }
      }
      // 水洼，映着阴天
      for (const [x, y, rx, ry] of PUD24) {
        q.fillStyle = 'rgba(40,42,32,0.35)'; q.beginPath(); q.ellipse(x, y + 1, rx + 4, ry + 2, 0, 0, TAU); q.fill();
        q.fillStyle = K.lin(q, 0, y - ry, 0, y + ry, [[0, '#bcc8c4'], [0.6, '#9aaaa8'], [1, '#7e8e8e']]);
        q.beginPath(); q.ellipse(x, y, rx, ry, 0, 0, TAU); q.fill();
        q.fillStyle = 'rgba(232,238,234,0.38)'; q.beginPath(); q.ellipse(x - rx * 0.2, y - ry * 0.3, rx * 0.55, ry * 0.25, 0, 0, TAU); q.fill();
      }
      // 右路尽头：空空的长亭
      q.save(); q.translate(860, HZ24 + 1); q.scale(1.6, 1.6); q.globalAlpha = 0.75; q.fillStyle = '#4e5a56';
      q.fillRect(-14, -20, 2.5, 20); q.fillRect(11.5, -20, 2.5, 20); q.fillRect(-1, -20, 2, 20);
      q.fillRect(-16, -8, 32, 1.6);
      q.beginPath(); q.moveTo(-27, -17); q.quadraticCurveTo(-9, -22, 0, -34); q.quadraticCurveTo(9, -22, 27, -17); q.lineTo(15, -22); q.lineTo(-15, -22); q.closePath(); q.fill();
      q.fillRect(-0.8, -38, 1.6, 5);
      q.restore();
      q.fillStyle = K.lin(q, 0, HZ24 - 46, 0, HZ24 + 40, [[0, 'rgba(206,216,210,0)'], [0.55, 'rgba(206,216,210,0.6)'], [1, 'rgba(206,216,210,0)']]); q.fillRect(0, HZ24 - 46, W, 86);
      // 他坐的大石头（后半）
      q.fillStyle = K.lin(q, 0, 590, 0, 730, [[0, '#76807a'], [0.5, '#4a544e'], [1, '#1e2622']]);
      q.beginPath(); q.moveTo(930, 736); q.quadraticCurveTo(930, 640, 980, 606); q.quadraticCurveTo(1070, 584, 1160, 598); q.quadraticCurveTo(1240, 620, 1260, 736); q.closePath(); q.fill();
      q.fillStyle = 'rgba(206,218,212,0.38)'; q.beginPath(); q.moveTo(972, 610); q.quadraticCurveTo(1070, 588, 1160, 600); q.quadraticCurveTo(1070, 598, 972, 614); q.fill();
      // 地平线上的一层雾、路标立柱
      E.mist(q, { t: 0, y: HZ24 - 8, h: 120, color: '#d2dcd6', alpha: 0.5 });
      q.drawImage(vb24Post(), 296, 148, 70, 600);
      // 阴雨的冷调（烘焙，不再逐帧调色）
      V.grade(q, 'storm', 0.15);
    });
  }
  // 前景石沿：挡住他大腿以下（低机位看过去）
  function vb24Lip() {
    return K.cache('g09_vb24_lip', 520, 240, 1, (q) => {
      q.translate(-760, -520);
      const r = A.rng(241);
      const shape = () => {
        q.beginPath(); q.moveTo(770, 760);
        q.bezierCurveTo(780, 650, 830, 600, 900, 590); q.bezierCurveTo(950, 584, 990, 594, 1030, 606);
        q.bezierCurveTo(1080, 620, 1130, 612, 1180, 630); q.bezierCurveTo(1240, 650, 1270, 700, 1280, 760); q.closePath();
      };
      q.fillStyle = K.lin(q, 0, 580, 0, 760, [[0, '#5e6a64'], [0.35, '#3c4642'], [1, '#141a18']]); shape(); q.fill();
      q.save(); shape(); q.clip();
      // 斧劈皴与苔
      for (let i = 0; i < 46; i++) {
        const x = 780 + r() * 490, y = 600 + r() * 150, len = 20 + r() * 50, w = 3 + r() * 7;
        q.fillStyle = rgba(r() < 0.7 ? '#10161a' : '#9aa8a2', 0.12 + r() * 0.22);
        q.beginPath(); q.moveTo(x, y); q.lineTo(x + w, y + 2); q.lineTo(x + w * 0.3 - len * 0.2, y + len); q.closePath(); q.fill();
      }
      for (let i = 0; i < 30; i++) { q.fillStyle = rgba(r() < 0.5 ? '#4c6e44' : '#6a8a52', 0.5); q.beginPath(); q.ellipse(790 + r() * 470, 600 + r() * 40, 4 + r() * 10, 2 + r() * 4, 0, 0, TAU); q.fill(); }
      q.restore();
      // 湿亮的上沿
      q.strokeStyle = 'rgba(220,230,226,0.55)'; q.lineWidth = 2.2;
      q.beginPath(); q.moveTo(806, 640); q.bezierCurveTo(830, 604, 860, 592, 900, 590); q.bezierCurveTo(950, 584, 990, 594, 1030, 606); q.bezierCurveTo(1080, 620, 1130, 612, 1180, 630); q.stroke();
      // 石沿前的一丛乱草
      for (let i = 0; i < 40; i++) {
        const x = 770 + r() * 500, y = 760, len = 30 + r() * 60, b = (r() - 0.6) * len * 0.5;
        q.strokeStyle = rgba(r() < 0.6 ? '#1a2620' : '#34463a', 0.9); q.lineWidth = 1.5 + r() * 2;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + b * 0.3, y - len * 0.6, x + b, y - len); q.stroke();
      }
    });
  }
  // 路标的指路牌：写着地名的木牌，被雨水冲得只剩残笔
  function vb24Arm(dir) {
    const txt = dir > 0 ? '蜀山' : '余杭';
    return K.cache('g09_vb24_arm2' + dir + fontKey(txt), 250, 60, 1.6, (q) => {
      const r = A.rng(dir > 0 ? 7 : 9);
      q.save();
      q.translate(dir > 0 ? 6 : 244, 30);
      q.scale(dir, 1);
      q.fillStyle = K.lin(q, 0, -22, 0, 22, [[0, '#82786a'], [0.5, '#5e564c'], [1, '#3a342e']]);
      q.beginPath(); q.moveTo(0, -21); q.lineTo(205, -21); q.lineTo(236, 0); q.lineTo(205, 21); q.lineTo(0, 21); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(20,18,14,0.7)'; q.lineWidth = 1.4; q.stroke();
      for (let i = 0; i < 16; i++) { q.strokeStyle = rgba(r() < 0.5 ? '#2a2420' : '#a49a8a', 0.25); q.lineWidth = 0.8; const y = -18 + r() * 36; q.beginPath(); q.moveTo(r() * 30, y); q.lineTo(120 + r() * 100, y + (r() - 0.5) * 3); q.stroke(); }
      q.fillStyle = 'rgba(0,0,0,0.25)'; q.fillRect(0, 14, 205, 7);
      q.restore();
      // 墨字：写上去，再被雨水一道道冲掉
      const bx = dir > 0 ? 6 + 112 : 244 - 112;
      const kk = q.getTransform().a, ink = document.createElement('canvas'); ink.width = Math.round(250 * kk); ink.height = Math.round(60 * kk);
      const ic = ink.getContext('2d'); ic.scale(kk, kk);
      E.util.glyphs(ic, txt, bx, 31, 34, '#141010');
      ic.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 26; i++) { ic.fillStyle = `rgba(0,0,0,${(0.5 + r() * 0.5).toFixed(2)})`; ic.fillRect(bx - 50 + r() * 100, -4 + r() * 20, 2 + r() * 6, 30 + r() * 50); }
      ic.globalCompositeOperation = 'source-over';
      q.globalAlpha = 0.85; q.drawImage(ink, 0, 0, 250, 60); q.globalAlpha = 1;
      // 冲下来的淡墨水痕
      for (let i = 0; i < 14; i++) { q.fillStyle = rgba('#241e1a', 0.06 + r() * 0.08); q.fillRect(bx - 40 + r() * 80, 26 + r() * 8, 1.5 + r() * 3, 8 + r() * 18); }
      for (let i = 0; i < 12; i++) { q.fillStyle = rgba('#c8ccc0', 0.1 + r() * 0.12); q.fillRect(r() * 236 + 6, 9, 2 + r() * 4, 10 + r() * 30); }
      q.fillStyle = 'rgba(90,120,70,0.5)'; for (let i = 0; i < 7; i++) { q.beginPath(); q.arc((dir > 0 ? 6 : 184) + r() * 60, 44 + r() * 6, 2 + r() * 4, 0, TAU); q.fill(); }
      const nx = dir > 0 ? 20 : 230;
      q.fillStyle = '#1a1612'; q.beginPath(); q.arc(nx, 30, 3.6, 0, TAU); q.fill();
      q.fillStyle = 'rgba(220,224,216,0.5)'; q.beginPath(); q.arc(nx - 1, 29, 1.2, 0, TAU); q.fill();
    });
  }
  function vb24Post() {
    return K.cache('g09_vb24_post', 70, 600, 1.4, (q) => {
      const r = A.rng(31);
      q.fillStyle = K.lin(q, 20, 0, 50, 0, [[0, '#8e8676'], [0.35, '#5e564a'], [1, '#24201c']]);
      q.beginPath(); q.moveTo(21, 22); q.lineTo(49, 22); q.lineTo(52, 600); q.lineTo(18, 600); q.closePath(); q.fill();
      for (let i = 0; i < 30; i++) { q.strokeStyle = rgba('#1a1612', 0.3 + r() * 0.3); q.lineWidth = 0.9; const x = 22 + r() * 26, y = 24 + r() * 560; q.beginPath(); q.moveTo(x, y); q.lineTo(x + (r() - 0.5) * 2, y + 20 + r() * 50); q.stroke(); }
      q.fillStyle = 'rgba(200,206,196,0.18)'; q.fillRect(22, 22, 4, 578);
      q.fillStyle = '#2a2520'; q.beginPath(); q.moveTo(8, 26); q.lineTo(35, 2); q.lineTo(62, 26); q.closePath(); q.fill();
      q.fillStyle = 'rgba(200,206,196,0.4)'; q.fillRect(10, 24, 50, 2);
      q.fillStyle = 'rgba(80,110,70,0.6)'; for (let i = 0; i < 16; i++) { q.beginPath(); q.arc(20 + r() * 30, 540 + r() * 60, 3 + r() * 6, 0, TAU); q.fill(); }
    });
  }
  // 油纸伞：(x, y) 为伞顶，R 半径，rot 平面内转角，el 俯仰（0 侧面，>0 看见伞面，<0 看见伞里），shaft 伞柄长
  // 逆光时油纸透亮：伞面上叠一层 screen 的暖光，伞骨成深色细线
  function oilUmbrella(g, x, y, R, rot, el, shaft, col, back, ghost) {
    const ce = Math.cos(el * PI / 2), se = Math.sin(el * PI / 2);
    const hc = 0.5 * R * ce, ry = Math.abs(se) * R + 3, sl = shaft * ce;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.lineCap = 'round';
    const stick = () => {
      g.strokeStyle = '#4a3420'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, sl); g.stroke();
      g.beginPath(); g.arc(-5, sl, 5, 0, PI); g.stroke();
    };
    const gr = g.createLinearGradient(-R, 0, R, 0);
    gr.addColorStop(0, mix(col, '#3a2010', 0.3)); gr.addColorStop(0.45, mix(col, '#ffe8c0', 0.25)); gr.addColorStop(1, mix(col, '#2a1408', 0.42));
    const dome = (bk) => {
      g.beginPath(); g.moveTo(-R, hc); g.quadraticCurveTo(-R * 0.86, hc * 0.19, 0, 0); g.quadraticCurveTo(R * 0.86, hc * 0.19, R, hc);
      g.ellipse(0, hc, R, ry, 0, 0, bk ? -PI : PI, bk); g.closePath();
    };
    if (ghost) { g.fillStyle = col; dome(el < 0); g.fill(); g.restore(); return; }
    if (el >= 0) {
      stick();
      g.fillStyle = gr; dome(false); g.fill();
      if (back) {
        g.save(); dome(false); g.clip(); g.globalCompositeOperation = 'screen';
        g.fillStyle = K.rad(g, R * 0.15, hc * 0.6, 0, R * 1.1, [[0, `rgba(255,214,140,${0.55 * back})`], [1, 'rgba(255,190,110,0)']]);
        g.fillRect(-R, -2, R * 2, hc + ry + 4); g.restore();
      }
      g.strokeStyle = 'rgba(70,34,10,0.55)'; g.lineWidth = 1.1;
      for (let i = 0; i <= 14; i++) { const a = (i / 14) * PI, px = R * Math.cos(a), py = hc + ry * Math.sin(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(px * 0.7, hc * 0.35 + (py - hc) * 0.6, px, py); g.stroke(); }
      g.strokeStyle = 'rgba(255,240,210,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-R * 0.55, hc * 0.45); g.quadraticCurveTo(0, -2, R * 0.5, hc * 0.4); g.stroke();
      g.strokeStyle = 'rgba(70,36,12,0.6)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(0, hc, R, ry, 0, 0, PI); g.stroke();
    } else {
      g.fillStyle = gr; dome(true); g.fill();
      // 伞里：深一层的油纸，伞骨从中心散开
      g.fillStyle = K.rad(g, 0, hc, 0, R, [[0, mix(col, '#2a1408', 0.55)], [1, mix(col, '#2a1408', 0.25)]]);
      g.beginPath(); g.ellipse(0, hc, R, ry, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,20,8,0.7)'; g.lineWidth = 1.2;
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; g.beginPath(); g.moveTo(0, hc); g.lineTo(R * Math.cos(a), hc + ry * Math.sin(a)); g.stroke(); }
      g.strokeStyle = 'rgba(255,220,170,0.3)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, hc, R, ry, 0, 0, TAU); g.stroke();
      g.save(); g.translate(0, hc); stick(); g.restore();
    }
    g.restore();
  }
  XYT.registerShot('vb24_signpost', {
    name: '路标无人', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(236,242,238,0.9)', accent: '#a8551e', bloom: 0.25,
    draw(g, c) {
      const t = c.t, lt = Math.max(0, c.lt), id = 'vb24_signpost';
      const tg = chr(c, id, 4), c5 = chr(c, id, 5), c7 = chr(c, id, 7);
      const dg = lt - tg;
      const gust = ss(-0.1, 0.15, dg) * (1 - 0.55 * ss(0.8, 2.2, dg));
      g.drawImage(vb24Back(), 0, 0);
      if (gust > 0.02) E.mist(g, { t, y: HZ24 - 10, h: 110, color: '#d2dcd6', alpha: 0.35 * gust, speed: -60 * gust });
      // 左路尽头的孤柳：起风时柳丝一齐甩向左边
      g.save(); g.translate(230, 0); g.scale(-1, 1);
      E.willow(g, { x: 0, y: HZ24 + 3, s: 0.25, alpha: 0.6, t, wind: 0.35 + 0.9 * gust, n: 30, color: '#6a8466', ink: '#3e4a46', seed: 5 });
      g.restore();
      // 水洼里随拍起涟漪
      const bt = [c.grid.time(c.b.i), c.grid.time(c.b.i - 1), c.grid.time(c.b.i - 2)];
      for (const [x, y, rx] of PUD24) if (rx >= 40) E.ripples(g, { x, y, t, t0: bt, life: 1.6, scale: rx / 110, color: '#eef2ee', alpha: 0.6, rings: 2 });
      V.ripples(g, c, { rain: 10, area: [480, 690, 640, 712], r: 16, life: 0.8, rings: 1, alpha: 0.35, color: '#eef2ee', seed: 3 });
      // 路两边的草在雨里伏倒
      const wind = 0.35 + 1.1 * gust;
      for (let i = 0; i < 48; i++) {
        const y = HZ24 + 30 + Math.pow(h2(i, 42), 0.8) * 160, x = h2(i, 41) * W;
        const k = (y - HZ24) / (H - HZ24), half = 300 * k + 40, cx = lerp(620, 600, k);
        if (Math.abs(x - cx) < half || (x > 900 && y > 590)) continue;
        const len = 14 + k * 40 + h2(i, 43) * 18, bend = -(Math.sin(t * 2 + i) * 0.25 + 0.4 + 0.5 * gust) * wind * len * 0.55;
        blade(g, x, y, len * (1 - 0.3 * gust), 1 + k * 2, bend, rgba(i % 3 ? '#26342a' : '#4a5c4c', 0.85));
      }
      // 路标：想法太多每个字吱呀一晃；“由”字被风猛地一扯
      let creak = 0;
      for (let k = 0; k < 4; k++) { const d = lt - chr(c, id, k); if (d > 0) creak += Math.exp(-d / 0.35) * Math.sin(d * 16); }
      const jolt = dg > 0 ? Math.exp(-dg / 0.3) * Math.sin(dg * 26) : 0;
      const sway = 0.018 * Math.sin(t * 1.7) + 0.045 * creak + 0.11 * jolt + 0.05 * gust * Math.sin(t * 9);
      g.save(); g.translate(331, 230); g.rotate(-0.06 + sway); g.scale(1.18, 1.18);
      g.drawImage(vb24Arm(-1), -244, -30, 250, 60); g.restore();
      g.save(); g.translate(331, 330); g.rotate(0.05 - sway * 0.8); g.scale(1.14, 1.14);
      g.drawImage(vb24Arm(1), -6, -30, 250, 60); g.restore();
      // 他：坐在路口的石头上；伞斜靠肩头。“由”字伞被卷走，“不”字转头去看，“我”字头垂得更低
      const look = ss(c5 - 0.05, c5 + 0.12, lt) * (1 - ss(c7 - 0.05, c7 + 0.15, lt)), droop = ss(c7 - 0.05, c7 + 0.2, lt);
      const fo = { stage: 'old', facing: -1, pose: 'sit', seat: 'ledge', prop: 'none', windDir: -1, wind: 0.3 + 0.6 * gust,
        head: 0.22 - 0.47 * look + 0.28 * droop, lean: 0.06 + 0.09 * droop, rim: '#e8f0ee', light: [600, 120], rimAlpha: 0.6, night: false };
      const { x: FX, y: FY, s: FS } = FIG24;
      const P = F.points('xiaoyao', FX, FY, FS, t, fo);
      const R = 128, col = '#e29c45';
      const C0 = [P.head[0] + 40, P.head[1] - 104], Hn = P.handN;
      const shaft = Math.hypot(Hn[0] - C0[0], Hn[1] - C0[1]), rot0 = Math.atan2(-(Hn[0] - C0[0]), Hn[1] - C0[1]);
      F.draw(g, 'xiaoyao', FX, FY, FS, t, fo);
      g.drawImage(vb24Lip(), 816, 520);
      const umb = (u, a) => {
        // 伞被风扯离手心，翻滚着向左飞出画面，经过路标时离镜头更近
        const x = C0[0] - (380 * u + 210 * u * u) - 20 * ss(0, 0.12, u);
        const y = C0[1] - 50 * ss(0, 0.2, u) - 30 * u + 60 * u * u + 18 * Math.sin(u * 5);
        const rot = rot0 + 1.7 * Math.sin(u * 2.7) * ss(0, 0.25, u) + 0.55 * u, el = clamp(0.2 + 0.4 * Math.sin(u * 3.4 + 0.3) - 0.3 * ss(0, 0.15, u) * (1 - ss(0.15, 0.4, u)), -0.35, 0.6);
        const RR = R * (1 + 0.3 * ss(0.5, 1.25, u));
        if (x > -RR * 1.4) { g.globalAlpha = a; oilUmbrella(g, x, y, RR, rot, el, shaft * 0.75, col, 1, a < 1); g.globalAlpha = 1; }
      };
      if (dg < 0) {
        oilUmbrella(g, C0[0], C0[1], R, rot0 + 0.02 * Math.sin(t * 2.1), -0.16, shaft, col, 0);
        // 雨点打在伞面上
        g.fillStyle = 'rgba(240,244,240,0.75)';
        for (let i = 0; i < 7; i++) {
          const k = Math.floor(t * 14) * 7 + i, a = PI + h2(k, 3) * PI;
          const hc = 0.5 * R * Math.cos(0.16 * PI / 2), ryy = Math.sin(0.16 * PI / 2) * R + 3;
          const px = R * Math.cos(a), py = hc + ryy * Math.sin(a) - 2;
          const cs = Math.cos(rot0), sn = Math.sin(rot0);
          g.fillRect(C0[0] + px * cs - py * sn - 1, C0[1] + px * sn + py * cs - 2, 2, 2);
        }
      } else {
        umb(Math.max(0, dg - 0.06), 0.15); umb(Math.max(0, dg - 0.03), 0.15); umb(dg, 1);
        // 雨直接打在他头上、肩上，溅起细水
        const n = 26, tq = Math.floor(lt * n);
        for (let j = 0; j < 14; j++) {
          const k = tq - j, age = lt - k / n;
          if (k / n < tg + 0.05) break;
          const pick = h2(k, 5), a = PI * (1.05 + 0.9 * h2(k, 6));
          let hx, hy;
          if (pick < 0.55) { hx = P.head[0] + Math.cos(a) * 24; hy = P.head[1] + Math.sin(a) * 26; }
          else { const S2 = pick < 0.8 ? P.shoulderN : P.shoulderF; hx = S2[0] + (h2(k, 7) - 0.5) * 50; hy = S2[1] - 8 + h2(k, 8) * 6; }
          splash(g, hx, hy, age, 0.5, 'rgba(238,244,242,0.9)', k);
        }
      }
      // 近景的长草：低机位下又大又虚，起风时伏倒
      for (let i = 0; i < 18; i++) {
        const x = h2(i, 81) * W, y = H + 6, len = 70 + h2(i, 82) * 90;
        if (x > 816) continue;
        const bend = -(Math.sin(t * 1.8 + i * 1.3) * 0.25 + 0.4 + 0.45 * gust) * wind * len * 0.5;
        blade(g, x, y, len * (1 - 0.25 * gust), 3 + h2(i, 83) * 3, bend, rgba('#1a2620', 0.9));
      }
      // 雨：起风时斜得更狠
      V.rain(g, c, { n: 240, angle: -0.12 - 0.3 * gust, speed: 1100, len: 46, color: '#eef3f0', alpha: 0.42, ground: 640, splash: 30 });
      // 阵风的雨幕：一道更密更亮的斜雨从右往左扫过画面
      const gf = dg / 0.45;
      if (gf > -0.05 && gf < 1.25) {
        const fx = W + 80 - (W + 520) * gf;
        g.save(); g.lineCap = 'round';
        for (let i = 0; i < 110; i++) {
          const x = fx + h2(i, 91) * 380, y = ((h2(i, 92) * (H + 160) + t * 1700) % (H + 160)) - 80;
          const e = 1 - Math.abs(x - fx - 190) / 190;
          if (e <= 0 || x < -40 || x > W + 40) continue;
          const len = 40 + h2(i, 93) * 50;
          g.strokeStyle = `rgba(244,248,246,${(0.6 * e).toFixed(3)})`; g.lineWidth = 1 + h2(i, 94) * 1.4;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(0.5) * len, y - Math.cos(0.5) * len); g.stroke();
        }
        const ga = (0.14 * Math.sin(PI * clamp(gf))).toFixed(3);
        g.fillStyle = K.lin(g, fx, 0, fx + 380, 0, [[0, 'rgba(230,238,236,0)'], [0.5, `rgba(230,238,236,${ga})`], [1, 'rgba(230,238,236,0)']]);
        g.fillRect(fx, 0, 380, H);
        g.restore();
      }
      // 被风卷起的落叶
      if (gust > 0.05) {
        for (let i = 0; i < 14; i++) {
          const u2 = dg - h2(i, 9) * 0.6;
          if (u2 < 0 || u2 > 2.2) continue;
          const x = 1320 - (520 + 320 * h2(i, 1)) * u2, y = 360 + h2(i, 2) * 320 + Math.sin(u2 * 6 + i) * 30;
          g.save(); g.translate(x, y); g.rotate(u2 * 8 + i); g.scale(1, Math.cos(u2 * 9 + i));
          g.fillStyle = i % 3 ? '#4e6248' : '#8a7a4a'; g.beginPath(); g.ellipse(0, 0, 6, 2.6, 0, 0, TAU); g.fill(); g.restore();
        }
      }
    },
  });

  // =====================================================================
  // 第29句 第13句 —— 剑落晨崖：崖下仰拍；剑浮起几寸又跌落，第一道金光只照亮空天
  // =====================================================================
  // 崖顶边线与右侧崖壁（仰拍：崖顶在上，崖壁一直落到画框底）
  const CLIFF = [[-30, 342], [70, 336], [170, 346], [270, 362], [350, 370], [430, 368], [500, 376], [552, 384], [578, 398],
    [566, 440], [596, 500], [584, 560], [612, 630], [598, 690], [626, 760], [-30, 760]];
  const NTOP = 9;
  const cliffY = (x) => {
    for (let i = 0; i < NTOP - 1; i++) { const [x0, y0] = CLIFF[i], [x1, y1] = CLIFF[i + 1]; if (x >= x0 && x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0)); }
    return 390;
  };
  const SUN25 = [1150, 735], PINE25 = [566, 400];
  // 松针团（仿车轮松针）：底下一层淡墨，上面一簇簇放射的松针，顶缘一抹粉光
  function pinePad(q, x, y, s, r, col, dark, lite) {
    q.fillStyle = rgba(dark, 0.6); q.beginPath();
    for (let k = 0; k < 6; k++) { const px = x + (k / 5 - 0.5) * 80 * s + (r() - 0.5) * 8 * s, rx = (12 + r() * 12) * s, ry = (5 + r() * 5) * s, py = y + 3 * s - Math.sin((k / 5) * PI) * 5 * s; q.moveTo(px + rx, py); q.ellipse(px, py, rx, ry, 0, 0, TAU); }
    q.fill();
    const nt = 5 + Math.floor(r() * 3);
    for (let f = 0; f < nt; f++) {
      const fx = x + (f / (nt - 1) - 0.5) * 78 * s + (r() - 0.5) * 8 * s, fy = y - Math.sin((f / (nt - 1)) * PI) * 7 * s + (r() - 0.5) * 4 * s, L = (13 + r() * 7) * s;
      q.fillStyle = rgba(dark, 0.9); q.beginPath(); q.ellipse(fx, fy + 2 * s, L * 0.95, L * 0.4, 0, 0, TAU); q.fill();
      q.lineWidth = 0.9;
      for (let k = 0; k < 15; k++) {
        const a = PI * 1.02 + (k / 14) * PI * 0.96;
        q.strokeStyle = k % 3 === 0 && a > PI * 1.2 && a < PI * 1.8 ? rgba(lite, 0.7) : rgba(col, 0.95);
        q.beginPath(); q.moveTo(fx, fy + 2 * s); q.lineTo(fx + Math.cos(a) * L, fy + 2 * s + Math.sin(a) * L * 0.6); q.stroke();
      }
    }
  }
  // 探崖松：树干从崖角斜探向空天，针叶团平铺成几层；后层淡、前层浓
  function vb25Pine() {
    return K.cache('g09_vb25_pine', 420, 270, 1, (q) => {
      q.translate(40, 230);
      const r = A.rng(255);
      q.lineCap = 'round'; q.strokeStyle = '#1c1824';
      const trunk = [[0, 0], [40, -6], [70, -40], [120, -62], [190, -78], [250, -110]];
      for (let i = 0; i < trunk.length - 1; i++) { q.lineWidth = lerp(15, 4, i / (trunk.length - 1)); q.beginPath(); q.moveTo(trunk[i][0], trunk[i][1]); q.lineTo(trunk[i + 1][0], trunk[i + 1][1]); q.stroke(); }
      q.strokeStyle = 'rgba(255,206,220,0.45)'; q.lineWidth = 2; q.beginPath(); trunk.forEach(([x, y], i) => (i ? q.lineTo(x - 1, y - 5) : q.moveTo(x, y - 6))); q.stroke();
      q.strokeStyle = '#1c1824';
      for (const [x0, y0, x1, y1, w] of [[70, -40, 60, -96, 4], [120, -62, 150, -124, 4.5], [190, -78, 220, -150, 3.5], [40, -6, 30, -34, 3]]) { q.lineWidth = w; q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo((x0 + x1) / 2 + 10, (y0 + y1) / 2, x1, y1); q.stroke(); }
      // 后层：淡紫，像隔着一层晨雾
      for (const [x, y, s2] of [[110, -150, 0.9], [210, -170, 0.75], [40, -110, 0.7]]) pinePad(q, x, y, s2, r, '#6c6884', '#7a7690', '#f0d0dc');
      for (const [x, y, s2] of [[250, -116, 1.0], [150, -128, 1.05], [62, -98, 0.8], [222, -152, 0.8], [26, -36, 0.6], [300, -96, 0.55]]) pinePad(q, x, y, s2, r, '#2a2838', '#1a1826', '#ffc8d8');
    });
  }
  function vb25Sky() {
    return K.cache('g09_vb25_sky2', W, H, 1, (q) => {
      // 右边的空天先冷而暗（金光到来前），左边崖后透一点粉色晨光
      q.fillStyle = K.lin(q, 0, 0, 0, H, [[0, '#7f93bb'], [0.55, '#a8a8c8'], [1, '#c8b6cc']]); q.fillRect(0, 0, W, H);
      q.globalCompositeOperation = 'screen';
      q.fillStyle = K.rad(q, 260, 470, 40, 760, [[0, 'rgba(255,196,206,0.7)'], [0.45, 'rgba(240,170,190,0.28)'], [1, 'rgba(240,170,190,0)']]); q.fillRect(0, 0, W, H);
      q.fillStyle = K.lin(q, 0, 520, 0, H, [[0, 'rgba(255,214,206,0)'], [1, 'rgba(255,214,206,0.35)']]); q.fillRect(0, 520, W, 200);
      q.globalCompositeOperation = 'source-over';
      // 将尽的晨星
      const r = A.rng(29);
      for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * 300, a = 0.15 + r() * 0.35; q.fillStyle = `rgba(255,250,255,${a.toFixed(2)})`; q.fillRect(x, y, 1.4, 1.4); }
      // 高天的薄云：长条，淡紫
      for (let i = 0; i < 14; i++) {
        const x = 560 + r() * 820, y = 140 + r() * 420, w = 180 + r() * 380, h = 7 + r() * 16;
        q.fillStyle = K.lin(q, 0, y - h, 0, y + h, [[0, 'rgba(236,220,236,0)'], [0.45, 'rgba(236,220,236,0.42)'], [0.7, 'rgba(176,160,196,0.32)'], [1, 'rgba(176,160,196,0)']]);
        q.beginPath(); q.ellipse(x, y, w / 2, h, -0.04, 0, TAU); q.fill();
      }
      // 崖下极远处的天雾
      q.fillStyle = K.lin(q, 0, 560, 0, H, [[0, 'rgba(236,214,226,0)'], [1, 'rgba(236,214,226,0.6)']]); q.fillRect(0, 560, W, 160);
    });
  }
  // 整屏底图：天 + 探崖松 + 崖壁（金光层另贴，并在松影处挖空）
  function vb25Back() {
    return K.cache('g09_vb25_back', W, H + 10, 1, (q) => {
      q.translate(0, 10);
      q.drawImage(vb25Sky(), 0, -10, W, H + 10);
      q.drawImage(vb25Pine(), PINE25[0] - 40, PINE25[1] - 230);
      q.drawImage(vb25Cliff(), -30, 322);
    });
  }
  // 金光层：只铺右半边（W/2 宽），一次画好；逐帧只改透明度和展开
  function vb25Gold() {
    return K.cache('g09_vb25_gold2', W / 2, H, 1, (q) => {
      q.translate(-W / 2, 0);
      const [sx, sy] = SUN25;
      q.fillStyle = K.rad(q, 1180, 760, 0, 900, [[0, 'rgba(255,214,130,0.95)'], [0.25, 'rgba(255,186,96,0.72)'], [0.6, 'rgba(236,160,90,0.34)'], [1, 'rgba(236,160,90,0)']]);
      q.fillRect(W / 2, 0, W / 2, H);
      // 薄云被点成金边
      const r = A.rng(29);
      for (let i = 0; i < 40; i++) { r(); r(); r(); }
      for (let i = 0; i < 14; i++) {
        const x = 560 + r() * 820, y = 140 + r() * 420, w = 180 + r() * 380, h = 7 + r() * 16;
        q.fillStyle = K.lin(q, 0, y - h, 0, y + h, [[0, 'rgba(255,240,190,0)'], [0.4, 'rgba(255,236,170,0.75)'], [0.7, 'rgba(255,190,90,0.45)'], [1, 'rgba(255,190,90,0)']]);
        q.beginPath(); q.ellipse(x, y, w / 2, h, -0.04, 0, TAU); q.fill();
      }
      // 丁达尔光：从日边向左上张开的扇形
      q.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const a = -PI / 2 - 0.66 + (i / 13) * 1.0 + (h2(i, 3) - 0.5) * 0.05, w = 0.012 + 0.03 * h2(i, 4), L = 800 + 400 * h2(i, 5), al = 0.16 + 0.16 * h2(i, 6);
        q.fillStyle = K.lin(q, sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, [[0, `rgba(255,206,120,${al})`], [0.45, `rgba(255,190,100,${al * 0.4})`], [1, 'rgba(255,190,100,0)']]);
        q.beginPath(); q.moveTo(sx, sy); q.lineTo(sx + Math.cos(a - w) * L, sy + Math.sin(a - w) * L); q.lineTo(sx + Math.cos(a + w) * L, sy + Math.sin(a + w) * L); q.closePath(); q.fill();
      }
      // 松影处挖空：金光只落在空天上
      q.globalCompositeOperation = 'destination-out';
      q.drawImage(vb25Pine(), PINE25[0] - 40, PINE25[1] - 230);
      // 左缘羽化，免得半屏贴图露出直边
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = K.lin(q, W / 2, 0, W / 2 + 220, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]); q.fillRect(W / 2, 0, W / 2, H);
      q.globalCompositeOperation = 'source-over';
    });
  }
  function vb25Cliff() {
    return K.cache('g09_vb25_cliff2', 680, 440, 1, (q) => {
      q.translate(30, -322);
      const shape = () => { q.beginPath(); CLIFF.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.closePath(); };
      q.fillStyle = K.lin(q, 0, 340, 0, 770, [[0, '#4c4a64'], [0.3, '#383a52'], [1, '#22263a']]);
      shape(); q.fill();
      q.save(); shape(); q.clip();
      const r = A.rng(25);
      // 岩理借石笋的皴法：一大一小两根石笋的中段，裁进崖形里
      E.stonePeak(q, { x: 250, y: 1080, h: 1150, w: 760, color: '#4a4862', light: '#e2bcd0', mist: false, haze: '#d8c4d4', seed: 12 });
      E.stonePeak(q, { x: 560, y: 980, h: 760, w: 240, color: '#3e3c56', light: '#dcb4ca', mist: false, haze: '#d8c4d4', seed: 19 });
      // 斧劈皴：几笔斜下的重墨尖楔
      for (let i = 0; i < 50; i++) {
        const x = r() * 620 - 30, y = cliffY(clamp(x, -30, 578)) + 10 + r() * 340, len = 30 + r() * 80, w = 3 + r() * 8, a = 1.8 + (r() - 0.5) * 0.4;
        q.fillStyle = K.lin(q, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, [[0, 'rgba(14,12,26,0.45)'], [1, 'rgba(14,12,26,0)']]);
        q.beginPath(); q.moveTo(x, y); q.lineTo(x + w, y + w * 0.3); q.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); q.closePath(); q.fill();
      }
      // 整体压暗一点（逆着天光）
      q.fillStyle = 'rgba(30,28,52,0.28)'; q.fillRect(-40, 300, 700, 470);
      // 崖顶下的阴影、崖脚升起的晨雾
      q.fillStyle = K.lin(q, 0, 350, 0, 420, [[0, 'rgba(10,10,20,0.4)'], [1, 'rgba(10,10,20,0)']]); q.fillRect(-40, 340, 700, 80);
      q.fillStyle = K.lin(q, 0, 600, 0, 770, [[0, 'rgba(232,206,222,0)'], [1, 'rgba(232,206,222,0.55)']]); q.fillRect(-40, 600, 700, 170);
      q.restore();
      // 崖顶边缘与右壁受天光的粉边
      q.strokeStyle = 'rgba(255,214,226,0.85)'; q.lineWidth = 2.2;
      q.beginPath(); for (let i = 0; i < NTOP; i++) { const [x, y] = CLIFF[i]; i ? q.lineTo(x, y) : q.moveTo(x, y); } q.stroke();
      q.strokeStyle = 'rgba(255,214,226,0.45)'; q.lineWidth = 1.8;
      q.beginPath(); for (let i = NTOP - 1; i < CLIFF.length - 1; i++) { const [x, y] = CLIFF[i]; i > NTOP - 1 ? q.lineTo(x, y) : q.moveTo(x, y); } q.stroke();
      // 崖顶一排枯草剪影
      for (let i = 0; i < 70; i++) {
        const x = -20 + r() * 590, y = cliffY(x) + 2, len = 6 + r() * 16, b = (r() - 0.4) * len * 0.6;
        q.strokeStyle = rgba(r() < 0.6 ? '#2a2a3a' : '#3c3a4c', 0.95); q.lineWidth = 1 + r();
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + b * 0.3, y - len * 0.6, x + b, y - len); q.stroke();
      }
    });
  }
  // 近景草丛（贴图，原点在根部）：又大又虚的剪影，叶尖挂露
  const CLUMPS = [[96, 726, 1, 251], [212, 736, 0.8, 252], [700, 730, 0.95, 253]];
  function vb25Clump(seed) {
    return K.cache('g09_vb25_clump' + seed, 220, 230, 1, (q) => {
      q.translate(110, 226);
      const r = A.rng(seed);
      for (let i = 0; i < 16; i++) {
        const a = -PI / 2 + (r() - 0.5) * 1.3, len = 120 + r() * 90, w = 2.5 + r() * 3, bend = (r() - 0.5) * 50;
        q.fillStyle = rgba(r() < 0.5 ? '#141420' : '#1e1e2c', 0.92);
        const tx = Math.cos(a) * len + bend, ty = Math.sin(a) * len;
        q.beginPath(); q.moveTo(-w, 0); q.quadraticCurveTo(tx * 0.4 - w, ty * 0.55, tx, ty); q.quadraticCurveTo(tx * 0.4 + w, ty * 0.55, w, 0); q.closePath(); q.fill();
      }
    });
  }
  // 叶尖的露珠位置（与贴图同种子）
  function clumpTips(seed) {
    const r = A.rng(seed), out = [];
    for (let i = 0; i < 16; i++) {
      const a = -PI / 2 + (r() - 0.5) * 1.3, len = 120 + r() * 90; r(); const bend = (r() - 0.5) * 50; r();
      out.push([Math.cos(a) * len + bend, Math.sin(a) * len]);
    }
    return out;
  }
  const TIPS25 = CLUMPS.map((c0) => clumpTips(c0[3]));
  XYT.registerShot('vb25_cliff', {
    name: '剑落晨崖', zone: 'right', night: false, text: '#1a2026', shadow: 'rgba(255,242,242,0.85)', accent: '#b07a1e', bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = Math.max(0, c.lt), id = 'vb25_cliff';
      const ct = [0, 1, 2, 3, 4, 5, 6].map((k) => chr(c, id, k)), c4 = ct[4], c5 = ct[5], c6 = ct[6];
      const land = c5;
      // 镜头：固定仰拍，缓缓升起（整像素平移，贴图走快路）；剑落地时一震
      const SS = (XYT.sprites && XYT.sprites.S) || 1;
      const shk = lt > land && lt < land + 0.12 ? (1 - (lt - land) / 0.12) * 2 : 0;
      const dy = Math.round((6 * clamp(lt / c.dur) + shk * Math.sin(lt * 140)) * SS) / SS, dx = Math.round(shk * Math.cos(lt * 170) * SS) / SS;
      g.save(); g.translate(dx, dy);
      g.drawImage(vb25Back(), 0, -10);
      // 第一道金光：“酬”字从右下地平线后涌上来，只照亮右边的空天
      const gold = ss(c6 - 0.05, c6 + 0.5, lt);
      if (gold > 0.003) {
        const gk = easeOut(clamp((lt - c6 + 0.05) / 0.5));
        g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = gold * (0.92 + 0.08 * Math.sin(t * 2.3));
        if (gk < 0.999) { g.translate(1180, 760); g.scale(lerp(0.15, 1, gk), lerp(0.15, 1, gk)); g.translate(-1180, -760); }
        g.drawImage(vb25Gold(), W / 2, 0); g.restore();
        E.sun(g, { x: SUN25[0], y: SUN25[1], r: 40, sink: 722, color: '#ffb850', glow: 0.8, alpha: gold });
      }
      E.mist(g, { t, y: 700, h: 110, color: '#f2dce4', alpha: 0.4, speed: 6 });
      // 人：立在崖边，伸手向天；剑从掌心颤抖着浮起，一字高一分
      const FX = 330, FY = cliffY(330) + 1, FS = 1.5;
      const fallen = lt >= land;
      const base = { stage: 'old', facing: 1, prop: 'none', wind: 0.5, tone: 'silhouette', ink: '#2a2a3a', whiteHair: true, rim: '#ffd0dc', light: [900, 300], rimAlpha: 1, rimWidth: 1.6 };
      const fo = fallen ? Object.assign({ pose: 'stand', head: 0.62, lean: 0.12 }, base) : Object.assign({ pose: 'reach', lean: -0.04 }, base);
      const P = F.points('xiaoyao', FX, FY, FS, t, Object.assign({}, base, { pose: 'reach', lean: -0.04 }));
      const hx = P.handN[0], hy = P.handN[1];
      let rise = 0;
      [12, 24, 36, 44].forEach((h, k) => { rise = Math.max(rise, h * easeOut(clamp((lt - ct[k] + 0.04) / 0.16))); });
      const lift = lt < c4 ? rise : 0, trem = lt < c4 ? (rise > 0 ? 0.8 + rise / 12 : 0) : 0;
      const SL = 112, A0 = PI / 2 - 0.32;
      let sx = hx - 26 + Math.sin(t * 61) * trem, sy = hy - 6 - lift + Math.cos(t * 53) * trem * 0.7, sa = A0 + 0.02 * Math.sin(t * 37) * trem;
      let gl = lt < c4 ? clamp(rise / 30) * (0.75 + 0.25 * Math.sin(t * 40)) : 0;
      if (lt > ct[3] && lt < c4) gl *= 0.65 + 0.35 * Math.sin(t * 75);
      const LX = 420, LY = cliffY(420) - 3;
      if (lt >= c4) {
        // 几：剑光一灭，直直坠下；分：砸在崖沿上弹起
        const y0 = hy - 6 - 44;
        if (lt < land) {
          const u = (lt - c4) / (land - c4);
          sx = lerp(hx - 26, LX - 50, u); sy = lerp(y0, LY - 4, u * u); sa = lerp(A0, PI / 2 + 0.05, u * u) + 0.3 * Math.sin(u * PI);
        } else {
          const e = lt - land, hop = Math.max(0, Math.sin(Math.min(1, e / 0.26) * PI)) * 18 * Math.exp(-e * 2) + Math.max(0, Math.sin(clamp((e - 0.26) / 0.16) * PI)) * 5;
          sx = LX - 50 + 18 * ss(0, 0.5, e); sy = LY - 4 - hop; sa = PI / 2 + 0.05 + 0.28 * Math.exp(-e * 5) * Math.cos(e * 24);
        }
      }
      F.draw(g, 'xiaoyao', FX, FY, FS, t, fo);
      if (lt < c4 && rise > 0) {
        // 掌心与剑之间一圈气：几粒小光点绕着转
        V.glowOrbs(g, c, { mode: 'orbit', x: hx - 2, y: hy - 4 - lift * 0.5, r: 18, tilt: 0.4, n: 6, speed: 4, size: 2.4, trail: 4, colors: ['#e8f6ff', '#ffe6f0', '#d8eeff'], alpha: 0.8 * clamp(rise / 20), blend: 'screen', beat: 0.3 });
      }
      steelSword(g, sx, sy, sa, SL, gl, t);
      // 当啷：火星、一小团石粉
      V.sparks(g, c, { at: land, x: LX - 30, y: LY, angle: -PI / 2, spread: 2.4, n: 30, speed: 240, gravity: 700, dur: 0.6, color: '#ffe0a0', size: [1, 2.6] });
      V.smoke(g, c, { kind: 'puff', at: land, x: LX - 30, y: LY - 2, w: 50, n: 5, size: 22, rise: 26, life: 0.9, drift: 18, color: '#d8c8d0', alpha: 0.5 });
      // 近景草丛与露珠：“分”字一震，露珠打颤；“酬”字落下，穿过金光时一闪
      const shake = lt > land ? Math.exp(-(lt - land) / 0.25) * Math.sin((lt - land) * 40) : 0;
      CLUMPS.forEach(([x, y, s, seed], ci) => {
        const sw = 0.03 * Math.sin(t * 1.4 + ci) + 0.05 * shake;
        g.save(); g.translate(x, y); g.rotate(sw); g.scale(s, s);
        g.drawImage(vb25Clump(seed), -110, -226, 220, 230);
        g.restore();
        TIPS25[ci].forEach(([tx0, ty0], i) => {
          if ((i + ci) % 4) return;
          const cs = Math.cos(sw), sn = Math.sin(sw), px = x + (tx0 * cs - ty0 * sn) * s, py = y + (tx0 * sn + ty0 * cs) * s;
          const d = lt - c6 - h2(i, ci + 7) * 0.25, fall = d > 0 ? 0.5 * 1800 * d * d : 0;
          if (fall > 300) return;
          const dy2 = py + 4 + fall, inGold = x > 600 && gold > 0.2;
          const r0 = 2.2 + 1.2 * h2(i, ci);
          g.fillStyle = 'rgba(250,246,255,0.85)'; g.beginPath(); g.ellipse(px, dy2, r0, r0 * (1 + Math.min(0.8, fall / 40)), 0, 0, TAU); g.fill();
          g.save(); g.globalCompositeOperation = 'screen';
          glow(g, px, dy2, 8 + r0 * 2.5, d > 0 && inGold ? '#ffd27a' : '#ffe8f4', d > 0 ? (inGold ? 0.95 : 0.5) : 0.18);
          g.restore();
        });
      });
      // 崖边草叶上的露水也被震落
      for (let i = 0; i < 9; i++) {
        const x = 240 + h2(i, 51) * 320, y0 = cliffY(x) - 8 - h2(i, 52) * 10, d = lt - c6 - h2(i, 54) * 0.2;
        const yy = y0 + (d > 0 ? 0.5 * 1600 * d * d : 0) + (d <= 0 ? shake * 1.5 : 0);
        if (yy - y0 > 200) continue;
        g.save(); g.globalCompositeOperation = 'screen'; glow(g, x, yy, 5, d > 0 ? '#ffd27a' : '#ffe8f0', d > 0 ? 0.8 : 0.4); g.restore();
      }
      V.bokeh(g, c, { n: 6, area: [640, 200, 1280, 700], colors: ['#ffe6c0', '#ffd0dc'], size: [30, 80], alpha: 0.1 + 0.12 * gold, seed: 25 });
      g.restore();
    },
  });

  // =====================================================================
  // 第30句 第14句 —— 灰烬五座：霜夜冷灰，俯身给每块石座斟一杯；比翼鸟掠过
  // =====================================================================
  const RING = [800, 604], RRX = 150, RRY = 40;
  const SEATS = [
    { x: 512, y: 598, w: 92, h: 52, cup: 1, seed: 1, mark: 'ribbon', col: '#d7c3ee' },   // 灵儿：淡紫发带
    { x: 582, y: 562, w: 80, h: 46, cup: 1, seed: 2, mark: 'tassel', col: '#e2322f' },   // 月如：红剑穗
    { x: 660, y: 542, w: 74, h: 42, cup: 1, seed: 3, mark: 'bell', col: '#e2e6ee' },     // 阿奴：苗银铃
    { x: 744, y: 532, w: 70, h: 40, cup: 1, seed: 4, mark: 'ribbon', col: '#2f9ab2' },   // 唐钰：青蓝发带
    { x: 912, y: 538, w: 72, h: 40, cup: 1, seed: 5, mark: 'fan', col: '#eef3ee' },      // 晋元：素扇（先已斟满）
    { x: 1004, y: 616, w: 104, h: 56, cup: -1, seed: 6 },                                // 他自己的座：杯倒扣
  ];
  // 推近的镜头：围着 (640,560) 放大 Z26；大贴图按 Z26 烘焙，贴的时候一像素对一像素
  const Z26 = 1.3, GX0 = 100, GX1 = 1350, GY0 = 284, GY1 = 700, GW26 = GX1 - GX0, GH26 = GY1 - GY0;
  // 星空、银河、天边远山与霜林，连同夜色调子一起烘焙（屏幕空间，只占上面三成）
  function vb26Sky() {
    return K.cache('g09_vb26_sky2', W + 80, 240, 1, (q) => {
      q.fillStyle = K.lin(q, 0, 0, 0, 240, [[0, '#03060d'], [0.55, '#0c1424'], [0.85, '#1e2a3e'], [1, '#2c3c54']]); q.fillRect(0, 0, W + 80, 240);
      E.stars(q, { t: 0, n: 220, seed: 30, maxY: 220, twinkle: 0, alpha: 0.85, milky: true, milkyX: 470, milkyY: 90, milkyAngle: -0.2, milkyColor: '#8aa0d0' });
      q.fillStyle = K.lin(q, 0, 130, 0, 210, [[0, 'rgba(40,56,80,0)'], [1, 'rgba(66,86,116,0.6)']]); q.fillRect(0, 130, W + 80, 110);
      E.mountains(q, { t: 0, lightDir: 1, layers: [
        { kind: 'far', color: '#1e2a3c', alpha: 1, y: 196, scaleY: 0.2, seed: 33, light: '#5a6a88', litA: 0.25, fog: '#3a4a62', fogA: 0.4 },
        { kind: 'mid', color: '#1a2434', alpha: 1, y: 208, scaleY: 0.12, seed: 35, fog: '#2c3c54', fogA: 0.5 },
      ] });
      V.grade(q, 'night', 0.25);
    });
  }
  // 贴图快路：只有平移缩放、贴图像素与目标一致时，对齐整像素直接拷贝
  function blit(g, img, x, y, w, h) {
    const m = g.getTransform();
    if (m.b === 0 && m.c === 0 && Math.abs(m.a * w - img.width) < 0.6 && Math.abs(m.d * h - img.height) < 0.6) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(img, Math.round(m.a * x + m.e), Math.round(m.d * y + m.f)); g.setTransform(m);
    } else g.drawImage(img, x, y, w, h);
  }
  // 一块平顶的石座：每块形状不同，顶面一道断续的霜边，零星霜点
  function seatTex(S) {
    return K.cache('g09_vb26_seat' + S.seed, S.w + 30, S.h + 30, 1.5, (q) => {
      q.translate(15 + S.w / 2, 15 + S.h);
      const r = A.rng(260 + S.seed * 7), w = S.w / 2, h = S.h;
      const tl = (r() - 0.5) * 10, P = [];
      // 轮廓：底宽、一侧鼓出一侧收进，顶面歪斜而平，边上有缺口
      const bulgeL = 0.9 + r() * 0.3, bulgeR = 0.9 + r() * 0.3;
      P.push([-w * (0.85 + r() * 0.15), 0]);
      P.push([-w * bulgeL, -h * (0.25 + r() * 0.15)]);
      P.push([-w * (bulgeL - 0.05 - r() * 0.1), -h * (0.62 + r() * 0.12)]);
      P.push([-w * (0.78 + r() * 0.12), -h + tl - r() * 4]);
      P.push([-w * (0.1 + r() * 0.2), -h - 2 + tl * 0.4 - r() * 4]);
      P.push([w * (0.3 + r() * 0.2), -h - 1 - tl * 0.4 - r() * 4]);
      P.push([w * (0.72 + r() * 0.15), -h - tl + r() * 3]);
      P.push([w * bulgeR, -h * (0.55 + r() * 0.15)]);
      P.push([w * (bulgeR + 0.04), -h * (0.2 + r() * 0.12)]);
      P.push([w * (0.8 + r() * 0.15), 0]);
      q.fillStyle = 'rgba(0,0,0,0.38)'; q.beginPath(); q.ellipse(6, 2, w * 1.15, 7, 0, 0, TAU); q.fill();
      const path = () => { q.beginPath(); P.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.closePath(); };
      q.fillStyle = K.lin(q, -w, 0, w, 0, [[0, '#5a6476'], [0.4, '#465062'], [1, '#1e2430']]); path(); q.fill();
      q.save(); path(); q.clip();
      for (let i = 0; i < 9; i++) { const x = (r() - 0.5) * w * 2, y = -r() * h; q.fillStyle = rgba(r() < 0.6 ? '#121620' : '#8a96aa', 0.18 + r() * 0.2); q.beginPath(); q.moveTo(x, y); q.lineTo(x + 4 + r() * 8, y + 2); q.lineTo(x + r() * 4, y + 10 + r() * 14); q.closePath(); q.fill(); }
      // 顶面（稍亮的一个扁面）
      q.fillStyle = 'rgba(150,166,190,0.35)'; q.beginPath(); q.moveTo(P[3][0], P[3][1]); q.lineTo(P[4][0], P[4][1]); q.lineTo(P[5][0], P[5][1]); q.lineTo(P[6][0], P[6][1]); q.lineTo(P[6][0] - 5, P[6][1] + 7); q.lineTo(P[3][0] + 5, P[3][1] + 7); q.closePath(); q.fill();
      q.restore();
      // 霜：顶沿断续的白边
      q.lineCap = 'round';
      for (let i = 3; i < 6; i++) {
        const [ax, ay] = P[i], [bx, by] = P[i + 1];
        for (let k = 0; k < 5; k++) {
          if (r() < 0.3) continue;
          const u0 = k / 5, u1 = u0 + 0.12 + r() * 0.08;
          q.strokeStyle = `rgba(236,244,252,${(0.6 + r() * 0.35).toFixed(2)})`; q.lineWidth = 1.2 + r() * 1.4;
          q.beginPath(); q.moveTo(lerp(ax, bx, u0), lerp(ay, by, u0) + 0.5); q.lineTo(lerp(ax, bx, u1), lerp(ay, by, u1) + 0.5); q.stroke();
        }
      }
      for (let i = 0; i < 10; i++) { q.fillStyle = 'rgba(240,248,255,0.7)'; q.fillRect((r() - 0.5) * w * 1.7, -h + 2 + r() * h * 0.7, 1.3, 1.3); }
    });
  }
  // 霜花：从石根、石座脚长出的羽状冰晶（分三阶段烘焙，逐帧交叉淡入）
  function frostFan(q, r, x, y, a, len, d) {
    if (d > 3 || len < 3) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len * 0.45;
    q.lineWidth = Math.max(0.5, 1.4 - d * 0.3); q.beginPath(); q.moveTo(x, y); q.lineTo(x2, y2); q.stroke();
    const n = 3 + Math.floor(r() * 3);
    for (let k = 1; k <= n; k++) {
      const u = k / (n + 1), px = lerp(x, x2, u), py = lerp(y, y2, u), l2 = len * (0.42 - 0.2 * u);
      frostFan(q, r, px, py, a - 0.75, l2, d + 1); frostFan(q, r, px, py, a + 0.75, l2, d + 1);
    }
  }
  const FX0 = 420, FX1 = 1140, FY0 = 470, FY1 = 690;
  function vb26Frost(stage) {
    return K.cache('g09_vb26_frost3' + stage, FX1 - FX0, FY1 - FY0, Z26, (q) => {
      q.translate(-FX0, -FY0);
      const r = A.rng(60 + stage);
      q.strokeStyle = 'rgba(218,232,250,0.5)'; q.lineCap = 'round';
      const roots = [];
      for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU; roots.push([RING[0] + Math.cos(a) * (RRX + 8), RING[1] + Math.sin(a) * (RRY + 4), a]); }
      for (const S of SEATS) for (let k = -2; k <= 2; k++) roots.push([S.x + k * S.w * 0.24, S.y + 2, k < 0 ? PI : 0]);
      for (let i = 0; i < 12; i++) roots.push([FX0 + 30 + r() * (FX1 - FX0 - 60), 490 + r() * 180, r() * TAU]);
      for (const [x, y, a0] of roots) {
        for (let k = 0; k < 2 + stage; k++) {
          if (r() > 0.5 + stage * 0.2) continue;
          const a = a0 + (r() - 0.5) * 1.6, len = (10 + r() * 14) * (0.7 + stage * 0.45);
          frostFan(q, r, x + (r() - 0.5) * 8, y + r() * 3, a, len, 0);
        }
      }
    });
  }
  function vb26Ground() {
    return K.cache('g09_vb26_ground2', GW26, GH26, Z26, (q) => {
      q.translate(-GX0, -GY0);
      // 霜地：远处与天边雾色相接，越近越暗；冷灰圈周围被霜照得发白
      q.fillStyle = K.lin(q, 0, GY0, 0, GY1, [[0, '#2c3c54'], [0.12, '#3a4a60'], [0.3, '#36445a'], [0.6, '#283446'], [1, '#0e121a']]); q.fillRect(GX0, GY0, GW26, GH26);
      q.fillStyle = K.rad(q, RING[0], RING[1] - 20, 40, 520, [[0, 'rgba(150,170,200,0.18)'], [1, 'rgba(150,170,200,0)']]); q.fillRect(GX0, GY0, GW26, GH26);
      const r = A.rng(26);
      for (let i = 0; i < 1700; i++) {
        const y = GY0 + 4 + Math.pow(r(), 1.2) * (GH26 - 4), k = (y - GY0) / GH26, x = GX0 + r() * GW26;
        q.fillStyle = rgba(r() < 0.75 ? '#c8d6e6' : '#0c1018', 0.08 + 0.25 * r() * (0.3 + k));
        q.fillRect(x, y, 0.6 + k * 2.2, 0.5 + k);
      }
      // 中景：一片挂霜的枯树与松，隔着夜雾
      E.pines(q, { xs: [180, 300, 1180, 1290], y: 392, ys: [0, 8, -4, 6], sizes: [0.42, 0.32, 0.38, 0.46], color: '#2a3446', ink: '#1c2432', seed: 9 });
      for (const [x0, y0, s0] of [[420, 404, 0.9], [560, 388, 0.7], [960, 396, 1.0], [1080, 410, 0.8], [250, 420, 0.8]]) {
        q.strokeStyle = '#1c2432'; q.lineCap = 'round';
        const br = (x, y, a, len, w, d) => {
          if (d > 5 || len < 4) return;
          const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
          q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.lineTo(x2, y2); q.stroke();
          if (d > 2) { q.fillStyle = 'rgba(214,228,244,0.5)'; q.fillRect(x2 - 1, y2 - 1, 2, 1.5); }
          br(x2, y2, a - 0.35 - r() * 0.3, len * (0.68 + r() * 0.1), w * 0.66, d + 1);
          br(x2, y2, a + 0.3 + r() * 0.3, len * (0.62 + r() * 0.1), w * 0.62, d + 1);
        };
        br(x0, y0, -PI / 2 + (r() - 0.5) * 0.2, 60 * s0, 5 * s0, 0);
      }
      q.fillStyle = K.lin(q, 0, 330, 0, 470, [[0, 'rgba(70,90,120,0.45)'], [1, 'rgba(70,90,120,0)']]); q.fillRect(GX0, 330, GW26, 140);
      q.fillStyle = K.lin(q, 0, GY0, 0, GY0 + 40, [[0, 'rgba(44,60,84,1)'], [1, 'rgba(44,60,84,0)']]); q.fillRect(GX0, GY0, GW26, 40);
      for (let i = 0; i < 200; i++) {
        const x = GX0 + r() * GW26, y = 440 + r() * 260, k = (y - 440) / 260, len = 6 + k * 26;
        if (Math.hypot((x - RING[0]) / 360, (y - RING[1]) / 120) < 1) continue;
        q.strokeStyle = rgba('#1a2230', 0.8); q.lineWidth = 0.8 + k;
        const b = (r() - 0.5) * len * 0.6;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + b * 0.3, y - len * 0.6, x + b, y - len); q.stroke();
        q.fillStyle = rgba('#dfe8f4', 0.5); q.fillRect(x + b - 1, y - len - 1, 2, 2);
      }
      // 冷灰圈：一圈石头围着灰白的灰烬，半埋的断炭
      const [rx, ry] = RING;
      q.save(); q.translate(rx, ry); q.scale(1, RRY / RRX);
      q.fillStyle = K.rad(q, 0, 0, 0, RRX, [[0, 'rgba(184,186,190,0.95)'], [0.5, 'rgba(126,128,134,0.85)'], [0.85, 'rgba(56,60,68,0.6)'], [1, 'rgba(40,44,52,0)']]);
      q.beginPath(); q.arc(0, 0, RRX, 0, TAU); q.fill(); q.restore();
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU, d = r() * 0.6, cx = rx + Math.cos(a) * RRX * d, cy = ry + Math.sin(a) * RRY * d, L = 16 + r() * 26, an = (r() - 0.5) * 0.8;
        q.save(); q.translate(cx, cy); q.rotate(an);
        q.fillStyle = '#16161a'; q.beginPath(); q.moveTo(-L / 2, 1); q.lineTo(-L / 2 + 3, -4 - r() * 3); q.lineTo(L / 2 - 4, -3 - r() * 3); q.lineTo(L / 2, 1); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(200,204,210,0.3)'; q.lineWidth = 0.8; q.beginPath(); q.moveTo(-L / 2 + 3, -4); q.lineTo(L / 2 - 4, -3); q.stroke();
        q.restore();
        // 灰盖住炭的下半截
        q.fillStyle = 'rgba(170,172,176,0.85)'; q.beginPath(); q.ellipse(cx, cy + 2, L * 0.55, 3.5, an * 0.3, 0, TAU); q.fill();
      }
      for (let i = 0; i < 50; i++) { q.fillStyle = rgba(r() < 0.6 ? '#d0d4d8' : '#4a4c50', 0.3); q.beginPath(); q.ellipse(rx + (r() - 0.5) * RRX * 1.5, ry + (r() - 0.5) * RRY * 1.4, 2 + r() * 8, 1 + r() * 2.5, 0, 0, TAU); q.fill(); }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU, x = rx + Math.cos(a) * RRX, y = ry + Math.sin(a) * RRY, sz = 0.8 + r() * 0.5;
        q.fillStyle = 'rgba(0,0,0,0.35)'; q.beginPath(); q.ellipse(x + 2, y + 3, 12 * sz, 4 * sz, 0, 0, TAU); q.fill();
        q.fillStyle = K.lin(q, 0, y - 7 * sz, 0, y + 5 * sz, [[0, '#4a5466'], [1, '#1c222e']]); q.beginPath(); q.ellipse(x, y, 12 * sz, 7 * sz, 0, 0, TAU); q.fill();
        q.fillStyle = 'rgba(214,226,240,0.5)'; q.beginPath(); q.ellipse(x - 1, y - 4 * sz, 8 * sz, 2 * sz, 0, 0, TAU); q.fill();
      }
    });
  }
  // 酒杯：青瓷小盏；full 斟满程度（杯面一点金光）；flip 倒扣（杯足朝上、结了霜，歪着）
  function cup(g, x, y, s, full, flip, t, k) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (flip) {
      g.rotate(-0.12);
      g.fillStyle = K.lin(g, -9, 0, 9, 0, [[0, '#c4d8d4'], [0.5, '#8eb2aa'], [1, '#4e6c68']]);
      g.beginPath(); g.moveTo(-5, -11); g.lineTo(5, -11); g.lineTo(9.5, 0); g.lineTo(-9.5, 0); g.closePath(); g.fill();
      g.fillStyle = '#26363a'; g.fillRect(-4.5, -13.5, 9, 2.8);
      g.fillStyle = 'rgba(236,244,252,0.9)'; g.fillRect(-4.5, -14, 9, 1.2);
      g.fillStyle = 'rgba(236,244,252,0.55)'; for (let i = 0; i < 5; i++) g.fillRect(-7 + i * 3.2, -6 + (i % 2) * 2, 1.4, 1.4);
      g.restore(); return;
    }
    g.fillStyle = K.lin(g, -8, 0, 8, 0, [[0, '#d4e4e0'], [0.5, '#9ec0b8'], [1, '#5e7c78']]);
    g.beginPath(); g.moveTo(-9, -11); g.lineTo(9, -11); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fill();
    g.fillStyle = '#2a3a3c'; g.beginPath(); g.ellipse(0, -11, 9, 2.6, 0, 0, TAU); g.fill();
    if (full > 0) {
      g.fillStyle = mix('#3a3020', '#eacd76', 0.5 * full); g.beginPath(); g.ellipse(0, -10.8, 8 * full, 2.2 * full, 0, 0, TAU); g.fill();
      add(g, () => glow(g, 1, -11, 10, '#ffe6a8', (0.35 + 0.25 * Math.sin(t * 3 + k * 1.7)) * full));
    }
    // 杯沿结霜
    g.strokeStyle = 'rgba(240,250,255,0.85)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, -11, 9, 2.6, 0, PI, TAU); g.stroke();
    g.restore();
  }
  // 比翼鸟（自画，短尾）：flap 0..1 拍内相位（拍点上翅膀下扑）
  function wingBird(g, x, y, s, dir, flap, col, glowC, ang) {
    add(g, () => glow(g, x, y, 22 * s, glowC, 0.32));
    g.save(); g.translate(x, y); g.rotate(ang || 0); g.scale(dir * s, s);
    const w = Math.cos(flap * TAU);   // 1 上举，-1 下扑
    g.fillStyle = col;
    // 远翅（暗一点）、身子、近翅、短叉尾
    g.globalAlpha = 0.7;
    g.beginPath(); g.moveTo(-2, -1); g.quadraticCurveTo(-6, -12 * w - 4, -16, -20 * w - 2); g.quadraticCurveTo(-8, -6 * w, 4, 0); g.closePath(); g.fill();
    g.globalAlpha = 1;
    g.beginPath(); g.ellipse(0, 0, 11, 3.6, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(10, -1.2, 3.2, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(13, -1.5); g.lineTo(17, -0.6); g.lineTo(13, 0.4); g.fill();
    g.beginPath(); g.moveTo(-9, 0); g.lineTo(-20, -4); g.lineTo(-15, 0); g.lineTo(-20, 4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(-2, -16 * w, -12, -27 * w); g.quadraticCurveTo(-4, -10 * w, 6, 0.5); g.closePath(); g.fill();
    g.restore();
  }
  const BIRD26 = [[-90, 70], [330, 104], [560, 140], [680, 560], [880, 440], [740, 120]];
  function catmull(P, u) {
    const n = P.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)];
    const cr = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * k + (2 * a - 5 * b + 4 * c2 - d) * k * k + (-a + 3 * b - 3 * c2 + d) * k * k * k);
    return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
  }
  XYT.registerShot('vb26_ashring', {
    name: '灰烬五座', zone: 'right', night: true, text: '#e9f1f6', shadow: 'rgba(6,10,22,0.92)', accent: '#eacd76', bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = Math.max(0, c.lt), id = 'vb26_ashring';
      const ct = [0, 1, 2, 3, 4, 5, 6].map((k) => chr(c, id, k));
      // 知、己、难、逢：每字向右挪半步，俯身斟一杯；几人留：直起身，举壶向天
      let step = 0;
      for (let k = 0; k < 4; k++) if (lt >= ct[k] - 0.12) step = k;
      const stepK = (k) => easeInOut(clamp((lt - (ct[k] - 0.12)) / 0.14));
      let fx = SEATS[0].x - 74, fy = SEATS[0].y + 30;
      for (let k = 1; k < 4; k++) { const e = stepK(k); fx = lerp(fx, SEATS[k].x - 74, e); fy = lerp(fy, SEATS[k].y + 30, e); }
      const fs = 1.62 - (628 - fy) * 0.0045;
      const up = lt >= ct[4];
      // 镜头横向缓移，跟着他
      const SS = (XYT.sprites && XYT.sprites.S) || 1;
      const pan = Math.round((150 * easeInOut(clamp((lt + 0.2) / 2.2)) + 18 * clamp((lt - 2) / 1.5)) * SS) / SS;
      g.drawImage(vb26Sky(), -Math.round(pan * 0.25 * SS) / SS, 0);
      for (let i = 0; i < 15; i++) {
        const x = h2(i, 81) * W, y = 14 + h2(i, 82) * 190, tw = Math.max(0, Math.sin(t * (1.5 + h2(i, 83) * 3) + i * 2.1));
        if (tw > 0.3) glow(g, x, y, 5 + 4 * h2(i, 84), '#e8f0ff', (tw - 0.3) * 0.9);
      }
      g.save(); g.translate(640, 560); g.scale(Z26, Z26); g.translate(-640 - pan, -560);
      blit(g, vb26Ground(), GX0, GY0, GW26, GH26);
      // 霜慢慢爬满地面：三段霜花，段与段之间短短交叉淡入
      const fk = ss(0.85, 1.25, lt) + ss(2.05, 2.45, lt), fi = Math.min(2, Math.floor(fk)), fa = fi < 2 ? fk - fi : 0;
      const FW = FX1 - FX0, FH = FY1 - FY0;
      g.globalAlpha = 0.9; blit(g, vb26Frost(fi), FX0, FY0, FW, FH);
      if (fa > 0.01 && fi < 2) { g.globalAlpha = 0.9 * fa; blit(g, vb26Frost(fi + 1), FX0, FY0, FW, FH); }
      g.globalAlpha = 1;
      E.mist(g, { t, y: 420, h: 80, color: '#56688a', alpha: 0.32, speed: 5 });
      // 灰里一点暗红余火：比翼鸟掠过时被风一扇，亮一下
      const bt0 = ct[4] - 0.45, bt1 = c.dur + 0.15, passT = bt0 + 0.5 * (bt1 - bt0);
      const bp = ss(passT - 0.08, passT + 0.08, lt) * (1 - ss(passT + 0.3, passT + 1.1, lt));
      const emb = 0.55 + 0.2 * Math.sin(t * 2.3) + 0.2 * c.be(0.4) + 0.8 * bp;
      add(g, () => { glow(g, RING[0] + 14, RING[1] - 3, 20 + 16 * bp, '#c8301a', 0.45 * emb); glow(g, RING[0] + 14, RING[1] - 3, 3, '#ffb070', Math.min(1, 0.9 * emb)); });
      // 石座、杯、各人的小物（先远后近）；他站在第几座前就画在那座之前或之后
      const fills = [0, 1, 2, 3].map((k) => clamp((lt - ct[k] - 0.1) / 0.24));
      const order = SEATS.map((s, i) => i).sort((a, b) => SEATS[a].y - SEATS[b].y);
      const drawSeat = (i) => {
        const S = SEATS[i], tex = seatTex(S);
        g.drawImage(tex, S.x - S.w / 2 - 15, S.y - S.h - 15, S.w + 30, S.h + 30);
        const cx = S.x + S.w * 0.08, cy = S.y - S.h - 1;
        cup(g, cx, cy + 1, 1.05 * (S.h / 48 + 0.2), i < 4 ? fills[i] : i === 4 ? 1 : 0, S.cup < 0, t, i);
        const bx = S.x - S.w * 0.36, by = S.y - S.h * 0.55, sw = Math.sin(t * 1.3 + i) * 2;
        g.lineCap = 'round';
        if (S.mark === 'bell') {
          g.strokeStyle = '#c9314a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(bx + 2, by - 14); g.lineTo(bx, by - 2); g.stroke();
          g.fillStyle = '#d8dce6'; g.beginPath(); g.arc(bx, by + 2, 4.2, 0, TAU); g.fill();
          add(g, () => glow(g, bx - 1, by + 1, 9, '#e8f0ff', 0.5));
        } else if (S.mark === 'fan') {
          g.fillStyle = 'rgba(238,243,238,0.85)'; g.beginPath(); g.moveTo(bx, by + 10); g.arc(bx, by + 10, 15, -PI * 0.85, -PI * 0.45); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(120,130,130,0.6)'; g.lineWidth = 0.6; for (let k = 0; k < 5; k++) { const a = -PI * 0.85 + k * 0.1 * PI; g.beginPath(); g.moveTo(bx, by + 10); g.lineTo(bx + Math.cos(a) * 15, by + 10 + Math.sin(a) * 15); g.stroke(); }
        } else if (S.mark) {
          g.strokeStyle = S.col; g.lineWidth = S.mark === 'tassel' ? 1.6 : 2.6; g.globalAlpha = 0.92;
          g.beginPath(); g.moveTo(bx + 8, by - 12); g.quadraticCurveTo(bx - 4, by - 2, bx + sw, by + 18); g.stroke();
          g.beginPath(); g.moveTo(bx + 8, by - 12); g.quadraticCurveTo(bx + 2, by + 2, bx + 6 + sw, by + 16); g.stroke();
          g.globalAlpha = 1;
        }
      };
      // 比他脚下更远的石座先画，更近的后画
      let drawn = false;
      const base = { stage: 'old', facing: 1, prop: 'none', wind: 0.2, tone: 'silhouette', ink: '#141820', whiteHair: true, rim: '#cfe0f5', light: [1000, 80], rimAlpha: 0.85 };
      const fo = up ? Object.assign({ pose: 'reach', lean: -0.12, head: -0.32 }, base) : Object.assign({ pose: 'stand', lean: 0.46, head: 0.3 }, base);
      const P = F.points('xiaoyao', fx, fy, fs, t, fo);
      const drawMan = () => {
        F.draw(g, 'xiaoyao', fx, fy, fs, t, fo);
        // 葫芦：斟酒时口朝下，举壶时口朝天
        const hN = P.handN, gs = 0.4 * fs / 1.5, ga = up ? 0.35 : 2.35;
        const gx = hN[0] + Math.sin(ga) * 4, gy = hN[1] - Math.cos(ga) * 4 + 6;
        E.gourd(g, { x: gx, y: gy, s: gs, angle: ga, t });
        if (!up) {
          // 酒线：从葫芦口直落进杯里，一道细亮，杯里一圈涟漪
          const mx = gx + Math.sin(ga) * 48 * gs, my = gy - Math.cos(ga) * 48 * gs;
          const S = SEATS[step], cx = S.x + S.w * 0.08, cy = S.y - S.h - 10;
          const d0 = lt - ct[step], grow = clamp(d0 / 0.08), cut = step < 3 ? clamp((lt - (ct[step + 1] - 0.2)) / 0.06) : clamp((lt - (ct[4] - 0.08)) / 0.06);
          if (grow > 0 && cut < 1) {
            const yA = lerp(my, cy, cut), yB = lerp(my, cy, grow);
            g.save(); g.lineCap = 'round';
            g.strokeStyle = 'rgba(240,214,140,0.9)'; g.lineWidth = 1.8;
            g.beginPath(); g.moveTo(mx, yA); g.quadraticCurveTo(mx + 3, (yA + yB) / 2, cx, yB); g.stroke();
            add(g, () => {
              const u = (t * 3) % 1; glow(g, lerp(mx, cx, u), lerp(yA, yB, u), 6, '#fff2c8', 0.8);
              if (grow >= 1) glow(g, cx, cy + 2, 12, '#ffe6a0', 0.6);
            });
            if (grow >= 1) { const rr = ((lt * 6) % 1); g.strokeStyle = `rgba(255,236,190,${(0.7 * (1 - rr)).toFixed(3)})`; g.lineWidth = 0.8; g.beginPath(); g.ellipse(cx, cy + 1.5, 2 + rr * 6, 0.6 + rr * 1.5, 0, 0, TAU); g.stroke(); }
            g.restore();
          }
        }
      };
      for (const i of order) {
        if (!drawn && SEATS[i].y > fy) { drawMan(); drawn = true; }
        drawSeat(i);
      }
      if (!drawn) drawMan();
      // 呵气成霜：每拍一小团白气
      for (let k = 0; k < 3; k++) {
        const t0 = c.grid ? c.grid.time(c.b.i - k) : 0, age = t - t0;
        if (age < 0 || age > 1.6) continue;
        const r = 6 + age * 22, a = 0.3 * Math.sin(PI * Math.min(1, age / 1.6)) * (age < 0.15 ? age / 0.15 : 1);
        g.save(); g.globalCompositeOperation = 'screen';
        glow(g, P.mouth[0] + 10 + age * 24, P.mouth[1] + 2 - age * 12, r, '#c8d8ee', a);
        glow(g, P.mouth[0] + 18 + age * 30, P.mouth[1] - 2 - age * 16, r * 0.7, '#c8d8ee', a * 0.6);
        g.restore();
      }
      // 灰被翅尖带起一缕
      V.smoke(g, c, { kind: 'puff', at: passT - 0.05, x: RING[0] - 10, y: RING[1] - 10, w: 160, n: 6, size: 50, rise: 50, life: 1.6, drift: 50, color: '#b8c2cc', alpha: 0.42 });
      g.restore();
      // 比翼鸟：一白一青，从左上俯冲，贴着灰烬掠过，再飞到画面上中；翅膀随拍扇动
      const bu = (lt - bt0) / (bt1 - bt0);
      if (bu > 0 && bu < 1) {
        const ph = c.b.ph != null ? c.b.ph : (lt * 2.4) % 1;
        const [bx, by] = catmull(BIRD26, bu), [qx, qy] = catmull(BIRD26, Math.min(1, bu + 0.01));
        const ang = Math.atan2(qy - by, qx - bx), dir = qx >= bx ? 1 : -1;
        const tilt = dir > 0 ? ang : ang - PI;
        const [bx2, by2] = catmull(BIRD26, Math.max(0, bu - 0.035));
        wingBird(g, bx2 - 4, by2 + 16, 1.7, dir, ph + 0.08, '#5cc4c8', '#9fe8e8', tilt);
        wingBird(g, bx, by, 1.8, dir, ph, '#f4f8ff', '#e8f0ff', tilt);
      }
      // 霜点：地面细碎的闪光
      add(g, () => {
        for (let i = 0; i < 22; i++) {
          const x = h2(i, 61) * W, y = 490 + h2(i, 62) * 230, tw = Math.max(0, Math.sin(t * (2 + h2(i, 63) * 3) + i * 1.7));
          if (tw > 0.6) glow(g, x, y, 4 + 4 * h2(i, 64), '#e8f2ff', (tw - 0.6) * 1.6);
        }
      });
    },
  });

  // =====================================================================
  // 第31句 第15句 —— 太阳雨童戏：孩子们扮“李大侠斩蛇妖”，撞上檐下的白发人
  // =====================================================================
  // 孩童：墨色剪影加一块衣色，低斜的太阳在发顶、肩头勾一道暖边；不画五官（只留侧脸轮廓）
  // o: facing, ph 跑步相位, run 0..1, top 衣色, hair 'buns'|'tuft', flower 花簪, ribbon 发带, sword 'up'|null,
  // tail 蛇尾绸带色, claw 双手作爪, tilt 仰头, reach 0..1 伸手接剑, rim 轮廓光, refl 画倒影（省掉影子）
  const KINK = '#2a2420';
  function kid(g, x, y, s, t, o) {
    const f = o.facing || 1, run = o.run ?? 1, ph = o.ph || 0;
    const bob = run * Math.abs(Math.sin(ph)) * 5;
    const lean = run * 0.2 + (o.lean || 0);
    g.save(); g.translate(x, y); g.scale(f * s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const hip = [0, -46 - bob];
    const sh = [hip[0] + Math.sin(lean) * 32, hip[1] - Math.cos(lean) * 32];
    const hc = [sh[0] + Math.sin(lean) * 5, sh[1] - 16];
    const rim = o.rim || '#ffe2a0', rk = f > 0 ? -1 : 1;   // 太阳在左上：朝右时光在背后
    const legP = (side) => {
      const p = ph + (side ? PI : 0);
      const th = run * 0.78 * Math.sin(p) + (1 - run) * (side ? 0.1 : -0.06);
      const kn = run * (0.25 + 0.9 * Math.max(0, Math.sin(p + 1.5))) + (1 - run) * 0.05;
      const kp = [hip[0] + Math.sin(th) * 22, hip[1] + Math.cos(th) * 22];
      const ap = [kp[0] + Math.sin(th - kn) * 22, kp[1] + Math.cos(th - kn) * 22];
      return [kp, ap];
    };
    const drawLeg = (side) => {
      const [kp, ap] = legP(side);
      g.strokeStyle = KINK; g.lineWidth = 7.5;
      g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(kp[0], kp[1]); g.lineTo(ap[0], ap[1]); g.stroke();
      g.fillStyle = KINK; g.beginPath(); g.ellipse(ap[0] + 3, ap[1] + 1, 5.5, 2.8, 0, 0, TAU); g.fill();
    };
    const armP = (side) => {
      const S = [sh[0] + (side ? -3 : 3), sh[1] + 3];
      let a1, a2;
      if (o.claw) { a1 = 2.0 + 0.25 * Math.sin(t * 9 + side); a2 = 0.7; }
      else if (o.sword === 'up' && !side) { a1 = 2.75 + 0.15 * Math.sin(t * 7); a2 = 0.25; }
      else if (o.reach && !side) { a1 = lerp(-0.5 * run * Math.sin(ph), 1.45, o.reach); a2 = lerp(0.5, 0.15, o.reach); }
      else { a1 = -run * 0.95 * Math.sin(ph + (side ? 0 : PI)) + (1 - run) * (side ? -0.15 : 0.1); a2 = 0.6 + run * 0.6; }
      const e = [S[0] + Math.sin(a1) * 14, S[1] + Math.cos(a1) * 14], hd = [e[0] + Math.sin(a1 + a2) * 13, e[1] + Math.cos(a1 + a2) * 13];
      return [S, e, hd];
    };
    const drawArm = (side, col) => {
      const [S, e, hd] = armP(side);
      g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(e[0], e[1]); g.lineTo(hd[0], hd[1]); g.stroke();
      g.fillStyle = KINK; g.beginPath(); g.arc(hd[0], hd[1], 2.8, 0, TAU); g.fill();
      return hd;
    };
    const top = o.top || '#a8cde0', topD = mix(top, KINK, 0.45);
    drawArm(1, topD);
    drawLeg(1);
    // 蛇妖的绿绸尾巴，拖在身后起伏
    if (o.tail) {
      const pts = [];
      for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([hip[0] - 6 - u * 74, hip[1] + 6 + u * 30 + Math.sin(t * 9 - u * 6.5) * 9 * u * (0.4 + 0.6 * run)]); }
      g.fillStyle = o.tail;
      g.beginPath();
      pts.forEach(([px, py], i) => { const w = 6 * (1 - (i / 14) * 0.8); i ? g.lineTo(px, py - w) : g.moveTo(px, py - w); });
      for (let i = 14; i >= 0; i--) { const w = 6 * (1 - (i / 14) * 0.8); g.lineTo(pts[i][0], pts[i][1] + w); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(240,250,200,0.6)';
      for (let i = 2; i < 14; i += 3) { g.beginPath(); g.arc(pts[i][0], pts[i][1], 1.2, 0, TAU); g.fill(); }
    }
    // 短襦：一块衣色，腰系带
    const lx = Math.sin(lean), ly = -Math.cos(lean), px = -ly, py = lx;
    const P = (u, w) => [hip[0] + lx * u + px * w, hip[1] + ly * u + py * w];
    g.fillStyle = top;
    g.beginPath();
    const p1 = P(-8, -16), p2 = P(29, -11), p3 = P(34, -5), p4 = P(34, 6), p5 = P(29, 11), p6 = P(-8, 17);
    g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.quadraticCurveTo(p3[0], p3[1], P(34, 0)[0], P(34, 0)[1]);
    g.quadraticCurveTo(p4[0], p4[1], p5[0], p5[1]); g.lineTo(p6[0], p6[1]);
    g.quadraticCurveTo(P(-12, 0)[0], P(-12, 0)[1], p1[0], p1[1]); g.closePath(); g.fill();
    g.strokeStyle = o.sash || mix(top, KINK, 0.6); g.lineWidth = 2.6;
    const b1 = P(2, -15), b2 = P(2, 16); g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.stroke();
    // 肩上的暖边
    if (!o.refl) { g.strokeStyle = rgba(rim, 0.85); g.lineWidth = 1.6; const q1 = P(30, 10 * rk), q2 = P(8, 15 * rk); g.beginPath(); g.moveTo(q1[0], q1[1]); g.quadraticCurveTo(P(33, 4 * rk)[0], P(33, 4 * rk)[1], P(32, -2 * rk)[0], P(32, -2 * rk)[1]); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.stroke(); }
    drawLeg(0);
    // 头：墨色剪影，侧脸一个小鼻尖，发髻
    g.save(); g.translate(hc[0], hc[1]); g.rotate((o.tilt || 0) - (o.look || 0) * 0.15);
    g.fillStyle = KINK;
    g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(10, -3); g.lineTo(14.5, 1.5); g.lineTo(10.5, 3.5); g.fill();
    if (o.hair === 'buns') {
      for (const bx of [-7, 5]) { g.beginPath(); g.arc(bx, -11, 5, 0, TAU); g.fill(); }
      if (o.flower) {
        g.fillStyle = o.flower;
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + t; g.beginPath(); g.arc(7 + Math.cos(a) * 2.6, -15 + Math.sin(a) * 2.6, 2.2, 0, TAU); g.fill(); }
        g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(7, -15, 1.3, 0, TAU); g.fill();
      }
    } else {
      g.beginPath(); g.ellipse(-2, -12, 5, 6, -0.3, 0, TAU); g.fill();
      if (o.ribbon) {
        g.strokeStyle = o.ribbon; g.lineWidth = 2.6;
        g.beginPath(); g.arc(0, 0, 11.2, PI * 1.05, PI * 1.75); g.stroke();
        g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(-10, -5); g.quadraticCurveTo(-18, -3 + Math.sin(t * 11) * 3, -25 - run * 6, 2 + Math.sin(t * 11 + 1) * 5); g.stroke();
        g.beginPath(); g.moveTo(-10, -4); g.quadraticCurveTo(-17, 2 + Math.sin(t * 10) * 2, -22 - run * 4, 8 + Math.sin(t * 10 + 2) * 4); g.stroke();
      }
    }
    // 发顶、后脑的暖边
    if (!o.refl) { g.strokeStyle = rgba(rim, 0.9); g.lineWidth = 1.8; g.beginPath(); g.arc(0, 0, 11.6, rk < 0 ? PI * 0.95 : PI * 1.5, rk < 0 ? PI * 1.5 : PI * 2.05); g.stroke(); }
    g.restore();
    const hd = drawArm(0, top);
    if (o.sword === 'up') woodSword(g, hd[0], hd[1], 0.35 + 0.15 * Math.sin(t * 7), 0.85, Math.sin(t * 9));
    g.restore();
    return [x + f * s * hd[0], y + s * hd[1]];
  }
  // 孩子伸出的手的位置（不画），用来对位木剑交接
  function kidHand(x, y, s, o) {
    const f = o.facing || 1, run = o.run ?? 1, ph = o.ph || 0, bob = run * Math.abs(Math.sin(ph)) * 5, lean = run * 0.2 + (o.lean || 0);
    const hip = [0, -46 - bob], sh = [Math.sin(lean) * 32, hip[1] - Math.cos(lean) * 32], S = [sh[0] + 3, sh[1] + 3];
    const a1 = o.reach ? lerp(-0.5 * run * Math.sin(ph), 1.45, o.reach) : 0, a2 = o.reach ? lerp(0.5, 0.15, o.reach) : 0.6;
    const e = [S[0] + Math.sin(a1) * 14, S[1] + Math.cos(a1) * 14], hd = [e[0] + Math.sin(a1 + a2) * 13, e[1] + Math.cos(a1 + a2) * 13];
    return [x + f * s * hd[0], y + s * hd[1]];
  }
  // 水花：落脚处溅起一圈水珠，age 秒
  function splash(g, x, y, age, s, col, seed) {
    if (age < 0 || age > 0.55) return;
    const e = 1 - age / 0.55;
    g.fillStyle = col;
    for (let i = 0; i < 9; i++) {
      const a = PI * (0.12 + 0.76 * h2(i, seed)), v = (90 + 90 * h2(i, seed + 1)) * s;
      const dx = Math.cos(a) * v * age * (h2(i, seed + 2) < 0.5 ? -1 : 1), dy = -Math.sin(a) * v * age + 520 * age * age * s;
      if (dy > 4) continue;
      g.globalAlpha = 0.85 * e; g.beginPath(); g.arc(x + dx, y + dy, (1.2 + 1.6 * h2(i, seed + 3)) * s, 0, TAU); g.fill();
    }
    g.globalAlpha = 0.6 * e; g.strokeStyle = col; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(x, y, (6 + age * 70) * s, (1.6 + age * 14) * s, 0, 0, TAU); g.stroke();
    g.globalAlpha = 1;
  }
  const PUD27 = [[200, 696, 84, 11], [470, 712, 100, 13], [700, 690, 66, 9], [1010, 716, 110, 14], [-120, 704, 80, 11]];
  const SUN27 = [96, 64];
  // 天、彩虹、太阳与斜射的阳光：一张整分辨率贴图
  const OX27 = 122, SKY27W = W + OX27 + 8;
  function vb27Sky() {
    return K.cache('g09_vb27_sky3', SKY27W, 540, 1, (q) => {
      q.translate(OX27, 0);
      q.fillStyle = K.lin(q, 0, 0, 0, 540, [[0, '#5e98a8'], [0.45, '#a8cdb8'], [0.8, '#e8e2b0'], [1, '#f6e4b0']]); q.fillRect(-OX27, 0, SKY27W, 540);
      // 彩虹：太阳在身后左上，虹在前方（右）
      const bands = ['#ff6a50', '#ffa848', '#ffe060', '#8ad070', '#50b8d8', '#6a78d0', '#9a68c0'];
      q.globalCompositeOperation = 'screen';
      bands.forEach((col, i) => { q.strokeStyle = rgba(col, 0.22); q.lineWidth = 11; q.beginPath(); q.arc(1010, 900, 668 - i * 10, PI * 1.1, PI * 1.64); q.stroke(); });
      q.globalCompositeOperation = 'source-over';
      bands.forEach((col, i) => { q.strokeStyle = rgba(col, 0.1); q.lineWidth = 10; q.beginPath(); q.arc(1010, 900, 668 - i * 10, PI * 1.12, PI * 1.62); q.stroke(); });
      E.clouds(q, { t: 0, y: 150, color: '#fffaf0', shade: '#a8c4c4', alpha: 0.5, n: 3, seed: 31, scale: 0.8, speed: 0, lightX: 0 });
      q.fillStyle = K.lin(q, 0, 380, 0, 540, [[0, 'rgba(248,230,178,0)'], [1, 'rgba(248,230,178,0.8)']]); q.fillRect(-OX27, 380, SKY27W, 160);
      E.sun(q, { x: SUN27[0], y: SUN27[1], r: 30, color: '#fff2c0', glow: 0.9, haze: '#ffe6a0', spread: 10 });
      // 斜射的阳光（静态）
      q.globalCompositeOperation = 'screen';
      for (let i = 0; i < 9; i++) {
        const a = 0.42 + (i / 8) * 0.72 + (h2(i, 7) - 0.5) * 0.06, w = 0.02 + 0.035 * h2(i, 8), L = 1500;
        q.fillStyle = K.lin(q, SUN27[0], SUN27[1], SUN27[0] + Math.cos(a) * L, SUN27[1] + Math.sin(a) * L, [[0, 'rgba(255,240,190,0.32)'], [0.5, 'rgba(255,236,180,0.12)'], [1, 'rgba(255,236,180,0)']]);
        q.beginPath(); q.moveTo(SUN27[0], SUN27[1]); q.lineTo(SUN27[0] + Math.cos(a - w) * L, SUN27[1] + Math.sin(a - w) * L); q.lineTo(SUN27[0] + Math.cos(a + w) * L, SUN27[1] + Math.sin(a + w) * L); q.closePath(); q.fill();
      }
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 中景：远山、白墙黛瓦、石拱桥、湿漉漉的布招
  function vb27Town() {
    return K.cache('g09_vb27_town2', 1700, 300, 1, (q) => {
      q.translate(0, -250);
      E.mountains(q, { t: 0, lightDir: -1, layers: [
        { kind: 'far', color: '#94bca4', alpha: 0.85, y: 452, scaleY: 0.32, seed: 41, light: '#fff0c0', litA: 0.45, soft: true },
        { kind: 'mid', color: '#7ea888', alpha: 0.95, y: 470, scaleY: 0.25, seed: 43, light: '#fff0c0', litA: 0.35, fog: '#f2ecc8', fogA: 0.35 },
      ] });
      E.jiangnanTown(q, { t: 0, y: 520, x0: 0, x1: 1700, scale: 0.72, color: '#efe8d4', roof: '#3a3e44', haze: '#e6eacc', hazeA: 0.3, lit: 0, light: '#fff0c0', lightX: 0, seed: 12, smoke: 0, bank: false });
      E.jiangnanTown(q, { t: 0, y: 534, x0: 380, x1: 1300, scale: 0.95, color: '#f6eedc', roof: '#33373e', haze: '#eef0d4', hazeA: 0.05, lit: 0, light: '#fff0c0', lightX: 0, seed: 17, smoke: 0, bank: false });
      E.archBridge(q, { x: 260, y: 540, s: 0.62, span: 240, color: '#9a9a8e', haze: '#eef0d4', hazeA: 0.12 });
      // 布招与小摊：雨水打湿的颜色更深
      const r = A.rng(270);
      for (const [x, col, h] of [[520, '#2f6a5a', 70], [700, '#a8402e', 60], [1060, '#3a4e7a', 76], [1240, '#7a5a2a', 64]]) {
        q.fillStyle = '#4a3a2a'; q.fillRect(x - 1.5, 440, 3, 96);
        q.fillStyle = col; q.beginPath(); q.moveTo(x + 2, 450); q.lineTo(x + 26, 450); q.lineTo(x + 26, 450 + h); q.lineTo(x + 14, 450 + h - 8); q.lineTo(x + 2, 450 + h); q.closePath(); q.fill();
        q.fillStyle = 'rgba(0,0,0,0.18)'; q.fillRect(x + 2, 450 + h * 0.55, 24, h * 0.45 - 6);
        q.fillStyle = 'rgba(255,250,230,0.25)'; q.fillRect(x + 3, 451, 3, h - 4);
      }
      // 小摊：竹竿撑起的布棚
      for (const x0 of [820, 1380]) {
        q.fillStyle = '#5a4630'; q.fillRect(x0, 486, 3, 50); q.fillRect(x0 + 86, 486, 3, 50);
        q.fillStyle = K.lin(q, 0, 476, 0, 496, [[0, '#d8c8a0'], [1, '#a89068']]);
        q.beginPath(); q.moveTo(x0 - 10, 496); q.lineTo(x0 + 6, 474); q.lineTo(x0 + 84, 474); q.lineTo(x0 + 100, 496); q.closePath(); q.fill();
        q.fillStyle = '#6a5038'; q.fillRect(x0 + 6, 512, 80, 6);
        for (let k = 0; k < 6; k++) { q.fillStyle = rgba(r() < 0.5 ? '#e8b060' : '#c86040', 0.9); q.beginPath(); q.arc(x0 + 14 + k * 12, 508, 4, 0, TAU); q.fill(); }
      }
    });
  }
  // 远景整张：天 + 中景市镇（横移时一起做视差，只贴一次）
  function vb27Far() {
    return K.cache('g09_vb27_far', SKY27W, 550, 1, (q) => {
      q.drawImage(vb27Sky(), 0, 0);
      q.drawImage(vb27Town(), -260 + OX27, 250);
    });
  }
  // 茶楼：连同酒旗、灯一起烘成一张（字体就绪后重建）
  function vb27Tea() {
    return K.cache('g09_vb27_tea' + fontKey('茶'), 760, 500, 1, (q) => {
      q.translate(380 - 1150, 490 - 646);
      E.teahouse(q, { x: 1150, y: 646, s: 1.45, t: 0.7, lit: 0.12, wind: 0.4, flag: '茶' });
    });
  }
  // 街面：错缝的青石板，湿亮，映着天色；水洼映出天与虹
  function vb27Street() {
    return K.cache('g09_vb27_street2', 1700, 210, 1, (q) => {
      q.translate(300, -526);
      q.fillStyle = K.lin(q, 0, 526, 0, 736, [[0, '#b8bea8'], [0.45, '#8a948a'], [1, '#56605c']]); q.fillRect(-300, 526, 1700, 210);
      const r = A.rng(27);
      // 一行行石板：越近越高越宽，错缝
      let y = 530, row = 0;
      while (y < 736) {
        const k = (y - 526) / 210, hh = 7 + k * 26, sx = 0.6 + k * 1.8;
        let x = -300 - r() * 60 * sx;
        while (x < 1400) {
          const w = (50 + r() * 70) * sx, v = r();
          q.fillStyle = rgba(v < 0.33 ? '#7c8884' : v < 0.66 ? '#9aa4a0' : '#6e7a78', 0.4);
          q.fillRect(x + 1, y + 1, w - 2, hh - 2);
          q.fillStyle = 'rgba(40,46,44,0.22)'; q.fillRect(x + 1, y + hh - 2, w - 2, 1);
          // 湿面上的天光
          q.fillStyle = K.lin(q, 0, y, 0, y + hh, [[0, 'rgba(230,240,226,0.32)'], [1, 'rgba(230,240,226,0)']]); q.fillRect(x + 2, y + 1, w - 4, hh * 0.5);
          q.fillStyle = 'rgba(40,46,44,0.32)'; q.fillRect(x, y + 1, 1.2, hh - 2);
          x += w;
        }
        y += hh * (0.85 + r() * 0.3); row++;
      }
      for (let i = 0; i < 60; i++) { q.fillStyle = rgba(r() < 0.7 ? '#fff4d0' : '#5a5040', 0.06 + r() * 0.1); q.fillRect(r() * 1700 - 300, 536 + r() * 190, 20 + r() * 70, 2 + r() * 3); }
      for (const [x, y2, rx, ry] of PUD27) {
        q.fillStyle = 'rgba(50,60,56,0.35)'; q.beginPath(); q.ellipse(x, y2 + 1, rx + 4, ry + 2, 0, 0, TAU); q.fill();
        // 倒映的天：近处是金黄的天边，远处是青蓝的高天
        q.fillStyle = K.lin(q, 0, y2 - ry, 0, y2 + ry, [[0, '#f2e4b0'], [0.45, '#b8d6c4'], [1, '#6aa0b0']]);
        q.beginPath(); q.ellipse(x, y2, rx, ry, 0, 0, TAU); q.fill();
        q.save(); q.beginPath(); q.ellipse(x, y2, rx, ry, 0, 0, TAU); q.clip();
        q.globalCompositeOperation = 'screen';
        ['#ff6a50', '#ffe060', '#50b8d8', '#9a68c0'].forEach((c0, i) => { q.fillStyle = rgba(c0, 0.16); q.fillRect(x - rx * 0.1 + i * 7, y2 - ry, 7, ry * 2); });
        q.restore();
        q.fillStyle = 'rgba(255,255,240,0.45)'; q.beginPath(); q.ellipse(x - rx * 0.25, y2 - ry * 0.35, rx * 0.5, ry * 0.18, 0, 0, TAU); q.fill();
      }
    });
  }
  // 垂柳：烘焙三帧摆动，逐帧交叉淡入（不再逐帧画虚线柳丝）
  function vb27Trunk() {
    return K.cache('g09_vb27_trunk', 300, 420, 1, (q) => {
      q.translate(150, 420);
      q.fillStyle = K.lin(q, -30, 0, 30, 0, [[0, '#6a5a40'], [0.4, '#3e3226'], [1, '#1e1812']]);
      q.beginPath(); q.moveTo(-26, 0); q.bezierCurveTo(-18, -120, -40, -220, -10, -300); q.lineTo(14, -300); q.bezierCurveTo(-4, -220, 24, -120, 30, 0); q.closePath(); q.fill();
      q.strokeStyle = '#2e261c'; q.lineCap = 'round';
      for (const [x0, y0, x1, y1, w] of [[-4, -290, -90, -360, 9], [4, -296, 80, -380, 8], [-40, -330, -120, -330, 4], [40, -350, 120, -340, 4], [0, -298, 10, -400, 6]]) {
        q.lineWidth = w; q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo((x0 + x1) / 2, y1 - 20, x1, y1); q.stroke();
      }
      q.strokeStyle = 'rgba(255,240,190,0.35)'; q.lineWidth = 2; q.beginPath(); q.moveTo(-22, -10); q.bezierCurveTo(-14, -120, -36, -220, -8, -296); q.stroke();
    });
  }
  function vb27Willow(k) {
    return K.cache('g09_vb27_willow' + k, 420, 470, 1, (q) => {
      q.translate(210, 440);
      q.drawImage(vb27Trunk(), -150, -420, 300, 420);
      q.lineCap = 'round';
      const t = k * 1.6;
      for (let i = 0; i < 40; i++) {
        const side = i % 2 ? 1 : -1, u0 = h2(i, 3);
        const ax = side * (20 + u0 * 120), ay = -300 - Math.sin(u0 * PI) * 70 - h2(i, 4) * 20, len = 150 + h2(i, 5) * 200;
        const sw = Math.sin(t * 1.3 + i * 0.7) * 10 + 8 + side * 6 * u0;
        const path = () => { q.beginPath(); q.moveTo(ax, ay); q.bezierCurveTo(ax + side * 8, ay + len * 0.2, ax + sw * 0.4, ay + len * 0.6, ax + sw, ay + len); };
        q.setLineDash([]); q.strokeStyle = i % 3 ? 'rgba(82,120,46,0.8)' : 'rgba(120,156,64,0.8)'; q.lineWidth = 2.6; path(); q.stroke();
        q.setLineDash([2.5, 3.5]); q.lineDashOffset = i * 1.7; q.strokeStyle = i % 2 ? 'rgba(220,230,130,0.75)' : 'rgba(176,210,96,0.75)'; q.lineWidth = 1.5; path(); q.stroke();
      }
      q.setLineDash([]);
    });
  }
  const KIDS = [
    { k: 'girl', x0: 120, xs: 1196, v: 520, y: 640, s: 1.18, top: '#f2a0b2', hair: 'buns', flower: '#ff5f8c', tail: '#3fa85e', claw: true, sash: '#3fa85e' },
    { k: 'b2', x0: -60, xs: 1130, v: 540, y: 636, s: 1.14, top: '#e8b640', hair: 'tuft', sword: 'up', sash: '#5a4a2a' },
    { k: 'hero', x0: 40, v: 420, y: 690, s: 1.38, top: '#cfe6ee', hair: 'tuft', ribbon: '#3b6db3', sword: 'up', look: 1 },
  ];
  XYT.registerShot('vb27_sunshower', {
    name: '太阳雨童戏', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(250,246,230,0.9)', accent: '#2f7a62', bloom: 0.35,
    draw(g, c) {
      const t = c.t, lt = Math.max(0, c.lt), id = 'vb27_sunshower';
      const c3 = chr(c, id, 3), c4 = chr(c, id, 4), c5 = chr(c, id, 5), c6 = chr(c, id, 6);
      // 镜头：跟着孩子从左往右移，最后停在檐下的他身上
      const SS = (XYT.sprites && XYT.sprites.S) || 1;
      const pan = Math.round(270 * (1 - easeInOut(clamp(lt / 2.0))) * SS) / SS;
      g.drawImage(vb27Far(), Math.round((pan * 0.45 - OX27) * SS) / SS, 0);
      g.save(); g.translate(pan, 0);
      g.drawImage(vb27Street(), -300, 526);
      const man = [902, 654], MS = 1.75;
      const bump = c3, take = c5 + 0.2, run2 = c6;
      // 孩子们的位置
      const ph0 = (c.b.x != null ? c.b.x : lt * 2.4) * PI;
      const st = KIDS.map((K0) => {
        const o = Object.assign({}, K0);
        o.ph = ph0 + K0.x0 * 0.013;
        let x, y = K0.y, run = 1;
        if (K0.k === 'hero') {
          // 李大侠追蛇妖，回头冲同伴喊，一头撞上檐下的老人
          const xb = man[0] - 66;
          if (lt < bump) { x = lerp(K0.x0, xb, lt / bump); y = lerp(K0.y, man[1] + 10, ss(bump - 0.9, bump, lt)); }
          else if (lt < take) {
            const e = lt - bump;
            x = xb - 64 * easeOut(clamp(e / 0.3)); y = man[1] + 10; run = 0; o.sword = null; o.look = 0; o.tilt = -0.28;
            o.reach = ss(c5 - 0.12, c5 + 0.12, lt);
          } else {
            // 接过剑，从他身前跑开
            const e2 = lt - take; x = xb - 64 + 520 * e2 * e2 + 200 * e2; y = man[1] + 10 + 34 * ss(0, 0.35, e2); run = ss(0, 0.15, e2); o.sword = 'up'; o.look = 0;
          }
        } else {
          // 另两个孩子从他身后跑过，停在右边，回头看
          const tStop = (K0.xs - K0.x0) / K0.v;
          if (lt < tStop) x = K0.x0 + K0.v * lt;
          else { x = K0.xs; run = 1 - ss(tStop, tStop + 0.2, lt); if (lt > tStop + 0.15) { o.facing = -1; o.look = 0; } }
        }
        o.run = run;
        return { K0, o, x, y };
      });
      // 水洼里的倒影：天光里翻转的孩子剪影
      for (const S of st) {
        for (const [px, py, rx, ry] of PUD27) {
          if (Math.abs(S.x - px) > rx * 0.9 || Math.abs(S.y - py) > 34) continue;
          g.save(); g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, TAU); g.clip();
          g.globalAlpha = 0.32; g.translate(S.x, S.y); g.scale(1, -0.55); g.translate(-S.x, -S.y);
          kid(g, S.x, S.y, S.K0.s, t, Object.assign({}, S.o, { refl: true }));
          g.restore();
        }
      }
      // 长长的影子拖向右下
      g.fillStyle = 'rgba(40,52,48,0.2)';
      for (const S of st) { g.save(); g.translate(S.x + 4, S.y + 2); g.rotate(0.2); g.beginPath(); g.ellipse(70 * S.K0.s, 0, 74 * S.K0.s, 7 * S.K0.s, 0, 0, TAU); g.fill(); g.restore(); }
      g.save(); g.translate(man[0], man[1] + 2); g.rotate(0.2); g.beginPath(); g.ellipse(120, 0, 130, 10, 0, 0, TAU); g.fill(); g.restore();
      // 柳与茶楼
      g.save(); g.translate(-20, 594); g.rotate(0.01 * Math.sin(t * 1.1)); g.drawImage(vb27Willow(0), -210, -440); g.restore();
      g.drawImage(vb27Tea(), 1150 - 380, 646 - 490);
      // 先画身后跑过的两个孩子，再画老人，最后画身前的李大侠
      for (const S of st) if (S.K0.k !== 'hero') kid(g, S.x, S.y, S.K0.s, t, S.o);
      // 老人：站在檐下；被撞后“闻”字单膝跪下拾剑，“笑”字递回，“传”字起身，转头望向茶楼，肩头轻轻一抖
      const jolt = lt > bump ? Math.exp(-(lt - bump) * 6) : 0;
      const base = { stage: 'old', facing: -1, prop: 'none', wind: 0.25, windDir: 1, rim: '#ffe0a0', light: [-80, -80], rimAlpha: 0.9, night: false };
      let fo;
      if (lt < c4) fo = Object.assign({ pose: 'stand', lean: -0.12 * jolt, head: 0.1 }, base);
      else if (lt < run2) fo = Object.assign({ pose: 'kneel', head: 0.25, lean: 0.06 }, base);
      else fo = Object.assign({ pose: 'lookBack', head: -0.3, lean: 0.02 + 0.025 * Math.sin((lt - run2) * TAU * 4) * Math.exp(-(lt - run2) * 2) }, base);
      const hero = st[2];
      const drawHero = () => kid(g, hero.x, hero.y, hero.K0.s, t, hero.o);
      if (lt >= take) F.draw(g, 'xiaoyao', man[0], man[1], MS, t, fo);
      drawHero();
      if (lt < take) F.draw(g, 'xiaoyao', man[0], man[1], MS, t, fo);
      // 木剑：撞上时脱手，落地弹两下；“闻”字被拾起，“笑”字递到两人之间，孩子接走
      if (lt > bump && lt < take) {
        const e = lt - bump, gx = man[0] - 52, gy = man[1] + 6;
        if (lt < c4 + 0.1) {
          const u = clamp(e / 0.3), hop = Math.abs(Math.sin(clamp((e - 0.3) / 0.3) * PI)) * 14 * (e > 0.3 ? 1 : 0);
          woodSword(g, lerp(man[0] - 70, gx, u), lerp(man[1] - 110, gy, u * u) - hop, 1.57 + (1 - u) * 5 + 0.05, 1.2, 0);
        } else {
          const P = F.points('xiaoyao', man[0], man[1], MS, t, fo);
          const kh = kidHand(hero.x, hero.y, hero.K0.s, hero.o);
          const pick = ss(c4 + 0.1, c4 + 0.26, lt), give = ss(c5 - 0.16, c5 + 0.08, lt);
          const hx = lerp(lerp(gx, P.handN[0], pick), kh[0] + 10, give), hy = lerp(lerp(gy, P.handN[1], pick), kh[1], give);
          // 剑横着递过去：剑柄朝着孩子
          woodSword(g, hx, hy, lerp(1.57, -1.57 + 0.2, pick), 1.2, 0);
        }
      }
      // 落脚水花：只在水洼里
      for (const S of st) {
        for (let j = 0; j < 3; j++) {
          const bi = c.b.i - j, t0 = c.grid ? c.grid.time(bi) : 0, age = t - t0;
          if (age < 0 || age > 0.55 || S.o.run < 0.5) continue;
          const x = S.x + 8, y = S.y + 2;
          const inP = PUD27.some(([px, py, rx, ry]) => Math.abs(x - px) < rx + 10 && Math.abs(y - py) < ry + 22);
          if (inP) { splash(g, x, y, age, 1.4, '#fffbe8', bi + S.K0.x0); g.save(); g.globalCompositeOperation = 'screen'; glow(g, x, y, 40, '#fff4c8', 0.45 * (1 - age / 0.55)); g.restore(); }
        }
      }
      g.restore();
      // 太阳雨：逆光的金色雨丝，迎光的几道亮得发白
      V.rain(g, c, { n: 170, angle: 0.1, speed: 1050, len: 56, color: '#ffe6a8', alpha: 0.7, blend: 'screen' });
      g.save(); g.globalCompositeOperation = 'screen'; g.lineCap = 'round';
      for (let i = 0; i < 30; i++) {
        const P = 0.7 + h2(i, 71) * 0.5, u = t / P + h2(i, 72), cyc = Math.floor(u), f = u - cyc;
        const x = h2(i * 31 + cyc, 73) * (W + 100) - 50 + f * 70, y = -60 + f * 840, tw = Math.sin(f * PI);
        g.strokeStyle = `rgba(255,248,214,${(0.85 * tw).toFixed(3)})`; g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5, y - 44); g.stroke();
        glow(g, x, y, 7, '#fff6d0', 0.75 * tw);
      }
      g.restore();
    },
  });

  // =====================================================================
  // 第32句 第16句 —— 檐下坠壶：醉卧屋脊的人松了手，旧葫芦沿瓦滚落，坠向噩梦
  // =====================================================================
  const EAVE = { x0: 180, y0: 470, x1: 1320, y1: 110 };
  const ED = (() => { const dx = EAVE.x1 - EAVE.x0, dy = EAVE.y1 - EAVE.y0, L = Math.hypot(dx, dy); return { dx: dx / L, dy: dy / L, L }; })();
  const eaveAt = (u, v) => [EAVE.x0 + ED.dx * u + ED.dy * v, EAVE.y0 + ED.dy * u - ED.dx * v];   // v>0 向屋顶内（左上）
  const PY28 = 1282, CAM28 = 662;   // 街面水洼（近景层坐标）、黑场时镜头下摇的总量
  // 对街（中景层）：远处一座塔的剪影，近处几重屋脊、白墙，一扇窗还亮着
  const AC0 = 380;
  function vb28Across() {
    return K.cache('g09_vb28_across3', W + 40, 680, 1, (q) => {
      q.translate(20, -AC0);
      const r = A.rng(282);
      E.clouds(q, { t: 0, y: 470, color: '#34466c', shade: '#141c30', alpha: 0.4, n: 4, seed: 33, scale: 0.9, speed: 0 });
      // 远塔
      q.fillStyle = '#121c32';
      const px = 640, pb = 506;
      for (let k = 0; k < 7; k++) {
        const w = 46 - k * 5, y = pb - k * 24;
        q.fillRect(px - w * 0.36, y - 18, w * 0.72, 18);
        q.beginPath(); q.moveTo(px - w * 0.62, y - 16); q.quadraticCurveTo(px, y - 24, px + w * 0.62, y - 16); q.lineTo(px + w * 0.5, y - 20); q.lineTo(px - w * 0.5, y - 20); q.closePath(); q.fill();
      }
      q.fillRect(px - 1.5, pb - 7 * 24 - 26, 3, 26);
      q.fillStyle = K.lin(q, 0, 400, 0, 560, [[0, 'rgba(34,53,92,0)'], [1, 'rgba(34,53,92,0.7)']]); q.fillRect(-20, 400, W + 40, 160);
      // 几重屋：屋面、正脊、翘角，下面白墙与窗
      const houses = [[-40, 300, 520, '#2c3852'], [230, 330, 560, '#283450'], [520, 300, 500, '#2e3a56'], [790, 360, 540, '#2a3652'], [1110, 260, 510, '#2c3854']];
      for (const [x, w, ry, wall] of houses) {
        const rh = 46 + r() * 16, wallTop = ry + rh;
        q.fillStyle = wall; q.fillRect(x + 12, wallTop, w - 24, 1000 - wallTop);
        q.fillStyle = 'rgba(0,0,0,0.25)'; q.fillRect(x + 12, wallTop, w - 24, 14);
        for (let k = 0; k < 3; k++) { q.fillStyle = '#121a2a'; q.fillRect(x + 50 + k * (w - 100) / 2 - 14, wallTop + 70 + (k % 2) * 40, 28, 38); }
        // 屋面
        q.fillStyle = '#0c1220';
        q.beginPath(); q.moveTo(x - 10, wallTop + 6); q.quadraticCurveTo(x + 6, wallTop - 2, x + 30, ry + 6); q.lineTo(x + w - 30, ry + 6); q.quadraticCurveTo(x + w - 6, wallTop - 2, x + w + 10, wallTop + 6); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(110,130,170,0.28)'; q.lineWidth = 1;
        for (let k = 1; k < 5; k++) { const yy = ry + 6 + (rh * k) / 5; q.beginPath(); q.moveTo(x + 30 - k * 6, yy); q.lineTo(x + w - 30 + k * 6, yy); q.stroke(); }
        for (let xx = x + 34; xx < x + w - 30; xx += 9) { q.strokeStyle = 'rgba(0,0,0,0.4)'; q.beginPath(); q.moveTo(xx, ry + 8); q.lineTo(xx + (xx - x - w / 2) * 0.08, wallTop + 2); q.stroke(); }
        // 正脊与两头翘起的脊吻
        q.fillStyle = '#080c16'; q.fillRect(x + 24, ry, w - 48, 7);
        q.beginPath(); q.moveTo(x + 24, ry + 7); q.quadraticCurveTo(x + 16, ry, x + 12, ry - 12); q.lineTo(x + 30, ry); q.closePath(); q.fill();
        q.beginPath(); q.moveTo(x + w - 24, ry + 7); q.quadraticCurveTo(x + w - 16, ry, x + w - 12, ry - 12); q.lineTo(x + w - 30, ry); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(140,160,200,0.35)'; q.beginPath(); q.moveTo(x + 24, ry + 0.5); q.lineTo(x + w - 24, ry + 0.5); q.stroke();
      }
      // 唯一亮着的一扇窗
      const lw = [880, 560 + 60];
      q.fillStyle = '#ffb860'; q.fillRect(lw[0], lw[1], 30, 40);
      q.fillStyle = '#5a3418'; q.fillRect(lw[0] + 14, lw[1], 2, 40); q.fillRect(lw[0], lw[1] + 19, 30, 2);
      q.globalCompositeOperation = 'lighter';
      q.fillStyle = K.rad(q, lw[0] + 15, lw[1] + 20, 0, 90, [[0, 'rgba(255,160,80,0.35)'], [1, 'rgba(255,160,80,0)']]); q.fillRect(lw[0] - 80, lw[1] - 70, 190, 180);
      q.globalCompositeOperation = 'source-over';
      // 夜雾罩一层
      q.fillStyle = 'rgba(20,32,58,0.22)'; q.fillRect(-20, AC0, W + 40, 680);
    });
  }
  // 近景街面：湿石板，路中一汪积水（倒映的天，末尾泛出血月）
  function vb28Street() {
    return K.cache('g09_vb28_street', W + 40, 220, 1, (q) => {
      q.translate(20, -(PY28 - 90));
      q.fillStyle = K.lin(q, 0, PY28 - 90, 0, PY28 + 130, [[0, '#141c2a'], [1, '#05070c']]); q.fillRect(-20, PY28 - 90, W + 40, 220);
      q.fillStyle = 'rgba(150,170,200,0.14)'; q.fillRect(-20, PY28 - 90, W + 40, 2);
      q.strokeStyle = 'rgba(0,0,0,0.5)'; q.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) { const yy = PY28 - 84 + k * k * 4.5; q.beginPath(); q.moveTo(-20, yy); q.lineTo(W + 20, yy); q.stroke(); }
      for (let k = -10; k < 30; k++) { q.beginPath(); q.moveTo(k * 60, PY28 - 84); q.lineTo(k * 60 + (k * 60 - 640) * 0.5, PY28 + 130); q.stroke(); }
      q.fillStyle = 'rgba(0,0,0,0.4)'; q.beginPath(); q.ellipse(430, PY28 + 2, 250, 30, 0, 0, TAU); q.fill();
      q.fillStyle = K.lin(q, 0, PY28 - 26, 0, PY28 + 26, [[0, '#2a3a5c'], [1, '#141e34']]); q.beginPath(); q.ellipse(430, PY28, 240, 26, 0, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(160,180,220,0.35)'; q.lineWidth = 1.2; q.beginPath(); q.ellipse(430, PY28, 240, 26, 0, PI * 1.05, PI * 1.95); q.stroke();
    });
  }
  // 屋面：瓦垄与一层层瓦的搭接（每片瓦下沿一道弯弯的瓦唇，深浅不一）；檐口下一条暗的檐底，椽头嵌在里面
  function vb28Roof() {
    return K.cache('g09_vb28_roof2', W, 560, 1, (q) => {
      q.save();
      q.beginPath(); q.moveTo(-40, -40); q.lineTo(W + 60, -40); q.lineTo(W + 60, EAVE.y1 - 30);
      const [ax, ay] = eaveAt(-160, 0), [bx, by] = eaveAt(ED.L + 80, 0);
      q.lineTo(bx, by); q.lineTo(ax, ay); q.closePath(); q.clip();
      q.fillStyle = K.lin(q, 0, 0, 520, 520, [[0, '#04060c'], [0.55, '#0a0f18'], [1, '#121a26']]); q.fillRect(-40, -40, W + 120, 620);
      const r = A.rng(28);
      // 一片片瓦：沿瓦垄方向（垂直檐口）逐层往里，越往里越扁越密
      for (let v = 6, k = 0; v < 900; k++) {
        const dv = 24 / (1 + k * 0.07);
        for (let u = -180; u < ED.L + 80; u += 28) {
          const uu = u - v * 0.29, lv = 0.08 + 0.12 * h2(u | 0, k), pa = eaveAt(uu, v), pb = eaveAt(uu + 26, v), pc = eaveAt(uu + 26, v + dv), pd = eaveAt(uu, v + dv);
          q.fillStyle = `rgba(80,100,140,${lv.toFixed(3)})`;
          q.beginPath(); q.moveTo(pa[0], pa[1]); q.lineTo(pb[0], pb[1]); q.lineTo(pc[0], pc[1]); q.lineTo(pd[0], pd[1]); q.closePath(); q.fill();
          // 瓦唇：下沿一道弯
          const mid = eaveAt(uu + 13, v - 3.5);
          q.strokeStyle = `rgba(0,0,0,${(0.45 + 0.2 * h2(k, u | 0)).toFixed(3)})`; q.lineWidth = 1.6;
          q.beginPath(); q.moveTo(pa[0], pa[1]); q.quadraticCurveTo(mid[0], mid[1], pb[0], pb[1]); q.stroke();
          q.strokeStyle = `rgba(150,170,210,${(0.06 + 0.1 * h2(u | 0, k + 5)).toFixed(3)})`; q.lineWidth = 1;
          const m2 = eaveAt(uu + 13, v - 2); q.beginPath(); q.moveTo(pa[0], pa[1] - 1.5); q.quadraticCurveTo(m2[0], m2[1] - 1.5, pb[0], pb[1] - 1.5); q.stroke();
        }
        v += dv;
      }
      // 瓦垄之间的深槽
      for (let u = -180; u < ED.L + 80; u += 28) {
        const [x0, y0] = eaveAt(u, 2), [x1, y1] = eaveAt(u - 260, 900);
        q.strokeStyle = 'rgba(0,0,0,0.55)'; q.lineWidth = 2.4; q.beginPath(); q.moveTo(x0, y0); q.lineTo(x1, y1); q.stroke();
      }
      // 灯笼照亮的那一段屋面
      q.globalCompositeOperation = 'lighter';
      const [lx, ly] = eaveAt(170, 30);
      q.fillStyle = K.rad(q, lx, ly, 0, 300, [[0, 'rgba(255,140,60,0.3)'], [1, 'rgba(255,140,60,0)']]); q.fillRect(-40, -40, W + 120, 620);
      q.globalCompositeOperation = 'source-over';
      q.restore();
      // 檐底：檐口下一条暗带，椽头一排嵌在里面
      const [s0x, s0y] = eaveAt(-160, 0), [s1x, s1y] = eaveAt(ED.L + 80, 0), [s2x, s2y] = eaveAt(ED.L + 80, -28), [s3x, s3y] = eaveAt(-160, -28);
      q.fillStyle = K.lin(q, 0, 0, 0, 30, [[0, '#06080e'], [1, '#0e1420']]);
      q.beginPath(); q.moveTo(s0x, s0y); q.lineTo(s1x, s1y); q.lineTo(s2x, s2y); q.lineTo(s3x, s3y); q.closePath(); q.fill();
      for (let u = -120; u < ED.L; u += 34) {
        const warm = Math.max(0, 1 - Math.abs(u - 170) / 240), [x, y] = eaveAt(u, -16);
        q.save(); q.translate(x, y); q.rotate(Math.atan2(ED.dy, ED.dx));
        q.fillStyle = mix('#151a24', '#7a4420', warm); q.fillRect(-5, -6, 10, 11);
        q.fillStyle = mix('#05070c', '#2a1408', warm); q.fillRect(-5, 3, 10, 2);
        q.restore();
      }
      q.strokeStyle = 'rgba(140,160,200,0.18)'; q.lineWidth = 1; q.beginPath(); q.moveTo(s3x, s3y); q.lineTo(s2x, s2y); q.stroke();
      // 檐口：瓦当、滴水
      for (let u = -140; u < ED.L + 60; u += 28) {
        const [x, y] = eaveAt(u, 0), warm = Math.max(0, 1 - Math.abs(u - 170) / 260);
        q.fillStyle = mix('#1c2432', '#5a3a26', warm * 0.8); q.beginPath(); q.arc(x, y, 10, 0, TAU); q.fill();
        q.strokeStyle = rgba(warm > 0.2 ? '#ffb070' : '#a0b4dc', 0.35 + warm * 0.3); q.lineWidth = 1; q.beginPath(); q.arc(x, y, 10, PI * 0.9, PI * 1.7); q.stroke();
        q.fillStyle = 'rgba(0,0,0,0.4)'; q.beginPath(); q.arc(x, y, 4, 0, TAU); q.fill();
        const [dx, dy] = eaveAt(u + 14, -2);
        q.fillStyle = mix('#101620', '#3a2618', warm * 0.8); q.beginPath(); q.moveTo(dx - 9, dy - 3); q.lineTo(dx + 9, dy - 9); q.lineTo(dx + 3, dy + 13); q.closePath(); q.fill();
      }
      // 老屋顶上的瓦松
      for (const uu of [120, 380, 560, 760]) {
        const [x, y] = eaveAt(uu, 14);
        q.strokeStyle = uu < 400 ? 'rgba(255,170,100,0.5)' : 'rgba(130,150,190,0.45)'; q.lineWidth = 1.3; q.lineCap = 'round';
        for (let k = 0; k < 9; k++) { const a = -PI / 2 + (k - 4) * 0.22 + (h2(uu, k) - 0.5) * 0.2, l = 10 + h2(k, uu) * 14; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); q.stroke(); }
      }
    });
  }
  // 醉卧屋脊的人：只露一条搭在瓦上的小臂、垂下檐口的宽袖、松开的手和几缕白发
  function sleeper(g, t, loose, lt) {
    const [ex, ey] = eaveAt(948, 0);
    const sw = Math.sin(t * 1.1) * 4 + Math.sin(t * 2.3) * 1.5;
    // 白发：从画框外的头上散下来，铺过瓦面，几缕垂出檐口
    g.lineCap = 'round';
    for (let k = 0; k < 11; k++) {
      const x0 = 1078 + k * 7 + h2(k, 21) * 8, over = h2(k, 26) < 0.55, [hx, hy] = eaveAt(1000 + k * 8.5, over ? -2 : 10 + 30 * h2(k, 27));
      const len = over ? 20 + h2(k, 22) * 60 : 0, cv = (h2(k, 23) - 0.5) * 40, ws = Math.sin(t * 1.3 + k * 0.8) * 5;
      g.strokeStyle = `rgba(232,228,220,${(0.35 + 0.4 * h2(k, 24)).toFixed(2)})`; g.lineWidth = 0.7 + h2(k, 25) * 0.9;
      g.beginPath(); g.moveTo(x0, -6); g.bezierCurveTo(x0 - 16 + cv, 50, hx + cv * 0.6, hy - 40, hx, hy);
      if (over) g.quadraticCurveTo(hx + ws * 0.5 + cv * 0.2, hy + len * 0.5, hx + ws + cv * 0.3, hy + len);
      g.stroke();
    }
    // 小臂：从画框上沿伸下，搭在瓦上，到檐口
    const sh = [1006, -20], el = eaveAt(966, 26), wr = eaveAt(948, 4);
    g.strokeStyle = '#3a414c'; g.lineWidth = 22;
    g.beginPath(); g.moveTo(sh[0], sh[1]); g.quadraticCurveTo(el[0] + 10, el[1] - 30, el[0], el[1]); g.lineTo(wr[0], wr[1]); g.stroke();
    g.strokeStyle = 'rgba(160,178,210,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(sh[0] - 11, sh[1]); g.quadraticCurveTo(el[0] - 2, el[1] - 34, el[0] - 10, el[1] - 4); g.stroke();
    // 宽袖：从小臂下垂出檐口，几道收尖的褶，随风轻摆
    g.fillStyle = K.lin(g, ex - 40, 0, ex + 40, 0, [[0, '#262c36'], [0.5, '#46505c'], [1, '#22282e']]);
    const tips = [[-34, 96], [-14, 112], [8, 104], [26, 88]];
    g.beginPath(); g.moveTo(el[0] - 18, el[1] - 4); g.quadraticCurveTo(ex - 40, ey + 10, ex - 36 + sw * 0.6, ey + 40);
    for (const [tx, ty] of tips) { const px2 = ex + tx + sw * (ty / 100), py2 = ey + ty; g.lineTo(px2, py2); g.lineTo(px2 + 6, py2 - 30); }
    g.quadraticCurveTo(ex + 34, ey + 10, el[0] + 22, el[1] + 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(8,10,14,0.6)'; g.lineWidth = 1;
    for (const [tx, ty] of tips) { g.beginPath(); g.moveTo(ex + tx * 0.4, ey + 4); g.lineTo(ex + tx + sw * (ty / 100) + 2, ey + ty - 4); g.stroke(); }
    g.strokeStyle = 'rgba(150,170,200,0.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(el[0] - 18, el[1] - 4); g.quadraticCurveTo(ex - 40, ey + 10, ex - 36 + sw * 0.6, ey + 40); g.stroke();
    // 手：垂过瓦当，五指松开
    const hx = ex - 8 + sw * 0.4, hy = ey + 30;
    g.fillStyle = '#c6b8a6';
    g.beginPath(); g.ellipse(hx, hy, 8, 10, 0.2, 0, TAU); g.fill();
    g.strokeStyle = '#c6b8a6'; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const a = PI / 2 + (k - 1.5) * 0.24, l = 11 + loose * 5; g.beginPath(); g.moveTo(hx + (k - 1.5) * 3, hy + 6); g.quadraticCurveTo(hx + (k - 1.5) * 4 + Math.cos(a) * l * 0.6 - (1 - loose) * 6, hy + 6 + l * 0.6, hx + (k - 1.5) * 4 + Math.cos(a) * l - (1 - loose) * 9, hy + 6 + l * (0.5 + 0.5 * loose)); g.stroke(); }
    return [hx, hy + 16];
  }
  XYT.registerShot('vb28_gourdfall', {
    name: '檐下坠壶', zone: 'left', night: true, text: '#e9f1f6', shadow: 'rgba(6,10,24,0.92)', accent: '#ff9a50', bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = Math.max(0, c.lt), id = 'vb28_gourdfall';
      const c0 = chr(c, id, 0), c1 = chr(c, id, 1), c2 = chr(c, id, 2);
      const tB = c.dur - 0.33;   // 落地前一瞬黑场
      // 葫芦：醉——从松开的指间滑落到瓦上；梦——沿檐滚下，每道瓦垄一颠，拍点上颠得最高；中——飞出檐口，慢镜头坠落
      const GS = 0.72, GR = 22, uStart = 900, uEdge = 300;
      const roll = clamp((lt - c1) / (c2 - c1));
      let gx, gy, gang = 0;
      const dist = (uStart - uEdge) * (0.3 * roll + 0.7 * roll * roll);
      const T2 = tB - c2, A2 = (2 * (PY28 - 34 - eaveAt(uEdge, GR + 4)[1] - 30 * T2)) / (T2 * T2);
      if (lt < c1) {
        // 醉：葫芦躺在腕边的瓦上，红绳一松，它晃了晃、慢慢歪倒
        const dr = easeIn(clamp((lt - c0) / 0.35));
        [gx, gy] = eaveAt(uStart - 6 * dr, GR + 4);
        gang = -0.5 + 0.08 * Math.sin(t * 1.6) * (1 - dr) - 0.7 * dr;
      } else if (lt < c2) {
        const gu = uStart - dist, ridge = Math.abs(Math.sin((gu / 28) * PI));
        let beat = 0;
        for (let k = 0; k < 2; k++) { const tb = c.grid ? c.grid.time(c.b.i - k) : 0, d = t - tb; if (d >= 0 && tb >= t - lt + c1) beat += 12 * Math.exp(-d / 0.14) * Math.sin(Math.min(PI, (d / 0.22) * PI)); }
        [gx, gy] = eaveAt(gu, GR + 4 + ridge * 6 + Math.max(0, beat));
        gang = -1.2 - dist / GR;
      }
      const u = lt - c2;
      const [ex, ey] = eaveAt(uEdge, GR + 4);
      const fallX = (s) => ex - 46 * s - 20 * Math.sin(s * 0.9), fallY = (s) => ey + 30 * s + 0.5 * A2 * s * s;
      let camY = 0;
      if (u >= 0) {
        gx = fallX(u); gy = fallY(u);
        gang = -1.2 - (uStart - uEdge) / GR - 1.2 * u;
        // 甩镜：先让葫芦落出一截，再跟着往下掉；末尾镜头放慢，街面迎上来
        camY = CAM28 * smooth(clamp((u - 0.08) / (T2 - 0.08)));
      }
      const SS = (XYT.sprites && XYT.sprites.S) || 1, rq = (v) => Math.round(v * SS) / SS;
      // 背景随镜头下摇：天最慢，对街次之，近处屋檐与街面最快
      const skO = -camY * 0.15;
      g.fillStyle = K.lin(g, 0, skO, 0, skO + 900, [[0, '#0a1430'], [0.45, '#182a4e'], [1, '#22355c']]); g.fillRect(-40, -40, W + 80, H + 80);
      g.fillStyle = 'rgba(220,230,255,0.7)';
      for (let i = 0; i < 46; i++) { const sy = h2(i, 62) * 560 + skO, tw = 0.5 + 0.5 * Math.sin(t * (1 + h2(i, 63) * 2) + i); if (sy > -4 && sy < H) { g.globalAlpha = 0.35 + 0.5 * tw; g.fillRect(h2(i, 61) * W, sy, 1.6, 1.6); } }
      g.globalAlpha = 1;
      const acY = rq(AC0 - camY * 0.62);
      if (acY < H) g.drawImage(vb28Across(), -20, acY);
      // 街面与积水：越接近地面，水里越映出一轮血红的月
      const stY = rq(PY28 - 90 - camY);
      if (stY < H) {
        g.drawImage(vb28Street(), -20, stY);
        const red = ss(1.6, T2, u), py = PY28 - camY;
        g.save(); g.beginPath(); g.ellipse(430, py, 240, 26, 0, 0, TAU); g.clip();
        if (red > 0) {
          g.fillStyle = `rgba(150,16,24,${(0.55 * red).toFixed(3)})`; g.fillRect(190, py - 30, 480, 60);
          const mx = 480 + Math.sin(t * 3) * 2;
          g.save(); g.translate(mx, py - 4); g.scale(1, 0.32);
          g.fillStyle = mix('#5a1a1c', '#ff3a2a', red); g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill();
          g.restore();
          add(g, () => glow(g, mx, py - 4, 90, '#d82828', 0.45 * red));
        }
        // 涟漪：酒珠落进水里
        for (let k = 0; k < 3; k++) {
          const a = ((t * 0.9 + k / 3) % 1);
          g.strokeStyle = red > 0.2 ? `rgba(255,120,110,${(0.5 * (1 - a)).toFixed(3)})` : `rgba(170,190,230,${(0.4 * (1 - a)).toFixed(3)})`; g.lineWidth = 1.2;
          g.beginPath(); g.ellipse(480, py - 4, 10 + a * 90, 2 + a * 10, 0, 0, TAU); g.stroke();
        }
        g.restore();
      }
      // 屋檐、灯笼、醉卧的人
      const roofY = rq(-camY);
      const [lx, ly] = eaveAt(170, -26);
      if (roofY > -600) {
        g.save(); g.translate(0, roofY);
        g.drawImage(vb28Roof(), 0, 0);
        const near = u > 0 ? Math.exp(-Math.pow((u - 0.45) / 0.35, 2)) : 0;
        add(g, () => { glow(g, lx, ly + 60, 220, '#ff8a3a', 0.3); glow(g, lx + 40, ly - 20, 150, '#ffb060', 0.14); });
        E.lantern(g, { x: lx, y: ly, s: 1.25, t, cord: 26, swing: 0.06 + 0.12 * near, text: '酒', glowColor: '#ff9a4a' });
        const loose = ss(c0 - 0.05, c0 + 0.3, lt);
        const hand = sleeper(g, t, loose, lt);
        if (lt < c1 + 0.3) {
          // 葫芦的红绳：先绕在指间，“醉”字从指间滑脱，搭在檐口垂着
          const nx = gx + 6, ny = gy - 10 + roofY * 0, slip = loose;
          const endX = lerp(hand[0], nx - 10, slip), endY = lerp(hand[1] - 6, ny + 34, slip) + 4 * Math.sin(t * 2);
          const cA = clamp(1 - (lt - c1) / 0.3);
          g.strokeStyle = `rgba(184,53,42,${cA.toFixed(3)})`; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(nx, ny); g.quadraticCurveTo((nx + endX) / 2 + 6, Math.max(ny, endY) + 10, endX, endY); g.stroke();
        }
        g.restore();
      }
      // 洒出的酒珠：像一串被灯笼照亮的星子，慢慢浮在下坠的葫芦上方
      if (u >= 0) add(g, () => {
        for (let k = 0; k < 24; k++) {
          const te = 0.03 + k * 0.09;
          if (u < te) break;
          const a = u - te, ang = h2(k, 5) * TAU, sp = 16 + 46 * h2(k, 6), gk = 0.45 * A2 + 0.4 * A2 * h2(k, 10);
          const vy0 = 30 + A2 * te;
          const px = fallX(te) - 46 * a + Math.cos(ang) * sp * a, wy = fallY(te) + vy0 * a + 0.5 * gk * a * a + Math.sin(ang) * sp * a * 0.7;
          const py = wy - camY;
          if (wy > PY28 - 6 || py > H + 20) continue;
          const warm = clamp(1 - Math.hypot(px - lx, wy - ly - 60) / 380), red = ss(1.7, T2, u);
          const col = red > 0.4 ? mix('#ff8a70', '#ff4a40', red) : warm > 0.25 ? '#ffcf8a' : '#cfe4ff';
          const tw = 0.6 + 0.4 * Math.sin(t * 6 + k * 1.9);
          glow(g, px, py, 7 + 6 * h2(k, 8), col, 0.75 * tw);
          g.fillStyle = `rgba(255,255,255,${(0.85 * tw).toFixed(2)})`; g.fillRect(px - 1, py - 1, 2, 2);
        }
      });
      E.gourd(g, { x: gx, y: gy - camY, s: GS, angle: gang, t, color: '#b8863e' });
      { // 灯笼照亮葫芦的一侧
        const warm = clamp(1 - Math.hypot(gx - lx, gy - ly - 60) / 360);
        if (warm > 0) add(g, () => glow(g, gx - 6, gy - camY - 4, 46, '#ffb060', 0.4 * warm));
      }
      // 坠入梦魇：末段四周压暗，透出一点血色
      const dk = ss(1.9, T2, u);
      if (dk > 0) { g.fillStyle = `rgba(16,0,4,${(0.32 * dk).toFixed(3)})`; g.fillRect(-40, -40, W + 80, H + 80); }
      const blk = ss(tB - 0.05, tB, lt);
      if (blk > 0) { g.fillStyle = `rgba(0,0,0,${blk.toFixed(3)})`; g.fillRect(-40, -40, W + 80, H + 80); }
    },
  });

})();
