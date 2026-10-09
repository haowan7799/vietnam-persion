/* 分镜镜头 第 12 组：副歌3 前四句 —— 雪巅长啸、霜剑为碑、雪原遗物、冰池倒影（每句后半硬切一格工笔重彩回忆） */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, hash, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 通用 ----------
  // 本句第 k 个字在镜头内的时刻；取不到或明显不对时用分镜表里的实测值
  function ct(c, k, fb) {
    const v = c.charT ? c.charT(k) : null;
    if (v == null) return fb;
    const r = v - (c.t - c.lt);
    return r > -1 && r < c.dur + 1 ? r : fb;
  }
  const win = (x, a, b) => smooth((x - a) / Math.max(1e-3, b - a));
  // 半径为负时画布会抛错，这里一律夹到 0
  const ellS = (g, x, y, rx, ry, r, a0, a1, ccw) => g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), r, a0, a1, ccw);
  const arcS = (g, x, y, r, a0, a1, ccw) => g.arc(x, y, Math.max(0, r), a0, a1, ccw);
  // 临时画布：每次取用都整张清空，不跨帧保存任何东西
  const scr = {};
  function scratch(name, w, h, k = 1) {
    const S = ((XYT.sprites && XYT.sprites.S) || 1) * k;
    let cv = scr[name];
    if (!cv) cv = scr[name] = document.createElement('canvas');
    const pw = Math.max(1, Math.ceil(w * S)), ph = Math.max(1, Math.ceil(h * S));
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, pw, ph);
    x.setTransform(S, 0, 0, S, 0, 0);
    cv.lw = w; cv.lh = h;
    return [cv, x];
  }
  function vgrad(g, x0, y0, x1, y1, stops) { g.fillStyle = K.lin(g, 0, y0, 0, y1, stops); g.fillRect(x0, y0, x1 - x0, y1 - y0); }
  function lighter(g, fn) { const op = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; fn(); g.globalCompositeOperation = op; }
  function glowA(g, x, y, r, col, a) { if (a > 0.003) { const ga = g.globalAlpha; A.glow(g, x, y, r, col, a * ga); g.globalAlpha = ga; } }

  // 竖向光帘贴图（极光、光柱共用）：底亮顶淡、两侧羽化，白色，按色另存
  function raySpr(col) {
    return K.cache('g12ray|' + col, 24, 256, 0.5, (g) => {
      vgrad(g, 0, 0, 24, 256, [[0, rgba(col, 0)], [0.55, rgba(col, 0.35)], [0.9, rgba(col, 1)], [1, rgba(col, 0)]]);
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = K.lin(g, 0, 0, 24, 0, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      g.fillRect(0, 0, 24, 256);
    });
  }
  // 柔边横条（风雪、雾痕）
  function barSpr(col) {
    return K.cache('g12bar|' + col, 128, 16, 0.5, (g) => {
      const gr = g.createRadialGradient(64, 8, 0, 64, 8, 64);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(1, rgba(col, 0));
      g.save(); g.scale(1, 0.125); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.restore();
    });
  }
  // 小粒子：柔点
  function dotSpr(col) {
    return K.cache('g12dot|' + col, 16, 16, 1, (g) => {
      const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.45, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
    });
  }

  // 局部的一团雪雾（E.mist 会横向铺满整幅，局部的烟团用这个）
  function puff(g, x, y, rx, ry, col, a, seed) {
    if (a <= 0.01) return;
    const sp = dotSpr(col), ga = g.globalAlpha;
    for (let i = 0; i < 6; i++) {
      const px = x + (h2(i, seed) - 0.5) * rx * 1.2, py = y + (h2(i, seed + 1) - 0.5) * ry * 0.8, r = 0.5 + 0.5 * h2(i, seed + 2);
      g.globalAlpha = ga * a * 0.5; g.drawImage(sp, px - rx * r, py - ry * r, rx * 2 * r, ry * 2 * r);
    }
    g.globalAlpha = ga;
  }

  // 回忆插格：工笔重彩的暖色绢面、描金细框、朱印；k 为插格内时间
  function memFrame(g, k, o = {}) {
    // 绢纹
    g.save();
    g.globalAlpha = 0.07; g.strokeStyle = '#5a3a1a'; g.lineWidth = 0.6;
    g.beginPath();
    for (let y = 3; y < H; y += 5) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
    g.globalAlpha = 1;
    // 暖色晕边
    const vg = g.createRadialGradient(640, 360, 300, 640, 360, 820);
    vg.addColorStop(0, 'rgba(120,60,20,0)'); vg.addColorStop(1, rgba(o.edge || '#3a1a08', 0.55));
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // 描金双线框
    g.strokeStyle = rgba('#e8c46a', 0.75); g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44);
    g.strokeStyle = rgba('#e8c46a', 0.4); g.lineWidth = 0.8; g.strokeRect(30, 30, W - 60, H - 60);
    // 朱印
    if (o.seal !== false) A.seal(g, o.sealX ?? W - 74, o.sealY ?? H - 78, 34, o.sealText || '忆', 0.85);
    // 切入时一闪
    if (o.flash !== false && k < 0.12) { g.fillStyle = rgba('#fff4d8', 0.55 * (1 - k / 0.12)); g.fillRect(0, 0, W, H); }
    g.restore();
  }

  // ======================================================================
  // 41 · c3_wake 雪巅长啸
  // ======================================================================
  const WK = { l: [0.24, 0.58, 1.0, 1.36, 2.08, 2.66, 3.12, 3.58, 3.94, 4.26, 4.82], mem: 5.24 };
  const AUR = ['#48c0a3', '#5ab8d8', '#b0a4e3', '#f0a8c8', '#f2be45'];
  // 夜空底：深靛到天边一抹青紫
  function wakeSky() {
    return K.cache('g12wakeSky', W, H, 0.5, (g) => {
      vgrad(g, 0, 0, W, H, [[0, '#070912'], [0.35, '#101830'], [0.62, '#1f2e58'], [0.78, '#2e4e7e'], [1, '#3a557e']]);
      const gr = g.createRadialGradient(760, 560, 40, 760, 560, 700);
      gr.addColorStop(0, 'rgba(110,190,190,0.28)'); gr.addColorStop(0.5, 'rgba(120,110,190,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
  }
  // 五色极光：一条打了两道褶的光幕（底边是 S 形，褶子处光帘重叠更亮），竖向光帘沿底边排开，随时间流动明灭
  function aurora(g, t, a, o = {}) {
    if (a <= 0.01) return;
    const n = o.n ?? 72, x0 = o.x0 ?? 200, x1 = o.x1 ?? 1340, Y = o.y ?? 360, span = x1 - x0;
    // 底边：x 来回折两次（褶），y 上下 ±60
    const foot = (u) => [
      x0 + u * span + span * 0.11 * Math.sin(u * TAU * 2 + 0.4 + t * 0.12),
      Y - 60 * Math.sin(u * TAU + 0.9 + t * 0.08) - 14 * Math.sin(u * 9.1 + t * 0.3),
    ];
    // 光帘都很柔，先在四分之一分辨率的临时画布里叠好，再一次性加亮贴回（只取光带那一截）
    const k = 1 / 4, bx = -60, by = Y - 380, bw = W + 120, bh = 460;
    const [cv, q] = scratch('g12aurora', bw, bh, k);
    q.translate(-bx, -by);
    q.globalCompositeOperation = 'lighter';
    const colAt = (u) => AUR[clamp(u * 4.6 + 0.3 * Math.sin(t * 0.2 + u * 3), 0, 4.999) | 0];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), [x, base] = foot(u);
      const hh = 180 + 150 * noise1(u * 6 + 3 + t * 0.12, 9), ww = 24 + 20 * h2(i, 3);
      const ci = u * 4.6, warm = ci > 2.6 ? 1.7 : 1;
      const lv = (0.3 + 0.7 * Math.pow(noise1(u * 5 - t * 0.35, 11), 1.5)) * (0.55 + 0.45 * Math.sin(t * 1.3 + i * 0.9) ** 2) * warm;
      const c0 = colAt(u), edge = Math.min(1, u / 0.12, (1 - u) / 0.08);
      q.globalAlpha = clamp(a * lv * 0.32 * edge);
      q.drawImage(raySpr(c0), x - ww / 2, base - hh, ww, hh * 1.06);
      // 细亮的光帘丝
      if (i % 2 === 0) { q.globalAlpha = clamp(a * lv * 0.42 * edge); q.drawImage(raySpr(i % 4 ? '#e8fff4' : c0), x - 3 + 8 * Math.sin(t * 0.7 + i), base - hh * 0.82, 6 + 3 * h2(i, 5), hh * 0.85); }
      // 光幕底边更亮：在软缓冲里点一串亮斑，放大后成一道柔亮的下沿（亮度随光帘明灭，断断续续）
      q.globalAlpha = clamp(a * lv * 0.5 * edge); q.drawImage(barSpr(i % 3 ? '#d8fff0' : c0), x - ww * 0.9, base - 10, ww * 1.8, 12);
    }
    q.globalAlpha = 1;
    // 光带底下的一层柔光
    for (let j = 0; j < 4; j++) { const u = (j + 0.5) / 4, [fx, fy] = foot(u); glowA(q, fx, fy - 40, 260, AUR[[0, 1, 3, 4][j]], a * (j > 1 ? 0.2 : 0.12)); }
    lighter(g, () => g.drawImage(cv, 0, 0, cv.width, cv.height, bx, by, bw, bh));
  }

  // 工笔淡彩的侧脸（朝左、微仰）：局部坐标以眼为原点
  function faceProfile(g) {
    g.beginPath();
    g.moveTo(-4, -112);
    g.bezierCurveTo(-30, -108, -45, -82, -47, -54);
    g.bezierCurveTo(-48, -40, -47, -29, -44, -22);
    g.bezierCurveTo(-41, -16, -42, -11, -45, -5);
    g.bezierCurveTo(-52, 11, -61, 27, -68, 38);
    g.bezierCurveTo(-73, 45, -69, 52, -61, 52);
    g.bezierCurveTo(-56, 52, -53, 56, -50, 59);
    g.bezierCurveTo(-50, 65, -52, 71, -53, 77);
    g.bezierCurveTo(-54, 81, -50, 84, -46, 85.5);
    g.bezierCurveTo(-50, 88, -53, 92, -50.5, 96.5);
    g.bezierCurveTo(-47.5, 100, -43, 103, -42.5, 107);
    g.bezierCurveTo(-44, 115, -49.5, 125, -48, 136);
    g.bezierCurveTo(-46.5, 147, -37, 155, -24, 156);
    g.bezierCurveTo(0, 157, 32, 145, 50, 127);
    g.bezierCurveTo(62, 116, 69, 98, 71, 78);
    g.lineTo(82, -30);
    g.bezierCurveTo(86, -88, 44, -122, -4, -112);
    g.closePath();
  }
  function faceTex() {
    return K.cache('g12face2', 420, 520, 1.6, (g) => {
      g.translate(190, 220);
      // 颈：大半在阴影里
      g.fillStyle = K.lin(g, -10, 0, 100, 0, [[0, '#a8a2ae'], [0.6, '#5e5f78'], [1, '#3a3c52']]);
      g.beginPath(); g.moveTo(-6, 146); g.bezierCurveTo(-2, 180, 0, 210, 4, 260); g.lineTo(84, 260); g.bezierCurveTo(78, 200, 72, 160, 66, 112); g.closePath(); g.fill();
      // 脸：冷夜里的象牙色，前亮后暗
      faceProfile(g);
      g.fillStyle = K.lin(g, -72, 0, 82, 0, [[0, '#e8ddd2'], [0.3, '#d6c9c2'], [0.62, '#a6a0b0'], [1, '#6c6c86']]);
      g.fill();
      g.save(); faceProfile(g); g.clip();
      const blob = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
      blob(-16, 36, 34, '#d88e86', 0.3);   // 颧红
      blob(-22, -6, 20, '#5e5a78', 0.32);  // 眼窝
      blob(28, 122, 74, '#3e3e5a', 0.5);   // 下颌阴影
      blob(42, 20, 58, '#4e4e6c', 0.32);   // 腮后
      blob(-56, 40, 14, '#e4a090', 0.2);   // 鼻头
      blob(-30, -70, 40, '#f2ebe4', 0.25); // 额光
      // 下颌一层淡淡的胡茬
      g.fillStyle = 'rgba(120,120,140,0.10)';
      for (let k = 0; k < 160; k++) { const a = h2(k, 61), x = lerp(-44, 46, a), y = lerp(100, 156, h2(k, 62)) - a * 18; g.fillRect(x, y, 1, 1.4); }
      g.restore();
      // 耳
      g.fillStyle = K.lin(g, 50, 0, 82, 0, [[0, '#b8aeb6'], [1, '#76768e']]);
      g.beginPath(); g.moveTo(54, 16); g.bezierCurveTo(56, -2, 80, -4, 82, 20); g.bezierCurveTo(84, 40, 76, 58, 66, 66); g.bezierCurveTo(60, 70, 54, 64, 56, 56); g.closePath(); g.fill();
      g.strokeStyle = rgba('#3a2c34', 0.55); g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(60, 14); g.bezierCurveTo(64, 4, 78, 8, 77, 24); g.bezierCurveTo(76, 38, 70, 48, 64, 56); g.stroke();
      // 工笔细墨线：外轮廓
      faceProfile(g);
      g.strokeStyle = 'rgba(40,28,34,0.9)'; g.lineWidth = 1.1; g.stroke();
      // 鼻翼、鼻孔
      g.strokeStyle = 'rgba(56,38,44,0.7)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(-56, 43); g.bezierCurveTo(-48, 39, -43, 46, -47, 54); g.stroke();
      g.fillStyle = 'rgba(60,36,42,0.5)'; g.beginPath(); ellS(g, -54, 51.5, 4, 1.5, -0.2, 0, TAU); g.fill();
      // 唇色
      g.fillStyle = rgba('#b77a7a', 0.6);
      g.beginPath(); g.moveTo(-52.5, 78); g.bezierCurveTo(-51.5, 82, -48, 85, -40, 85.5); g.lineTo(-46, 85.5); g.bezierCurveTo(-50.5, 88, -52.5, 92, -50, 96); g.bezierCurveTo(-45.5, 95, -42, 91, -40, 86); g.closePath(); g.fill();
      // 额上几道浅纹（风霜）
      g.strokeStyle = 'rgba(70,52,62,0.2)'; g.lineWidth = 0.7;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-44 + k * 2, -60 - k * 7); g.quadraticCurveTo(-28, -64 - k * 7, -14, -60 - k * 7); g.stroke(); }
      // 眉：灰白细毛，一根根顺着长
      g.lineCap = 'round';
      for (let k = 0; k < 30; k++) {
        const u = k / 29, x = lerp(-44, 6, u), y = -29 - 9 * Math.sin(u * 2.6) + (h2(k, 4) - 0.5) * 3;
        g.strokeStyle = rgba(h2(k, 5) > 0.45 ? '#f4f4f6' : '#9a9aa8', 0.9); g.lineWidth = 1.3 - u * 0.5;
        g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + 9 + u * 5, y - 2 - (1 - u) * 2); g.stroke();
      }
    });
  }
  // 渐细的一绺（头发、发带、衣褶共用）：pts 中心线，w0→w1 宽度
  function lock(g, pts, w0, w1) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = lerp(w0, w1, i / (n - 1)) / 2;
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    g.beginPath(); g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath(); g.fill();
  }
  // 一绺头发的中心线：根部顺风横出，越往梢越受重力下垂，梢头随风大幅摆动
  function hairLine(sx, sy, L, sag, ph, t, wind, n = 10) {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n, wv = (40 * u * u * Math.sin(t * 1.6 - u * 3 + ph) + 10 * u * Math.sin(t * 3.1 - u * 6 + ph)) * wind;
      pts.push([sx + u * L * (1 - 0.12 * u * u), sy + u * u * sag + wv]);
    }
    return pts;
  }
  // 根部实、梢头淡的渐变（沿发丝方向）
  function tipFade(g, pts, col, a0) {
    const p0 = pts[0], p1 = pts[pts.length - 1];
    return K.lin(g, p0[0], p0[1], p1[0], p1[1], [[0, rgba(col, a0)], [0.55, rgba(col, a0 * 0.75)], [1, rgba(col, 0)]]);
  }
  // 脑后白发：14 绺粗发打底，40 根细丝在上，长度有限、垂坠、梢头飘散
  function hairBack(g, t, wind) {
    for (let i = 0; i < 14; i++) {
      const sx = lerp(56, 96, h2(i, 21)), sy = lerp(-150, 10, h2(i, 22));
      const L = lerp(170, 320, h2(i, 23)), sag = lerp(60, 140, h2(i, 25)), ph = h2(i, 24) * TAU;
      const pts = hairLine(sx, sy, L, sag, ph, t, wind);
      const deep = i % 3 === 0;
      g.fillStyle = tipFade(g, pts, deep ? '#7a8098' : '#e2e5ee', deep ? 0.75 : 0.8);
      lock(g, pts, 10 + 8 * h2(i, 28), 1);
    }
    g.lineCap = 'round'; g.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const sx = lerp(54, 98, h2(i, 31)), sy = lerp(-156, 16, h2(i, 32));
      const L = lerp(150, 310, h2(i, 33)), sag = lerp(50, 140, h2(i, 35)), ph = h2(i, 34) * TAU;
      const pts = hairLine(sx, sy, L, sag, ph, t, wind, 8);
      g.strokeStyle = tipFade(g, pts, h2(i, 36) < 0.25 ? '#9aa0b8' : '#f4f6fb', 0.75);
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
      g.stroke();
    }
  }
  // part 'static'：发片、丝发、发髻（烘进贴图）；'dyn'：随风动的乱发、鬓发、发带尾
  function hairCap(g, t, part) {
    // 发际线：额顶→鬓角；头发整体是一块光滑的银灰，再用极细的亮线顺着头骨梳向发髻（工笔的丝发）
    const HL = [[-36, -104], [-14, -112], [10, -104], [26, -84], [38, -58], [48, -30], [56, 4]];
    if (part === 'static') {
    const cap = () => {
      g.beginPath();
      g.moveTo(-40, -100);
      g.bezierCurveTo(-48, -134, -14, -168, 34, -170);
      g.bezierCurveTo(80, -170, 102, -132, 100, -80);
      g.bezierCurveTo(98, -36, 92, 0, 82, 26);
      g.bezierCurveTo(70, 14, 60, 0, 56, 4);
      for (let i = HL.length - 2; i >= 0; i--) g.lineTo(HL[i][0], HL[i][1]);
      g.closePath();
    };
    cap();
    g.fillStyle = K.lin(g, -30, -170, 100, -10, [[0, '#cfd3e2'], [0.5, '#8e94b0'], [1, '#474d6c']]);
    g.fill();
    g.save(); cap(); g.clip();
    const bun = [78, -160], cen = [30, -60];
    g.lineCap = 'round';
    for (let k = 0; k < 90; k++) {
      // 在发际线上取起点
      const f = h2(k, 71) * (HL.length - 1.001), i = f | 0, w = f - i;
      const p0 = [lerp(HL[i][0], HL[i + 1][0], w) - 2, lerp(HL[i][1], HL[i + 1][1], w) - 2];
      const mx = (p0[0] + bun[0]) / 2, my = (p0[1] + bun[1]) / 2;
      let nx = mx - cen[0], ny = my - cen[1]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const bul = 16 + 18 * h2(k, 72) + (p0[1] > -60 ? 10 : 0);
      g.strokeStyle = rgba(h2(k, 73) > 0.25 ? '#f6f7fb' : '#6a708e', 0.35 + 0.45 * h2(k, 74));
      g.lineWidth = 0.6 + 0.9 * h2(k, 75);
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(mx + nx * bul, my + ny * bul, bun[0] + (h2(k, 76) - 0.5) * 12, bun[1] + (h2(k, 77) - 0.5) * 8); g.stroke();
    }
    // 头顶受光的一抹
    glowA(g, 10, -150, 46, '#ffffff', 0.25);
    g.restore();
    // 发髻与发带结
    g.fillStyle = K.lin(g, 54, -170, 100, -128, [[0, '#f4f5fa'], [1, '#8a90aa']]);
    g.beginPath(); ellS(g, 80, -164, 21, 15, -0.5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,66,90,0.6)'; g.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) { g.beginPath(); ellS(g, 80, -164, 17 - k * 3, 11 - k * 2, -0.5, 0.4, 2.8); g.stroke(); }
    g.fillStyle = '#3b6db3';
    g.save(); g.translate(80, -156); g.rotate(-0.6); g.fillRect(-15, -4, 30, 8); g.restore();
    return;
    }
    // 头顶几根被风挑起的乱发
    g.strokeStyle = 'rgba(240,242,250,0.6)'; g.lineWidth = 0.7;
    for (let k = 0; k < 6; k++) { const x0 = lerp(-10, 60, k / 5), y0 = -166 + Math.abs(x0 - 30) * 0.15, sw = Math.sin(t * 3.4 + k) * 6; g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + 20, y0 - 18 + sw, x0 + 50, y0 - 10 - sw, x0 + 80 + sw, y0 + 4); g.stroke(); }
    // 额前发际的碎发
    g.strokeStyle = 'rgba(236,238,246,0.7)'; g.lineWidth = 0.8;
    for (let k = 0; k < 8; k++) { const x0 = lerp(-36, 20, k / 7), y0 = lerp(-102, -100, k / 7) - Math.sin(k / 7 * PI) * 8; g.beginPath(); g.moveTo(x0, y0 - 4); g.quadraticCurveTo(x0 - 4, y0 + 2, x0 - 8 + Math.sin(t * 3 + k) * 1.5, y0 + 7); g.stroke(); }
    // 鬓角两缕散发，细而弯，垂过耳前，被风吹得轻摆
    for (let k = 0; k < 3; k++) {
      const sw = Math.sin(t * 2.4 + k * 1.3) * 6, pts = [];
      for (let j = 0; j <= 9; j++) { const v = j / 9; pts.push([lerp(40 + k * 8, 30 + k * 10, v) + sw * v * v + Math.sin(v * 5 + k * 2 + t) * 5 * v, lerp(-56 + k * 8, 96 + k * 18, v)]); }
      g.fillStyle = rgba(k % 2 ? '#f6f6fa' : '#c4c8d8', 0.75);
      lock(g, pts, 2.6, 0.3);
    }
    // 额前一缕
    { const sw = Math.sin(t * 2.9) * 4, pts = []; for (let j = 0; j <= 8; j++) { const v = j / 8; pts.push([lerp(-28, -50, v) + sw * v + Math.sin(v * 4 + t * 2) * 3 * v, lerp(-104, -30, v)]); } g.fillStyle = 'rgba(244,244,250,0.7)'; lock(g, pts, 2.4, 0.3); }
    // 蓝发带的两条尾巴：与白发同样受风、下垂
    for (let k = 0; k < 2; k++) {
      const pts = hairLine(86, -156, 170 + k * 40, 70 + k * 40, 1.3 + k * 2.1, t + k * 0.2, 1, 12);
      g.fillStyle = k ? '#2c5598' : '#4f86cc';
      lock(g, pts, 7 - k * 2, 2.5);
    }
  }
  // 脸的静态部分（后肩、脸、轮廓光、发片、高领与肩雪）连同 -0.16 的仰角一起烘成一张贴图，逐帧只做轴对齐的缩放贴图
  const FSP = { ox: 150, oy: 300, w: 700, h: 900, rot: -0.16 };
  function faceSprite() {
    return K.cache('g12faceSprite', FSP.w, FSP.h, 1.6, (g) => {
      g.translate(FSP.ox, FSP.oy); g.rotate(FSP.rot);
      // 大氅后肩
      g.fillStyle = K.lin(g, 60, 120, 380, 500, [[0, '#1a1e2a'], [1, '#06080c']]);
      g.beginPath(); g.moveTo(40, 150); g.bezierCurveTo(140, 120, 280, 200, 340, 300); g.lineTo(420, 560); g.lineTo(20, 560); g.closePath(); g.fill();
      g.drawImage(faceTex(), -190, -220, 420, 520);
      // 侧脸外缘一线冷光（极光青）
      g.save();
      faceProfile(g); g.clip();
      g.strokeStyle = 'rgba(190,240,246,0.6)'; g.lineWidth = 3.2;
      g.translate(2, 0.5); faceProfile(g); g.stroke();
      g.restore();
      hairCap(g, 0, 'static');
      collarStatic(g);
    });
  }
  function drawFace(g, c, x, y, sc, open, smile) {
    const t = c.t;
    g.save();
    g.translate(x, y); g.scale(sc, sc);
    g.save(); g.rotate(FSP.rot); hairBack(g, t, 0.9); g.restore();
    g.drawImage(faceSprite(), -FSP.ox, -FSP.oy, FSP.w, FSP.h);
    g.rotate(FSP.rot);
    // 眼：闭着时一道弯线挂着雪，睁开后露出眼珠与一点星光
    const lidUp = lerp(0, 7.5, open), sq = smile * 1.6;
    g.lineCap = 'round';
    if (open > 0.02) {
      g.fillStyle = '#e8e6e6';
      g.beginPath(); g.moveTo(-14, -2); g.quadraticCurveTo(-24, -4 - lidUp, -35, -3 - lidUp * 0.4); g.quadraticCurveTo(-37, 1, -34, 2 - sq * 0.4); g.quadraticCurveTo(-24, 3 - sq, -14, -1); g.closePath(); g.fill();
      g.save(); g.clip();
      g.fillStyle = '#221c26'; g.beginPath(); ellS(g, -30, -1.5 - lidUp * 0.2, 5.4, 6.6, 0.1, 0, TAU); g.fill();
      g.fillStyle = '#41506e'; g.beginPath(); ellS(g, -30.5, -1.5 - lidUp * 0.2, 3.4, 4.6, 0.1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,30,40,0.35)'; g.fillRect(-40, -12 - lidUp, 30, 4);
      g.restore();
      glowA(g, -32.5, -4 - lidUp * 0.3, 4.5, '#e8f8ff', 0.95 * open);
      g.strokeStyle = rgba('#dff4ff', 0.6 * open); g.lineWidth = 1;
      g.beginPath(); g.moveTo(-33, 2.2 - sq * 0.4); g.quadraticCurveTo(-24, 3.6 - sq, -16, 0.4); g.stroke();
    }
    g.strokeStyle = 'rgba(24,18,24,0.95)'; g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(-13, -2); g.quadraticCurveTo(-24, lerp(1.5, -4 - lidUp, open), -36, lerp(-1, -3 - lidUp * 0.4, open)); g.stroke();
    g.lineWidth = 0.9;
    for (let k = 0; k < 10; k++) {
      const u = k / 9, lx = lerp(-16, -35, u), ly = lerp(lerp(-1, -2, u), lerp(-2, -5 - lidUp, u), open) + Math.sin(u * PI) * lerp(2, -2.5, open);
      const dx = lerp(-3, -5.5, u), dy = lerp(5.5, -3.5, open);
      g.beginPath(); g.moveTo(lx, ly); g.quadraticCurveTo(lx + dx * 0.5, ly + dy * 0.7, lx + dx, ly + dy); g.stroke();
    }
    g.strokeStyle = 'rgba(60,44,52,0.45)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-15, 3 - sq * 0.6); g.quadraticCurveTo(-25, 6 - sq * 1.4, -33, 4 - sq); g.stroke();
    g.beginPath(); g.moveTo(-14, -9 - lidUp * 0.3); g.quadraticCurveTo(-25, -12 - lidUp * 0.5, -34, -9 - lidUp * 0.3); g.stroke();
    // 睫毛上的雪：五粒分开的冰晶，坐在睫毛根上，各自闪一下；睁眼时抖落
    for (let k = 0; k < 5; k++) {
      const u = (k + 0.4 + 0.3 * h2(k, 30)) / 5.1, fall = clamp((open - 0.1 - h2(k, 31) * 0.35) * 3), drop = fall * fall * 70;
      const s = u * 0.94 + 0.03, lidY = (1 - s) * (1 - s) * -2 + 2 * s * (1 - s) * 1.5 + s * s * -1;
      const sx = lerp(-13, -36, s) + drop * 0.15, sy = lerp(lidY - 1 + 3 * h2(k, 33), -4, open) + drop;
      const a = (1 - fall) * 0.95;
      if (a < 0.02) continue;
      const r = 1.2 + h2(k, 32), tw = 0.55 + 0.45 * Math.pow(Math.max(0, Math.sin(t * (2 + h2(k, 34) * 2) + k * 2.3)), 3);
      g.fillStyle = rgba('#5a6a92', 0.4 * a); g.beginPath(); arcS(g, sx + 0.7, sy + 0.9, r * 1.1, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', a); g.beginPath(); arcS(g, sx, sy, r * 0.85, 0, TAU); g.fill();
      lighter(g, () => {
        glowA(g, sx, sy, r * 2.2, '#dff4ff', 0.3 * a * tw);
        const L = 6 * tw, rot = 0.3 + h2(k, 35);
        g.strokeStyle = rgba('#ffffff', 0.85 * a * tw); g.lineWidth = 0.5;
        g.beginPath();
        for (let j = 0; j < 2; j++) { const an = rot + j * PI / 2, cx = Math.cos(an) * L, cy = Math.sin(an) * L; g.moveTo(sx - cx, sy - cy); g.lineTo(sx + cx, sy + cy); }
        g.stroke();
      });
    }
    // 嘴角的笑：口线向后上扬，法令纹浅浅出现
    g.strokeStyle = 'rgba(64,36,42,0.85)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-46, 85.5); g.bezierCurveTo(-42, 86 - smile * 0.5, -38, 85 - smile * 2.5, -33, 82 - smile * 5.5); g.stroke();
    g.strokeStyle = rgba('#4a3440', 0.15 + 0.3 * smile); g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-50, 60); g.bezierCurveTo(-44, 66 - smile * 2, -38, 74 - smile * 3, -32, 82 - smile * 4); g.stroke();
    glowA(g, -22, 38 - smile * 4, 24, '#fff0e6', 0.08 + 0.14 * smile);
    hairCap(g, t, 'dyn');
    g.restore();
  }
  function collarStatic(g) {
    // 大氅高领：立领裹住脖子，领口一圈灰里子；肩上积着几团雪，外缘一线冷光
    const collar = () => {
      g.beginPath(); g.moveTo(-60, 560); g.bezierCurveTo(-58, 420, -40, 280, -26, 196);
      g.bezierCurveTo(-4, 186, 40, 170, 76, 140); g.bezierCurveTo(92, 126, 104, 112, 112, 100);
      g.bezierCurveTo(150, 140, 230, 190, 330, 270); g.bezierCurveTo(380, 320, 410, 420, 430, 560); g.closePath();
    };
    collar();
    g.fillStyle = K.lin(g, -60, 160, 300, 560, [[0, '#262c3c'], [0.5, '#121620'], [1, '#05070a']]);
    g.fill();
    g.save(); collar(); g.clip();
    // 衣褶：几道长而弯的淡笔
    g.strokeStyle = 'rgba(110,130,170,0.28)'; g.lineWidth = 2;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(-20 + k * 46, 230 + k * 18); g.bezierCurveTo(-30 + k * 50, 320, -10 + k * 56, 420, -16 + k * 64, 560); g.stroke(); }
    // 领口里子
    g.fillStyle = K.lin(g, -30, 180, 110, 120, [[0, '#5a6280'], [1, '#383e56']]);
    g.beginPath(); g.moveTo(-26, 196); g.bezierCurveTo(-4, 186, 40, 170, 76, 140); g.bezierCurveTo(92, 126, 104, 112, 112, 100);
    g.bezierCurveTo(118, 112, 122, 124, 126, 136); g.bezierCurveTo(90, 176, 30, 206, -24, 222); g.closePath(); g.fill();
    g.restore();
    // 肩头的积雪：一条上缘起伏、下缘化开的软白
    const sx0 = 104, sx1 = 420;
    const top = (x) => { const u = (x - sx0) / (sx1 - sx0); return 104 + Math.pow(u, 1.1) * 190 - 3 * Math.sin(x * 0.11) - 2 * Math.sin(x * 0.27) - 4; };
    g.beginPath(); g.moveTo(sx0, top(sx0));
    for (let x = sx0; x <= sx1; x += 6) g.lineTo(x, top(x));
    for (let x = sx1; x >= sx0; x -= 6) g.lineTo(x, top(x) + 12 + 8 * Math.sin(x * 0.07) + 6 * Math.sin(x * 0.19));
    g.closePath();
    g.fillStyle = K.lin(g, 0, 100, 0, 330, [[0, 'rgba(244,248,252,0.95)'], [1, 'rgba(206,220,238,0.75)']]); g.fill();
    g.beginPath(); g.moveTo(-24, 198);
    for (let x = -24; x <= 100; x += 6) g.lineTo(x, 198 - (x + 24) * 0.78 - 2 * Math.sin(x * 0.3));
    for (let x = 100; x >= -24; x -= 6) g.lineTo(x, 198 - (x + 24) * 0.78 + 7 + 3 * Math.sin(x * 0.21));
    g.closePath(); g.fillStyle = 'rgba(236,242,250,0.85)'; g.fill();
    for (let k = 0; k < 24; k++) { const x = lerp(sx0, sx1, h2(k, 85)), y = top(x) + 10 + 14 * h2(k, 86); glowA(g, x, y, 2 + 3 * h2(k, 87), '#ffffff', 0.7); }
    g.strokeStyle = 'rgba(160,226,236,0.6)'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(-58, 540); g.bezierCurveTo(-56, 420, -40, 280, -26, 198); g.stroke();
  }
  // 雪巅：右下的雪峰（左坡受极光照亮，右坡蓝影，崖面露出一道道斧劈皴的黑石）
  const ridgeY = (x) => x < 870 ? 525 + Math.pow((870 - x) / 400, 1.5) * 190 + 5 * Math.sin(x * 0.05) : 525 + Math.pow((x - 870) / 420, 1.15) * 105 + 4 * Math.sin(x * 0.07);
  function summitTex() {
    return K.cache('g12summit3', 840, 270, 1, (g) => {
      g.translate(-450, -450);
      const path = () => { g.beginPath(); g.moveTo(450, 730); for (let x = 450; x <= 1292; x += 4) g.lineTo(x, ridgeY(x)); g.lineTo(1292, 730); g.closePath(); };
      path();
      g.fillStyle = K.lin(g, 450, 0, 1292, 0, [[0, '#bfd4e4'], [0.42, '#f2f8fb'], [0.5, '#c4d2e6'], [0.62, '#93a6c6'], [1, '#5c6e96']]);
      g.fill();
      g.save(); path(); g.clip();
      // 坡下渐暗
      g.fillStyle = K.lin(g, 0, 520, 0, 730, [[0, 'rgba(40,60,100,0)'], [1, 'rgba(40,56,96,0.55)']]); g.fillRect(450, 450, 842, 280);
      const rr = A.rng(77);
      // 露出的黑石：沿坡势斜拖的淡墨（雪景山水的皴染），软边，不见硬棱
      const bar = barSpr('#1c2640');
      for (let k = 0; k < 46; k++) {
        const x = 500 + rr() * 780, right = x > 870, y0 = ridgeY(x) + 16 + Math.pow(rr(), 0.8) * 170;
        const ang = right ? 0.55 + rr() * 0.25 : PI - 0.55 - rr() * 0.25, len = 60 + rr() * 140, th = 5 + rr() * 12;
        g.save(); g.translate(x, y0); g.rotate(ang);
        g.globalAlpha = (right ? 0.55 : 0.38) * (0.5 + rr() * 0.5);
        g.drawImage(bar, 0, -th / 2, len, th);
        g.restore();
      }
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(20,28,48,0.35)'; g.lineWidth = 1;
      for (let k = 0; k < 14; k++) {
        const x = 540 + rr() * 720, right = x > 870, y0 = ridgeY(x) + 20 + rr() * 120, d = right ? 1 : -1;
        g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + d * 20, y0 + 30, x + d * (30 + rr() * 30), y0 + 50 + rr() * 40); g.stroke();
      }
      // 雪面上细的风纹
      for (let k = 0; k < 70; k++) {
        const x = 470 + rr() * 820, y = ridgeY(x) + 6 + rr() * 200, len = 16 + rr() * 50;
        g.strokeStyle = rgba(x > 870 ? '#3e527c' : '#8ea8c4', 0.22); g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len / 2, y - 3, x + len, y + 2); g.stroke();
      }
      g.restore();
      // 受光的山脊一线亮边
      g.strokeStyle = 'rgba(226,252,255,0.9)'; g.lineWidth = 1.6;
      g.beginPath(); for (let x = 462; x <= 872; x += 4) x === 462 ? g.moveTo(x, ridgeY(x)) : g.lineTo(x, ridgeY(x)); g.stroke();
    });
  }
  // 崖边雪松：虬干横出，针叶成簇；积雪用“自身减去下移一截的自身”求出每簇的上沿
  function pineBare() {
    return K.cache('g12pineB', 320, 270, 1, (g) => {
      g.translate(30, 262);
      g.strokeStyle = '#121820'; g.lineCap = 'round'; g.lineJoin = 'round';
      const limb = (pts, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]); g.stroke(); };
      limb([[0, 0], [6, -40], [-6, -80], [20, -120], [60, -150], [110, -168], [170, -172], [240, -190]], 12);
      limb([[20, -118], [0, -150], [10, -190], [40, -210]], 6);
      limb([[60, -150], [70, -190], [110, -214]], 5);
      limb([[110, -168], [140, -140], [190, -130]], 5);
      limb([[-4, -70], [-30, -90], [-44, -120]], 5);
      // 树皮鳞纹
      g.strokeStyle = 'rgba(120,130,150,0.35)'; g.lineWidth = 1;
      for (let k = 0; k < 14; k++) { const y = -10 - k * 9; g.beginPath(); arcS(g, 2 + Math.sin(k) * 4, y, 4, 0.2, 2.8); g.stroke(); }
      // 针叶簇：每簇一片扁圆，由无数短针画成
      const pads = [[40, -214, 58], [112, -218, 64], [196, -134, 54], [250, -194, 52], [176, -180, 60], [-44, -126, 46], [70, -170, 40]];
      for (const [x, y, w] of pads) {
        const rr = A.rng(x * 7 + 3);
        g.fillStyle = '#16262a';
        g.beginPath(); ellS(g, x, y, w, 13, 0, 0, TAU); g.fill();
        g.strokeStyle = '#1f3436'; g.lineWidth = 1.4;
        for (let i = 0; i < 70; i++) {
          const a = PI + rr() * PI, r = w * (0.4 + 0.65 * rr()), px = x + Math.cos(a) * r * 0.9, py = y + Math.sin(a) * 12 * (0.5 + rr());
          g.beginPath(); g.moveTo(px, py + 4); g.lineTo(px + Math.cos(a) * 9, py + Math.sin(a) * 6 - 3); g.stroke();
        }
        g.strokeStyle = '#2c4a48'; g.lineWidth = 1;
        for (let i = 0; i < 30; i++) { const px = x + (rr() - 0.5) * w * 1.6, py = y + 4 + rr() * 6; g.beginPath(); g.moveTo(px, py); g.lineTo(px + (rr() - 0.5) * 8, py + 8); g.stroke(); }
      }
    });
  }
  const PINE_PADS = [[40, -214, 58], [112, -218, 64], [196, -134, 54], [250, -194, 52], [176, -180, 60], [-44, -126, 46], [70, -170, 40]];
  // 只有积雪的一层（贴在光秃的树上）：每簇针叶顶上压一团圆鼓鼓的厚雪，枝干上沿一道薄雪
  function pineCaps() {
    return K.cache('g12pineCaps2', 320, 290, 1, (g) => {
      const b = pineBare();
      // 枝干上沿：剪影减去下移 6px 的自己
      g.drawImage(b, 0, 20, 320, 270);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#eef4fb'; g.fillRect(0, 0, 320, 290);
      g.globalCompositeOperation = 'destination-out';
      g.drawImage(b, 0, 26, 320, 270);
      g.globalCompositeOperation = 'source-over';
      g.translate(30, 282);
      for (const [x, y, w] of PINE_PADS) {
        const rr = A.rng(x * 13 + 7), cy = y - 8;
        // 雪团：一串大小不一的圆鼓叠成一条起伏的雪垄，下沿压着针叶的一层蓝影
        const bumps = [];
        for (let j = 0; j < 7; j++) { const u = j / 6; bumps.push([x + (u - 0.5) * w * 1.55 + (rr() - 0.5) * 6, cy - 4 - Math.sin(u * PI) * (6 + rr() * 5), w * (0.16 + 0.1 * Math.sin(u * PI)) + rr() * 4]); }
        g.fillStyle = 'rgba(60,82,130,0.35)';
        g.beginPath(); for (const [bx, by, br] of bumps) { g.moveTo(bx + br, by + 6); ellS(g, bx, by + 6, br, br * 0.75, 0, 0, TAU); } g.fill();
        g.fillStyle = K.lin(g, 0, cy - 22, 0, cy + 8, [[0, '#ffffff'], [0.55, '#eef3fa'], [1, '#c4d2e8']]);
        g.beginPath(); for (const [bx, by, br] of bumps) { g.moveTo(bx + br, by); ellS(g, bx, by, br, br * 0.78, 0, 0, TAU); } g.fill();
        g.beginPath(); ellS(g, x, cy + 1, w * 0.8, 7, 0, 0, TAU); g.fill();
        // 雪团上受光的亮点
        g.fillStyle = 'rgba(255,255,255,0.9)';
        for (const [bx, by, br] of bumps) { g.beginPath(); ellS(g, bx - br * 0.25, by - br * 0.35, br * 0.4, br * 0.22, -0.3, 0, TAU); g.fill(); }
        // 雪团垂下的几根小冰凌
        g.fillStyle = 'rgba(230,240,252,0.85)';
        for (let j = 0; j < 3; j++) { const ix = x + (rr() - 0.5) * w * 1.2; g.beginPath(); g.moveTo(ix - 2, cy + 6); g.lineTo(ix + 2, cy + 6); g.lineTo(ix, cy + 12 + rr() * 6); g.closePath(); g.fill(); }
      }
    });
  }
  // 故人云影：人物只画一次进缓存（定格的姿势），整体着成一种颜色，腿脚化进云里；贴时四份错开叠成柔边
  const GH = { bw: 420, bh: 340, foot: 300 };
  function ghostTex(key, who, s, opts, tint, whip) {
    return K.cache('g12ghost|' + key, GH.bw, GH.bh, 0.35, (g) => {
      const fx = GH.bw / 2, fy = GH.foot, o = Object.assign({ tone: 'silhouette', ink: tint, wind: 0.9, seed: 3 }, opts);
      F.draw(g, who, fx, fy, s, 1.3, o);
      if (whip) {
        // 月如的长鞭：从手里甩出一道大弧
        const p = F.points(who, fx, fy, s, 1.3, o).handN;
        g.strokeStyle = tint; g.lineCap = 'round';
        const pts = [];
        for (let k = 0; k <= 16; k++) { const u = k / 16; pts.push([p[0] + u * 190 * s, p[1] - Math.sin(u * PI * 1.2) * 70 * s + u * u * 40 * s]); }
        g.fillStyle = tint; lock(g, pts, 4.5, 1.2);
      }
      // 整体着色（剪影里的头发、配件都统一成云的颜色）
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = K.lin(g, 0, fy - 200 * s, 0, fy, [[0, mix(tint, '#ffffff', 0.45)], [0.5, tint], [1, tint]]);
      g.fillRect(0, 0, GH.bw, GH.bh);
      // 下半身化进云里
      const h = F.height(who, o) * s;
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = K.lin(g, 0, fy - h * 0.45, 0, fy - h * 0.05, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
      g.fillRect(0, fy - h * 0.45, GH.bw, GH.bh);
      g.globalCompositeOperation = 'source-over';
    });
  }
  // scatter 0..1：被风撕成一层层横向的残影吹散
  function cloudGhost(g, c, tex, x, y, s, h, tint, a, scatter, seed) {
    if (a <= 0.01) return;
    const ga = g.globalAlpha, t = c.t, e = scatter;
    const bob = Math.sin(t * 0.9 + seed) * 4, X0 = x - GH.bw / 2 + Math.sin(t * 0.4 + seed) * 6, Y0 = y - GH.foot + bob;
    const OFF = [[-3, -2], [3, 2], [-2, 3], [2, -3]];
    // 腰下的云团（同色微光）
    puff(g, x + e * e * 300, y - h * 0.4 + bob, 90 * s * (1 + e), 30 * s, tint, 0.55 * a * (1 - e), seed + 40);
    puff(g, x - 30 * s + e * e * 420, y - h * 0.25 + bob, 120 * s * (1 + e), 26 * s, mix(tint, '#ffffff', 0.4), 0.35 * a * (1 - e), seed + 50);
    for (let j = 0; j < (e < 0.02 ? 1 : 4); j++) {
      const off = e * e * (60 + 260 * j) + e * 50 * j, st = 1 + e * (0.3 + 0.6 * j), dy = -e * 18 * j;
      const aj = e < 0.02 ? 1 : (1 - e) * (j ? 0.55 * (1 - j / 4) : 1);
      for (const [ox, oy] of OFF) {
        g.globalAlpha = ga * a * aj * 0.25;
        g.drawImage(tex, X0 + off - GH.bw * (st - 1) * 0.3 + ox, Y0 + dy + oy, GH.bw * st, GH.bh);
      }
    }
    g.globalAlpha = ga;
  }

  // 大全景的远景：天与星（极光之下）、脚下的雪山与云海（极光之上），各烘一张
  function wakeFarA() {
    return K.cache('g12wakeFarA', W + 80, H + 80, 0.75, (g) => {
      g.translate(40, 40);
      g.drawImage(wakeSky(), -40, -40, W + 80, H + 80);
      E.stars(g, { t: 0, n: 200, seed: 41, maxY: 520, alpha: 0.95, twinkle: 0 });
    });
  }
  function wakeFaceBg() {
    return K.cache('g12wakeFaceBg', W + 80, H + 80, 0.75, (g) => {
      g.translate(40, 40);
      g.drawImage(wakeSky(), -40, -40, W + 80, H + 80);
      E.stars(g, { t: 0, n: 120, seed: 43, maxY: 720, alpha: 0.9, twinkle: 0 });
      E.mist(g, { t: 0, y: 650, h: 230, color: '#4e668e', alpha: 0.75, seed: 3 });
    });
  }
  function wakeFarB() {
    return K.cache('g12wakeFarB', W + 80, 380, 1, (g) => {
      g.translate(40, -380);
      E.mountains(g, { t: 0, layers: [
        { color: '#6f86b0', light: '#c8dcf0', alpha: 1, y: 600, scaleY: 0.55, kind: 'far', seed: 12, rim: '#d8f0ff', rimA: 0.5, speed: 0 },
        { color: '#4c6290', light: '#b0c8e8', alpha: 1, y: 640, scaleY: 0.7, kind: 'mid', seed: 15, rim: '#cfeaff', rimA: 0.45, speed: 0 },
      ] });
      g.fillStyle = '#4c6290'; g.fillRect(-40, 640, W + 80, 140);
      E.mist(g, { t: 0, y: 612, h: 120, color: '#a8bede', alpha: 0.6, seed: 2 });
      E.mist(g, { t: 0, y: 690, h: 140, color: '#8ea4cc', alpha: 0.5, seed: 6 });
    });
  }
  // 老人统一的样子：墨色大氅（带一点靛蓝），飞白笔触，白发蓝带
  const OLD = { stage: 'old', tone: 'silhouette', ink: '#1a2234', accent: '#3a4a70', feibai: 0.55, whiteHair: true, ribbon: '#3b6db3' };
  // 呵出的一团白气：rise 秒内由小变大、上浮、淡去，里面几点冰晶闪光
  function breath(g, x, y, d, o) {
    const life = o.life ?? 1.2;
    if (d < 0 || d > life) return;
    const u = d / life, r = lerp(o.r0 ?? 20, o.r1 ?? 90, easeOut(u)), a = (o.a ?? 0.6) * (1 - u) * clamp(d * 10);
    const px = x + (o.vx ?? -120) * d, py = y + (o.vy ?? -40) * d;
    puff(g, px, py, r, r * 0.62, o.col || '#e2eaf6', a, o.seed || 1);
    puff(g, px - r * 0.2, py + r * 0.05, r * 0.55, r * 0.4, '#ffffff', a * 0.9, (o.seed || 1) + 3);
    lighter(g, () => {
      for (let i = 0; i < 4; i++) {
        const gx = px + (h2(i, o.seed + 7) - 0.5) * r * 1.1, gy = py + (h2(i, o.seed + 8) - 0.5) * r * 0.6;
        const tw = Math.pow(Math.max(0, Math.sin(d * 9 + i * 2.1)), 4);
        if (tw > 0.05) glowA(g, gx, gy, 3 + 2 * h2(i, o.seed + 9), '#ffffff', 0.9 * tw * (1 - u));
      }
    });
  }
  function wakeWide(g, c, Z, Zb, hx, hy, tx, ty) {
    const t = c.t, lt = c.lt, L = WK.l;
    const tChi = ct(c, 5, L[5]), tJin = ct(c, 6, L[6]), tKuang = ct(c, 7, L[7]), tKong = ct(c, 10, L[10]);
    // 远景：天、星、极光（缩放小，近景缩放大，做出纵深）
    g.save();
    g.translate(tx, ty); g.scale(Zb, Zb); g.translate(-hx, -hy);
    g.drawImage(wakeFarA(), -40, -40, W + 80, H + 80);
    E.stars(g, { t, n: 90, seed: 42, maxY: 480, alpha: 0.9 });
    const auroraA = 1.0 * (1 - 0.6 * win(lt, tKong - 0.1, tKong + 0.5)) * (1 + 0.25 * c.be(0.3));
    aurora(g, t, auroraA, { y: 400 });
    // 故人云影：举葫芦的道士、扬鞭的红衣女子、回眸的白衣少女；终成二字一直在，空字一到被风撕散
    const ap = win(lt, tJin - 0.4, tKuang + 0.15), sc = easeIn(clamp((lt - (tKong - 0.08)) / 0.45));
    if (ap > 0.01 && sc < 0.999) {
      const GS = [
        ['jj', 'jiujianxian', 500, 330, 1.3, { pose: 'laugh', prop: 'gourd', facing: 1 }, '#e8b070', 0.5, 3, false],
        ['yr', 'yueru', 760, 300, 1.05, { pose: 'reach', prop: 'whip', facing: 1 }, '#ff9a88', 0.6, 5, true],
        ['le', 'linger', 980, 380, 1.15, { pose: 'lookBack', facing: -1 }, '#d8ccff', 0.85, 7, false],
      ];
      g.globalCompositeOperation = 'lighter';
      GS.forEach(([key, who, x, y, s, op, tint, al, seed, whip], j) => {
        const tex = ghostTex(key, who, s, op, tint, whip), h = F.height(who, op) * s;
        const aj = al * ap * win(lt, tJin - 0.4 + j * 0.18, tKuang + 0.15 + j * 0.18);
        cloudGhost(g, c, tex, x, y, s, h, tint, aj, clamp(sc * (1 + 0.15 * j) - 0.05 * j), seed);
      });
      g.globalCompositeOperation = 'source-over';
      // 云影身侧的流云，吹散时一起被扯走
      E.mist(g, { t, y: 300, h: 170, color: '#c8d8ff', alpha: 0.26 * ap * (1 - sc), speed: 16, offset: -700 * sc * sc, seed: 4 });
      E.mist(g, { t, y: 200, h: 120, color: '#d8ccff', alpha: 0.14 * ap * (1 - sc), speed: -10, offset: -500 * sc * sc, seed: 8 });
    }
    // 流星：空字之后，空空的星空里划过一次
    const mt = lt - (tKong + 0.05);
    if (mt > 0 && mt < 0.38) {
      const u = easeOut(mt / 0.35), mx = lerp(1080, 760, u), my = lerp(70, 210, u), al = Math.sin(PI * clamp(mt / 0.38)) ** 0.6;
      lighter(g, () => {
        g.strokeStyle = K.lin(g, mx, my, mx + 230, my - 100, [[0, rgba('#ffffff', al)], [1, 'rgba(255,255,255,0)']]);
        g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + 230, my - 100); g.stroke();
        glowA(g, mx, my, 18, '#eaf6ff', al); glowA(g, mx, my, 5, '#ffffff', al);
      });
    }
    // 远山：雪山群在脚下，山间一层云海（静态，烘好）
    g.drawImage(wakeFarB(), -40, 380, W + 80, 380);
    g.restore();
    // 近景：雪峰、雪松、人
    g.save();
    g.translate(tx, ty); g.scale(Z, Z); g.translate(-hx, -hy);
    g.drawImage(summitTex(), 450, 450, 840, 270);
    // 雪松：狂字一笑，满树积雪震落，枝条回弹
    const shake = lt - tKuang, sh = shake > 0 ? Math.exp(-shake / 0.5) * Math.sin(shake * 24) * 0.05 : 0;
    const off = clamp(shake / 0.3);
    g.save(); g.translate(985, 552); g.rotate(sh - 0.04);
    g.drawImage(pineBare(), -30, -262, 320, 270);
    if (off < 1) { g.globalAlpha = 1 - off; g.drawImage(pineCaps(), -30, -282, 320, 290); g.globalAlpha = 1; }
    g.restore();
    // 人：墨色大氅、白发蓝带，立在峰顶；痴字起仰天大笑，痴、狂两字各是一声长笑
    const laugh = lt >= tChi - 0.05;
    const pulse = Math.max(lt > tChi ? Math.exp(-(lt - tChi) / 0.3) : 0, lt > tKuang ? Math.exp(-(lt - tKuang) / 0.3) : 0);
    const fo = Object.assign({}, OLD, {
      facing: -1, pose: laugh ? 'laugh' : 'stand', wind: 0.8 + 0.2 * pulse, windDir: 1, rim: '#bff0ea', light: [560, 260], night: true, seed: 6,
    });
    F.draw(g, 'xiaoyao', 868, 527, 0.48, t, fo);
    const pm = F.points('xiaoyao', 868, 527, 0.48, t, fo).mouth;
    for (const [tk, sd] of [[tChi, 61], [tKuang, 67]]) {
      const d = lt - tk;
      breath(g, pm[0] - 2, pm[1] - 6, d, { r0: 10, r1: 56, vx: 34, vy: -80, a: 0.95, life: 1.3, seed: sd });
      // 脚下踢起的雪粉
      if (d > 0 && d < 1) puff(g, 868 + 18 * d, 524 - 10 * d, 20 + 50 * d, 6 + 10 * d, '#eef3fa', 0.6 * (1 - d), sd + 3);
    }
    // 落雪：枝上的积雪团与雪粉落下，扬起一片雪雾
    if (shake > 0 && shake < 2.6) {
      const dsp = dotSpr('#f4f8ff');
      for (let i = 0; i < 170; i++) {
        const big = i < 20, d = shake - h2(i, 51) * (big ? 0.15 : 0.3);
        if (d < 0) continue;
        let bx, by;
        if (big) { const pd = PINE_PADS[i % PINE_PADS.length]; bx = 985 + pd[0] + (h2(i, 58) - 0.5) * pd[2]; by = 552 + pd[1] - 6; }
        else { const u = h2(i, 52); bx = 985 + lerp(-60, 260, u); by = 552 - lerp(110, 200, h2(i, 53)) + (u > 0.6 ? 40 : 0); }
        const x = bx + d * (big ? 30 : 20 + 50 * h2(i, 54)) + Math.sin(d * 3 + i) * (big ? 2 : 5), y = by + 0.5 * (big ? 700 : 380) * d * d * (0.6 + 0.5 * h2(i, 55));
        const r = big ? 3 + 4 * h2(i, 56) : 1.6 + 6 * h2(i, 56) * h2(i, 57), al = clamp(1 - d / (big ? 1.4 : 2));
        if (y > ridgeY(x) + 6) continue;
        if (big) {
          g.globalAlpha = al; g.fillStyle = '#f2f6fc';
          g.beginPath(); ellS(g, x, y, r, r * 0.8, d * 3, 0, TAU); g.fill();
          g.fillStyle = 'rgba(150,170,210,0.6)'; g.beginPath(); ellS(g, x + r * 0.2, y + r * 0.35, r * 0.8, r * 0.4, 0, 0, PI); g.fill();
        } else { g.globalAlpha = al * 0.95; g.drawImage(dsp, x - r, y - r, r * 2, r * 2); }
      }
      g.globalAlpha = 1;
      puff(g, 1070 + shake * 40, 420 + shake * 60, 150 + shake * 90, 60 + shake * 50, '#e6eefa', 0.6 * Math.exp(-shake / 0.9) * clamp(shake * 5), 9);
      lighter(g, () => glowA(g, 1080, 400 + shake * 40, 120 + shake * 60, '#dfe8f8', 0.22 * Math.exp(-shake / 0.5)));
    }
    // 峰顶被风扯起的雪烟
    for (let k = 0; k < 3; k++) {
      const u = ((t * 0.35 + k / 3) % 1), x = 880 + u * 420, y = 522 - u * 30 + Math.sin(t + k) * 4;
      puff(g, x, y, 30 + u * 90, 10 + u * 22, '#e8f0fa', 0.5 * Math.sin(PI * u), 12 + k);
    }
    g.restore();
  }

  // 古字的一阵风雪：大片近处的雪团横扫过画面，一层白雾压过来，切换就藏在它最浓的那一瞬
  function gustVeil(g, c, d, amt) {
    if (amt <= 0.01) return;
    g.fillStyle = rgba('#e8eef8', 0.55 * amt * amt); g.fillRect(0, 0, W, H);
    E.mist(g, { t: c.t, y: 360, h: 600, color: '#eef3fb', alpha: 0.85 * amt, speed: 900, seed: 19 });
    E.mist(g, { t: c.t, y: 300, h: 300, color: '#ffffff', alpha: 0.6 * amt, speed: 1300, seed: 23 });
    const bar = barSpr('#ffffff'), dsp = dotSpr('#ffffff');
    for (let i = 0; i < 60; i++) {
      const v = h2(i, 141), sp = 1400 + 1300 * v, len = 40 + 140 * v, th = 6 + 20 * v;
      const x = -300 + ((h2(i, 142) * 1900 + (d + 0.4) * sp) % 1900), y = h2(i, 143) * (H + 60) - 30 + Math.sin(d * 4 + i) * 10;
      g.globalAlpha = clamp(amt * (0.35 + 0.6 * v));
      g.drawImage(bar, x - len, y - th / 2, len * 2, th);
      g.drawImage(dsp, x + len * 0.6 - th / 2, y - th / 2, th, th);
    }
    g.globalAlpha = 1;
  }

  XYT.registerShot('c3_wake', {
    name: '雪巅长啸', zone: 'left', night: true, text: '#e9f1f6', shadow: 'rgba(8,12,30,0.92)', accent: '#9fe3d0', bloom: 0.34,
    draw(g, c) {
      const t = c.t, lt = c.lt, L = WK.l;
      const tXiao = ct(c, 0, L[0]), tGu = ct(c, 4, L[4]), tMem = WK.mem;
      if (lt >= tMem) { wakeMemory(g, c, lt - tMem); return; }
      // 假拉远：近景从 5 倍缩到 1，远景从 1.35 缩到 1；脸在风雪最浓时一刀切走
      const p0 = tGu - 0.1, u = easeOut(clamp((lt - p0) / 1.2)), u2 = easeInOut(clamp((lt - p0) / 1.2));
      const tSw = tGu + 0.1, face = lt < tSw;
      const gd = lt - (tGu - 0.05), gust = gd < 0 ? 0 : gd < 0.15 ? smooth(gd / 0.15) : 1 - smooth((gd - 0.15) / 0.45);
      const hx = 866, hy = 452;
      const Z = lerp(5, 1, u), Zb = lerp(1.35, 1, u2);
      const tx = lerp(800, hx, u2), ty = lerp(330, hy, u2);
      if (!face) {
        wakeWide(g, c, Z, Zb, hx, hy, tx, ty);
        V.snow(g, c, { n: 90, size: [1, 7], fall: 34, wind: 40, seed: 45, alpha: 0.8 });
      } else {
        g.save();
        const z = 1.0 + 0.04 * clamp(lt / 2) + 0.05 * smooth(gd / 0.15);
        g.translate(640, 360); g.scale(z, z); g.translate(-640, -360);
        g.drawImage(wakeFaceBg(), -40, -40, W + 80, H + 80);
        E.stars(g, { t, n: 60, seed: 44, maxY: 600, alpha: 0.9 });
        aurora(g, t, 0.8, { y: 540, x0: 100, x1: 900, n: 48 });
        const smile = smooth((lt + 0.2) / 0.5) * (0.5 + 0.5 * smooth((lt - 0.9) / 0.6));
        const open = smooth((lt - tXiao) / 0.42);
        // 脸跟着同一个缩放一起退远（以眼为锚点）
        const fs = 1.5 * Z / 5;
        drawFace(g, c, tx, ty, fs, open, smile);
        // 呵出的白气：每个字一口，从嘴里出来，往左上飘散
        const cr = Math.cos(FSP.rot), sr = Math.sin(FSP.rot);
        const mx = tx + fs * (cr * -46 - sr * 86), my = ty + fs * (sr * -46 + cr * 86);
        for (let k = 0; k < 4; k++) breath(g, mx - 8, my, lt - ct(c, k, L[k]), { seed: 70 + k * 5 });
        g.restore();
        V.snow(g, c, { n: 46, size: [3, 22], fall: 40, wind: 30, layer: 'front', seed: 44, alpha: 0.75 });
      }
      gustVeil(g, c, gd, gust);
    },
  });

  // 回忆：余杭客栈，少年店小二给醉道士斟酒，道士拍桌大笑（工笔重彩，暖金）
  function innHallTex() {
    return K.cache('g12innhall4', W, H, 1, (g) => {
      vgrad(g, 0, 0, W, H, [[0, '#2a120a'], [0.55, '#5a2a12'], [1, '#1e0c06']]);
      // 后墙木板壁，朱漆立柱
      for (let x = 0; x < W; x += 64) { g.fillStyle = x % 128 ? '#5e2e14' : '#6a3618'; g.fillRect(x, 60, 62, 520); }
      // 一扇大格窗，窗外灯火透进来（虚焦，压暗一些，人物不再逆光成黑影）
      const WX0 = 410, WX1 = 930, WY0 = 110, WY1 = 410;
      g.fillStyle = '#c8823e'; g.fillRect(WX0, WY0, WX1 - WX0, WY1 - WY0);
      const gr = g.createRadialGradient(670, 250, 20, 670, 250, 340); gr.addColorStop(0, 'rgba(255,230,180,0.55)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = gr; g.fillRect(WX0, WY0, WX1 - WX0, WY1 - WY0);
      g.strokeStyle = 'rgba(60,24,8,0.75)'; g.lineWidth = 5;
      for (let k = 0; k <= 10; k++) { g.beginPath(); g.moveTo(WX0 + k * 52, WY0); g.lineTo(WX0 + k * 52, WY1); g.stroke(); }
      for (let k = 0; k <= 6; k++) { g.beginPath(); g.moveTo(WX0, WY0 + k * 50); g.lineTo(WX1, WY0 + k * 50); g.stroke(); }
      g.lineWidth = 12; g.strokeStyle = '#3a1608'; g.strokeRect(WX0, WY0, WX1 - WX0, WY1 - WY0);
      // 朱漆立柱（左柱让开歌词栏）
      for (const px of [340, 1000]) {
        g.fillStyle = K.lin(g, px, 0, px + 46, 0, [[0, '#6a100c'], [0.4, '#c8301c'], [1, '#4a0a06']]);
        g.fillRect(px, 0, 46, H);
        g.fillStyle = '#d8a440'; g.fillRect(px - 4, 70, 54, 10); g.fillRect(px - 4, 540, 54, 8);
      }
      // 梁上石青彩画
      g.fillStyle = K.lin(g, 0, 20, 0, 70, [[0, '#123e4a'], [0.5, '#2a8a86'], [1, '#0e3036']]); g.fillRect(0, 20, W, 50);
      g.strokeStyle = '#e8c060'; g.lineWidth = 2;
      for (let x = 60; x < W; x += 140) { g.beginPath(); ellS(g, x, 45, 46, 14, 0, 0, TAU); g.stroke(); g.beginPath(); ellS(g, x, 45, 26, 7, 0, 0, TAU); g.stroke(); }
      // 酒旗：红布黑字
      g.fillStyle = '#b8241a'; g.beginPath(); g.moveTo(1090, 90); g.lineTo(1190, 90); g.lineTo(1190, 330); g.lineTo(1140, 300); g.lineTo(1090, 330); g.closePath(); g.fill();
      g.strokeStyle = '#e8b850'; g.lineWidth = 2; g.strokeRect(1096, 96, 88, 190);
      g.fillStyle = '#1a0a06'; g.font = `78px ${XYT.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('酒', 1140, 190);
      // 酒架上的坛子（远处虚焦，压暗）
      for (let k = 0; k < 4; k++) E.wineJar(g, { x: 80 + k * 46, y: 520, s: 0.42, label: '酒' });
      g.fillStyle = 'rgba(30,12,4,0.35)'; g.fillRect(40, 380, 220, 150);
      // 地面
      vgrad(g, 0, 580, W, H, [[0, '#4a2610'], [1, '#1e0e06']]);
      // 窗光与灯光的暖晕
      K.lighter(g, () => { A.glow(g, 670, 250, 360, '#ffc070', 0.2); A.glow(g, 150, 150, 160, '#ffa040', 0.22); });
      g.globalAlpha = 1;
    });
  }
  function wakeMemory(g, c, k) {
    const t = c.t;
    const z = 1.2 + 0.04 * k;
    g.save(); g.translate(660, 560); g.scale(z, z); g.translate(-660, -560);
    g.drawImage(innHallTex(), 0, 0, W, H);
    // 两盏宫灯
    for (const [lx, ly] of [[150, 96], [1120, 70]]) E.lantern(g, { x: lx, y: ly, s: 1.25, t, kind: 'palace', lit: 1, color: '#d83a22', glowColor: '#ffb050', seed: lx });
    // 拍桌：每一拍道士的手先抬起、再重重拍在桌面上（只算落在插格里的拍）
    const since = c.b ? c.b.since : 9, onBeat = k - since > -0.02;
    const slap = onBeat ? Math.exp(-since / 0.12) * (c.b.str ?? 1) : 0;
    const per = c.b ? c.b.period || 0.83 : 0.83, lift = c.b ? 1 - smooth((per * (1 - c.b.ph)) / 0.25) : 0;
    const drop = 6 * slap - 7 * lift;
    // 方桌：朱漆描金，桌面高度对着道士拍下的那只手
    const jo = { pose: 'laugh', prop: 'gourd', facing: -1, wind: 0.15, rim: '#ffd690', light: [640, 260], night: true, seed: 3 };
    const JX = 850, JY = 866;
    const ty = F.points('jiujianxian', JX, JY, 2.25, t, jo).handF[1] + 8;
    // 桌面（在人身后的那一半先画）
    g.fillStyle = K.lin(g, 0, ty - 40, 0, ty, [[0, '#b0642a'], [1, '#7a3a14']]);
    g.beginPath(); g.moveTo(330, ty); g.lineTo(390, ty - 40); g.lineTo(1050, ty - 40); g.lineTo(1110, ty); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(240,192,96,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(390, ty - 40); g.lineTo(1050, ty - 40); g.stroke();
    // 人物身后的暖光
    lighter(g, () => { glowA(g, 840, 420, 260, '#ffb860', 0.22); glowA(g, 480, 460, 220, '#ffb860', 0.2); });
    // 醉道士：仰天大笑，举起葫芦，远手拍桌
    F.draw(g, 'jiujianxian', JX, JY + drop, 2.25, t, jo);
    // 少年店小二斟酒
    const yo = { stage: 'youth', pose: 'reach', facing: 1, wind: 0.15, lean: 0.12, rim: '#ffd690', light: [640, 260], night: true, seed: 4 };
    F.draw(g, 'xiaoyao', 470, ty + 172, 2.05, t, yo);
    const pp = F.points('xiaoyao', 470, ty + 172, 2.05, t, yo);
    // 桌前沿一直落到画外，挡住两人的腿
    g.fillStyle = K.lin(g, 0, ty, 0, ty + 120, [[0, '#7a2a12'], [1, '#2e0e04']]); g.fillRect(330, ty, 780, H + 60 - ty);
    g.strokeStyle = '#f0c060'; g.lineWidth = 2; g.beginPath(); g.moveTo(330, ty); g.lineTo(1110, ty); g.stroke();
    g.strokeStyle = 'rgba(240,192,96,0.6)'; g.lineWidth = 1.2; g.strokeRect(350, ty + 8, 740, 24);
    g.strokeStyle = 'rgba(240,192,96,0.35)'; g.strokeRect(350, ty + 44, 740, 60);
    // 正面的一层暖光（工笔重彩，脸与衣都被照亮）
    lighter(g, () => glowA(g, 640, 520, 420, '#ffb060', 0.25));
    // 酒碗：拍桌时一齐跳起
    const jump = -12 * slap;
    for (const [bx, s, ph] of [[690, 1.25, 0], [880, 1, 1], [560, 0.9, 2]]) {
      const by = ty - 18 + jump * (0.8 + 0.6 * h2(ph, 3));
      g.fillStyle = K.lin(g, bx - 28 * s, 0, bx + 28 * s, 0, [[0, '#d8d0bc'], [0.45, '#ffffff'], [1, '#9c947e']]);
      g.beginPath(); g.moveTo(bx - 28 * s, by - 20 * s); g.quadraticCurveTo(bx, by + 14 * s, bx + 28 * s, by - 20 * s); g.closePath(); g.fill();
      g.strokeStyle = '#2f6aa0'; g.lineWidth = 2.2 * s; g.beginPath(); g.moveTo(bx - 23 * s, by - 13 * s); g.quadraticCurveTo(bx, by - 1 * s, bx + 23 * s, by - 13 * s); g.stroke();
      g.fillStyle = '#d0902a'; g.beginPath(); ellS(g, bx, by - 20 * s, 26 * s, 5.5 * s, 0, 0, TAU); g.fill();
    }
    // 酒坛倾斜，一道金色酒线落进碗里
    const jx = pp.handN[0] + 4, jy = pp.handN[1] + 10;
    E.wineJar(g, { x: jx, y: jy + 34, s: 0.62, tilt: 1.05, label: '酒' });
    const mx = jx + 58, my = jy - 4, bxw = 690, byw = ty - 42 + jump;
    g.strokeStyle = 'rgba(246,190,80,0.95)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(mx, my); g.bezierCurveTo(mx + 40, my + 4, bxw - 10, byw - 60, bxw, byw); g.stroke();
    g.strokeStyle = 'rgba(255,240,190,0.8)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(mx, my - 1); g.bezierCurveTo(mx + 40, my + 3, bxw - 11, byw - 61, bxw - 1, byw); g.stroke();
    lighter(g, () => glowA(g, bxw, byw, 40, '#ffd070', 0.55));
    // 拍下的那只手：桌面荡开一圈，溅起八颗酒珠
    if (slap > 0.02) {
      const hp = F.points('jiujianxian', JX, JY + drop, 2.25, t, jo).handF, e = 1 - slap;
      g.strokeStyle = rgba('#ffe0a0', 0.8 * slap); g.lineWidth = 2;
      g.beginPath(); ellS(g, hp[0], ty - 14, 8 + 30 * e, (8 + 30 * e) * 0.3, 0, 0, TAU); g.stroke();
      for (let i = 0; i < 8; i++) {
        const a = PI + 0.25 + (i / 7) * (PI - 0.5), v = 60 + 60 * h2(i, 9), d = e * 0.5;
        glowA(g, hp[0] + Math.cos(a) * v * d * 1.4, ty - 14 + Math.sin(a) * v * d * 2 + 300 * d * d, 4, '#ffd080', 0.95 * slap);
      }
      lighter(g, () => glowA(g, hp[0], ty - 14, 46, '#ffd890', 0.4 * slap));
    }
    // 酒气与灯下暖尘
    E.mist(g, { t, y: 520, h: 120, color: '#ffe0b0', alpha: 0.12, speed: 12, seed: 5, w: 600 });
    V.dust(g, c, { n: 32, area: [80, 60, 1200, 600], color: '#ffd8a0', size: [1, 3], night: true });
    g.restore();
    memFrame(g, k, { sealText: '酒' });
  }

  // ======================================================================
  // 42 · c3_frostsword 霜剑为碑
  // ======================================================================
  const FS = { l: [0.25, 0.59, 0.99, 1.43, 1.95, 2.47, 3.13, 3.51, 3.89, 4.23, 4.68], mem: 5.07 };
  const SW = { x: 420, ground: 630, Lb: 200, bury: 120 };
  // 星河夜空与脚下云海（静态，缓存）
  function frostSkyTex() {
    return K.cache('g12frostSky', W, H, 0.6, (g) => {
      vgrad(g, 0, 0, W, H, [[0, '#06070e'], [0.35, '#111a30'], [0.65, '#26365a'], [1, '#4a5c82']]);
      const gr = g.createRadialGradient(300, 140, 20, 300, 140, 620);
      gr.addColorStop(0, 'rgba(120,140,210,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, 560);
    });
  }
  // 霜花纹理：〔第8句第5–7字〕羽状冰晶（白色，按剑身拉伸）
  function frostTex() {
    return K.cache('g12frostTex', 40, 240, 2, (g) => {
      const rr = A.rng(902);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineCap = 'round';
      for (let k = 0; k < 46; k++) {
        const x = rr() * 40, y = rr() * 240, L = 6 + rr() * 16, a = -PI / 2 + (rr() - 0.5) * 1.6;
        g.lineWidth = 0.4 + rr() * 0.7;
        g.beginPath(); g.moveTo(x, y); const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L; g.lineTo(ex, ey); g.stroke();
        // 羽枝
        for (let j = 1; j < 4; j++) {
          const u = j / 4, px = lerp(x, ex, u), py = lerp(y, ey, u), l2 = L * 0.35 * (1 - u * 0.5);
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 0.7) * l2, py + Math.sin(a - 0.7) * l2); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 0.7) * l2, py + Math.sin(a + 0.7) * l2); g.stroke();
        }
      }
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let k = 0; k < 120; k++) g.fillRect(rr() * 40, rr() * 240, 1, 1);
    });
  }
  // 缺口钝剑：x 剑身中线，gy 剑格的 y（剑尖朝下）；剑刃六处豁口，剑尖崩掉一截
  const NOTCH = [[-1, 0.12, 4.2, 6], [1, 0.2, 5.4, 7], [-1, 0.31, 5.8, 7.5], [1, 0.4, 4.6, 6], [-1, 0.5, 6.2, 8], [1, 0.62, 5, 6.5]];
  const bladeW = (u, s) => 7.5 * s * (1 - u * 0.25);
  function bladePath(g, x, gy, L, s) {
    const left = NOTCH.filter((n) => n[0] < 0), right = NOTCH.filter((n) => n[0] > 0).reverse();
    g.beginPath(); g.moveTo(x - bladeW(0, s), gy);
    for (const [, u, d, hh] of left) { const w = bladeW(u, s), y = gy + L * u; g.lineTo(x - w, y - hh * 0.5 * s); g.lineTo(x - w + d * s, y + hh * 0.1 * s); g.lineTo(x - w + d * 0.4 * s, y + hh * 0.3 * s); g.lineTo(x - w, y + hh * 0.5 * s); }
    // 崩掉的剑尖：一道斜的断口
    g.lineTo(x - bladeW(0.86, s), gy + L * 0.86); g.lineTo(x - 2 * s, gy + L * 0.9); g.lineTo(x + 1 * s, gy + L * 0.87); g.lineTo(x + bladeW(0.84, s), gy + L * 0.83);
    for (const [, u, d, hh] of right) { const w = bladeW(u, s), y = gy + L * u; g.lineTo(x + w, y + hh * 0.5 * s); g.lineTo(x + w - d * 0.4 * s, y + hh * 0.3 * s); g.lineTo(x + w - d * s, y + hh * 0.1 * s); g.lineTo(x + w, y - hh * 0.5 * s); }
    g.lineTo(x + bladeW(0, s), gy); g.closePath();
  }
  // 冰壳：比剑身各宽 2px，上沿是参差的霜线
  function shellPath(g, x, gy, L, s, topY, botY, fr) {
    const uT = (topY - gy) / L, uB = (botY - gy) / L, n = 8;
    g.beginPath();
    for (let k = 0; k <= n; k++) { const u = lerp(uB, uT, k / n); g.lineTo(x - bladeW(u, s) - 2, gy + L * u); }
    for (let k = 0; k <= 6; k++) { const xx = x - bladeW(uT, s) - 2 + (k / 6) * (bladeW(uT, s) + 2) * 2; g.lineTo(xx, topY + (h2(k, 9 + Math.floor(fr * 4)) * 9 - 2) * s); }
    for (let k = n; k >= 0; k--) { const u = lerp(uB, uT, k / n); g.lineTo(x + bladeW(u, s) + 2, gy + L * u); }
    g.closePath();
  }
  // 羽状霜花：主干 3–7px，两侧各一根短枝
  function fernSprays(g, x, gy, L, s, topY, botY, a) {
    g.strokeStyle = rgba('#f2faff', 0.9 * a); g.lineWidth = 0.8; g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k < 40; k++) {
      const y = lerp(botY - 2, gy + 6, h2(k, 21));
      if (y < topY + 2) continue;
      const u = (y - gy) / L, side = k % 2 ? 1 : -1, w0 = bladeW(u, s) + 1.5;
      const an = (side > 0 ? 0 : PI) + (h2(k, 22) - 0.5) * 1.6, len = (3 + 4 * h2(k, 23)) * s * 0.85;
      const x0 = x + side * w0 * (0.4 + 0.6 * h2(k, 24)), ex = x0 + Math.cos(an) * len, ey = y + Math.sin(an) * len;
      g.moveTo(x0, y); g.lineTo(ex, ey);
      for (const f of [0.45, 0.75]) { const px = lerp(x0, ex, f), py = lerp(y, ey, f), l2 = len * 0.4 * (1.1 - f); g.moveTo(px, py); g.lineTo(px + Math.cos(an - 0.8) * l2, py + Math.sin(an - 0.8) * l2); g.moveTo(px, py); g.lineTo(px + Math.cos(an + 0.8) * l2, py + Math.sin(an + 0.8) * l2); }
    }
    g.stroke();
  }
  function star4(g, x, y, L, a, col = '#ffffff', rot = 0.2) {
    if (a <= 0.02) return;
    g.strokeStyle = rgba(col, a); g.lineWidth = 0.9; g.lineCap = 'round';
    g.beginPath();
    for (let j = 0; j < 2; j++) { const an = rot + j * PI / 2, cx = Math.cos(an) * L, cy = Math.sin(an) * L; g.moveTo(x - cx, y - cy); g.lineTo(x + cx, y + cy); }
    g.stroke();
    g.lineWidth = 0.6; g.beginPath();
    for (let j = 0; j < 2; j++) { const an = rot + PI / 4 + j * PI / 2, cx = Math.cos(an) * L * 0.4, cy = Math.sin(an) * L * 0.4; g.moveTo(x - cx, y - cy); g.lineTo(x + cx, y + cy); }
    g.stroke();
  }
  function frostSword(g, c, o) {
    const s = o.s, x = o.x, gy = o.gy, L = SW.Lb * s, snowY = o.snowY, t = c.t;
    g.save();
    g.beginPath(); g.rect(x - 80, -50, 160, snowY + 50); g.clip();
    // 剑身：冷钢，中脊一道亮线
    bladePath(g, x, gy, L, s);
    g.fillStyle = K.lin(g, x - 8 * s, 0, x + 8 * s, 0, [[0, '#d8e2ea'], [0.48, '#9aa8b8'], [0.52, '#4e5a6c'], [1, '#78869a']]);
    g.fill();
    g.strokeStyle = 'rgba(30,36,50,0.55)'; g.lineWidth = 0.8; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(x - 0.4, gy + 4); g.lineTo(x - 0.4, gy + L * 0.84); g.stroke();
    // 锈斑与旧血
    g.fillStyle = 'rgba(110,70,60,0.3)';
    for (let k = 0; k < 5; k++) { g.beginPath(); ellS(g, x + (h2(k, 3) - 0.5) * 8 * s, gy + L * (0.15 + 0.6 * h2(k, 4)), 1.8 * s, 4 * s, 0, 0, TAU); g.fill(); }
    // 刀、钝、刃：一点星光沿刃口滑下，每过一处豁口就卡一下、亮一下
    for (const [tk, side] of o.glints || []) {
      const d = c.lt - tk;
      if (d < 0 || d > 0.42) continue;
      const u = Math.min(0.8, (d / 0.3) * 0.8), w = bladeW(u, s), gx = x + side * w, gyy = gy + L * u;
      let catchA = 0;
      for (const [sd, un] of NOTCH) if (sd === side) catchA = Math.max(catchA, Math.exp(-(((u - un) / 0.035) ** 2)));
      const al = (0.55 + 0.9 * catchA) * (1 - smooth((d - 0.3) / 0.12));
      lighter(g, () => { glowA(g, gx, gyy, 9 + 10 * catchA, '#e8f6ff', 0.7 * al); star4(g, gx, gyy, 5 + 8 * catchA, Math.min(1, al), '#ffffff', 0.1); });
    }
    // 霜：从雪线向上爬，羽状冰晶；外面一层半透明冰壳
    const fr = clamp(o.frost), sh = clamp(o.shell ?? 1);
    if (fr > 0 && sh > 0) {
      const topY = lerp(snowY, gy, fr);
      g.save(); g.globalAlpha = sh;
      shellPath(g, x, gy, L, s, topY, snowY + 4, fr);
      g.fillStyle = 'rgba(220,240,255,0.35)'; g.fill();
      g.save(); g.clip();
      g.fillStyle = K.lin(g, 0, topY, 0, snowY, [[0, 'rgba(240,250,255,0.55)'], [1, 'rgba(200,226,246,0.75)']]);
      g.fillRect(x - 14 * s, topY - 12 * s, 28 * s, snowY - topY + 20 * s);
      g.drawImage(frostTex(), x - 12 * s, gy - 4, 24 * s, L);
      g.restore();
      g.strokeStyle = 'rgba(244,252,255,0.95)'; g.lineWidth = 1.2; g.stroke();
      fernSprays(g, x, gy, L, s, topY, snowY, 1);
      g.restore();
    }
    g.restore();
    // 每个字霜往上爬一节：新的霜线上一点星芒，光一闪
    for (const [ts, j] of o.steps || []) {
      const d = c.lt - ts;
      if (d < 0 || d > 0.9 || fr <= 0) continue;
      const fy = lerp(snowY, gy, fr), pulse = Math.exp(-Math.max(0, d - 0.12) / 0.3) * clamp(d * 12), side = j % 2 ? 1 : -1;
      lighter(g, () => { glowA(g, x, fy, 18, '#e8f8ff', 0.6 * pulse); star4(g, x + side * bladeW((fy - gy) / L, s), fy, 12 * (0.6 + 0.4 * pulse), pulse, '#ffffff', 0.35); });
    }
    // 裂纹：破字一道清脆的白线自下而上劈开冰壳
    const ck = clamp(o.crack || 0);
    if (ck > 0) {
      const y0 = snowY, y1 = lerp(snowY, gy + 8, ck), a = o.crackA ?? 1;
      lighter(g, () => {
        g.strokeStyle = rgba('#f4fcff', 0.95 * a); g.lineWidth = 1.2; g.lineJoin = 'miter';
        g.beginPath(); g.moveTo(x + 1, y0);
        for (let k = 1; k <= 14; k++) { const y = lerp(y0, y1, k / 14); g.lineTo(x + (k % 2 ? 1 : -1) * (2 + 3 * h2(k, 33)) * s, y); }
        g.stroke();
        g.lineWidth = 0.8;
        for (let k = 2; k < 14; k += 3) { const y = lerp(y0, y1, k / 14), d = (k % 2 ? 1 : -1); g.beginPath(); g.moveTo(x, y); g.lineTo(x + d * 7 * s, y - 6 * s); g.stroke(); }
        glowA(g, x, y1, 10, '#dff6ff', 0.8 * a);
      });
    }
    // 剑格（铜，带霜边）、剑柄、剑首
    g.save(); g.translate(x, gy); g.scale(s, s);
    g.fillStyle = K.lin(g, -18, 0, 18, 0, [[0, '#5a4a30'], [0.5, '#b89a58'], [1, '#3a2c18']]);
    g.beginPath(); g.moveTo(-19, 1); g.quadraticCurveTo(0, -9, 19, 1); g.lineTo(15, 6); g.quadraticCurveTo(0, 0, -15, 6); g.closePath(); g.fill();
    if (o.guardFrost > 0) { g.strokeStyle = rgba('#f0f8ff', 0.85 * o.guardFrost); g.lineWidth = 1.6; g.beginPath(); g.moveTo(-18, 0); g.quadraticCurveTo(0, -9, 18, 0); g.stroke(); }
    g.fillStyle = '#20140e'; g.fillRect(-3.8, -46, 7.6, 40);
    g.strokeStyle = '#4a3226'; g.lineWidth = 1.3; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(-3.8, -9 - k * 4); g.lineTo(3.8, -12 - k * 4); g.stroke(); }
    g.fillStyle = '#a8904c'; g.beginPath(); ellS(g, 0, -49, 6.5, 5, 0, 0, TAU); g.fill();
    g.strokeStyle = '#a8904c'; g.lineWidth = 2; g.beginPath(); arcS(g, 0, -56, 4, 0, TAU); g.stroke();
    g.restore();
    // 剑穗：红丝随风，绝字冻住，结满白霜
    const fz = clamp(o.freeze || 0), tt = o.tasselT, px = x, py = gy - 60 * s, wind = 0.7;
    const col = mix('#b8302a', '#e8d8dc', fz * 0.65);
    g.strokeStyle = col; g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      g.lineWidth = (1.6 - k * 0.12) * s;
      const ex = px + (16 + 30 * wind + k * 3) * s + Math.sin(tt * 3 + k) * 5 * s, ey = py + (40 - wind * 16 + k * 3) * s;
      const cx = px + 8 * s + Math.sin(tt * 2.4 + k) * 4 * s, cy = py + 18 * s;
      g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
      if (fz > 0.05) {
        g.fillStyle = rgba('#f2faff', 0.9 * fz);
        g.beginPath(); g.moveTo(ex - 1.6 * s, ey); g.lineTo(ex + 1.6 * s, ey); g.lineTo(ex, ey + (5 + 4 * h2(k, 41)) * s * fz); g.closePath(); g.fill();
      }
    }
    g.fillStyle = col; g.beginPath(); arcS(g, px + 2 * s, py + 6 * s, 3.2 * s, 0, TAU); g.fill();
    if (fz > 0.05) lighter(g, () => glowA(g, px + 14 * s, py + 26 * s, 26 * s, '#e8f6ff', 0.35 * fz));
  }
  // 峰顶：剑与人所在的雪顶，过了 x≈940 是一道雪檐，往下陡落进云海；远处崖边一株小雪松
  const CORN = 940;
  const fsBase = (x) => 606 + Math.pow(Math.abs(x - 470) / 820, 1.5) * (x > 470 ? 64 : 40) + 3 * Math.sin(x * 0.03);
  const fsGround = (x) => x <= CORN ? fsBase(x) - 5 * smooth((x - CORN + 50) / 50) : fsBase(CORN) - 5 + Math.pow((x - CORN) / 70, 2.1) * 70;
  function fsGroundTex() {
    return K.cache('g12fsGround2', W + 80, 200, 1, (g) => {
      g.translate(40, -540);
      const path = () => { g.beginPath(); g.moveTo(-40, 740); for (let x = -40; x <= W + 40; x += 6) g.lineTo(x, Math.min(745, fsGround(x))); g.lineTo(W + 40, 745); g.closePath(); };
      path();
      g.fillStyle = K.lin(g, 0, 596, 0, 720, [[0, '#eef4fa'], [0.35, '#d6e0ee'], [1, '#8e9ec4']]); g.fill();
      g.save(); path(); g.clip();
      const rr = A.rng(311);
      for (let k = 0; k < 14; k++) { const x = rr() * CORN, y = 620 + rr() * 100, rx = 120 + rr() * 220; g.fillStyle = K.lin(g, 0, y - 8, 0, y + 10, [[0, 'rgba(255,255,255,0.5)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(110,130,180,0.35)']]); g.beginPath(); ellS(g, x, y, rx, 10 + rr() * 8, 0, 0, TAU); g.fill(); }
      for (let k = 0; k < 80; k++) { const x = rr() * W, y = fsGround(x) + 6 + rr() * 110, l = 20 + rr() * 60; g.strokeStyle = 'rgba(110,128,176,0.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y + 1); g.stroke(); }
      // 雪檐背光的一面：越往下越蓝
      g.fillStyle = K.lin(g, CORN - 60, 0, CORN + 120, 0, [[0, 'rgba(70,90,140,0)'], [1, 'rgba(70,90,140,0.55)']]); g.fillRect(CORN - 60, 600, 400, 160);
      // 脚印：从右前方一路走到剑前
      for (let i = 0; i < 16; i++) {
        const v = i / 15, x = lerp(900, 600, Math.pow(v, 0.85)) + Math.sin(v * 6) * 14, y = lerp(716, fsGround(600) + 8, Math.pow(v, 0.7)), sc = lerp(1.6, 0.8, v), side = i % 2 ? 1 : -1;
        g.fillStyle = 'rgba(96,112,160,0.5)'; g.beginPath(); ellS(g, x + side * 8 * sc, y, 7 * sc, 3 * sc, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); ellS(g, x + side * 8 * sc, y + 2.4 * sc, 7 * sc, 1.6 * sc, 0, 0, PI); g.fill();
      }
      g.restore();
      // 雪檐的亮边，檐口垂下几根冰凌
      g.strokeStyle = 'rgba(240,250,255,0.9)'; g.lineWidth = 1.5;
      g.beginPath(); for (let x = -40; x <= CORN + 160; x += 6) x === -40 ? g.moveTo(x, fsGround(x)) : g.lineTo(x, fsGround(x)); g.stroke();
      g.fillStyle = 'rgba(236,246,255,0.85)';
      for (let k = 0; k < 7; k++) { const x = CORN + 4 + k * 9, y = fsGround(x); g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + 2, y); g.lineTo(x, y + 8 + 10 * h2(k, 5)); g.closePath(); g.fill(); }
    });
  }
  function frostBgTex() {
    return K.cache('g12frostBg2', W + 80, H + 80, 1, (g) => {
      g.translate(40, 40);
      g.drawImage(frostSkyTex(), -40, -40, W + 80, H + 80);
      E.stars(g, { t: 0, n: 200, seed: 52, maxY: 520, alpha: 1, twinkle: 0, milky: 1.15, milkyX: 600, milkyY: 220, milkyAngle: -0.62, milkyColor: '#c4d0ff' });
      // 天边一抹淡淡的玫瑰色
      K.lighter(g, () => A.glow(g, 900, 470, 500, '#f6d6dc', 0.12));
      g.globalAlpha = 1;
      E.mountains(g, { t: 0, layers: [
        { color: '#5a6c94', light: '#c8d6ee', alpha: 1, y: 476, scaleY: 0.55, kind: 'far', seed: 31, rim: '#dceaff', rimA: 0.45, speed: 0 },
      ] });
      vgrad(g, -40, 440, W + 40, 520, [[0, 'rgba(150,168,206,0)'], [0.55, 'rgba(150,168,206,0.85)'], [1, 'rgba(150,168,206,1)']]);
      E.mist(g, { t: 0, y: 470, h: 90, color: '#b4c2e0', alpha: 0.7, seed: 13 });
      E.mountains(g, { t: 0, layers: [
        { color: '#3e4e74', light: '#aabcde', alpha: 1, y: 548, scaleY: 0.5, kind: 'mid', seed: 36, rim: '#d0e2ff', rimA: 0.4, speed: 0 },
      ] });
      // 脚下的云海（雪檐外看得见）
      E.cloudSea(g, { t: 0, y: 566, color: '#d8e2f2', shade: '#7a8cb8', speed: 0, rows: 4, seed: 7 });
      E.mist(g, { t: 0, y: 590, h: 120, color: '#dde6f4', alpha: 0.55, seed: 15 });
      g.drawImage(fsGroundTex(), -40, 540, W + 80, 200);
      // 雪檐边上的小雪松（第一镜那株，远远地）
      g.save(); g.translate(CORN + 6, fsGround(CORN + 6) + 3); g.scale(0.4, 0.4); g.rotate(0.05);
      g.drawImage(pineBare(), -30, -262, 320, 270); g.drawImage(pineCaps(), -30, -282, 320, 290);
      g.restore();
    });
  }
  // 插下剑的一瞬：雪块成冠状溅开，两团雪粉
  function snowBurst(g, x, y, hit) {
    if (hit <= 0 || hit > 1.6) return;
    const dsp = dotSpr('#f4f8ff');
    for (let i = 0; i < 40; i++) {
      const a = -PI / 2 + (h2(i, 61) - 0.5) * (PI * 2 / 3), v = 300 + 300 * h2(i, 62), d = hit;
      const px = x + Math.cos(a) * v * d * 0.9, py = y - 4 + Math.sin(a) * v * d * 0.7 + 0.5 * 900 * d * d;
      if (py > y + 14) continue;
      const r = 2 + 4 * h2(i, 63), al = clamp(1.4 - d / 0.8);
      g.globalAlpha = al; g.fillStyle = '#f4f8fd';
      g.beginPath(); ellS(g, px, py, r, r * 0.8, d * 4 + i, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,140,190,0.6)'; g.beginPath(); ellS(g, px + r * 0.2, py + r * 0.3, r * 0.75, r * 0.35, 0, 0, PI); g.fill();
    }
    for (let i = 0; i < 50; i++) {
      const a = -PI / 2 + (h2(i, 66) - 0.5) * 2.4, v = 120 + 260 * h2(i, 67), dr = 3;
      const dd = (v * (1 - Math.exp(-dr * hit))) / dr, px = x + Math.cos(a) * dd, py = y - 6 + Math.sin(a) * dd * 0.7 + 120 * hit * hit;
      const r = 1 + 2.5 * h2(i, 68), al = clamp(1 - hit / (0.5 + 0.8 * h2(i, 69)));
      if (al <= 0) continue;
      g.globalAlpha = al; g.drawImage(dsp, px - r, py - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    lighter(g, () => glowA(g, x, y - 10, 50, '#dfe8f8', 0.25 * Math.exp(-hit / 0.3)));
    const pu = easeOut(clamp(hit / 1.2));
    puff(g, x - 30 - 40 * pu, y - 14 - 30 * pu, lerp(30, 90, pu), lerp(14, 40, pu), '#eef3fa', 0.7 * (1 - pu), 21);
    puff(g, x + 30 + 50 * pu, y - 10 - 20 * pu, lerp(30, 90, pu), lerp(12, 34, pu), '#e6eef8', 0.6 * (1 - pu), 25);
    const ru = easeOut(clamp(hit / 0.7));
    g.strokeStyle = rgba('#ffffff', 0.7 * (1 - ru)); g.lineWidth = 2.5 * (1 - ru) + 0.5;
    g.beginPath(); ellS(g, x, y + 2, 20 + 150 * ru, 5 + 26 * ru, 0, 0, TAU); g.stroke();
  }
  // 雪面上围着剑根的一圈圈霜花，每个字长一圈
  function frostRings(g, x, y, lt, steps) {
    const RX = [18, 34, 50, 66];
    g.lineCap = 'round';
    steps.forEach((ts, j) => {
      const gr = easeOut(clamp((lt - ts) / 0.35));
      if (gr <= 0) return;
      const rx = RX[j], ry = rx * 0.28, n = 8 + j * 5;
      g.strokeStyle = rgba('#ffffff', 0.25 * gr); g.lineWidth = 0.8;
      g.beginPath(); ellS(g, x, y + 4, rx * gr, ry * gr, 0, 0, TAU); g.stroke();
      g.strokeStyle = rgba('#f4fbff', 0.85 * gr); g.lineWidth = 0.7;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + h2(i, j + 70) * 0.3, px = x + Math.cos(a) * rx * gr, py = y + 4 + Math.sin(a) * ry * gr, r = (2 + 2.5 * h2(i, j + 71)) * gr;
        for (let m = 0; m < 3; m++) { const b = m * PI / 3 + h2(i, j + 72); g.moveTo(px - Math.cos(b) * r, py - Math.sin(b) * r * 0.6); g.lineTo(px + Math.cos(b) * r, py + Math.sin(b) * r * 0.6); }
      }
      g.stroke();
    });
  }
  // 冰壳碎开：整层冰壳沿剑身裂成 16 块（两列 × 八层），各自朝外翻飞、下坠，霜屑纷落
  function shellShatter(g, x, gy, snowY, s, age, t) {
    if (age < 0 || age > 1.4) return;
    const L = SW.Lb * s, rows = 8, fade = 1 - smooth((age - 0.5) / 0.9);
    for (let i = 0; i < 16; i++) {
      const col = i % 2, row = i >> 1, side = col ? 1 : -1;
      const y0 = lerp(gy + 4, snowY, row / rows), y1 = lerp(gy + 4, snowY, (row + 1) / rows), u = ((y0 + y1) / 2 - gy) / L;
      const w = bladeW(u, s) + 2.5, cx = x + side * w * 0.5, cy = (y0 + y1) / 2;
      const vx = side * (90 + 170 * h2(i, 501)), vy = -60 - 160 * h2(i, 502), rot = (h2(i, 503) - 0.5) * 14 * age;
      const px = cx + vx * age, py = cy + vy * age + 0.5 * 700 * age * age;
      if (py > snowY + 10) continue;
      g.save(); g.translate(px, py); g.rotate(rot);
      const hw = w * 0.55, hh = (y1 - y0) * 0.6, j = (k) => (h2(i * 5 + k, 504) - 0.5) * 4;
      g.beginPath(); g.moveTo(-hw + j(0), -hh); g.lineTo(hw + j(1), -hh + j(2)); g.lineTo(hw * 0.8 + j(3), hh); g.lineTo(-hw, hh + j(4)); g.closePath();
      g.fillStyle = rgba('#dcefff', 0.45 * fade); g.fill();
      const gl = Math.pow(Math.abs(Math.sin(rot * 1.4 + i)), 8);
      g.strokeStyle = rgba('#ffffff', (0.6 + 0.4 * gl) * fade); g.lineWidth = 1; g.stroke();
      g.restore();
      if (gl > 0.3) lighter(g, () => star4(g, px, py, 6 * gl, gl * fade, '#ffffff', 0.4));
    }
    // 霜屑
    const dsp = dotSpr('#eef8ff');
    for (let i = 0; i < 60; i++) {
      const y0 = lerp(snowY, gy + 10, h2(i, 71)), side = i % 2 ? 1 : -1, d = age - h2(i, 72) * 0.25;
      if (d < 0) continue;
      const px = x + side * (6 + 40 * d * h2(i, 73)), py = y0 + 0.5 * 500 * d * d - 30 * d;
      if (py > snowY + 6) continue;
      const r = 1 + 2.4 * h2(i, 74), tw = 0.6 + 0.4 * Math.sin(t * 20 + i);
      g.globalAlpha = clamp(1 - d / 1.2) * tw; g.drawImage(dsp, px - r, py - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }
  function frostScene(g, c) {
    const t = c.t, lt = c.lt, L = FS.l;
    const tDao = ct(c, 0, L[0]), tDun = ct(c, 1, L[1]), tRen = ct(c, 2, L[2]);
    const tFa = ct(c, 3, L[3]), tEn = ct(c, 4, L[4]), tDuan = ct(c, 5, L[5]), tYi = ct(c, 6, L[6]), tJue = ct(c, 7, L[7]), tPo = ct(c, 10, L[10]);
    // 插剑的一瞬：极短的下坠，落地时镜头一震；整镜极慢地推近一点
    const plant = easeIn(clamp((lt - (tFa - 0.16)) / 0.16)), hit = lt - tFa;
    const shake = hit > 0 && hit < 0.4 ? Math.exp(-hit / 0.08) * 5 : 0;
    const z = 1 + 0.05 * easeInOut(clamp((lt + 0.3) / (FS.mem + 0.3)));
    g.save();
    g.translate(480 + Math.sin(t * 91) * shake, 560 + Math.cos(t * 77) * shake); g.scale(z, z); g.translate(-480, -560);
    // 天、星河、云海、雪顶一次烘好；动的只有星光闪烁、一条流云和雪面闪光
    g.drawImage(frostBgTex(), -40, -40, W + 80, H + 80);
    E.stars(g, { t, n: 110, seed: 53, maxY: 460, alpha: 0.9 });
    E.mist(g, { t, y: 540, h: 100, color: '#d0dcf0', alpha: 0.35, speed: 9, seed: 14 });
    lighter(g, () => { for (let i = 0; i < 30; i++) { const x = h2(i, 91) * CORN, y = fsGround(x) + 6 + h2(i, 92) * 100, a = Math.max(0, Math.sin(t * (1.5 + 2 * h2(i, 93)) + i)) ** 6; if (a > 0.05) glowA(g, x, y, 3 + 4 * h2(i, 94), '#ffffff', a * 0.8); } });
    E.mist(g, { t, y: 640, h: 50, color: '#f0f4fa', alpha: 0.35, speed: 40, seed: 16, w: 600 });
    // 剑与人的位置
    const s = 1.3, snowY = SW.ground, gyPlanted = SW.ground + SW.bury - SW.Lb * s;
    // 插剑前：剑随着刀、钝、刃三个字一点点举高
    const lift = 130 + 30 * easeOut(clamp(lt / (tFa - 0.2)));
    const gy = lerp(gyPlanted - lift, gyPlanted, plant);
    const gripY = gy - 26 * s;
    const FX = 541, FY = 614, S = 2.2;
    // 手：插剑前高举剑柄，插下后按在剑首上；绝字松手，手落回膝上
    const rel = smooth((lt - tJue) / 0.5);
    const holdN = [lerp((FX - SW.x) / S, 30, rel), lerp((gripY - 10 - FY) / S, -44, rel)];
    const holdF = [lerp((FX - SW.x) / S - 3, 24, rel), lerp((gripY + 8 - FY) / S, -40, rel)];
    const bow = smooth((lt - tFa) / 0.6), grief = smooth((lt - tJue) / 1.2);
    const fo = Object.assign({}, OLD, {
      facing: -1, prop: 'none', pose: 'kneel', cradle: true, holdN, holdF, lean: lerp(-0.32, 0.02, bow) + 0.12 * grief, head: lerp(-0.75, -0.25, bow) + 0.35 * grief,
      wind: 0.75, windDir: 1, rim: '#cfe2ff', light: [260, 120], night: true, seed: 2,
    });
    // 举剑时剑尖在雪上的影子，越落越近
    if (plant < 1) {
      const tipY = gy + SW.Lb * s * 0.88, gap = Math.max(0, snowY - tipY);
      g.fillStyle = rgba('#5a6a98', 0.35 * clamp(1 - gap / 90)); g.beginPath(); ellS(g, SW.x + 6, snowY + 2, 10 + gap * 0.25, 3 + gap * 0.05, 0, 0, TAU); g.fill();
    }
    F.draw(g, 'xiaoyao', FX, FY, S, t, Object.assign({ part: 'back' }, fo));
    // 霜：恩、断、义、绝四个字，每字往上爬一节
    const steps = [tEn, tDuan, tYi, tJue];
    let frost = 0;
    for (const ts of steps) frost += 0.25 * easeOut(clamp((lt - ts) / 0.35));
    const crackP = clamp((lt - tPo) / 0.14), shell = 1 - smooth((lt - tPo - 0.05) / 0.25);
    frostSword(g, c, { x: SW.x, gy, s, snowY: snowY - 2, frost, shell, crack: crackP, crackA: 1 - smooth((lt - tPo - 0.3) / 0.5),
      guardFrost: smooth((lt - tJue) / 0.4) * shell, freeze: smooth((lt - tJue) / 0.25), tasselT: Math.min(t, c.t - c.lt + tJue),
      glints: [[tDao, -1], [tDun, 1], [tRen, -1]], steps: steps.map((ts, j) => [ts, j]) });
    // 插进雪里的那一截被雪堆盖住
    if (plant > 0.5) {
      g.fillStyle = K.lin(g, 0, snowY - 10, 0, snowY + 14, [[0, '#f4f8fc'], [1, '#a8b8d4']]);
      g.beginPath(); ellS(g, SW.x, snowY + 4, 30, 9, 0, PI, TAU); g.lineTo(SW.x + 30, snowY + 12); g.lineTo(SW.x - 30, snowY + 12); g.closePath(); g.fill();
      g.fillStyle = 'rgba(80,96,140,0.3)'; g.beginPath(); ellS(g, SW.x + 10, snowY + 10, 40, 5, 0, 0, TAU); g.fill();
    }
    frostRings(g, SW.x, snowY, lt, steps);
    // 近侧手臂压在剑柄前
    F.draw(g, 'xiaoyao', FX, FY, S, t, Object.assign({ part: 'front' }, fo));
    snowBurst(g, SW.x, snowY, hit);
    // 破：冰壳整个碎开，碎片四散落下
    shellShatter(g, SW.x, gy, snowY, s, lt - tPo - 0.06, t);
    // 空中的冰尘：拍点上一闪一闪
    V.snow(g, c, { n: 70, size: [1, 5], fall: 14, wind: 18, seed: 57, alpha: 0.8, beat: 1 });
    g.restore();
  }
  // 碎冰里先映出桃花池：〔第8句第5–7字〕冰碴从剑上飞开，越飞越大，里面是那年的仙岛，随后填满整幅
  function shardReveal(g, c, k, cx, cy) {
    const n = 18;
    const shards = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (h2(i, 401) - 0.5) * 0.3, dist = lerp(40, 900, easeIn(clamp(k * (0.8 + 0.4 * h2(i, 402)))));
      const sz = lerp(14, 300, easeIn(k)) * (0.6 + 0.6 * h2(i, 403)), rot = h2(i, 404) * TAU + k * 3 * (h2(i, 405) - 0.5);
      const px = cx + Math.cos(a) * dist, py = cy + Math.sin(a) * dist * 0.75;
      const pts = [];
      for (let j = 0; j < 4; j++) { const b = rot + j * TAU / 4 + (h2(i * 4 + j, 406) - 0.5) * 0.9, r = sz * (0.5 + 0.6 * h2(i * 4 + j, 407)); pts.push([px + Math.cos(b) * r, py + Math.sin(b) * r]); }
      shards.push(pts);
    }
    const path = () => { g.beginPath(); for (const p of shards) { g.moveTo(p[0][0], p[0][1]); for (let j = 1; j < 4; j++) g.lineTo(p[j][0], p[j][1]); g.closePath(); } };
    // 碎片里映出的就是下一格回忆的画面（半分辨率临时画一帧）
    const [cv, q] = scratch('g12memPeek', W, H, 0.5);
    frostMemory(q, c, 0, true);
    // 起初把少女那一块对到剑旁的碎片里，越飞越对齐，填满时正好接上下一格
    const ox = (1 - easeOut(k)) * (cx - 690), oy = (1 - easeOut(k)) * (cy - 520);
    g.save(); path(); g.clip();
    g.fillStyle = '#9fd0d0'; g.fillRect(0, 0, W, H);
    g.drawImage(cv, 0, 0, cv.width, cv.height, ox, oy, W, H);
    g.fillStyle = 'rgba(230,246,255,0.12)'; g.fillRect(0, 0, W, H);
    g.restore();
    path(); g.strokeStyle = 'rgba(240,250,255,0.9)'; g.lineWidth = 1.3; g.stroke();
  }

  XYT.registerShot('c3_frostsword', {
    name: '霜剑为碑', zone: 'right', night: true, text: '#e9f1f6', shadow: 'rgba(6,10,26,0.92)', accent: '#bfe6ff', bloom: 0.4,
    draw(g, c) {
      const lt = c.lt;
      if (lt >= FS.mem) { frostMemory(g, c, lt - FS.mem); return; }
      frostScene(g, c);
      const rk = (lt - (FS.mem - 0.18)) / 0.18;
      if (rk > 0) shardReveal(g, c, clamp(rk), SW.x, 560);
    },
  });

  // 回忆：仙灵岛桃花池，白衣少女在水里回身，水花与桃瓣一齐溅起
  function peachPoolTex() {
    return K.cache('g12peachPool4', W, H, 1, (g) => {
      vgrad(g, 0, 0, W, 470, [[0, '#9fd6e0'], [0.6, '#e6f2e4'], [1, '#f6eed8']]);
      // 远山：石青石绿的仙岛
      E.mountains(g, { layers: [
        { color: '#7fb4b0', light: '#d8eee4', alpha: 1, y: 430, scaleY: 0.55, kind: 'far', seed: 61 },
        { color: '#3f8a7c', light: '#a8dcc4', alpha: 1, y: 470, scaleY: 0.6, kind: 'mid', seed: 64 },
      ] });
      E.mist(g, { y: 440, h: 90, color: '#ffffff', alpha: 0.6, seed: 3 });
      // 池水：碧色
      vgrad(g, 0, 470, W, H, [[0, '#7cc6c0'], [0.4, '#3c9a98'], [1, '#1c5a62']]);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      const rr = A.rng(44);
      for (let k = 0; k < 50; k++) { const y = 476 + Math.pow(rr(), 1.4) * 240, x = rr() * W, l = 20 + rr() * 80 * (y / 600); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
      // 左上斜照的几道光（让开右侧歌词栏）
      K.lighter(g, () => {
        for (let k = 0; k < 6; k++) {
          g.save(); g.translate(180 + k * 34, -40); g.rotate(-0.55 - k * 0.06);
          g.globalAlpha = 0.16 + 0.08 * (k % 2); g.drawImage(raySpr('#fff2c8'), -30 - k * 6, 0, 60 + k * 12, 900);
          g.restore();
        }
      });
      g.globalAlpha = 1;
      // 桃树：大的在左，小的在中右（右侧留给歌词）
      E.peachTree(g, { x: 120, y: 520, s: 1.15, t: 0, seed: 5, sway: 0, wind: 0, fall: 0 });
      E.peachTree(g, { x: 880, y: 500, s: 0.8, t: 0, seed: 8, sway: 0, wind: 0, fall: 0 });
      // 荷叶
      for (let k = 0; k < 4; k++) E.lotus(g, { x: [160, 330, 1010, 1180][k], y: [640, 700, 690, 620][k], s: 1.1, open: 1, flower: k % 2 === 0, leaves: 2, seed: k + 3 });
      // 右侧压暗一些，月白字才看得清
      g.fillStyle = K.lin(g, 1000, 0, 1110, 0, [[0, 'rgba(12,40,48,0)'], [1, 'rgba(12,40,48,0.5)']]); g.fillRect(1000, 0, W - 1000, H);
    });
  }
  function frostMemory(g, c, k, peek) {
    const t = c.t;
    const z = 1.02 + 0.04 * k;
    g.save(); g.translate(660, 420); g.scale(z, z); g.translate(-660, -420);
    g.drawImage(peachPoolTex(), 0, 0, W, H);
    // 少女：站在齐膝的水里，0.4 秒里回过身来，长发随之一甩
    const lx = 690, ly = 660, ls = 2.05, turn = easeOut(clamp(k / 0.4)), swing = Math.sin(PI * clamp(k / 0.6));
    const lo = { pose: 'lookBack', facing: -1, wind: 0.6 + 0.4 * swing, windDir: -1, head: lerp(0.4, -0.2, turn), lean: -0.05 * swing, rim: '#fff0c8', light: [200, 0], night: false, seed: 5 };
    F.draw(g, 'linger', lx, ly, ls, t, lo);
    const lp = F.points('linger', lx, ly, ls, t, lo);
    // 水面没过小腿
    {
      const gr = g.createRadialGradient(lx, ly - 10, 10, lx, ly - 10, 200);
      gr.addColorStop(0, 'rgba(96,180,178,0.95)'); gr.addColorStop(0.5, 'rgba(96,180,178,0.85)'); gr.addColorStop(1, 'rgba(96,180,178,0)');
      g.save(); g.translate(lx, ly - 10); g.scale(1, 0.32); g.translate(-lx, -(ly - 10));
      g.fillStyle = gr; g.fillRect(lx - 200, ly - 210, 400, 400); g.restore();
      g.fillStyle = K.lin(g, 0, ly - 60, 0, ly + 30, [[0, 'rgba(96,180,178,0)'], [0.5, 'rgba(96,180,178,0.8)'], [1, 'rgba(70,150,150,0.95)']]);
      g.beginPath(); ellS(g, lx, ly + 10, 90, 60, 0, 0, TAU); g.fill();
    }
    // 腰下的水波一圈圈荡开
    V.ripples(g, c, { x: lx, y: ly - 22, t0: [c.t - k, c.t - k + 0.35], r: 200, flat: 0.16, rings: 3, life: 1.6, color: '#ffffff', width: 1.5 });
    // 回身甩起的水花：从袖口扬出去的一弧弧水珠
    const dsp = dotSpr('#ffffff');
    const sx = lp.handF[0], sy = lp.handF[1];
    for (let i = 0; i < 70; i++) {
      const a = -PI / 2 - 0.5 + (h2(i, 81) - 0.5) * 1.9, v = 260 + 320 * h2(i, 82), d = k - h2(i, 83) * 0.15;
      if (d < 0) continue;
      const x = sx + Math.cos(a) * v * d * 1.1, y = sy + Math.sin(a) * v * d * 1.1 + 0.5 * 900 * d * d;
      if (y > ly - 20) continue;
      const r = 2 + 4 * h2(i, 84);
      g.globalAlpha = 0.9; g.drawImage(dsp, x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    lighter(g, () => glowA(g, sx, sy, 140, '#fff6e0', 0.25 * Math.exp(-k / 0.6)));
    // 桃瓣满天（出画的那段少一些）
    V.petals(g, c, { kind: 'peach', n: peek ? 24 : c.lt > c.dur - 0.75 ? 36 : 56, size: [6, 16], fall: 40, wind: -60, gust: 30, night: false, seed: 15 });
    g.restore();
    memFrame(g, k, { sealText: '仙', flash: false, seal: !peek });
  }

  // ======================================================================
  // 43 · c3_relics 雪原遗物
  // ======================================================================
  const RL = { l: [0.24, 0.54, 1.0, 1.4, 2.24, 2.68, 3.14, 3.5, 3.96, 4.32, 4.78], mem: 5.2 };
  const RX = 880, RY = 612, RS = 0.7;
  // 俯瞰的雪原：远处压扁、近处舒展的风纹与雪丘；顶上一条将明未明的天
  const fieldY = 120;
  const persp = (v) => fieldY + Math.pow(v, 1.6) * (H + 40 - fieldY); // v 0 远 → 1 近
  // 雪面底色（与贴图里的渐变一致，盖脚印时取色用）
  const snowAt = (y) => { const u = clamp((y - fieldY) / (H - fieldY)); return u < 0.45 ? mix('#a4b6d8', '#ccd8ec', u / 0.45) : mix('#ccd8ec', '#e3ecf7', (u - 0.45) / 0.55); };
  function relicFieldTex() {
    return K.cache('g12relicField4', W + 120, H + 60, 0.8, (g) => {
      g.translate(60, 0);
      // 天：深夜的靛蓝，到天边转成淡紫、一线玫瑰色（深夜将尽）
      vgrad(g, -60, 0, W + 60, fieldY + 6, [[0, '#0a1028'], [0.45, '#1e2a58'], [0.78, '#5a5a8e'], [0.93, '#b890b4'], [1, '#e8b8c0']]);
      E.stars(g, { t: 0, n: 70, seed: 64, maxY: fieldY - 30, alpha: 0.9, twinkle: 0 });
      K.lighter(g, () => { A.glow(g, 380, fieldY, 520, '#f0b8c8', 0.22); A.glow(g, 380, fieldY - 6, 200, '#ffd8c8', 0.18); });
      g.globalAlpha = 1;
      // 远处一线低丘
      g.fillStyle = '#7480aa';
      g.beginPath(); g.moveTo(-60, fieldY + 2);
      for (let x = -60; x <= W + 60; x += 20) g.lineTo(x, fieldY - 4 - 6 * Math.sin(x * 0.006 + 1) - 4 * noise1(x * 0.02, 3));
      g.lineTo(W + 60, fieldY + 2); g.closePath(); g.fill();
      // 雪面：星光下的蓝白，远处偏蓝、近处发亮
      vgrad(g, -60, fieldY, W + 60, H + 60, [[0, '#9cb0d4'], [0.12, '#a4b6d8'], [0.42, '#ccd8ec'], [1, '#e3ecf7']]);
      // 天边一层冷雾，远处更虚
      vgrad(g, -60, fieldY, W + 60, fieldY + 120, [[0, 'rgba(200,190,220,0.7)'], [1, 'rgba(200,190,220,0)']]);
      const rr = A.rng(431);
      // 大片的明暗：雪原上起伏的缓坡
      for (let k = 0; k < 16; k++) { const v = rr(), y = persp(v), x = rr() * W, r = (160 + rr() * 300) * (0.4 + v); A.softBlob(g, x, y, r, k % 2 ? 0.25 : 0.16, k % 2 ? '#f4f8fd' : '#34466e'); }
      // 雪丘：一道道横长起伏的亮脊与背风的暗影（远处细密，近处舒展）
      for (let k = 0; k < 30; k++) {
        const v = Math.pow(rr(), 0.9), y0 = persp(v), x0 = rr() * (W + 300) - 150, len = (160 + rr() * 420) * (0.3 + v * 1.3), amp = (2 + 7 * v), tilt = (rr() - 0.35) * 0.22;
        const pts = [];
        for (let j = 0; j <= 16; j++) { const u = j / 16; pts.push([x0 + u * len, y0 + Math.sin(u * PI) * -amp * 2 + Math.sin(u * 7 + k) * amp * 0.5 + u * len * tilt * (0.3 + v)]); }
        g.fillStyle = K.lin(g, 0, y0 - amp * 2, 0, y0 + 6 + 22 * v, [[0, rgba('#34466e', 0.3 + 0.3 * v)], [1, rgba('#34466e', 0)]]);
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) g.lineTo(p[0], p[1]);
        for (let j = pts.length - 1; j >= 0; j--) g.lineTo(pts[j][0], pts[j][1] + (6 + 22 * v) * Math.sin((j / 16) * PI));
        g.closePath(); g.fill();
        g.strokeStyle = rgba('#ffffff', 0.4 + 0.45 * v); g.lineWidth = 0.6 + 1.6 * v;
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
      }
      // 风纹：细碎的弯弧
      for (let k = 0; k < 220; k++) {
        const v = Math.pow(rr(), 0.8), y = persp(v), x = rr() * (W + 80) - 40, len = (10 + rr() * 50) * (0.2 + v * 1.4);
        g.strokeStyle = rgba(rr() < 0.6 ? '#6a7ca6' : '#ffffff', 0.14 + 0.2 * v); g.lineWidth = 0.4 + 1.1 * v;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - len * 0.5, y - 3 * v - 1, x - len, y + 1.5 * v); g.stroke();
      }
      // 露出雪面的枯草与碎石（标出尺度）
      for (let k = 0; k < 30; k++) {
        const v = rr(), y = persp(v), x = rr() * W, s = 0.3 + v * 1.4;
        if (Math.abs(x - RX) < 140 && y > 500) continue;
        g.strokeStyle = rgba('#2a2e3c', 0.65); g.lineWidth = 0.7 * s;
        for (let j = 0; j < 5; j++) { g.beginPath(); g.moveTo(x + j * 2 * s, y); g.lineTo(x + j * 2 * s + (rr() - 0.6) * 8 * s, y - (6 + rr() * 8) * s); g.stroke(); }
        if (rr() < 0.5) { g.fillStyle = rgba('#2a2e3c', 0.7); g.beginPath(); ellS(g, x + 10 * s, y + 1, 5 * s, 2.4 * s, 0, 0, TAU); g.fill(); g.fillStyle = rgba('#ffffff', 0.8); g.beginPath(); ellS(g, x + 10 * s, y - 0.8 * s, 4 * s, 1.2 * s, 0, PI, TAU); g.fill(); }
      }
      // 星光在雪面上的冷辉
      K.lighter(g, () => { A.glow(g, 760, 470, 520, '#a8bce8', 0.12); A.glow(g, RX - 30, RY - 20, 160, '#c8d6f6', 0.14); });
      g.globalAlpha = 1;
    });
  }
  // 一路走来的脚印：从远处左上弯弯曲曲走到他跪的地方；足字起，风雪从远端一个个把它们填平
  const FOOT_N = 66;
  function footAt(i) {
    const u = i / (FOOT_N - 1), v = lerp(0.03, 0.825, Math.pow(u, 1.25));
    return [lerp(380, RX + 26, u) + Math.sin(u * 7.5 + 0.6) * 140 * (1 - u) * (0.4 + u), persp(v), 0.25 + v * 1.3, u];
  }
  function footprints(g, lt, tZu, tEnd) {
    for (let i = 0; i < FOOT_N; i++) {
      const [x, y, s, u] = footAt(i), side = i % 2 ? 1 : -1;
      const ti = tZu + Math.pow(u, 0.9) * (tEnd - tZu), cov = smooth((lt - ti) / 0.4);
      const a = (0.35 + 0.65 * u) * (1 - cov);
      const fx = x + side * 6 * s;
      if (a > 0.01) {
        g.fillStyle = rgba('#3a4c78', a * 0.75); g.beginPath(); ellS(g, fx, y, 5.5 * s, 2.4 * s, 0, 0, TAU); g.fill();
        g.fillStyle = rgba('#ffffff', a * 0.7); g.beginPath(); ellS(g, fx, y + 1.8 * s, 5.5 * s, 1.2 * s, 0, 0, PI); g.fill();
      }
      // 填平的那一下：一小团雪粉
      if (cov > 0 && cov < 1) A.softBlob(g, fx - 6 * s * cov, y, 10 * s * (0.6 + cov), 0.5 * Math.sin(PI * cov), snowAt(y));
    }
  }
  // 红剑穗：held 为真时挂在手上随风；落在雪上时九缕红丝向左飘散；bury 0..1 被雪埋掉多少（从根往梢埋）
  function tasselOn(g, t, x, y, held, bury, s = 1) {
    const col = '#c3272b';
    g.strokeStyle = col; g.lineCap = 'round';
    if (held) {
      for (let k = 0; k < 9; k++) {
        g.lineWidth = 1.2 * s;
        const ex = x - (8 + 14 * Math.sin(t * 4 + k)) * s - 10 * s, ey = y + (22 + k * 1.5) * s;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 4 * s, y + 12 * s, ex, ey); g.stroke();
      }
    } else {
      // 底下一点暖光
      lighter(g, () => glowA(g, x - 30, y, 34, '#ff9a6a', 0.22));
      for (let k = 0; k < 9; k++) {
        const L = (60 + 20 * h2(k, 121)) * s, dy = (k - 4) * 1.6 * s, pts = [];
        for (let j = 0; j <= 10; j++) { const u = j / 10; pts.push([x - u * L, y + dy * u + 6 * u * Math.sin(t * 3.2 - u * 5 + k * 0.9) + 2 * u * u]); }
        g.lineWidth = (1.6 - 0.06 * k) * s;
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
      }
    }
    g.fillStyle = col; g.beginPath(); arcS(g, x, y, 3.4 * s, 0, TAU); g.fill();
    g.fillStyle = '#d8b25e'; g.beginPath(); arcS(g, x + 2.4 * s, y - 2 * s, 2 * s, 0, TAU); g.fill();
  }
  // 积雪堆：亮白，顶上一线受光，底下一抹蓝影
  function drift(g, x, y, rx, ry, a, seed = 1) {
    if (a <= 0.01 || ry < 0.5) return;
    const lumps = [[0, 0, 1, 1], [-0.45, 0.15, 0.6, 0.75], [0.4, 0.2, 0.55, 0.7], [-0.15, -0.25, 0.45, 0.6]];
    g.fillStyle = rgba('#34466e', 0.22 * a); g.beginPath(); ellS(g, x + 3, y + ry * 0.55, rx * 1.05, ry * 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = K.lin(g, 0, y - ry * 1.2, 0, y + ry, [[0, rgba('#ffffff', a)], [0.5, rgba('#eef3fb', a)], [1, rgba('#cfdcee', a)]]);
    g.beginPath();
    lumps.forEach(([dx, dy, sx, sy], i) => { const jx = (h2(i, seed) - 0.5) * 0.2; g.moveTo(x + (dx + jx + sx) * rx, y + dy * ry); ellS(g, x + (dx + jx) * rx, y + dy * ry, rx * sx, ry * sy, 0, 0, TAU); });
    g.fill();
    lighter(g, () => glowA(g, x - rx * 0.2, y - ry * 0.4, rx * 0.6, '#ffffff', 0.25 * a));
  }
  function relicScene(g, c) {
    const t = c.t, lt = c.lt, L = RL.l;
    const tBao = ct(c, 4, L[4]), tLan = ct(c, 5, L[5]), tZu = ct(c, 6, L[6]), tJi = ct(c, 7, L[7]), tMei = ct(c, 8, L[8]), tRen = ct(c, 9, L[9]), tDong = ct(c, 10, L[10]);
    // 镜头：极慢升高（一点点拉远），饱览二字起朝遗物轻推近
    const pz = clamp((lt + 0.7) / (c.dur + 0.7));
    const push = lerp(1, 1.15, easeInOut(clamp((lt - tBao) / (tMei - tBao))));
    const z = lerp(1.06, 1.0, easeInOut(pz)) * push, ax = RX - 50, ay = RY;
    g.save();
    g.translate(ax, ay); g.scale(z, z); g.translate(-ax, -ay - 8 * pz);
    g.drawImage(relicFieldTex(), -60, 0, W + 120, H + 60);
    // 天边将熄的星
    g.save(); g.beginPath(); g.rect(-60, 0, W + 120, fieldY - 8); g.clip();
    E.stars(g, { t, n: 60, seed: 63, maxY: fieldY - 10, alpha: 1 - 0.5 * pz });
    g.restore();
    lighter(g, () => glowA(g, 380, fieldY, 320, '#f0b8c8', 0.12 * pz));
    footprints(g, lt, tZu, RL.mem - 0.2);

    // 地上的风雪：贴地的雪尘一条条从右扫到左，开头四个字最猛
    const gust = 0.45 + 0.55 * (1 - smooth((lt - 1.4) / 1.2)) + 0.4 * smooth((lt - tMei) / 0.8);
    const bar = barSpr('#ffffff');
    for (let i = 0; i < 34; i++) {
      const v = h2(i, 301), y = persp(lerp(0.05, 1, v)) + Math.sin(t * 0.7 + i) * 4, len = (120 + 300 * h2(i, 302)) * (0.3 + v);
      const sp = (160 + 260 * v) * (0.6 + 0.6 * gust), span = W + len * 2 + 200;
      const x = W + len - ((h2(i, 303) * span + t * sp) % span);
      g.globalAlpha = clamp((0.1 + 0.25 * v) * gust * (0.6 + 0.4 * Math.sin(t * 1.3 + i)));
      g.drawImage(bar, x, y - (2 + 7 * v), len, 4 + 14 * v);
    }
    // 〔第19句第1–4字〕：一阵雪幕从右往左扫过整片雪原，贴地十二道亮的雪流
    const veil = 1 - smooth((lt - 1.1) / 0.6);
    if (veil > 0.01) {
      for (let i = 0; i < 12; i++) {
        const v = h2(i, 311), len = 300 + 400 * h2(i, 312), th = 3 + 7 * v, sp = 900 + 500 * h2(i, 313), span = W + len + 600;
        const x = W + 200 - ((h2(i, 314) * span + (lt + 0.3) * sp) % span), y = persp(lerp(0.25, 0.98, h2(i, 315)));
        g.globalAlpha = clamp((0.35 + 0.25 * v) * veil);
        g.drawImage(bar, x, y - th, len, th * 2);
      }
      g.globalAlpha = 1;
      E.mist(g, { t, y: 300, h: 260, color: '#f2f6fc', alpha: 0.45 * veil, speed: -320, seed: 41, w: 900 });
      E.mist(g, { t, y: 560, h: 240, color: '#f4f8fc', alpha: 0.45 * veil, speed: -420, seed: 42, w: 1000 });
    }
    g.globalAlpha = 1;
    E.mist(g, { t, y: 640, h: 90, color: '#eef3fa', alpha: 0.22, speed: -120, seed: 43, w: 700 });
    lighter(g, () => {
      for (let i = 0; i < 40; i++) {
        const v = h2(i, 311), x = h2(i, 312) * W, y = persp(lerp(0.3, 1, v)), a = Math.max(0, Math.sin(t * (1.2 + 2.5 * h2(i, 313)) + i * 1.9)) ** 8;
        if (a > 0.05) glowA(g, x, y, 2 + 5 * v, '#ffffff', a * 0.9);
      }
    });
    // 他：跪在右下，手里先捧着葫芦，“览”字放下；再取出剑穗，“迹”字放下
    const sNear = RS;
    const chest = [14, -66], ground1 = [46, -4], ground2 = [34, -2], knees = [22, -36];
    const lerpP = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const d1 = smooth((lt - tBao) / (tLan - tBao)), u1 = smooth((lt - tLan) / 0.45);
    const d2 = smooth((lt - tZu) / (tJi - tZu)), u2 = smooth((lt - tJi) / 0.6);
    let hand = chest;
    if (lt < tLan) hand = lerpP(chest, ground1, d1);
    else if (lt < tZu) hand = lerpP(ground1, chest, u1);
    else if (lt < tJi) hand = lerpP(chest, ground2, d2);
    else hand = lerpP(ground2, knees, u2);
    const bend = lt < tLan ? d1 : lt < tZu ? 1 - u1 : lt < tJi ? d2 : 1 - u2;
    const fo = Object.assign({}, OLD, {
      facing: -1, prop: 'none', pose: 'kneel', cradle: true, holdN: [hand[0], hand[1] - 2], holdF: [hand[0] - 3, hand[1] + 3], lean: -0.15 + 0.35 * bend, head: 0.1 + 0.3 * bend + 0.25 * smooth((lt - tJi) / 1.2),
      wind: 0.35, windDir: 1, hairLoose: false, rim: '#e4eeff', light: [300, 0], night: true, seed: 4,
    });
    // 身下一抹淡影
    g.fillStyle = 'rgba(52,70,110,0.3)'; g.beginPath(); ellS(g, RX - 6, RY + 4, 50, 10, 0, 0, TAU); g.fill();
    // 放在雪里的遗物（先画，人在后面跪着）：葫芦、剑穗，脚下一小片暖光
    const gx = RX - 40, gyy = RY + 2, tx = RX - 62, ty = RY + 12;
    if (lt >= tLan - 0.05) lighter(g, () => glowA(g, gx - 20, gyy + 2, 70, '#ffc890', 0.15 * smooth((lt - tLan + 0.05) / 0.4)));
    // 没字起风雪来埋：人字时葫芦埋了一半，懂字时剑穗只剩梢
    const bury = 0.5 * smooth((lt - tMei) / (tRen - tMei)) + 0.4 * smooth((lt - tRen) / (tDong - tRen)) + 0.1 * smooth((lt - tDong) / 0.4);
    if (lt >= tLan) {
      E.gourd(g, { x: gx, y: gyy - 8, s: 0.6, angle: -1.25, color: '#b8803e', cord: '#c3272b', t });
      // 琥珀色的边光
      lighter(g, () => { glowA(g, gx - 4, gyy - 16, 16, '#ffb860', 0.35); glowA(g, gx + 10, gyy - 12, 10, '#ffd8a0', 0.3); });
      const dd = lt - tLan;
      if (dd < 0.8) puff(g, gx, gyy - 4, 36 + dd * 30, 9 + dd * 6, '#f4f8fd', 0.6 * (1 - dd / 0.8), 31);
    }
    if (lt >= tJi) { tasselOn(g, t, tx, ty, false, bury, 1); const de = lt - tJi; if (de < 0.8) puff(g, tx - 20, ty, 40 + de * 30, 9 + de * 6, '#f4f8fd', 0.55 * (1 - de / 0.8), 33); }
    // 积雪：葫芦上隆起一堆，剑穗从根往梢被一道长雪垄盖住
    if (bury > 0) {
      drift(g, gx - 2, gyy - 4 - 2 * bury, 30 * (0.6 + 0.5 * bury), 12 * bury + 1, clamp(bury * 3), 5);
      if (lt >= tJi) { const len = 72 * Math.min(1, bury * 1.05); drift(g, tx - len * 0.45, ty + 1, len * 0.55 + 6, 3 + 6 * bury, clamp(bury * 3), 9); }
      // 白色雪流从遗物上掠过
      const bar2 = barSpr('#ffffff');
      for (let i = 0; i < 6; i++) {
        const sp = 500 + 300 * h2(i, 331), len = 120 + 140 * h2(i, 332), span = 900;
        const x = RX + 300 - (((lt - tMei) * sp + h2(i, 333) * span) % span), y = RY - 6 + (h2(i, 334) - 0.5) * 30;
        g.globalAlpha = clamp(0.55 * smooth((lt - tMei) / 0.3)); g.drawImage(bar2, x, y - 3, len, 6);
      }
      g.globalAlpha = 1;
    }
    F.draw(g, 'xiaoyao', RX, RY, sNear, t, fo);
    // 手上捧着的东西
    const hp = F.points('xiaoyao', RX, RY, sNear, t, fo).handN;
    if (lt < tLan) E.gourd(g, { x: hp[0] - 2, y: hp[1] - 8, s: 0.6, angle: -0.2 + 0.4 * d1, color: '#b8803e', cord: '#c3272b', t });
    else if (lt >= tLan + 0.2 && lt < tJi) tasselOn(g, t, hp[0], hp[1], true, 0, 1);
    // 风里的雪：从右往左横着吹（远景的细雪，不要近景的大光斑）
    V.snow(g, c, { n: 130, size: [0.8, 3.5], layer: 'back', color: '#ffffff', fall: 60, wind: -150 * (0.6 + 0.5 * gust), gust: 40, seed: 66, alpha: 0.9, beat: 0.6 });
    g.restore();
    // 歌词栏：左边一条局部压暗（屏幕坐标，盖在雾与雪流之上）
    g.fillStyle = K.lin(g, 0, 0, 440, 0, [[0, 'rgba(18,26,58,0.55)'], [0.4, 'rgba(18,26,58,0.42)'], [1, 'rgba(18,26,58,0)']]); g.fillRect(0, 0, 440, H);
  }
  // 雪幕：一道白的风雪从右往左扫过，后面露出春天的石桥
  function snowSweep(g, c, ex) {
    // 扫过左边歌词栏时淡一些，字不被白幕吞掉
    const pk = ex < 480 ? 0.7 : 0.92;
    g.fillStyle = K.lin(g, ex - 260, 0, ex + 260, 0, [[0, 'rgba(244,248,253,0)'], [0.4, rgba('#f4f8fd', pk)], [0.6, rgba('#f4f8fd', pk)], [1, 'rgba(244,248,253,0)']]);
    g.fillRect(ex - 260, 0, 520, H);
    const bar = barSpr('#ffffff');
    for (let i = 0; i < 26; i++) {
      const len = 160 + 260 * h2(i, 351), y = h2(i, 352) * H, x = ex - 200 + h2(i, 353) * 500 - len / 2;
      g.globalAlpha = 0.5 + 0.4 * h2(i, 354); g.drawImage(bar, x, y - 4, len, 8 + 8 * h2(i, 355));
    }
    g.globalAlpha = 1;
  }

  XYT.registerShot('c3_relics', {
    name: '雪原遗物', zone: 'left', night: true, text: '#e9f1f6', shadow: 'rgba(10,14,34,0.92)', accent: '#e8a0a6', bloom: 0.3,
    draw(g, c) {
      const lt = c.lt, s0 = RL.mem - 0.3, s1 = RL.mem + 0.3, sp = (lt - s0) / (s1 - s0);
      if (sp <= 0) { relicScene(g, c); return; }
      if (sp >= 1) { relicMemory(g, c, lt - RL.mem); return; }
      const ex = lerp(W + 280, -280, easeInOut(sp));
      if (ex > -40) { g.save(); g.beginPath(); g.rect(0, 0, Math.max(0, ex + 40), H); g.clip(); relicScene(g, c); g.restore(); }
      if (ex < W + 40) { g.save(); g.beginPath(); g.rect(Math.max(0, ex - 40), 0, W, H); g.clip(); relicMemory(g, c, lt - RL.mem); g.restore(); }
      snowSweep(g, c, ex);
    },
  });

  // 回忆：春日江南石桥，五个伙伴并肩走过，有人回头笑（桥、桃树、倒影都烘进底图）
  const BR = { x: 660, y: 528, s: 1.0, span: 320 };
  // 石桥单独烘一张，蒙上一层暖白（只蒙在桥身上）
  function bridgeTex() {
    return K.cache('g12bridge', W, H, 1, (g) => {
      E.archBridge(g, { x: BR.x, y: BR.y, s: BR.s, span: BR.span, color: '#b8b2a4' });
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(236,228,210,0.35)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    });
  }
  function springTex() {
    return K.cache('g12spring4', W, H, 1, (g) => {
      vgrad(g, 0, 0, W, 400, [[0, '#9ed2e6'], [0.6, '#e6f2e6'], [1, '#faf2dc']]);
      E.mountains(g, { layers: [{ color: '#8cb8b0', light: '#e0f0e4', alpha: 1, y: 330, scaleY: 0.42, kind: 'far', seed: 71 }] });
      E.mist(g, { y: 330, h: 80, color: '#ffffff', alpha: 0.6, seed: 5 });
      E.jiangnanTown(g, { t: 0, y: 410, x0: -40, x1: 1320, scale: 0.7, seed: 9, haze: '#e8f0ec', hazeA: 0.3 });
      vgrad(g, 0, 408, W, H, [[0, '#a4d4c8'], [0.4, '#6ab4ac'], [1, '#2e7478']]);
      K.lighter(g, () => A.glow(g, 1000, 110, 380, '#fff2c8', 0.3));
      g.globalAlpha = 1;
      // 桃树都在右边（左边让给歌词）
      E.peachTree(g, { x: 1040, y: 470, s: 0.7, t: 0, seed: 12, sway: 0, wind: 0, fall: 0, color: '#f6c8d2' });
      // 水里的桥影：与桥身合成一个满圆
      g.save(); g.beginPath(); g.rect(0, BR.y, W, H - BR.y); g.clip();
      g.translate(0, BR.y * 2); g.scale(1, -1); g.globalAlpha = 0.36;
      g.drawImage(bridgeTex(), 0, 0, W, H);
      g.restore();
      g.globalAlpha = 1;
      g.drawImage(bridgeTex(), 0, 0, W, H);
      E.peachTree(g, { x: 1180, y: 560, s: 1.0, t: 0, seed: 11, sway: 0, wind: 0, fall: 0 });
      // 左侧压暗一点（歌词栏）
      g.fillStyle = K.lin(g, 0, 0, 360, 0, [[0, 'rgba(20,48,52,0.45)'], [1, 'rgba(20,48,52,0)']]); g.fillRect(0, 0, 360, H);
    });
  }
  function relicMemory(g, c, k) {
    const t = c.t;
    const z = 1.03 + 0.035 * Math.max(0, k);
    g.save(); g.translate(640, 400); g.scale(z, z); g.translate(-640, -400);
    g.drawImage(springTex(), 0, 0, W, H);
    const bx = BR.x, by = BR.y, bs = BR.s, span = BR.span;
    const wb = barSpr('#ffffff');
    for (let i = 0; i < 40; i++) {
      const v = h2(i, 401), y = by + 4 + Math.pow(v, 1.3) * (H - by), len = (30 + 90 * h2(i, 402)) * (0.4 + v);
      const x = ((h2(i, 403) * (W + 200) + t * (8 + 14 * v)) % (W + 200)) - 100;
      g.globalAlpha = 0.2 + 0.3 * Math.sin(t * 2 + i) ** 2; g.drawImage(wb, x, y, len, 3 + 3 * v);
    }
    g.globalAlpha = 1;
    // 桥面高度（与 archBridge 的桥面曲线一致）
    const deckY = (x) => {
      const lh = span * 0.62 + 60, base = span * 0.62 + 56, R = span / 2, cx = (span + 220) / 2;
      const xx = (x - bx) / bs + cx, dx = Math.abs(xx - cx) / (R * 1.22);
      const d = dx < 1 ? base - 16 - ((R * 0.92 + 10) * Math.sqrt(1 - dx * dx * 0.55) - 4 * dx * dx) : base - 16;
      return by - (lh - 4) * bs + d * bs;
    };
    // 五人：唐钰与逍遥并肩挨着走，阿奴蹦在前头，灵儿跟着，月如在桥顶回身招呼
    const fs = 0.95, sp = F.walkSpeed('xiaoyao', fs, { speed: 0.8 });
    const walkers = [['linger', 462, 7], ['tangyu', 536, 1], ['xiaoyao', 594, 5], ['anu', 668, 3]];
    for (const [who, x0, seed] of walkers) {
      const x = x0 + sp * k;
      F.draw(g, who, x, deckY(x) + 2, fs, t, { pose: 'walk', facing: 1, wind: 0.5, seed, speed: 0.8 });
    }
    F.draw(g, 'yueru', 812, deckY(812) + 2, fs, t, { pose: 'lookBack', facing: 1, wind: 0.5, seed: 9 });
    // 燕子与桃瓣，暖阳
    V.birds(g, c, { kind: 'pair', x: 430, y: 150, dir: 1, speed: 120, size: 0.6, color: '#4a4a52', night: false });
    V.petals(g, c, { kind: 'peach', n: 40, size: [5, 12], fall: 40, wind: 50, night: false, seed: 23 });
    g.restore();
    memFrame(g, Math.max(0, k), { sealText: '春', flash: false });
  }

  // ======================================================================
  // 44 · c3_icelake 冰池倒影
  // ======================================================================
  const IL = { l: [0.27, 0.59, 0.95, 1.45, 1.81, 2.15, 2.61, 3.09, 3.37, 3.83, 4.17, 4.77, 5.19, 5.57, 6.01] };
  const AX = 392;               // 冰面与人脚的分界（倒影的镜像轴）
  const OX = 560;               // 老人站的位置
  // 天与远岸：黎明前的蓝调，远处水月宫的断柱在雾里
  function iceSkyTex() {
    return K.cache('g12iceSky2', W, AX + 20, 0.6, (g) => {
      vgrad(g, 0, 0, W, AX + 20, [[0, '#7a88ae'], [0.45, '#a2aecb'], [0.85, '#d6dceb'], [1, '#ece6ea']]);
      const gr = g.createRadialGradient(980, AX, 20, 980, AX, 520);
      gr.addColorStop(0, 'rgba(240,226,236,0.55)'); gr.addColorStop(1, 'rgba(240,226,236,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, AX + 20);
    });
  }
  // 枯树：三层渐细的枝杈
  function deadTree(g, x, y, h, seed) {
    const rr = A.rng(seed);
    g.strokeStyle = '#6e7a98'; g.lineCap = 'round';
    const br = (x0, y0, a, L, w, lv) => {
      const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
      g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (rr() - 0.5) * L * 0.2, (y0 + y1) / 2, x1, y1); g.stroke();
      if (lv >= 3) return;
      const n = lv === 0 ? 4 : 2;
      for (let k = 0; k < n; k++) {
        const f = lv === 0 ? 0.35 + k * 0.17 : 0.5 + k * 0.3, bx = lerp(x0, x1, f), by = lerp(y0, y1, f);
        br(bx, by, a + (k % 2 ? 1 : -1) * (0.5 + rr() * 0.5), L * (0.42 + rr() * 0.15), w * 0.55, lv + 1);
      }
      if (lv > 0) br(x1, y1, a + (rr() - 0.5) * 0.5, L * 0.5, w * 0.6, lv + 1);
    };
    br(x, y, -PI / 2 + (rr() - 0.5) * 0.2, h, 3.2, 0);
  }
  // 一根白玉柱：柱础、收分的柱身、凹槽、柱头或参差的断口、裂纹
  function jadeColumn(g, x, base, h, w, broken, seed) {
    const rr = A.rng(seed), top = base - h;
    // 柱础
    g.fillStyle = '#b4bed0'; g.fillRect(x - w * 0.85, base - 7, w * 1.7, 7);
    g.fillStyle = '#c8d2e0'; g.beginPath(); ellS(g, x, base - 8, w * 0.7, 3.5, 0, 0, TAU); g.fill();
    // 柱身：左亮右暗，略收分
    g.fillStyle = K.lin(g, x - w / 2, 0, x + w / 2, 0, [[0, '#dfe5ee'], [0.45, '#c8d2e0'], [1, '#97a3bc']]);
    g.beginPath(); g.moveTo(x - w / 2, base - 9); g.lineTo(x - w * 0.44, top);
    if (broken) { const n = 5; for (let k = 1; k <= n; k++) g.lineTo(lerp(x - w * 0.44, x + w * 0.44, k / n), top + (rr() - 0.3) * 12 - (k === 2 ? 8 : 0)); }
    else g.lineTo(x + w * 0.44, top);
    g.lineTo(x + w / 2, base - 9); g.closePath(); g.fill();
    // 凹槽
    g.strokeStyle = 'rgba(120,132,160,0.45)'; g.lineWidth = 0.8;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * w * 0.22, base - 10); g.lineTo(x + k * w * 0.2, top + (broken ? 10 : 3)); g.stroke(); }
    // 柱头
    if (!broken) {
      g.fillStyle = '#c8d2e0'; g.beginPath(); g.moveTo(x - w * 0.44, top); g.quadraticCurveTo(x - w * 0.9, top - 2, x - w * 0.8, top - 7); g.lineTo(x + w * 0.8, top - 7); g.quadraticCurveTo(x + w * 0.9, top - 2, x + w * 0.44, top); g.closePath(); g.fill();
      g.fillStyle = '#d8e0ea'; g.fillRect(x - w * 0.85, top - 12, w * 1.7, 5);
    }
    // 裂纹
    g.strokeStyle = 'rgba(80,90,120,0.5)'; g.lineWidth = 0.7;
    for (let k = 0; k < 2; k++) { let cx = x + (rr() - 0.5) * w * 0.6, cy = top + 14 + rr() * h * 0.5; g.beginPath(); g.moveTo(cx, cy); for (let j = 0; j < 4; j++) { cx += (rr() - 0.5) * 5; cy += 6 + rr() * 6; g.lineTo(cx, cy); } g.stroke(); }
  }
  // 远岸：低岛、断柱、残梁、枯树
  function ruinsTex() {
    return K.cache('g12ruins2', W, 220, 0.6, (g) => {
      g.translate(0, -(AX - 200));
      // 岛
      g.fillStyle = '#8492b0';
      g.beginPath(); g.moveTo(0, AX + 4);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, AX - 14 - 22 * Math.pow(Math.sin(x * 0.0032 + 0.4), 2) - 8 * noise1(x * 0.01, 4));
      g.lineTo(W, AX + 4); g.closePath(); g.fill();
      // 枯树
      for (const [x, h, sd] of [[300, 80, 3], [376, 56, 5], [1190, 72, 7]]) deadTree(g, x, AX - 12, h, sd);
      // 残梁斜搭（先画，在柱后）
      g.fillStyle = '#aab4c8'; g.save(); g.translate(880, AX - 166); g.rotate(0.12); g.fillRect(-130, -5, 240, 9); g.restore();
      // 水月宫断柱
      const cols = [[760, 150, 0], [820, 118, 1], [880, 156, 0], [940, 66, 1], [1000, 146, 0], [1068, 92, 1]];
      cols.forEach(([x, h, br], i) => jadeColumn(g, x, AX - 6, h, 18, br, 600 + i));
      // 半截倒下靠在柱上的残梁
      g.save(); g.translate(1030, AX - 40); g.rotate(-0.5); g.fillStyle = '#b4bed0'; g.fillRect(-60, -5, 120, 10); g.restore();
    });
  }
  // 枯荷：折了的茎、干莲蓬、卷边的残叶（墨色），在冰上投下倒影
  function deadLotus(g, x, y, s, seed) {
    const rr = A.rng(seed);
    g.strokeStyle = '#2a2a2e'; g.lineCap = 'round';
    const n = 3 + ((seed * 7) % 3);
    for (let k = 0; k < n; k++) {
      const h = (70 + rr() * 110) * s, lean = (rr() - 0.5) * 0.5, brk = rr() < 0.5;
      const mx = x + k * 14 * s - n * 7 * s, tx = mx + Math.sin(lean) * h, ty = y - Math.cos(lean) * h;
      g.lineWidth = (1.6 + rr() * 1.2) * s;
      g.beginPath(); g.moveTo(mx, y);
      if (brk) { const bx = lerp(mx, tx, 0.65), by = lerp(y, ty, 0.65); g.quadraticCurveTo(lerp(mx, bx, 0.5) + 4 * s, lerp(y, by, 0.5), bx, by); g.lineTo(bx + (rr() > 0.5 ? 1 : -1) * 26 * s, by + 22 * s); }
      else g.quadraticCurveTo(lerp(mx, tx, 0.5) + 6 * s, lerp(y, ty, 0.5), tx, ty);
      g.stroke();
      if (!brk && rr() < 0.7) {
        g.save(); g.translate(tx, ty); g.rotate(lean + (rr() - 0.5) * 0.8 + PI * (rr() < 0.4 ? 0.6 : 0));
        g.fillStyle = '#3a3430'; g.beginPath(); g.moveTo(-8 * s, -6 * s); g.lineTo(8 * s, -6 * s); g.lineTo(3 * s, 4 * s); g.lineTo(-3 * s, 4 * s); g.closePath(); g.fill();
        g.fillStyle = '#7a7268'; for (let j = -1; j <= 1; j++) { g.beginPath(); arcS(g, j * 4 * s, -5 * s, 1.1 * s, 0, TAU); g.fill(); }
        g.restore();
      } else if (!brk) {
        g.save(); g.translate(tx, ty); g.rotate(lean * 2 + rr() - 0.5);
        g.fillStyle = 'rgba(52,46,40,0.85)';
        g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-24 * s, -6 * s, -30 * s, 14 * s, -10 * s, 18 * s); g.bezierCurveTo(4 * s, 22 * s, 20 * s, 10 * s, 14 * s, -2 * s); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(150,140,120,0.5)'; g.lineWidth = 0.6 * s; g.beginPath(); g.moveTo(0, 0); g.lineTo(-12 * s, 12 * s); g.moveTo(0, 0); g.lineTo(6 * s, 12 * s); g.stroke();
        g.restore();
      }
    }
    g.fillStyle = 'rgba(240,246,250,0.8)'; g.beginPath(); ellS(g, x, y + 2 * s, (16 + n * 8) * s, 4 * s, 0, 0, TAU); g.fill();
  }
  const LOTUS_FAR = [[250, 22, 0.42, 3], [420, 16, 0.35, 5], [880, 18, 0.38, 7], [1160, 26, 0.45, 9], [960, 34, 0.5, 13]];
  const LOTUS_NEAR = [[90, 230, 1.25, 21], [230, 120, 0.8, 23], [1110, 170, 1.0, 25], [1230, 260, 1.35, 27]];
  function lotusClump(s, seed) {
    const w = 220 * s + 40, h = 230 * s + 20;
    return K.cache('g12lotus' + seed, w, h, 1, (g) => { g.translate(w / 2, h - 12); deadLotus(g, 0, 0, s, seed); });
  }
  function lotusLayer(g, list) {
    for (const [x, dy, s, sd] of list) { const im = lotusClump(s, sd); g.drawImage(im, x - im.lw / 2, AX + dy - (im.lh - 12), im.lw, im.lh); }
  }
  // 冰面：霜纹、裂纹、薄雪（静态）
  function iceTex() {
    return K.cache('g12ice2', W + 80, H - AX + 40, 0.8, (g) => {
      g.translate(40, -AX);
      vgrad(g, -40, AX, W + 40, H + 40, [[0, '#c6d6e6'], [0.25, '#aec2d8'], [1, '#8ea4c2']]);
      const rr = A.rng(626);
      for (let k = 0; k < 30; k++) { const v = rr(), y = AX + 10 + Math.pow(v, 1.3) * (H - AX), x = rr() * W, rx = (60 + rr() * 200) * (0.4 + v); A.softBlob(g, x, y, rx, 0.18, '#f2f6fa'); }
      g.lineCap = 'round';
      for (let k = 0; k < 40; k++) {
        const v = rr(), y = AX + 6 + Math.pow(v, 1.2) * (H - AX), x = rr() * W, len = (30 + rr() * 140) * (0.3 + v);
        g.strokeStyle = rgba('#ffffff', 0.25 + 0.3 * rr()); g.lineWidth = 0.5 + v;
        g.beginPath(); g.moveTo(x, y);
        let px = x, py = y;
        for (let j = 0; j < 5; j++) { px += len / 5 * (0.6 + rr() * 0.8); py += (rr() - 0.5) * 8 * v; g.lineTo(px, py); }
        g.stroke();
      }
      // 远岸在冰上的倒影
      g.save(); g.translate(0, AX * 2); g.scale(1, -1); g.globalAlpha = 0.24; g.drawImage(ruinsTex(), 0, AX - 200, W, 220); g.restore();
      // 冰里的气泡
      for (let k = 0; k < 60; k++) { const v = rr(), y = AX + 10 + Math.pow(v, 1.1) * (H - AX), x = rr() * W, r = (0.8 + rr() * 2.4) * (0.4 + v); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.6; g.beginPath(); arcS(g, x, y, r, 0, TAU); g.stroke(); }
      // 倒在冰上的一截断柱，半埋在薄雪里
      g.save(); g.translate(1010, AX + 34); g.rotate(-0.08);
      g.fillStyle = K.lin(g, 0, -10, 0, 10, [[0, '#dfe5ee'], [0.5, '#c8d2e0'], [1, '#8e9ab4']]); g.fillRect(-80, -9, 150, 18);
      g.strokeStyle = 'rgba(120,132,160,0.45)'; g.lineWidth = 0.8;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(-78, k * 4.5); g.lineTo(68, k * 4.5); g.stroke(); }
      g.fillStyle = '#b4bed0'; g.beginPath(); ellS(g, -80, 0, 4, 9, 0, 0, TAU); g.fill();
      g.fillStyle = '#c8d2e0'; g.beginPath(); g.moveTo(70, -9); g.lineTo(78, -4); g.lineTo(72, 1); g.lineTo(80, 6); g.lineTo(70, 9); g.closePath(); g.fill();
      A.softBlob(g, -20, 8, 60, 0.6, '#f2f6fa');
      g.restore();
      g.fillStyle = 'rgba(70,90,130,0.2)'; g.beginPath(); ellS(g, 1010, AX + 46, 90, 6, -0.08, 0, TAU); g.fill();
    });
  }
  // 清冰：一片没结霜的冰，边缘不规则，透出深蓝的水
  function clearIceTex() {
    return K.cache('g12clearIce2', 660, 330, 0.6, (g) => {
      const rr = A.rng(717);
      for (let k = 0; k < 26; k++) {
        const a = rr() * TAU, d = Math.pow(rr(), 0.7), x = 330 + Math.cos(a) * d * 210, y = 150 + Math.sin(a) * d * 90;
        A.softBlob(g, x, y, 70 + rr() * 70, 0.34, d < 0.45 ? '#14223f' : k % 4 ? '#1a2a4e' : '#2c4272');
      }
      g.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        let x = 120 + rr() * 420, y = 70 + rr() * 160; const a = (rr() - 0.5) * 0.8;
        g.strokeStyle = rgba('#e8f2fa', 0.25 + 0.25 * rr()); g.lineWidth = 0.6 + rr() * 0.8;
        g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 6; j++) { x += Math.cos(a) * (14 + rr() * 22); y += Math.sin(a) * 10 + (rr() - 0.5) * 10; g.lineTo(x, y); }
        g.stroke();
      }
      for (let k = 0; k < 40; k++) { g.strokeStyle = 'rgba(220,236,250,0.4)'; g.lineWidth = 0.6; g.beginPath(); arcS(g, 140 + rr() * 380, 60 + rr() * 190, 0.8 + rr() * 2.2, 0, TAU); g.stroke(); }
      for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU + rr() * 0.2, x = 330 + Math.cos(a) * 270 * (0.9 + 0.2 * rr()), y = 150 + Math.sin(a) * 125 * (0.9 + 0.2 * rr()); A.softBlob(g, x, y, 26 + rr() * 30, 0.25, '#f2f6fa'); }
      g.globalCompositeOperation = 'destination-in';
      const gr = g.createRadialGradient(330, 150, 60, 330, 150, 330);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(330, 150); g.scale(1, 0.48); g.translate(-330, -150); g.fillStyle = gr; g.fillRect(0, -200, 660, 700); g.restore();
    });
  }
  // 整幅静态背景一次烘好：天、星、晨光、远岸断柱、岸边雾、冰面、清冰、远近枯荷
  function iceBgTex() {
    return K.cache('g12iceBg3', W + 80, H + 80, 1, (g) => {
      g.translate(40, 40);
      g.drawImage(iceSkyTex(), -40, -40, W + 80, AX + 60);
      E.stars(g, { t: 0, n: 30, seed: 71, maxY: 200, alpha: 0.35, color: '#ffffff', twinkle: 0 });
      // 天将亮：远岸上方一团玫瑰金
      K.lighter(g, () => { A.glow(g, 980, AX - 20, 520, '#f2c8b8', 0.35); A.glow(g, 960, AX - 10, 160, '#ffe6c0', 0.18); });
      // 天边一道玫瑰金的晨带
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = K.lin(g, 0, AX - 150, 0, AX, [[0, 'rgba(255,255,255,0)'], [0.6, 'rgba(244,206,196,0.55)'], [1, 'rgba(240,196,180,0.7)']]); g.fillRect(-40, AX - 150, W + 80, 150);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.drawImage(ruinsTex(), 0, AX - 200, W, 220);
      E.mist(g, { t: 0, y: AX - 70, h: 140, color: '#e4ecf4', alpha: 0.5, seed: 50 });
      E.mist(g, { t: 0, y: AX - 20, h: 90, color: '#eef4f8', alpha: 0.7, seed: 51 });
      g.drawImage(iceTex(), -40, AX, W + 80, H - AX + 40);
      g.drawImage(clearIceTex(), OX + 40 - 330, AX - 10, 660, 330);
      lotusLayer(g, LOTUS_FAR);
      lotusLayer(g, LOTUS_NEAR);
    });
  }
  function iceScene(g, c) {
    const t = c.t, lt = c.lt, L = IL.l;
    const tWo = ct(c, 11, L[11]), tKan = ct(c, 13, L[13]), tTou = ct(c, 14, L[14]), tGun = ct(c, 9, L[9]);
    // 连续推近 1.00 → 1.25；“我”字起再一口气推到 1.55，对准冰上的人与冰下的他们
    const zb = lerp(1.0, 1.25, easeInOut(clamp((lt + 0.7) / (tWo + 0.7))));
    const cz = easeInOut(clamp((lt - tWo) / 0.8));
    const z = lerp(zb, 1.55, cz), CX = lerp(600, 640, cz), CY = lerp(392, 382, cz);
    g.save();
    g.translate(CX, CY); g.scale(z, z); g.translate(-600, -392);
    g.drawImage(iceBgTex(), -40, -40, W + 80, H + 80);
    // 冰下的倒影：少年逍遥提一盏琥珀花灯，灵儿挨着他
    const lit = (0.25 + 0.75 * smooth(lt / Math.max(1, tGun + 0.3))) * (1 + 0.3 * Math.exp(-Math.max(0, lt - tKan) / 0.5) * smooth((lt - tKan + 0.1) / 0.1));
    const look = smooth((lt - tKan) / 0.35);
    const yo = { stage: 'hero', facing: 1, prop: 'lantern', wind: 0.3, seed: 3, fx: 0.25 + 0.2 * lit, head: 0.15 };
    const lo = { facing: -1, wind: 0.35, seed: 5, head: lerp(0.32, -0.32, look), lean: lerp(0.05, -0.08, look) };
    const lp0 = F.points('xiaoyao', OX, AX, 0.95, t, yo).lantern || [OX + 30, AX - 90];
    Object.assign(yo, { rim: '#ffd890', light: lp0, night: true });
    Object.assign(lo, { rim: '#ffd890', light: lp0, night: true });
    const lh = F.points('linger', OX + 62, AX, 0.95, t, lo).head;
    g.save();
    g.beginPath(); g.rect(OX - 220, AX, 520, H - AX + 60); g.clip();
    g.save(); g.translate(0, AX * 2); g.scale(1, -1);
    lighter(g, () => glowA(g, lp0[0], lp0[1], 150, '#ffb860', 0.2 * lit));
    F.draw(g, 'xiaoyao', OX, AX, 0.95, t, yo);
    F.draw(g, 'linger', OX + 62, AX, 0.95, t, lo);
    // 灵儿抬头一笑：细细的眉眼与嘴角（工笔淡彩）
    if (look > 0.05) {
      g.strokeStyle = rgba('#5a3a48', 0.85 * look); g.lineWidth = 0.9; g.lineCap = 'round';
      g.beginPath(); arcS(g, lh[0] - 5, lh[1] - 1, 2.6, PI * 0.15, PI * 0.85, false); g.stroke();
      g.beginPath(); g.moveTo(lh[0] - 8.5, lh[1] + 5.5); g.quadraticCurveTo(lh[0] - 6.5, lh[1] + 7.5, lh[0] - 4.5, lh[1] + 6); g.stroke();
      glowA(g, lh[0] - 3, lh[1] + 3, 6, '#f2a8b8', 0.6 * look);
    }
    g.restore();
    // 冰把倒影压得发蓝发白；两人身上那一片冰最清，看得见她的笑
    const cxr = OX + 31, cyr = AX + 88;
    g.save(); g.translate(cxr, cyr); g.scale(1, 1.3);
    const wash = g.createRadialGradient(0, 0, 60, 0, 0, 230);
    wash.addColorStop(0, 'rgba(206,224,238,0.1)'); wash.addColorStop(0.55, 'rgba(206,224,238,0.1)'); wash.addColorStop(1, 'rgba(190,210,230,0.3)');
    g.fillStyle = wash; g.fillRect(-400, -300, 800, 600);
    g.restore();
    // 花灯的暖光透过冰层
    const lmy = AX * 2 - lp0[1];
    lighter(g, () => { glowA(g, lp0[0], lmy, 110, '#c88a30', 0.2 * lit); glowA(g, lp0[0], lmy, 26, '#ffd890', 0.45 * lit); });
    g.restore();
    // 冰雾贴着冰面
    E.mist(g, { t, y: AX + 18, h: 80, color: '#f4f8fb', alpha: 0.5, speed: 10, seed: 52 });
    // 看字：冰下的灯里升起点点金光；有十来点破冰而出，飘过老人的脸
    const mk = lt - tKan + 0.2;
    if (mk > 0) {
      const dsp = dotSpr('#ffe2a0'), goldSpr = dotSpr('#d89a3a');
      lighter(g, () => {
        for (let i = 0; i < 28; i++) {
          const out = i < 10, d = mk - h2(i, 91) * 0.6;
          if (d < 0) continue;
          const x = lp0[0] + (h2(i, 92) - 0.5) * (out ? 50 : 70) + Math.sin(d * 2 + i) * 10 - (out ? d * 14 : 0);
          const y = lmy - d * (out ? 150 + 60 * h2(i, 93) : 40 + 50 * h2(i, 93));
          if (!out && y < AX + 4) continue;
          const above = AX - y, fade = out ? 1 - smooth((above - 100) / 80) : 1;
          const r = 2 + 3 * h2(i, 94), a = clamp(d * 3) * clamp(1 - d / (out ? 1.8 : 1.6)) * 0.9 * fade;
          if (a <= 0.01) continue;
          if (y < AX) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = a; g.drawImage(goldSpr, x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4); g.globalCompositeOperation = 'lighter'; }
          g.globalAlpha = a * (y < AX ? 0.6 : 1); g.drawImage(dsp, x - r, y - r, r * 2, r * 2);
        }
        g.globalAlpha = 1;
      });
    }
    // 老人：墨色大氅独立冰上，低头看着冰下；看字之后含泪而笑
    const oo = Object.assign({}, OLD, { facing: 1, prop: 'none', pose: 'stand', wind: 0.55, windDir: -1, rim: '#eef6ff', light: [980, 300], night: true, seed: 8, head: 0.35, lean: 0.04 });
    lighter(g, () => glowA(g, OX + 20, AX + 6, 100, '#eacd76', 0.2 * lit));
    F.draw(g, 'xiaoyao', OX, AX + 2, 0.95, t, oo);
    // 泪：看字后眼角一点亮，顺着脸颊一滑，落下去，打在冰上
    const hp = F.points('xiaoyao', OX, AX + 2, 0.95, t, oo).head, ex = hp[0] + 3.5, ey = hp[1] + 3;
    const tw = lt - tKan - 0.02, tDrop = 0.1, gTear = 2400;
    const landX = ex + 5, landY = AX + 5, fallH = landY - (ey + 4), tLand = tKan + 0.02 + tDrop + Math.sqrt(2 * fallH / gTear);
    if (tw > 0 && lt < tLand) {
      lighter(g, () => {
        if (tw < tDrop) { const r = 0.8 + 0.6 * tw / tDrop; glowA(g, ex, ey + 4 * tw / tDrop, 4, '#ffffff', 0.6); g.fillStyle = '#ffffff'; g.beginPath(); arcS(g, ex, ey + 4 * tw / tDrop, r, 0, TAU); g.fill(); }
        else {
          const d = tw - tDrop, yy = ey + 4 + 0.5 * gTear * d * d, xx = lerp(ex, landX, clamp((yy - ey) / fallH));
          g.strokeStyle = K.lin(g, xx, yy, xx, yy - 18, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]); g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy - Math.min(18, 3 + d * 60)); g.stroke();
          g.fillStyle = '#ffffff'; g.beginPath(); arcS(g, xx, yy, 1, 0, TAU); g.fill(); glowA(g, xx, yy, 3.5, '#ffffff', 0.6);
        }
      });
    }
    // 泪痕留在颊上
    if (tw > 0) { const wa = 0.7 * (1 - smooth((tw - 0.6) / 0.6)); g.strokeStyle = rgba('#eaf6ff', wa); g.lineWidth = 0.8; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + 0.6, ey + 5); g.stroke(); }
    // 落到冰上：两圈细纹荡开
    const rd = lt - tLand;
    if (rd > 0 && rd < 1.2) {
      for (let k = 0; k < 2; k++) {
        const u = clamp((rd - k * 0.15) / 1), r = 4 + 36 * easeOut(u);
        if (u <= 0) continue;
        g.strokeStyle = rgba('#ffffff', 0.8 * (1 - u)); g.lineWidth = 1;
        g.beginPath(); ellS(g, landX, landY, r, r * 0.26, 0, 0, TAU); g.stroke();
      }
      if (rd < 0.08) lighter(g, () => glowA(g, landX, landY, 6, '#ffffff', 0.5));
    }
    // 透：泪落处裂出一道细纹，从两人倒影中间往下跑，在她脸前一点停住
    const ck = lt - Math.max(tTou, tLand);
    if (ck > 0) {
      const u = easeOut(clamp(ck / 0.4));
      const tx = lh[0] - 8, ty = AX * 2 - lh[1] - 14, n = 12;
      const P = [];
      for (let k = 0; k <= n; k++) { const v = k / n; P.push([lerp(landX, tx, v) + Math.sin(v * 9 + 1) * 5 * (1 - v * 0.5) + (h2(k, 3) - 0.5) * 4, lerp(landY, ty, v) + (h2(k, 4) - 0.5) * 3]); }
      const m = u * n, flash = ck > 0.4 && ck < 0.47 ? 1 : 0;
      const line = (col, w, dy) => {
        g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'miter';
        g.beginPath(); g.moveTo(P[0][0], P[0][1] + dy);
        for (let k = 1; k <= Math.ceil(m); k++) { const f = Math.min(1, m - (k - 1)); g.lineTo(lerp(P[k - 1][0], P[k][0], f), lerp(P[k - 1][1], P[k][1], f) + dy); }
        g.stroke();
        // 三根短枝
        for (const [k, ln, an] of [[3, 12, -0.9], [6, 20, 0.8], [9, 8, -0.7]]) {
          if (m < k + 0.5) continue;
          const dx = P[k + 1][0] - P[k][0], dyy = P[k + 1][1] - P[k][1], a0 = Math.atan2(dyy, dx) + an, gl = Math.min(1, (m - k - 0.5) * 2);
          g.beginPath(); g.moveTo(P[k][0], P[k][1] + dy); g.lineTo(P[k][0] + Math.cos(a0) * ln * gl, P[k][1] + Math.sin(a0) * ln * gl + dy); g.stroke();
        }
      };
      line('rgba(60,80,120,0.4)', 0.8, 1.4);
      line(rgba('#ffffff', 0.95), 1.2, 0);
      if (flash) lighter(g, () => { line('rgba(230,246,255,0.7)', 2, 0); for (const p of P) glowA(g, p[0], p[1], 7, '#e8f6ff', 0.18); });
    }
    // 冰雾贴着冰面漂
    E.mist(g, { t, y: AX + 120, h: 120, color: '#eef4f8', alpha: 0.32, speed: 14, seed: 53 });
    // 空中的冰晶：拍点上闪一下
    V.snow(g, c, { n: 60, size: [1, 5], fall: 10, wind: 12, seed: 77, alpha: 0.7, beat: 1, night: false });
    g.restore();
  }

  XYT.registerShot('c3_icelake', {
    name: '冰池倒影', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(240,246,250,0.9)', accent: '#9a6a1c', bloom: 0.3,
    draw(g, c) { iceScene(g, c); },
  });

  // 空闲时先把本组的静态贴图烘好，免得切镜那一帧现烘而卡顿（只是缓存，不影响画面）。
  // 只在播放头接近本组（200 s 之后）或暂停时才烘，且不给 requestIdleCallback 设超时，不抢正在播放的帧
  const WARM = [wakeSky, faceSprite, wakeFaceBg, wakeFarA, wakeFarB, summitTex, pineBare, pineCaps, innHallTex, frostSkyTex, fsGroundTex, frostTex, peachPoolTex,
    relicFieldTex, bridgeTex, springTex, iceBgTex, frostBgTex];
  function songPos() {
    try {
      const st = XYT.api && XYT.api.state && XYT.api.state();
      if (!st) return { pos: 0, playing: false };
      if (!st.playing || !st.actx) return { pos: st.pos || 0, playing: false };
      return { pos: st.startOff + (st.actx.currentTime - st.startCtx), playing: true };
    } catch (e) { return { pos: 0, playing: false }; }
  }
  let wi = 0;
  function warmTick() {
    if (wi >= WARM.length) return;
    const sp = songPos(), near = sp.pos > 200 && sp.pos < 268;
    if (!XYT.sprites || !(near || !sp.playing)) { setTimeout(warmTick, 1500); return; }
    const run = () => { try { WARM[wi](); } catch (e) { /* 预热失败不影响正式绘制 */ } wi++; setTimeout(warmTick, 60); };
    if (window.requestIdleCallback) window.requestIdleCallback(run); else setTimeout(run, 120);
  }
  setTimeout(warmTick, 2500);
})();
