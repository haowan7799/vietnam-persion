/* 分镜镜头 第 06 组：副歌1 前四句 —— 荷湖轻狂、万剑梦碎、负骨南行、街头陌路 */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 通用小工具 ----------
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const glowS = () => XYT.sprites.glow;
  const tintS = (col) => XYT.sprites.tint(XYT.sprites.glow, col);
  // 本句第 k 字相对镜头起点的时间；取不到时用分镜实测表
  function charAt(c, k, table) {
    const v = c.charT ? c.charT(k) : null;
    return v == null ? table[Math.min(k, table.length - 1)] : v - (c.t - c.lt);
  }
  function chars(c, table) { const out = []; for (let k = 0; k < table.length; k++) out.push(charAt(c, k, table)); return out; }
  // 柔光点（亮场用 screen，暗场用 lighter）
  function dot(g, x, y, r, col, a, op) {
    if (!(a > 0.003)) return;
    const o = g.globalCompositeOperation, ga = g.globalAlpha;
    g.globalCompositeOperation = op || 'lighter'; g.globalAlpha = ga * Math.min(1, a);
    g.drawImage(tintS(col), x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = o; g.globalAlpha = ga;
  }
  // 每帧复用的设备分辨率缓冲：box 为当前变换下的逻辑区域；只当草稿用，每次先清空
  const bufs = {};
  function devBox(g, box) {
    const m = g.getTransform();
    const xs = [], ys = [];
    for (const [x, y] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
    const cw = g.canvas.width, ch = g.canvas.height;
    const X0 = Math.max(0, Math.floor(Math.min(...xs))), Y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const X1 = Math.min(cw, Math.ceil(Math.max(...xs))), Y1 = Math.min(ch, Math.ceil(Math.max(...ys)));
    return { m, X0, Y0, w: X1 - X0, h: Y1 - Y0 };
  }
  function scratch(name, w, h) {
    let cv = bufs[name];
    if (!cv) cv = bufs[name] = document.createElement('canvas');
    if (cv.width < w || cv.height < h) { cv.width = Math.max(cv.width, w, 2); cv.height = Math.max(cv.height, h, 2); }
    const q = cv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    q.clearRect(0, 0, w + 2, h + 2);
    return { cv, q };
  }
  // 宣纸色
  const PAPER = '#f6f1e4';

  // =====================================================================
  // 第17句 荷湖轻狂：〔第17句第1–4字〕｜〔第17句第5–8字〕｜〔第17句第9–11字〕
  // =====================================================================
  const T17 = [0.26, 0.58, 0.98, 1.36, 2.18, 2.68, 3.1, 3.58, 3.86, 4.22, 4.86];
  const HZ = 318;                 // 水天线
  const BX = 820, BY = 464, BL = 560; // 船心、吃水线、船长
  const FS = 0.88;                // 船上人物的缩放
  const SPL = [1068, 574];        // 落水处（船头前方的开阔水面）
  const SUN17 = [1236, -78];      // 正午的日头在画外右上
  const LIGHT17 = SUN17;
  const PET17 = [722, 546];       // 「空」字荷瓣落水处
  const X17 = { li: 622, yu: 734, xy: 858, jj: 1020, xyBack: 884 };
  const deck17 = (x, rot) => BY - 16 + (x - BX) * Math.sin(rot);
  // 浮在水面的荷叶贴图（与工具包的荷叶同一画法，但可以任意摆放、摇动）
  function padTex(seed, col) {
    return K.cache('g06|pad' + seed + col, 200, 70, 1, (q) => {
      const r = A.rng(seed + 70), cx = 100, cy = 35, rx = 92, ry = 28;
      const notch = PI / 2 + (r() - 0.5) * 0.8;
      q.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = notch + 0.18 + (i / 60) * (TAU - 0.36), wob = 1 + (noise1(a * 3, seed) - 0.5) * 0.12;
        const px = cx + Math.cos(a) * rx * wob, py = cy + Math.sin(a) * ry * wob - (Math.sin(a) < 0 ? 2 : 0);
        i ? q.lineTo(px, py) : q.moveTo(px, py);
      }
      q.lineTo(cx + Math.cos(notch) * 6, cy + Math.sin(notch) * 3); q.closePath();
      q.fillStyle = K.rad(q, cx - 10, cy - 6, 4, rx, [[0, mix(col, '#e2eea0', 0.5)], [0.6, col], [1, mix(col, '#0a3020', 0.4)]]);
      q.fill();
      q.save(); q.clip();
      q.strokeStyle = rgba(mix(col, '#eef6c0', 0.55), 0.38); q.lineWidth = 0.9;
      for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; q.beginPath(); q.moveTo(cx, cy); q.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); q.stroke(); }
      q.strokeStyle = rgba('#f4fad0', 0.55); q.lineWidth = 2;
      q.beginPath(); q.ellipse(cx, cy - 1.5, rx - 2, ry - 1.5, 0, PI * 1.05, PI * 1.95); q.stroke();
      q.restore();
      q.fillStyle = mix(col, '#ffffff', 0.3); q.beginPath(); q.arc(cx, cy, 3, 0, TAU); q.fill();
    });
  }
  // 小舟（侧面）：船艏在右、翘起；整只烘成贴图，逐帧只按横摇转动
  function skiffTex() {
    const L = BL, h = 30;
    return K.cache('g06|skiff17', L + 120, 96, 1, (q) => {
      q.translate(L / 2 + 60, 64);
      const hull = () => {
        q.beginPath();
        q.moveTo(-L / 2 - 16, -h - 8);
        q.quadraticCurveTo(-L / 2 + 6, 2, -L * 0.22, 8);
        q.lineTo(L * 0.2, 8);
        q.quadraticCurveTo(L / 2 - 4, 2, L / 2 + 28, -h - 18);
        q.lineTo(L / 2 + 15, -h - 10);
        q.quadraticCurveTo(L * 0.1, -h + 2, -L / 2 - 6, -h - 4);
        q.closePath();
      };
      hull();
      q.fillStyle = K.lin(q, 0, -h - 10, 0, 9, [[0, '#a06c3e'], [0.4, '#6e4426'], [1, '#2a1a0e']]);
      q.fill();
      q.save(); hull(); q.clip();
      q.strokeStyle = 'rgba(30,16,8,0.45)'; q.lineWidth = 1;
      for (let k = 1; k < 4; k++) { const yy = -h + k * 9; q.beginPath(); q.moveTo(-L / 2, yy - 4); q.quadraticCurveTo(0, yy + 5, L / 2 + 10, yy - 9 - k); q.stroke(); }
      q.fillStyle = 'rgba(255,236,190,0.24)'; q.fillRect(-L / 2 - 20, -h - 20, L + 60, 8);
      // 水面映上船腹的波光
      q.fillStyle = 'rgba(190,245,225,0.2)'; q.fillRect(-L / 2 - 20, -2, L + 60, 12);
      q.restore();
      q.strokeStyle = 'rgba(255,232,180,0.8)'; q.lineWidth = 1.8;
      q.beginPath(); q.moveTo(-L / 2 - 6, -h - 4); q.quadraticCurveTo(L * 0.1, -h + 2, L / 2 + 15, -h - 10); q.stroke();
      q.strokeStyle = 'rgba(28,18,10,0.85)'; q.lineWidth = 1.3;
      q.beginPath(); q.moveTo(-L / 2 - 16, -h - 8); q.quadraticCurveTo(-L / 2 + 6, 2, -L * 0.22, 8); q.lineTo(L * 0.2, 8); q.quadraticCurveTo(L / 2 - 4, 2, L / 2 + 28, -h - 18); q.stroke();
    });
  }
  function skiff(g, rot, alpha) {
    const sp = skiffTex();
    g.save(); g.translate(BX, BY + 2); g.rotate(rot);
    if (alpha != null) g.globalAlpha *= alpha;
    g.drawImage(sp, -(BL / 2 + 60), -64, sp.lw, sp.lh);
    g.restore();
  }
  // 荷叶伞：叶心在 (x, y)，r 半径，tilt 倾角
  function leafCanopy(g, x, y, r, tilt, col) {
    g.save(); g.translate(x, y); g.rotate(tilt);
    g.fillStyle = K.lin(g, 0, -r * 0.5, 0, r * 0.25, [[0, mix(col, '#d8eaa0', 0.35)], [1, mix(col, '#0e3a2a', 0.45)]]);
    g.beginPath();
    g.moveTo(-r, r * 0.08);
    g.bezierCurveTo(-r * 0.9, -r * 0.42, r * 0.9, -r * 0.42, r, r * 0.08);
    g.quadraticCurveTo(r * 0.5, -r * 0.02, r * 0.3, r * 0.14);
    g.quadraticCurveTo(0, r * 0.02, -r * 0.3, r * 0.14);
    g.quadraticCurveTo(-r * 0.5, -r * 0.02, -r, r * 0.08);
    g.fill();
    g.strokeStyle = rgba('#eaf4c8', 0.45); g.lineWidth = 0.8;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(0, -r * 0.05); g.quadraticCurveTo(k * r * 0.2, -r * 0.3, k * r * 0.3, r * 0.05); g.stroke(); }
    g.restore();
  }
  // 出水的荷叶（立叶）：叶柄 + 翻卷的叶盘，烘成贴图；锚点在叶柄入水处
  function standLeafTex(k, r, stem) {
    const w = r * 2.4, h = stem + r * 0.9;
    return K.cache('g06|stand' + k + '|' + r + '|' + stem, w, h, 1, (q) => {
      const x = w / 2, y = h - 2, top = y - stem;
      q.strokeStyle = '#2c5a3c'; q.lineWidth = Math.max(2, r * 0.05); q.lineCap = 'round';
      q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + r * 0.08, (y + top) / 2, x + r * 0.04, top + r * 0.05); q.stroke();
      const col = ['#3f9a6c', '#2f8a5e', '#4aa676'][k % 3];
      q.save(); q.translate(x, top); q.rotate((k % 2 ? -1 : 1) * 0.12);
      // 叶背（暗）与叶面（受光）两层，边缘起伏
      q.fillStyle = mix(col, '#0e3a2a', 0.5);
      q.beginPath(); q.ellipse(0, r * 0.02, r * 1.02, r * 0.3, 0, 0, TAU); q.fill();
      q.fillStyle = K.lin(q, 0, -r * 0.4, 0, r * 0.2, [[0, mix(col, '#e2f0a8', 0.45)], [0.6, col], [1, mix(col, '#0e3a2a', 0.35)]]);
      q.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = PI + (i / 40) * PI, wob = 1 + 0.06 * Math.sin(i * 1.7 + k);
        q.lineTo(Math.cos(a) * r * wob, Math.sin(a) * r * 0.42 * wob - r * 0.02);
      }
      for (let i = 0; i <= 20; i++) { const u = i / 20, xx = lerp(r, -r, u); q.lineTo(xx, r * 0.06 + Math.sin(u * PI * 5 + k) * r * 0.035); }
      q.closePath(); q.fill();
      q.strokeStyle = rgba('#eef6c8', 0.45); q.lineWidth = 0.9;
      for (let j = -4; j <= 4; j++) { q.beginPath(); q.moveTo(0, -r * 0.02); q.quadraticCurveTo(j * r * 0.16, -r * 0.3, j * r * 0.24, r * 0.04); q.stroke(); }
      q.strokeStyle = rgba('#f6fad8', 0.6); q.lineWidth = 1.6;
      q.beginPath(); q.ellipse(0, -r * 0.02, r * 0.98, r * 0.4, 0, PI * 1.08, PI * 1.6); q.stroke();
      q.restore();
    });
  }
  // 荷花花头烘成贴图（花后衬一圈透光的柔白）；花茎逐帧画，花头随茎平移摇摆
  function flowerTex(i, s, open, col) {
    const w = 130 * s, h = 112 * s;
    return K.cache('g06|flh' + i, w, h, 1, (q) => {
      const x = w / 2, fy = h - 8 * s;
      if (open > 0.4) { const gr = q.createRadialGradient(x, fy - 30 * s, 0, x, fy - 30 * s, 58 * s); gr.addColorStop(0, 'rgba(255,248,240,0.5)'); gr.addColorStop(1, 'rgba(255,248,240,0)'); q.fillStyle = gr; q.fillRect(0, 0, w, h); }
      E.lotus(q, { x, y: fy, s, open, t: -i / 0.9, seed: i, leaves: 0, color: col, leafColor: '#2f7a58', stem: 0 });
    });
  }
  // 远景荷：[x, y, s, 开合, 色, 茎长]
  const FL17 = [
    // 远处的小荷
    [372, 468, 0.42, 0.9, '#f8e8ec', 60], [586, 440, 0.36, 0.5, '#e8789a', 60], [1092, 466, 0.4, 1, '#f4a6b8', 62], [1204, 452, 0.34, 0.3, '#e8789a', 60], [474, 502, 0.5, 1, '#e8789a', 62],
    // 中景
    [430, 592, 0.8, 1, '#e8789a', 64], [604, 624, 0.9, 0.6, '#f4a6b8', 64], [930, 646, 0.85, 1, '#f8e4e8', 62],
    // 近景
    [520, 708, 1.25, 0.9, '#f4a6b8', 70], [1150, 712, 1.15, 1, '#e8789a', 66],
    // 从画底伸进来的高茎大荷（近、半出画）
    [300, 800, 1.8, 1, '#f8e8ec', 116], [1272, 812, 2.0, 0.8, '#e8789a', 104], [900, 836, 1.5, 0.25, '#f4a6b8', 150],
  ];
  // 立叶：[x, y, r, 茎长, k]
  const SL17 = [[86, 770, 118, 150, 0], [1100, 780, 128, 112, 1], [520, 790, 92, 112, 2]];
  // 落水处附近活动的浮叶：[x, y, s, 种子]
  const PADS17 = [[928, 606, 0.95, 1], [1172, 590, 0.9, 2], [994, 664, 1.15, 3], [1132, 668, 1.05, 0], [880, 556, 0.7, 2]];
  // 静态荷田：远小近大的浮叶；船前、落水处、歌词栏留出水面
  function lotusField() {
    return K.cache('g06|lotusField3', W + 80, H - HZ + 30, 1, (q) => {
      q.translate(40, -HZ);
      const r = A.rng(1717);
      const rows = 110;
      for (let i = 0; i < rows; i++) {
        const v = Math.pow(i / rows, 1.15), y = lerp(HZ + 8, H + 16, v), s = lerp(0.18, 2.0, Math.pow(v, 1.3));
        const n = 1 + Math.floor(r() * 2.4);
        for (let k = 0; k < n; k++) {
          const x = -40 + r() * (W + 80), sd = Math.floor(r() * 4), cv = r(), fl = r(), keep = r();
          const nearBoat = x > 548 && x < 1130 && y > 452 && y < 548;
          const lyr = x < 270 && y > 330 && y < 560;
          const spl = Math.hypot(x - SPL[0], (y - SPL[1]) * 1.9) < 240;
          const pet = Math.hypot(x - PET17[0], (y - PET17[1]) * 2.2) < 120;
          if ((nearBoat && keep < 0.9) || (lyr && keep < 0.75) || spl || pet) continue;
          const col = v < 0.35 ? (cv < 0.5 ? '#5aa682' : '#6aae84') : cv < 0.4 ? '#2f8a5e' : cv < 0.75 ? '#3a9466' : '#48a070';
          const img = padTex(sd, col);
          q.save(); q.translate(x, y); if (fl < 0.5) q.scale(-1, 1);
          q.drawImage(img, -100 * s, -35 * s, 200 * s, 70 * s); q.restore();
        }
      }
    });
  }
  // 天色（俯冲时露出的高空也用它）
  const SKY17 = { top: '#1f6aa6', mid: '#5fb2d8', bottom: '#e6f6ee', y0: -260, y1: HZ + 6, midAt: 0.58, haze: '#ffffff', hazeY: HZ, hazeA: 0.25 };
  // 从画外右上斜射下来的日光
  function rays17(q) {
    q.save(); q.globalCompositeOperation = 'screen';
    for (let i = 0; i < 9; i++) {
      const a = 2.0 + (i / 8) * 0.62 + (h2(i, 3) - 0.5) * 0.08, L = 1100 + 300 * h2(i, 4), w = 26 + 70 * h2(i, 5), al = 0.08 + 0.12 * h2(i, 6);
      q.save(); q.translate(SUN17[0], SUN17[1]); q.rotate(a);
      const gr = q.createLinearGradient(0, 0, L, 0);
      gr.addColorStop(0, `rgba(255,248,214,${al})`); gr.addColorStop(0.55, `rgba(255,246,210,${al * 0.7})`); gr.addColorStop(1, 'rgba(255,246,210,0)');
      q.fillStyle = gr;
      q.beginPath(); q.moveTo(0, -6); q.lineTo(L, -w); q.lineTo(L, w); q.lineTo(0, 6); q.closePath(); q.fill();
      q.restore();
    }
    q.restore();
  }
  // 天、日光、积云、青绿远山、水面与山影、荷田、斜照的日光，整张烘好（固定机位时一次贴满）
  function bg17() {
    return K.cache('g06|bg17c', W + 80, H + 40, 1, (q) => {
      q.translate(40, 20);
      E.sky(q, SKY17);
      A.glow(q, SUN17[0], SUN17[1], 560, '#fff8dc', 0.75);
      A.glow(q, SUN17[0], SUN17[1], 240, '#ffffff', 0.95);
      // 高空几缕淡云；远山后面堆起的夏日积云
      E.clouds(q, { t: 0, y: 84, color: '#ffffff', shade: '#9cc8e0', alpha: 0.55, n: 3, seed: 17, speed: 0, scale: 0.8, lightX: SUN17[0] });
      E.clouds(q, { t: 0, y: 302, color: '#ffffff', shade: '#9ec4dc', alpha: 0.95, n: 3, seed: 9, speed: 0, scale: 1.05, style: 'cumulus', lightX: SUN17[0], spread: 16 });
      E.mountains(q, { t: 0, lightDir: 1, layers: [
        { kind: 'far', color: '#7fb8c4', light: '#fbf0cc', litA: 0.5, y: HZ + 2, scaleY: 0.34, speed: 0, seed: 3, fog: '#e2f4ee', fogA: 0.35 },
        { kind: 'mid', color: '#2f8a7a', light: '#eacd76', litA: 0.62, y: HZ + 4, scaleY: 0.42, speed: 0, seed: 6, rim: '#fff0c0', rimA: 0.6, fog: '#d2eee4', fogA: 0.22 },
      ] });
      // 水面：远处映天的浅碧到近处深碧
      q.fillStyle = K.lin(q, 0, HZ, 0, H + 20, [[0, '#c6ece2'], [0.18, '#78c4b0'], [0.55, '#2f8a78'], [1, '#1f6e62']]);
      q.fillRect(-40, HZ, W + 80, H + 20 - HZ);
      // 山影：把水天线以上 200 像素翻下来，越近越淡
      const src = q.canvas, sc = src.width / (W + 80), tmp = document.createElement('canvas');
      tmp.width = src.width; tmp.height = Math.ceil(200 * sc);
      const tq = tmp.getContext('2d');
      tq.drawImage(src, 0, (20 + HZ - 200) * sc, src.width, 200 * sc, 0, 0, tmp.width, tmp.height);
      tq.globalCompositeOperation = 'destination-in';
      const fg = tq.createLinearGradient(0, tmp.height, 0, 0); fg.addColorStop(0, 'rgba(0,0,0,0.62)'); fg.addColorStop(0.6, 'rgba(0,0,0,0.25)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      tq.fillStyle = fg; tq.fillRect(0, 0, tmp.width, tmp.height);
      q.save(); q.translate(0, HZ + 1); q.scale(1, -1.15);
      q.globalAlpha = 0.75; q.drawImage(tmp, -40, -200, W + 80, 200);
      q.restore();
      // 水天交界一线薄雾
      q.fillStyle = K.lin(q, 0, HZ - 10, 0, HZ + 16, [[0, 'rgba(240,250,246,0)'], [0.5, 'rgba(240,250,246,0.5)'], [1, 'rgba(240,250,246,0)']]);
      q.fillRect(-40, HZ - 10, W + 80, 26);
      // 日头正下方的一条亮水
      q.globalCompositeOperation = 'screen';
      q.fillStyle = K.lin(q, 1000, 0, 1400, 0, [[0, 'rgba(255,250,220,0)'], [0.55, 'rgba(255,250,220,0.35)'], [1, 'rgba(255,250,220,0.1)']]);
      q.fillRect(960, HZ, 460, H + 20 - HZ);
      q.globalCompositeOperation = 'source-over';
      const lf = lotusField();
      q.drawImage(lf, -40, HZ, lf.lw, lf.lh);
      rays17(q);
    });
  }
  // 俯冲时露出的高空（-260..-20）
  function sky17() {
    return K.cache('g06|sky17', W + 80, 250, 0.5, (q) => { q.translate(40, 260); E.sky(q, SKY17); rays17(q); });
  }
  // 船的倒影：翻过来、往下渐淡，烘成贴图
  function skiffRefl() {
    const sp = skiffTex();
    return K.cache('g06|skiffR', sp.lw, 70, 1, (q) => {
      q.save(); q.translate(0, 71); q.scale(1, -1); q.drawImage(sp, 0, 0, sp.lw, sp.lh); q.restore();
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = K.lin(q, 0, 0, 0, 70, [[0, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, sp.lw, 70);
    });
  }
  // 水花：中心一柱水、一圈向外翻的水刺（刺尖甩出水珠）、抛物线落回的水珠、外扩的白沫圈；亮处闪光
  function taperLine(g, x0, y0, x1, y1, w0, w1) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    g.beginPath(); g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.closePath(); g.fill();
  }
  function splash(g, x, y, age, s, seed, n) {
    if (age < 0 || age > 1.8) return;
    const G = 1700 * s, fade = 1 - age / 1.8;
    // 白沫圈
    const rr = (36 + 96 * easeOut(age / 1.2)) * s;
    g.fillStyle = rgba('#ffffff', 0.5 * (1 - smooth(age / 1.4)));
    g.beginPath(); g.ellipse(x, y + 2, rr * 0.8, rr * 0.2, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba('#ffffff', 0.8 * (1 - smooth(age / 1.6))); g.lineWidth = 2.2 * s;
    g.beginPath(); g.ellipse(x, y + 2, rr, rr * 0.24, 0, 0, TAU); g.stroke();
    // 中心水柱：先冲高，再塌成一团
    const ch = 150 * s * Math.sin(PI * clamp(age / 0.9)) * easeOut(clamp(age / 0.3)), ca = 1 - smooth(age / 1.0);
    if (ch > 2 && ca > 0) {
      const cw = 15 * s * (1 + age * 0.8);
      g.fillStyle = rgba('#f4fcfa', 0.88 * ca);
      g.beginPath(); g.moveTo(x - cw * 1.7, y);
      g.bezierCurveTo(x - cw * 0.9, y - ch * 0.4, x - cw * 0.7, y - ch * 0.85, x - cw * 0.2, y - ch);
      g.quadraticCurveTo(x, y - ch - cw * 0.9, x + cw * 0.3, y - ch);
      g.bezierCurveTo(x + cw * 0.8, y - ch * 0.85, x + cw * 0.9, y - ch * 0.4, x + cw * 1.7, y);
      g.closePath(); g.fill();
      g.fillStyle = rgba('#b8e8e0', 0.5 * ca); g.beginPath(); g.ellipse(x + cw * 0.5, y - ch * 0.45, cw * 0.35, ch * 0.4, 0, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', ca); g.beginPath(); g.arc(x, y - ch - cw * 0.2, cw * 0.36, 0, TAU); g.fill();
    }
    // 水冠的一圈细刺
    const cr = Math.sin(PI * clamp(age / 0.62)), ka = 1 - smooth(age / 0.7);
    if (cr > 0 && ka > 0) {
      g.fillStyle = rgba('#ffffff', 0.9 * ka);
      for (let j = 0; j < 11; j++) {
        const u = j / 10 - 0.5, a = -PI / 2 + u * 2.3 + (h2(j, seed + 7) - 0.5) * 0.25, L = (50 + 70 * h2(j, seed + 8)) * s * cr * (1 - Math.abs(u) * 0.6);
        const bx = x + u * 2 * 44 * s, by = y + 1, tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L;
        taperLine(g, bx, by, tx, ty, 5 * s, 1.2 * s);
        g.beginPath(); g.arc(tx, ty, 3 * s, 0, TAU); g.fill();
      }
    }
    // 水珠
    const glints = [];
    for (let i = 0; i < n; i++) {
      const an = -PI / 2 + (h2(i, seed) - 0.5) * 2.4, v = (200 + 360 * Math.sqrt(h2(i, seed + 1))) * s, d0 = 0.03 + 0.12 * h2(i, seed + 3);
      const a2 = age - d0;
      if (a2 < 0) continue;
      const px = x + Math.cos(an) * v * a2 * 0.8, py = y - 6 * s + Math.sin(an) * v * a2 + 0.5 * G * a2 * a2;
      if (py > y + 6) continue;
      const r = (1.3 + 3 * h2(i, seed + 2)) * s * (1 - age * 0.35);
      g.fillStyle = rgba(i % 3 ? '#f6fcfa' : '#c4ece4', 0.95 * fade);
      g.beginPath(); g.ellipse(px, py, r, r * 1.3, 0, 0, TAU); g.fill();
      if (i % 4 === 0) glints.push([px, py, r]);
    }
    for (const [px, py, r] of glints) { dot(g, px, py, r * 5, '#fffbe8', 0.6 * fade, 'screen'); sparkle(g, px, py, r * 3.2, 0.8 * fade); }
  }
  // 蜻蜓：一段一段飞，停一停
  function dragonfly(g, t, seed, x0, y0, sc) {
    const k = Math.floor(t * 0.9 + seed), f = t * 0.9 + seed - k, mv = smooth(f / 0.35);
    const px = (j) => x0 + (h2(j, seed) - 0.5) * 360, py = (j) => y0 + (h2(j, seed + 1) - 0.5) * 140;
    const x = lerp(px(k), px(k + 1), mv), y = lerp(py(k), py(k + 1), mv) + Math.sin(t * 3 + seed) * 3;
    const dir = px(k + 1) >= px(k) ? 1 : -1;
    g.save(); g.translate(x, y); g.scale(dir * sc, sc);
    g.strokeStyle = '#1e3a40'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-14, 0); g.lineTo(8, 0); g.stroke();
    g.fillStyle = '#c83c23'; g.beginPath(); g.arc(9, 0, 2.2, 0, TAU); g.fill();
    const fl = Math.sin(t * 60 + seed) * 0.5 + 0.5;
    g.fillStyle = rgba('#f2fbff', 0.6);
    for (const [ox, a] of [[2, -0.5], [-2, -0.35]]) {
      g.beginPath(); g.ellipse(ox, -4 - fl * 2, 11, 2.6, a - fl * 0.4, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(ox, 3 + fl * 1.5, 10, 2.4, -a + fl * 0.3, 0, TAU); g.fill();
    }
    g.restore();
  }
  // 四芒星的碎金
  function sparkle(g, x, y, r, a) {
    if (a < 0.02) return;
    g.fillStyle = rgba('#fffbe6', Math.min(1, a));
    g.beginPath();
    g.moveTo(x - r, y); g.quadraticCurveTo(x, y, x, y - r * 0.55); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r * 0.55); g.quadraticCurveTo(x, y, x - r, y);
    g.fill();
  }
  // 酒剑仙每个字一招；逍遥慢半拍照着学
  const JJ_MOVES = ['swordUp', 'swordPoint', 'dance', 'summon'];
  function jjMove(lt, ct) {
    if (lt < ct[4]) return { pose: 'laugh', k: -1 };
    let k = 0;
    for (let i = 0; i < 4; i++) if (lt >= ct[4 + i]) k = i;
    return { pose: JJ_MOVES[k], k };
  }
  // 剑光：沿剑尖走过的一段弧（亮芯加柔光），弧头先扫过去，弧尾随后收拢
  function qiArc(g, cx, cy, R, a1, dir, age, core, glowC, w0) {
    const sweep = 2.1, head = easeOut(clamp(age / 0.13)), tail = easeIn(clamp((age - 0.06) / 0.55));
    if (age < 0 || tail >= 1) return;
    const a0 = a1 - dir * sweep, aH = lerp(a0, a1, head), aT = lerp(a0, a1, tail);
    const n = 22, L = [], Rr = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = lerp(aT, aH, u), w = w0 * Math.pow(u, 1.4) + 0.4, rr = R * (1 + 0.04 * Math.sin(u * PI));
      L.push([cx + Math.cos(a) * (rr + w), cy + Math.sin(a) * (rr + w)]); Rr.push([cx + Math.cos(a) * (rr - w), cy + Math.sin(a) * (rr - w)]);
    }
    const shape = () => { g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= n; i++) g.lineTo(L[i][0], L[i][1]); for (let i = n; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath(); };
    const fade = 1 - tail;
    const o = g.globalCompositeOperation;
    g.globalCompositeOperation = 'screen';
    g.strokeStyle = rgba(glowC, 0.32 * fade); g.lineWidth = w0 * 5; g.lineJoin = 'round';
    g.beginPath(); for (let i = 0; i <= n; i++) { const a = lerp(aT, aH, i / n); (i ? g.lineTo : g.moveTo).call(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.stroke();
    g.globalCompositeOperation = o;
    shape(); g.fillStyle = rgba(core, 0.95 * fade); g.fill();
    const hx = cx + Math.cos(aH) * R, hy = cy + Math.sin(aH) * R;
    dot(g, hx, hy, w0 * 9, glowC, 0.8 * fade, 'screen');
    sparkle(g, hx, hy, w0 * 4.5, 0.9 * fade * (1 - head * 0.4));
  }
  // 船上一组人画进缓冲（便于「〔第17句第9–11字〕」擦除）；返回酒剑仙、逍遥的姿势信息
  function boatCrew(q, c, ct, rot) {
    const t = c.t, lt = c.lt, bt = c.be(0.3);
    const deck = (x) => deck17(x, rot);
    const out = {};
    // 灵儿：船尾举着一片荷叶，随拍笑得前仰后合
    {
      const x = X17.li, y = deck(x), shake = 0.03 * Math.sin(t * TAU * 6.5) * (0.6 + 0.4 * Math.sin(t * 1.7));
      const laughK = lt > ct[1] ? 1 : 0.5;
      const o = { pose: 'swordUp', prop: 'none', wind: 0.45, head: -0.25 - 0.25 * bt * laughK + shake * 2, lean: -0.05 - 0.15 * bt * laughK + shake, seed: 3, light: LIGHT17 };
      F.draw(q, 'linger', x, y, FS * 0.98, t, o);
      const p = F.points('linger', x, y, FS * 0.98, t, o);
      const bob = 5 * bt;
      q.strokeStyle = '#2c6a4a'; q.lineWidth = 1.9;
      q.beginPath(); q.moveTo(p.handN[0], p.handN[1] + 6); q.lineTo(p.handN[0] + 3, p.handN[1] - 26 - bob); q.stroke();
      leafCanopy(q, p.handN[0] + 4, p.handN[1] - 28 - bob, 44, -0.2 + 0.08 * Math.sin(t * 2.1) - 0.12 * bt, '#3d9a6c');
    }
    // 月如：举桨、一桨拍下；「词」后笑着拿桨指着水里的他
    {
      const x = X17.yu, y = deck(x);
      const up = lt < ct[0] + 0.12, after = lt > ct[2];
      const pose = up ? 'swordUp' : 'reach';
      const sh = after ? 0.04 * Math.sin(t * TAU * 6) : 0;
      const o = { pose, prop: 'none', wind: 0.5, seed: 5, lean: after ? -0.12 + sh : pose === 'reach' ? 0.22 : 0, head: after ? -0.5 + sh * 2 : 0, light: LIGHT17 };
      F.draw(q, 'yueru', x, y, FS, t, o);
      const p = F.points('yueru', x, y, FS, t, o);
      let th;
      if (up) th = -PI * 0.62 + 0.06 * Math.sin(t * 5) - 0.25 * seg(lt, 0, ct[0] + 0.12);
      else if (lt < ct[1]) th = lerp(-PI * 0.7, 0.3, easeIn(seg(lt, ct[0] + 0.12, ct[1])));
      else if (lt < ct[2]) th = lerp(0.3, 0.75, smooth(seg(lt, ct[1], ct[1] + 0.25)));
      else th = Math.atan2(SPL[1] - 30 - p.handN[1], SPL[0] - p.handN[0]) + 0.05 * Math.sin(t * 4);
      const hx = p.handN[0], hy = p.handN[1], Lo = 118;
      const ex = hx + Math.cos(th) * Lo, ey = hy + Math.sin(th) * Lo, sx = hx - Math.cos(th) * 22, sy = hy - Math.sin(th) * 22;
      if (lt > ct[0] + 0.12 && lt < ct[1] + 0.2) {
        q.strokeStyle = rgba('#ffffff', 0.6 * (1 - seg(lt, ct[1], ct[1] + 0.2)));
        q.lineWidth = 16; q.beginPath(); q.arc(hx, hy, Lo * 0.86, Math.max(-PI * 0.7, th - 1.3), th); q.stroke();
      }
      q.strokeStyle = '#6a4426'; q.lineWidth = 3.6; q.lineCap = 'round';
      q.beginPath(); q.moveTo(sx, sy); q.lineTo(ex, ey); q.stroke();
      q.save(); q.translate(ex, ey); q.rotate(th);
      q.fillStyle = '#7a5030'; q.beginPath(); q.ellipse(12, 0, 23, 8, 0, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(255,230,180,0.55)'; q.lineWidth = 1; q.beginPath(); q.moveTo(-4, -2.6); q.lineTo(32, -2.6); q.stroke();
      q.restore();
      out.oarHit = [ex, ey];
    }
    // 逍遥：挨桨前大笑；爬回船后站到酒剑仙身后学他（慢半拍）
    {
      const stand = ct[4] + 0.44;
      if (lt < ct[1]) {
        F.draw(q, 'xiaoyao', X17.xy, deck(X17.xy), FS, t, { pose: 'laugh', facing: 1, wind: 0.5, seed: 1, light: LIGHT17 });
      } else if (lt >= stand) {
        const x = X17.xyBack, y = deck(x) - 3;
        const lag = lt - 0.22, jm = jjMove(lag, ct);
        const pose = lag < ct[5] ? 'swordUp' : jm.pose;
        const o = { pose, facing: 1, wind: 0.6, seed: 1, light: LIGHT17, lean: pose === 'laugh' ? -0.05 : 0.04 * Math.sin(t * 2.4) };
        F.draw(q, 'xiaoyao', x, y, FS * 0.97, t, o);
        out.xy = { o, x, y, s: FS * 0.97, k: lag < ct[5] ? 0 : jm.k, t0: lag < ct[5] ? stand : ct[4 + jm.k] + 0.22 };
        // 身上还在滴水
        const wet = 1 - seg(lt, stand, stand + 1.8);
        for (let i = 0; i < 8 && wet > 0; i++) {
          const ph = (t * 1.6 + h2(i, 77)) % 1, dx = (h2(i, 78) - 0.5) * 34;
          q.fillStyle = rgba('#e8f8ff', 0.9 * wet * (1 - ph));
          q.beginPath(); q.ellipse(x + dx, y - 64 + ph * 66, 1.6, 2.6, 0, 0, TAU); q.fill();
        }
      }
    }
    // 酒剑仙：船头醉舞剑，仰天狂歌
    const jj = jjMove(lt, ct);
    const x = X17.jj, y = deck(x) - 6;
    const sway = Math.sin(t * 2.3);
    const drink = jj.k < 0, js = FS * 1.02;
    const o = { pose: jj.pose, facing: 1, wind: 0.6, seed: 7, light: LIGHT17, prop: drink ? 'gourd' : undefined, lean: 0.09 * sway + (jj.pose === 'summon' ? -0.12 : 0), head: drink ? 0.06 * sway : jj.pose === 'summon' ? -0.35 : 0.05 * Math.sin(t * 3) };
    F.draw(q, 'jiujianxian', x, y, js, t, o);
    const p = F.points('jiujianxian', x, y, js, t, o);
    if (drink) {
      // 仰天举起大葫芦，倒过来往嘴里灌
      const gs = 0.7 * js, h = p.gourdMouth || p.handN, m = p.mouth;
      const dx = m[0] - h[0], dy = m[1] - h[1], l = Math.hypot(dx, dy) || 1, ang = Math.atan2(dx / l, -dy / l) + 0.06 * Math.sin(t * 2.6);
      const ox = h[0] - gs * 6 * Math.sin(ang), oy = h[1] + gs * 6 * Math.cos(ang);
      E.gourd(q, { x: ox, y: oy, s: gs, angle: ang, t });
      const gx = ox + gs * 46 * Math.sin(ang), gy = oy - gs * 46 * Math.cos(ang);
      q.strokeStyle = 'rgba(236,176,64,0.92)'; q.lineWidth = 2.2 * js; q.lineCap = 'round';
      q.beginPath(); q.moveTo(gx, gy); q.quadraticCurveTo((gx + m[0]) / 2 + 3, (gy + m[1]) / 2, m[0], m[1] - 1); q.stroke();
      for (let i = 0; i < 5; i++) { const u = ((t * 2.4 + i * 0.2) % 1), a = h2(i, 5) * TAU; q.fillStyle = rgba('#f2c060', 0.9 * (1 - u)); q.beginPath(); q.arc(m[0] + Math.cos(a) * u * 14, m[1] + Math.sin(a) * u * 8 + u * u * 20, 1.4, 0, TAU); q.fill(); }
    }
    out.jj = { o, x, y, s: FS * 1.02, k: jj.k, p };
    return out;
  }
  // 某一时刻的拍点包络（与 c.be 同一公式），用于定格画面
  function beAt(c, lt, d) {
    const gr = c.grid;
    if (!gr || !gr.pos) return 0;
    const tt = c.t - c.lt + lt, i = Math.floor(gr.pos(tt)), since = Math.max(0, tt - gr.time(i));
    return Math.exp(-since / d) * (0.4 + 0.6 * (gr.strength ? gr.strength(i) : 0.6));
  }
  // 「终」字前一刻把船上的人定格成一张图：擦除时人不再动（时间停住），也省下逐帧画人
  function crewFrozen(c, ct, tf) {
    const t0 = c.t - c.lt + tf;
    return K.cache('g06|crewFZ|' + t0.toFixed(3), 640, 300, 1, (q) => {
      q.translate(-530, -190);
      const cf = { t: t0, lt: tf, be: (d) => beAt(c, tf, d), de: () => 0 };
      q.canvas.info = boatCrew(q, cf, ct, 0);
    });
  }
  // 「〔第17句第9–11字〕」的三道擦笔：k 第几笔，u 笔锋走到哪（0..1）；返回带毛边的笔形
  const STK = { xa: 566, xb: 1124, th: 104, cy: [280, 366, 448], slant: Math.tan(8 * PI / 180) };
  const gunY = (x) => BY - 28 - 13 * Math.pow(clamp((x - 930) / 200), 2);
  function strokePath(q, k, u, cont) {
    const xa = STK.xa, xh = lerp(xa, STK.xb, u), cy = (x) => STK.cy[k] - (x - 844) * STK.slant;
    const th = STK.th, n = 26;
    if (!cont) q.beginPath();
    for (let i = 0; i <= n; i++) {
      const v = i / n, x = lerp(xa, xh, v), press = 0.82 + 0.18 * Math.sin(Math.min(1, v * 3) * PI / 2), tipK = 1 - Math.pow(clamp((v - 0.86) / 0.14), 2) * 0.55;
      const w = (th / 2) * press * tipK * (k === 0 ? 1 + 0.55 * Math.max(0, 1 - v / 0.28) : 1) + 7 * (noise1(x * 0.045 + k * 7, 3) - 0.5);
      i ? q.lineTo(x, cy(x) - w) : q.moveTo(x, cy(x) - w);
    }
    q.quadraticCurveTo(xh + 26, cy(xh), lerp(xa, xh, 1), cy(xh) + th * 0.32);
    for (let i = n; i >= 0; i--) {
      const v = i / n, x = lerp(xa, xh, v), press = 0.82 + 0.18 * Math.sin(Math.min(1, v * 3) * PI / 2), tipK = 1 - Math.pow(clamp((v - 0.86) / 0.14), 2) * 0.7;
      const w = (th / 2) * press * tipK + 9 * (noise1(x * 0.05 + k * 5, 4) - 0.5) + (v > 0.7 ? 6 * Math.sin(x * 0.4 + k) : 0);
      q.lineTo(x, Math.min(cy(x) + w, gunY(x)));
    }
    q.quadraticCurveTo(xa - 30, cy(xa) + 6, xa, cy(xa) - th * 0.45);
    q.closePath();
  }
  // 笔里的飞白：顺笔势的细丝，做成细长的小块接在笔形路径里，evenodd 填充时就成了镂空
  function strokeDry(q, k, u) {
    const xh = lerp(STK.xa, STK.xb, u), cy = (x) => STK.cy[k] - (x - 844) * STK.slant;
    for (let i = 0; i < 46; i++) {
      const off = (h2(i, 61 + k) - 0.5) * STK.th * 0.86, x0 = lerp(STK.xa + 20, STK.xb - 40, Math.pow(h2(i, 62 + k), 0.6)), len = 50 + 260 * h2(i, 63 + k);
      const x1 = Math.min(x0 + len, xh - 6);
      if (x1 <= x0 + 6) continue;
      const w = (0.5 + 1.8 * Math.pow(h2(i, 64 + k), 2)), bend = (h2(i, 65) - 0.5) * 4, n = 6;
      const pt = (v, sd) => { const x = lerp(x0, x1, v), taper = Math.sin(PI * Math.min(1, v * 1.15 + 0.02)); return [x, Math.min(gunY(x) - 3, cy(x) + off * (1 - 0.04 * v) + bend * Math.sin(PI * v) + sd * w * (0.35 + 0.65 * taper))]; };
      let p0 = pt(0, -1); q.moveTo(p0[0], p0[1]);
      for (let j = 1; j <= n; j++) { const p1 = pt(j / n, -1); q.lineTo(p1[0], p1[1]); }
      for (let j = n; j >= 0; j--) { const p1 = pt(j / n, 1); q.lineTo(p1[0], p1[1]); }
      q.closePath();
    }
  }
  // 穿云的云团：大朵积云从画心向四周涨开
  function diveClouds(g, c, u) {
    const t = c.t, k = 1.1 + 3 * Math.pow(u, 1.5), a = 1 - smooth(u / 0.95);
    if (a < 0.01) return;
    g.save(); g.translate(640, 360); g.scale(k, k); g.translate(-640, -360);
    const ga = g.globalAlpha; g.globalAlpha = ga * a;
    E.clouds(g, { t, y: 250, color: '#ffffff', shade: '#a8cce2', alpha: 1, n: 4, seed: 51, speed: 0, scale: 2.0, style: 'cumulus', spread: 120, lightX: 1240 });
    E.clouds(g, { t, y: 660, color: '#ffffff', shade: '#b4d4e4', alpha: 1, n: 4, seed: 57, speed: 0, scale: 2.2, style: 'cumulus', spread: 100, lightX: 1240 });
    g.globalAlpha = ga;
    g.restore();
  }

  XYT.registerShot('c1_lotusboat', {
    name: '荷湖轻狂', zone: 'left', night: false,
    text: '#1a2026', shadow: 'rgba(243,249,241,0.9)', accent: '#c83c23', bloom: 0.14,
    draw(g, c) {
      const t = c.t, lt = c.lt, ct = chars(c, T17);
      const hit = ct[1], inW = ct[2], up = ct[3], tClimb = ct[4];
      // 航拍俯冲：0.45 秒内从云里扎下来落成大全景；之后固定机位，「空」后缓缓拉远
      const dv = easeOut(seg(lt, 0, 0.45));
      const back = smooth(seg(lt, ct[10], c.dur + 0.2));
      const z = lerp(1.3, 1.0, dv) - 0.05 * back, dy = lerp(340, 0, dv);
      g.save();
      if (dv < 1 || back > 0) { g.translate(BX, 420 + dy); g.scale(z, z); g.translate(-BX, -420); }
      const bg = bg17(), pulse = c.de(0.6), bp = c.be(0.3);
      if (dv < 1) { const sk = sky17(); g.drawImage(sk, -40, -260, sk.lw, sk.lh); }
      // 底图内容柔和，固定机位时用最近邻贴（引擎本身有微推拉，双线性整幅重采样要 3 毫秒多）
      { const sm = g.imageSmoothingEnabled; if (dv >= 1) g.imageSmoothingEnabled = false; g.drawImage(bg, -40, -20, bg.lw, bg.lh); g.imageSmoothingEnabled = sm; }
      // 日头那一角随强拍亮一亮
      dot(g, SUN17[0] - 20, SUN17[1] + 60, 300, '#fff6d8', 0.16 + 0.26 * pulse, 'screen');
      // 远水上细碎的波光（缓缓流动）
      {
        const spr = tintS('#ffffff'), ga = g.globalAlpha;
        for (let i = 0; i < 10; i++) {
          const u = Math.pow(h2(i, 41), 1.5), yy = HZ + 4 + u * 90, len = (30 + 90 * h2(i, 42)) * (0.4 + u * 1.2);
          const x = ((h2(i, 43) * (W + 300) + t * (6 + 14 * u)) % (W + 300)) - 150;
          g.globalAlpha = ga * 0.32 * (0.5 + 0.5 * Math.sin(t * 1.2 + i * 2.3));
          g.drawImage(spr, x, yy - (1 + u * 2), len, 2 + u * 4);
        }
        g.globalAlpha = ga;
      }
      // 船随拍横摇；挨桨、爬船时晃得厉害
      const kick = (t0, a, d) => (lt > t0 ? a * Math.exp(-(lt - t0) / d) * Math.sin((lt - t0) * 9) : 0);
      const rock = 0.012 * Math.sin(t * 1.4) + kick(hit, 0.05, 0.6) + kick(tClimb + 0.2, -0.035, 0.5) + 0.006 * c.de(0.5);
      // 船底的暗影与倒影
      g.fillStyle = 'rgba(14,60,50,0.28)'; g.beginPath(); g.ellipse(BX, BY + 12, BL * 0.56, 11, 0, 0, TAU); g.fill();
      { const sr = skiffRefl(); g.drawImage(sr, Math.round(BX - (BL / 2 + 60)), BY + 9 + Math.round(rock * 40), sr.lw, sr.lh); }
      skiff(g, rock, 1);
      // 船上的人画进缓冲；「〔第17句第9–11字〕」时三道擦笔自上而下扫过，剪影化成留白再晕散
      const e0 = ct[8], eEnd = ct[10] + 0.34;
      const D = devBox(g, [536, 196, 1160, BY + 16]);
      let crew = null;
      if (D.w > 2 && D.h > 2 && lt < ct[10] + 1.6) {
        const live = lt < e0 + 2.25;   // 留白晕完以后船上就空了，不必再画人
        const P = scratch('g06crew', live ? D.w : 2, live ? D.h : 2), q = P.q;
        const M = [D.m.a, D.m.b, D.m.c, D.m.d, D.m.e - D.X0, D.m.f - D.Y0];
        q.setTransform(...M);
        if (live) {
          if (lt < e0 - 0.04) crew = boatCrew(q, c, ct, rock);
          else {
            const FZ = crewFrozen(c, ct, e0 - 0.04), pv = BY - 16;
            q.translate(BX, pv); q.rotate(rock); q.translate(-BX, -pv);
            q.drawImage(FZ, 530, 190, FZ.lw, FZ.lh);
            q.setTransform(...M);
            crew = FZ.info || null;
          }
        }
        const prog = [0, 1, 2].map((k) => easeInOut(seg(lt, ct[8 + k] - 0.04, ct[8 + k] + 0.3)));
        const erasing = lt > e0 - 0.04, age = lt - e0;
        const strokes = (qq) => { qq.fillStyle = '#000'; qq.beginPath(); for (let k = 0; k < 3; k++) if (prog[k] > 0) strokePath(qq, k, prog[k], true); qq.fill(); };
        let Gh = null, kq = 0;
        if (erasing && live) {
          // 留白：被笔扫过的剪影换成宣纸色，画在小缓冲里（放大回去就是现成的晕染），越往后越糊
          kq = lerp(0.34, 0.09, smooth(seg(age, 0.1, 1.6)));
          const gw = Math.max(2, Math.ceil(D.w * kq)), gh = Math.max(2, Math.ceil(D.h * kq));
          Gh = scratch('g06ghost', gw, gh);
          Gh.q.drawImage(P.cv, 0, 0, D.w, D.h, 0, 0, gw, gh);
          Gh.q.globalCompositeOperation = 'source-in'; Gh.q.fillStyle = PAPER; Gh.q.fillRect(0, 0, gw, gh);
          Gh.q.globalCompositeOperation = 'destination-in';
          Gh.q.setTransform(M[0] * gw / D.w, M[1] * gh / D.h, M[2] * gw / D.w, M[3] * gh / D.h, M[4] * gw / D.w, M[5] * gh / D.h);
          strokes(Gh.q);
          Gh.w = gw; Gh.h = gh;
          // 原剪影在笔下直接抠掉；三笔扫完，没扫到的零星也淡去
          q.globalCompositeOperation = 'destination-out'; strokes(q);
          const rest = 1 - smooth(seg(lt, eEnd, eEnd + 0.4));
          if (rest < 1) { q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'destination-in'; q.fillStyle = rgba('#000000', rest); q.fillRect(0, 0, D.w, D.h); }
          q.globalCompositeOperation = 'source-over';
        }
        // 人影倒在水里：只取脚下那一截翻下去，淡淡的
        const wy = D.m.d * (BY + 9) + D.m.f, rh = Math.min(D.h, Math.round(110 * D.m.d));
        const crewA = live && !(erasing && lt > eEnd + 0.4);
        if (crewA) { g.save(); g.setTransform(1, 0, 0, -1, 0, 2 * wy); g.globalAlpha = 0.16; g.drawImage(P.cv, 0, D.h - rh, D.w, rh, D.X0, D.Y0 + D.h - rh, D.w, rh); g.restore(); }
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        if (crewA) g.drawImage(P.cv, 0, 0, D.w, D.h, D.X0, D.Y0, D.w, D.h);
        if (Gh) {
          const ga = 1 - smooth(seg(age, 0.5, 2.2));
          if (ga > 0.01) {
            const grow = 1 + 0.08 * smooth(seg(age, 0.2, 1.6));
            g.globalAlpha = ga;
            g.drawImage(Gh.cv, 0, 0, Gh.w, Gh.h, D.X0 - D.w * (grow - 1) / 2, D.Y0 - D.h * (grow - 1) / 2 - 10 * (grow - 1) * 12, D.w * grow, D.h * grow);
          }
        }
        g.restore();
        // 笔本身：宣纸色的大笔，毛边、飞白，扫完后慢慢化进水色里；船舷以下不着色
        if (erasing && lt < ct[10] + 1.6) {
          for (let k = 0; k < 3; k++) {
            if (prog[k] <= 0) continue;
            const done = lt - (ct[8 + k] + 0.3), al = 0.96 * (1 - smooth(seg(done, 0.18, 1.25)));
            if (al <= 0.01) continue;
            g.globalAlpha = al; g.fillStyle = PAPER;
            g.beginPath(); strokePath(g, k, prog[k], true); strokeDry(g, k, prog[k]); g.fill('evenodd');
          }
          g.globalAlpha = 1;
          // 笔锋处一点水光
          for (let k = 0; k < 3; k++) if (prog[k] > 0 && prog[k] < 1) {
            const xx = lerp(STK.xa, STK.xb, prog[k]), yy = STK.cy[k] - (xx - 844) * STK.slant;
            dot(g, xx, yy, 70, '#ffffff', 0.55, 'screen');
          }
        }
        // 留白化开时飘起几点宣纸屑
        if (lt > e0) {
          g.fillStyle = PAPER;
          for (let i = 0; i < 18; i++) {
            const t0 = e0 + h2(i, 51) * (eEnd - e0), a2 = lt - t0;
            if (a2 < 0 || a2 > 1.8) continue;
            const x = 600 + h2(i, 52) * 480 + Math.sin(a2 * 2 + i) * 10, y = 300 + h2(i, 53) * 150 - a2 * (30 + 30 * h2(i, 54));
            g.globalAlpha = 0.9 * (1 - a2 / 1.8);
            g.beginPath(); g.ellipse(x, y, 2.4 + 2 * h2(i, 55), 1.3, a2 * 2 + i, 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
        }
      }
      // 剑光：酒剑仙每字一道金弧，逍遥学着划一道细弱的青白弧
      if (crew && crew.jj.k >= 0 && lt < e0 + 0.5) {
        const J = crew.jj, p = J.p, tip = p.swordTip || p.gourdMouth || p.handN, sh = p.shoulderN;
        const R = Math.hypot(tip[0] - sh[0], tip[1] - sh[1]) + 10, a1 = Math.atan2(tip[1] - sh[1], tip[0] - sh[0]);
        qiArc(g, sh[0], sh[1], R, a1, [-1, 1, -1, 1][J.k], lt - ct[4 + J.k], '#fff6d0', '#f0c239', 3.4);
        if (lt - ct[4 + J.k] < 0.25 && p.swordTip) dot(g, p.swordTip[0], p.swordTip[1], 40, '#fff2b0', 0.9 * (1 - (lt - ct[4 + J.k]) / 0.25), 'screen');
      }
      if (crew && crew.xy && lt < e0 + 0.3) {
        const X = crew.xy, p = F.points('xiaoyao', X.x, X.y, X.s, t, X.o), tip = p.swordTip || p.handN, sh = p.shoulderN;
        const R = Math.hypot(tip[0] - sh[0], tip[1] - sh[1]) + 6, a1 = Math.atan2(tip[1] - sh[1], tip[0] - sh[0]);
        qiArc(g, sh[0], sh[1], R * 0.9, a1, [-1, 1, -1, 1][X.k], lt - X.t0, '#f2fbff', '#9ad8e8', 1.6);
      }
      // 落水：被一桨拍飞，高高翻一个半跟头扎进湖里
      if (lt >= hit && lt < inW + 0.06) {
        const u = seg(lt, hit, inW), x = lerp(X17.xy, SPL[0], u), base = lerp(deck17(X17.xy, 0), SPL[1] + 20, u * u);
        const y = base - 150 * 4 * u * (1 - u) - 30 * u;
        const cy = y - 70 * FS;
        g.save();
        if (u > 0.82) { g.beginPath(); g.rect(-200, -200, W + 400, SPL[1] + 200); g.clip(); }
        g.translate(x, cy); g.rotate(0.5 + u * 3 * PI); g.translate(-x, -cy);
        F.draw(g, 'xiaoyao', x, y, FS, t, { pose: 'fall', facing: 1, wind: 1, seed: 1, light: LIGHT17 });
        g.restore();
        if (lt - hit < 0.3 && crew) {
          const ia = 1 - (lt - hit) / 0.3, [ix, iy] = crew.oarHit;
          g.strokeStyle = rgba('#ffffff', 0.95 * ia); g.lineWidth = 2.4; g.lineCap = 'round';
          g.beginPath();
          for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU + 0.3, r0 = 10 + 16 * (1 - ia), r1 = r0 + 12 + 10 * h2(k, 9); g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); g.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); }
          g.stroke();
          sparkle(g, ix, iy, 20 * (0.6 + 0.4 * ia), ia);
        }
      }
      // 水里冒头：先喷一道水，再两手乱扑腾
      if (lt >= up - 0.1 && lt < tClimb + 0.44) {
        const bob = Math.sin((lt - up) * 6) * 3, rise = easeOut(seg(lt, up - 0.1, up + 0.25));
        const climb = smooth(seg(lt, tClimb, tClimb + 0.44));
        const x = lerp(SPL[0] - 6, X17.xyBack, climb), wl = lerp(SPL[1], BY + 8, climb);
        const y = lerp(SPL[1] + 150 - rise * 96 + bob, deck17(x, 0), climb);
        const flail = lt < tClimb ? (lt > up + 0.55 ? 'summon' : 'reach') : 'kneel';
        g.save(); g.beginPath(); g.rect(800, 180, 420, wl - 180); g.clip();
        const o = { pose: flail, facing: -1, wind: 0.2, seed: 1, light: LIGHT17, prop: 'none', head: flail === 'summon' ? 0.15 * Math.sin(lt * 9) : 0, lean: climb > 0 ? 0.35 : 0 };
        F.draw(g, 'xiaoyao', x, y, FS, t, o);
        const p = F.points('xiaoyao', x, y, FS, t, o);
        g.restore();
        // 喷水：一道弧线水柱
        const sp = seg(lt, up + 0.12, up + 0.6);
        if (sp > 0 && sp < 1) {
          for (let i = 0; i < 26; i++) {
            const u = i / 26 * Math.min(1, sp * 1.6), age2 = u * 0.5;
            const px = p.mouth[0] - 8 - age2 * 240, py = p.mouth[1] - age2 * 300 + 0.5 * 1400 * age2 * age2;
            const a = (1 - sp) * (0.5 + 0.5 * h2(i, 3));
            g.fillStyle = rgba('#f4fcff', a); g.beginPath(); g.arc(px + (h2(i, 4) - 0.5) * 4, py, 1.6 + 2.4 * h2(i, 5), 0, TAU); g.fill();
          }
        }
        // 扑腾：每拍两手各拍起一小簇水花
        if (lt > up + 0.5 && lt < tClimb) {
          const b0 = c.b.since, sideX = Math.floor(c.b.i) % 2 ? p.handN[0] : p.handF[0];
          splash(g, sideX, SPL[1] - 2, b0, 0.5, 13 + (Math.floor(c.b.i) % 5), 24);
        }
      }
      E.ripples(g, { x: SPL[0], y: SPL[1], t: lt, t0: [inW, up, up + 0.9, tClimb], scale: 2.0, color: '#ffffff', alpha: 0.7, life: 2.4, rings: 4 });
      splash(g, SPL[0], SPL[1], lt - inW, 1.8, 5, 90);
      // 落水处附近的浮叶：被浪推开、乱摇，慢慢平复
      for (const [x0, y0, s, sd] of PADS17) {
        const d = Math.hypot(x0 - SPL[0], (y0 - SPL[1]) * 1.9) || 1, age = lt - inW;
        const hitK = age > 0 ? Math.exp(-age / 0.9) * Math.max(0, 1.3 - d / 260) : 0;
        const push = age > 0 ? (1 - Math.exp(-age * 3)) * 26 * Math.max(0, 1.2 - d / 300) : 0;
        const dx = (x0 - SPL[0]) / d, dy = (y0 - SPL[1]) / d;
        const x = x0 + dx * push, y = y0 + dy * push * 0.5 + Math.sin(t * 1.6 + sd * 2) * 1.5 + hitK * 8 * Math.sin(age * 11 + sd);
        const tilt = 0.04 * Math.sin(t * 1.3 + sd) + hitK * 0.32 * Math.sin(age * 9 + sd * 1.7);
        const img = padTex(sd, sd % 2 ? '#3a9466' : '#2f8a5e');
        g.save(); g.translate(x, y); g.rotate(tilt); g.scale(sd % 2 ? -1 : 1, 1 + hitK * 0.25 * Math.sin(age * 13));
        g.drawImage(img, -100 * s, -35 * s, 200 * s, 70 * s); g.restore();
      }
      // 「空」：一片荷瓣从高处飘下，落在船前的开阔水面上，一圈圈涟漪
      const pt = ct[10], fallU = seg(lt, pt - 1.3, pt);
      if (lt > pt - 1.3 && lt < pt + 0.04) {
        const px = lerp(690, PET17[0], fallU) + Math.sin(lt * 3.6) * 26 * (1 - fallU), py = lerp(250, PET17[1], easeIn(fallU) * 0.6 + fallU * 0.4);
        dot(g, px, py, 46, '#ffe8f0', 0.55, 'screen');
        g.save(); g.translate(px, py); g.rotate(Math.sin(lt * 2.6) * 0.8); g.scale(1, 0.45 + 0.55 * Math.abs(Math.cos(lt * 2.2)));
        g.fillStyle = K.lin(g, 0, -28, 0, 28, [[0, '#e8789a'], [0.55, '#f8c8d6'], [1, '#fff6f6']]);
        g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-17, 10, -14, -20, 0, -30); g.bezierCurveTo(14, -20, 17, 10, 0, 30); g.fill();
        g.strokeStyle = 'rgba(200,80,120,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 26); g.lineTo(0, -24); g.stroke();
        g.restore();
      }
      E.ripples(g, { x: PET17[0], y: PET17[1], t: lt, t0: pt, scale: 2.2, color: '#ffffff', alpha: 0.85, life: 3.2, rings: 6 });
      if (lt >= pt) {
        const fl = Math.sin(lt * 2) * 0.8;
        dot(g, PET17[0], PET17[1] - 3, 40, '#fff0f4', 0.45 + 0.25 * bp, 'screen');
        g.save(); g.translate(PET17[0], PET17[1] + fl); g.rotate(0.12);
        g.fillStyle = K.lin(g, -26, 0, 26, 0, [[0, '#f8d0dc'], [0.5, '#fff4f6'], [1, '#e8789a']]);
        g.beginPath(); g.moveTo(-27, 0); g.bezierCurveTo(-10, -9, 12, -8, 27, 0); g.bezierCurveTo(12, 6, -10, 6, -27, 0); g.fill();
        g.restore();
      }
      // 荷花：远小近大，花色深浅不一；落水处附近的被溅得乱摇
      const snap = dv >= 1 && back <= 0 ? (v) => Math.round(v) : (v) => v;
      g.lineCap = 'round';
      for (let i = 0; i < FL17.length; i++) {
        const [x, y, s, op, col, stem] = FL17[i];
        const spr = flowerTex(i, s, op, col);
        const d = Math.hypot(x - SPL[0], (y - SPL[1]) * 2), age = lt - inW;
        const hitK = age > 0 ? Math.exp(-age / 0.7) * Math.max(0, 1 - d / 420) : 0;
        const sw = (6 * Math.sin(t * 0.9 + i * 1.3) + 3 * bp + hitK * 30 * Math.sin(age * 14)) * s, top = y - stem * s;
        g.strokeStyle = '#2a6a4a'; g.lineWidth = 2.6 * s;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sw * 0.2, (y + top) / 2, x + sw, top + 4 * s); g.stroke();
        g.drawImage(spr, snap(x + sw - spr.lw / 2), snap(top - spr.lh + 8 * s), spr.lw, spr.lh);
      }
      // 近处的立叶：被风一阵阵压斜
      for (const [x, y, r, stem, k] of SL17) {
        const spr = standLeafTex(k, r, stem), sk = 0.07 * Math.sin(t * 1.1 + k * 2) + 0.05 * noise1(t * 0.7 + k, 9) + 0.02 * bp;
        g.save(); g.translate(x, y); g.transform(1, 0, -sk, 1, 0, 0); g.rotate(sk * 0.3);
        g.drawImage(spr, -spr.lw / 2, -(spr.lh - 2), spr.lw, spr.lh);
        g.restore();
      }
      // 蜻蜓、水面碎金（集中在日头下方，随拍闪）
      dragonfly(g, t, 3, 470, 400, 0.95);
      dragonfly(g, t + 7, 11, 1150, 430, 0.8);
      for (let i = 0; i < 40; i++) {
        const sunCol = i < 24, u = Math.pow(h2(i, 32), 1.3);
        const x = sunCol ? 1000 + h2(i, 31) * 300 + Math.sin(t * 0.7 + i) * 10 : (h2(i, 31) * (W + 100) + t * 6) % (W + 100) - 50;
        const y = HZ + 8 + u * 300;
        const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (2 + 3 * h2(i, 33)) + i * 1.7), 8);
        sparkle(g, x, y, (8 + 14 * h2(i, 34)) * (0.4 + 0.8 * u) * (0.75 + 0.45 * bp), tw * (0.55 + 0.45 * bp));
      }
      g.restore();
      // 开场：白闪里冲出云层
      if (lt < 0.5) {
        diveClouds(g, c, clamp(lt / 0.45));
        const va = 1 - smooth(clamp(lt / 0.2));
        if (va > 0) { g.fillStyle = rgba('#ffffff', va); g.fillRect(-10, -10, W + 20, H + 20); }
      }
    },
  });

  // =====================================================================
  // 第18句 万剑梦碎：〔第18句第1–4字〕｜〔第18句第5–8字〕｜〔第18句第9–11字〕
  // =====================================================================
  const T18 = [0.31, 0.57, 0.97, 1.49, 2.01, 2.53, 2.91, 3.51, 3.85, 4.33, 4.71];
  const HX = 600, HY = 568;           // 逍遥脚下（脚踩一朵云）
  const FC = [584, 456];              // 剑阵中心（他背后）
  const TGT = [990, 300];             // 剑尖所指：罗刹鬼婆
  const DEM = [1012, 238];            // 鬼婆的头
  const ROWS = [[372, 19], [302, 16], [234, 13], [168, 10]]; // 由外到内 [半径, 柄数]
  function swordList() {
    const out = [];
    ROWS.forEach(([R, n], row) => {
      for (let i = 0; i < n; i++) {
        const ra = lerp(-PI * 0.95, -PI * 0.05, i / (n - 1)) + (row % 2) * 0.05;
        const x = FC[0] + Math.cos(ra) * R, y = FC[1] + Math.sin(ra) * R * 0.86;
        if (x < 370 && y < 560) continue;   // 歌词栏里不放剑
        out.push({ row, i, ra, x, y, aim: Math.atan2(TGT[1] - y, TGT[0] - x), k: out.length });
      }
    });
    return out;
  }
  const SWORDS = swordList();
  // 梦境底图：金碧青绿——深蓝天、金边积云、金色勾边的石峰、云海
  function bg18() {
    return K.cache('g06|bg18c', W + 80, H + 40, 1, (q) => {
      q.translate(40, 20);
      E.sky(q, { top: '#215a8e', mid: '#6ab8cc', bottom: '#f8eccc', y0: -20, y1: 600, midAt: 0.55 });
      A.glow(q, FC[0] + 40, FC[1] - 60, 460, '#fff0c0', 0.42);
      E.clouds(q, { t: 0, y: 150, color: '#fff4d2', shade: '#6f9cc0', alpha: 0.9, n: 4, seed: 31, speed: 0, scale: 0.95, style: 'cumulus', lightX: 640, spread: 80 });
      E.mountains(q, { t: 0, lightDir: 1, layers: [
        { kind: 'karst', color: '#5e9db0', light: '#fae4a0', litA: 0.6, y: 574, scaleY: 0.72, speed: 0, seed: 4, rim: '#ffd970', rimA: 0.8, fog: '#e8f2ee', fogA: 0.45 },
        { kind: 'karst', color: '#2c7a78', light: '#f0c84c', litA: 0.72, y: 616, scaleY: 0.9, speed: 0, seed: 9, rim: '#ffd060', rimA: 0.95, fog: '#e0eee8', fogA: 0.28 },
      ] });
      E.cloudSea(q, { t: 0, y: 584, color: '#fff8e4', shade: '#8ab2cc', far: '#eef2e8', rows: 4, speed: 0, seed: 3, lightX: 640 });
    });
  }
  // 脚下的一朵祥云（受金光）
  function nimbusTex() {
    return K.cache('g06|nimbus', 300, 110, 1, (q) => {
      const P = [[60, 70, 34], [104, 56, 42], [150, 50, 48], [200, 58, 42], [240, 72, 32], [128, 80, 40], [182, 82, 38]];
      for (const [x, y, r] of P) A.softBlob(q, x, y, r * 1.5, 0.35, '#ffffff');
      q.fillStyle = K.lin(q, 0, 10, 0, 100, [[0, '#fffbea'], [0.6, '#e8f2f4'], [1, '#b8d4e0']]);
      q.beginPath(); for (const [x, y, r] of P) { q.moveTo(x + r, y); q.arc(x, y, r, 0, TAU); } q.fill();
      q.strokeStyle = 'rgba(240,196,80,0.8)'; q.lineWidth = 2;
      q.beginPath(); for (const [x, y, r] of P.slice(0, 5)) q.arc(x, y, r, PI * 1.1, PI * 1.9); q.stroke();
      q.globalCompositeOperation = 'destination-out';
      q.fillStyle = K.lin(q, 0, 70, 0, 110, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]); q.fillRect(0, 70, 300, 40);
    });
  }
  // 尖细的发丝/手臂：沿点列画一条两头可不等宽的带子
  function taper(g, pts, w0, w1, noFill) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (n - 1)) / 2;
      L.push([p[0] - (dy / l) * w, p[1] + (dx / l) * w]); R.push([p[0] + (dy / l) * w, p[1] - (dx / l) * w]);
    }
    if (!noFill) g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    if (!noFill) g.fill();
    return L;
  }
  // 两节骨的手臂：肩 S、手 H，返回肘的位置（bend 决定肘往哪边弯）
  function ik2(S, Hp, L1, L2, bend) {
    let dx = Hp[0] - S[0], dy = Hp[1] - S[1], d = Math.hypot(dx, dy) || 1;
    const dd = Math.min(d, (L1 + L2) * 0.995), a = Math.atan2(dy, dx);
    const c = clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1), b = Math.acos(c) * bend;
    return [S[0] + Math.cos(a + b) * L1, S[1] + Math.sin(a + b) * L1];
  }
  // 罗刹鬼婆的墨云身形：佝偻的肩背、破烂的长袍化成往右下翻卷的墨烟；烘成柔边贴图（造图时模糊一次）
  function demonBody() {
    return K.cache('g06|demonBody2', 620, 660, 0.5, (q) => {
      q.translate(250, 130);
      const INK = '#161823';
      try { q.filter = `blur(${7 * (XYT.sprites.S || 1) * 0.5}px)`; } catch (e) { /* 无滤镜时边缘略硬 */ }
      // 外层淡墨：往右下拖开的烟尾
      for (const [bx, by, r, sd, al] of [[200, 440, 150, 7, 0.22], [250, 330, 120, 8, 0.25], [130, 400, 160, 6, 0.32], [60, 300, 130, 9, 0.5]]) { q.fillStyle = rgba(INK, al); A.inkBlob(q, bx, by, r, sd * 7, 0.42); q.fill(); }
      // 佝偻的肩背与长袍
      for (const [bx, by, r, sd, al] of [[40, 210, 112, 1, 0.85], [70, 130, 96, 2, 0.95], [10, 90, 70, 3, 1], [-10, 150, 74, 4, 0.9], [100, 70, 80, 5, 0.85]]) { q.fillStyle = rgba(INK, al); A.inkBlob(q, bx, by, r, sd * 7, 0.3); q.fill(); }
      q.filter = 'none';
      // 袍下摆撕成一缕缕的墨
      q.fillStyle = rgba(INK, 0.55);
      for (let i = 0; i < 9; i++) {
        const x0 = -40 + i * 26, pts = [];
        for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push([x0 + u * (60 + 30 * h2(i, 3)) + Math.sin(u * 5 + i) * 10, 250 + u * (200 + 120 * h2(i, 4))]); }
        taper(q, pts, 22 - (i % 3) * 5, 0.6);
      }
      // 里头一层浓墨、一点青冷的幽光
      q.fillStyle = rgba('#0b0c12', 0.8); A.inkBlob(q, 30, 150, 64, 11, 0.3); q.fill();
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = K.rad(q, -30, 110, 4, 170, [[0, 'rgba(100,210,200,0.2)'], [1, 'rgba(100,210,200,0)']]); q.fillRect(-250, -130, 620, 660);
    });
  }
  // 罗刹鬼婆：低垂向前的侧脸（朝左）、往右上翻飞的大片长发、两只肘弯的利爪手臂、破袖、墨缕
  // reach 0..1 近手扑向 (tx, ty)；spread 0..1 爪张开；glowK 爪上的冷光
  function rakshasa(g, x, y, s, t, reach, tx, ty, spread, glowK) {
    const INK = '#161823';
    // 长发：从头顶往右上、右边一大片翻飞，发梢卷曲
    for (let i = 0; i < 20; i++) {
      const pts = [], len = (300 + 260 * h2(i, 71)) * s, a0 = -2.5 + i * 0.13, lift = (h2(i, 73) - 0.35) * 260 * s;
      for (let k = 0; k <= 16; k++) {
        const u = k / 16, wv = Math.sin(t * 2.2 - u * 6 + i * 0.9) * 30 * u * s;
        const px = x + 10 * s + Math.cos(a0) * 34 * s * (1 - u) + u * len;
        const py = y - 22 * s + Math.sin(a0) * 40 * s * (1 - u) - u * lift + wv + u * u * 90 * s + Math.sin(u * 4 + i) * 16 * u * s;
        pts.push([px, py]);
      }
      g.fillStyle = rgba(INK, 0.5 + 0.5 * h2(i, 72));
      taper(g, pts, (14 - (i % 5) * 2) * s, 0.6);
    }
    // 墨云身形（缓缓起伏）
    const body = demonBody(), br = 1 + 0.02 * Math.sin(t * 1.3);
    g.drawImage(body, x - 250 * s * br, y - 130 * s, 620 * s * br, 660 * s);
    // 边缘散开的墨缕
    for (let i = 0; i < 7; i++) {
      const u = (t * 0.35 + h2(i, 61)) % 1, side = i % 2 ? 1 : -1;
      const bx = x + (side > 0 ? 120 + 80 * h2(i, 62) : -60 - 40 * h2(i, 62)) * s, by = y + (180 + 260 * h2(i, 63)) * s - u * 120 * s;
      const pts = [];
      for (let k = 0; k <= 8; k++) { const v = k / 8; pts.push([bx + side * v * 80 * s + Math.sin(v * 5 + t * 2 + i) * 12 * s, by - v * 46 * s]); }
      g.fillStyle = rgba(INK, 0.5 * Math.sin(PI * u));
      taper(g, pts, 10 * s, 0.4);
    }
    // 侧脸：低头前探，额、鹰钩鼻、凹颊、尖下巴；脸缘一线惨白的冷光
    const face = () => {
      g.beginPath();
      g.moveTo(x + 22 * s, y - 44 * s);
      g.quadraticCurveTo(x - 18 * s, y - 52 * s, x - 34 * s, y - 20 * s);
      g.lineTo(x - 52 * s, y + 2 * s); g.lineTo(x - 38 * s, y + 8 * s);
      g.quadraticCurveTo(x - 34 * s, y + 18 * s, x - 42 * s, y + 30 * s);
      g.quadraticCurveTo(x - 34 * s, y + 50 * s, x - 18 * s, y + 58 * s);
      g.quadraticCurveTo(x + 16 * s, y + 40 * s, x + 30 * s, y - 4 * s); g.closePath();
    };
    g.fillStyle = INK; face(); g.fill();
    g.strokeStyle = rgba('#cfe8e4', 0.55); g.lineWidth = 1.4 * s;
    g.beginPath(); g.moveTo(x - 20 * s, y - 49 * s); g.quadraticCurveTo(x - 30 * s, y - 34 * s, x - 34 * s, y - 20 * s); g.lineTo(x - 52 * s, y + 2 * s); g.stroke();
    g.beginPath(); g.moveTo(x - 42 * s, y + 30 * s); g.quadraticCurveTo(x - 34 * s, y + 50 * s, x - 18 * s, y + 58 * s); g.stroke();
    // 两点冷光
    const ex = x - 22 * s, ey = y - 10 * s, bl = noise1(t * 3, 2) > 0.93 ? 0.25 : 1;
    dot(g, ex, ey, 40 * s, '#7ff6e0', (0.55 + 0.3 * glowK) * bl, 'screen');
    g.fillStyle = rgba('#e8fffa', bl); g.beginPath(); g.ellipse(ex, ey, 9 * s, 2.2 * s, -0.35, 0, TAU); g.fill();
    // 手臂与爪：骨节分明，上臂挂着破袖
    const arm = (S, Hp, bend, sp, k0) => {
      const L1 = 132 * s, L2 = 128 * s, Eb = ik2(S, Hp, L1, L2, bend);
      // 破袖：从肩到肘下挂的几缕
      g.fillStyle = rgba(INK, 0.6);
      for (let j = 0; j < 4; j++) {
        const u0 = 0.25 + j * 0.2, px = lerp(S[0], Eb[0], u0), py = lerp(S[1], Eb[1], u0), pts = [];
        for (let k = 0; k <= 6; k++) { const v = k / 6; pts.push([px + Math.sin(t * 2.5 + j + v * 3) * 8 * s * v + v * 14 * s, py + v * (50 + 20 * j) * s]); }
        taper(g, pts, 16 * s, 1);
      }
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        if (u <= 0.5) { const a = u * 2; pts.push([lerp(S[0], Eb[0], a), lerp(S[1], Eb[1], a)]); }
        else { const a = (u - 0.5) * 2, bow = Math.sin(PI * a) * 8 * s * bend; const dx = Hp[0] - Eb[0], dy = Hp[1] - Eb[1], l = Math.hypot(dx, dy) || 1; pts.push([lerp(Eb[0], Hp[0], a) - (dy / l) * bow, lerp(Eb[1], Hp[1], a) + (dx / l) * bow]); }
      }
      g.fillStyle = INK; const Ledge = taper(g, pts, 34 * s, 9 * s);
      g.beginPath(); g.arc(Eb[0], Eb[1], 11 * s, 0, TAU); g.fill();
      g.strokeStyle = rgba('#a8e0d8', 0.42); g.lineWidth = 1.3 * s;
      g.beginPath(); Ledge.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      // 手掌与五根细长的弯钩利爪
      const an = Math.atan2(Hp[1] - Eb[1], Hp[0] - Eb[0]);
      g.fillStyle = INK; g.beginPath(); g.ellipse(Hp[0], Hp[1], 15 * s, 10 * s, an, 0, TAU); g.fill();
      for (let k = 0; k < 5; k++) {
        const fa = an + (k - 2) * lerp(0.2, 0.5, sp) + 0.08 * Math.sin(t * 6 + k + k0), L1f = (k === 0 ? 24 : 34) * s, L2f = (k === 0 ? 30 : 48) * s;
        const kx = Hp[0] + Math.cos(fa) * L1f, ky = Hp[1] + Math.sin(fa) * L1f;
        taper(g, [[Hp[0], Hp[1]], [lerp(Hp[0], kx, 0.5), lerp(Hp[1], ky, 0.5)], [kx, ky]], 8 * s, 4.5 * s);
        g.beginPath(); g.arc(kx, ky, 3 * s, 0, TAU); g.fill();
        const cl = [], hook = (k - 2 >= 0 ? 1 : -1) * lerp(0.9, 0.5, sp);
        for (let j = 0; j <= 8; j++) { const u = j / 8, aa = fa + (0.15 + 0.95 * u * u) * hook; cl.push([kx + Math.cos(aa) * L2f * u, ky + Math.sin(aa) * L2f * u]); }
        taper(g, cl, 5 * s, 0.5);
        g.strokeStyle = rgba('#eef6f0', 0.85); g.lineWidth = 1.2 * s;
        g.beginPath(); for (let j = 4; j <= 8; j++) (j === 4 ? g.moveTo : g.lineTo).call(g, cl[j][0], cl[j][1]); g.stroke();
      }
      return Hp;
    };
    // 远侧手臂：高举到头后上方，爪子张着
    const Sf = [x + 40 * s, y + 84 * s], Hf = [x + 70 * s + Math.sin(t * 1.4) * 10 * s, y - 150 * s + Math.cos(t * 1.1) * 10 * s];
    arm(Sf, Hf, 1, 0.55 + 0.45 * spread, 3);
    // 近侧手臂：肘高高支起、爪子往下探着作势；「义」字猛地扑向他
    const Sn = [x - 24 * s, y + 92 * s];
    const idle = [x - 210 * s + Math.sin(t * 1.6) * 12 * s, y + 70 * s + Math.cos(t * 1.3) * 14 * s];
    const Hn = [lerp(idle[0], tx, reach), lerp(idle[1], ty, reach) - Math.sin(PI * reach) * 60 * s];
    const hp = arm(Sn, Hn, -1, spread, 0);
    if (glowK > 0) dot(g, hp[0], hp[1], 120 * s, '#7ff6e0', 0.4 * glowK, 'screen');
    return hp;
  }
  // 卧房（近景）：粉墙、梁柱、格子窗（窗纸透着晨光、映出桃枝）、右边的床、木地板；左栏只留浅色的墙与纱
  const WIN18 = [770, 56, 440, 300];
  function room18() {
    return K.cache('g06|room18c', W + 80, H + 40, 1, (q) => {
      q.translate(40, 20);
      const FL = 560;
      // 粉墙：暖白，墨色淡淡晕开
      q.fillStyle = K.lin(q, 0, -20, 0, FL, [[0, '#f0e4ca'], [1, '#e0caa4']]); q.fillRect(-40, -20, W + 80, FL + 20);
      const r = A.rng(181);
      for (let k = 0; k < 16; k++) { q.fillStyle = rgba(k % 3 ? '#c8ac80' : '#a89070', 0.05 + r() * 0.05); A.inkBlob(q, 300 + r() * 1000, r() * 520, 40 + r() * 110, k, 0.5); q.fill(); }
      const pat = q.createPattern(XYT.sprites.paper, 'repeat');
      q.save(); q.globalCompositeOperation = 'multiply'; q.globalAlpha = 0.18; q.fillStyle = pat; q.fillRect(-40, -20, W + 80, H + 40); q.restore();
      // 梁、柱（柱子在歌词栏以右）
      q.fillStyle = K.lin(q, 0, -20, 0, 24, [[0, '#4a3020'], [1, '#6a4630']]); q.fillRect(-40, -20, W + 80, 44);
      q.fillStyle = 'rgba(255,230,190,0.25)'; q.fillRect(-40, 22, W + 80, 2);
      for (const [x, w] of [[352, 34], [1256, 36]]) {
        q.fillStyle = K.lin(q, x - w / 2, 0, x + w / 2, 0, [[0, '#4a2e1c'], [0.4, '#7a5236'], [1, '#3a2416']]); q.fillRect(x - w / 2, 22, w, FL - 22);
      }
      // 窗：格子窗，窗纸透光；窗外的桃枝映在窗纸上
      const [wx, wy, ww, wh] = WIN18;
      q.fillStyle = K.lin(q, 0, wy, 0, wy + wh, [[0, '#fffaea'], [1, '#ffeec4']]); q.fillRect(wx, wy, ww, wh);
      A.glow(q, wx + ww * 0.62, wy + wh * 0.36, 300, '#ffffff', 0.9);
      q.save(); q.beginPath(); q.rect(wx, wy, ww, wh); q.clip();
      q.strokeStyle = 'rgba(120,90,80,0.4)'; q.lineCap = 'round';
      const br = (x0, y0, a, len, w, d) => { const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; q.lineWidth = w; q.beginPath(); q.moveTo(x0, y0); q.lineTo(x1, y1); q.stroke(); if (d > 0) { br(x1, y1, a - 0.5, len * 0.62, w * 0.6, d - 1); br(x1, y1, a + 0.35, len * 0.7, w * 0.65, d - 1); } else for (let k = 0; k < 3; k++) { q.fillStyle = 'rgba(232,140,160,0.5)'; q.beginPath(); q.arc(x1 + (k - 1) * 6, y1 + (k % 2) * 5, 5, 0, TAU); q.fill(); } };
      br(wx + ww + 10, wy + 70, PI + 0.25, 150, 7, 3);
      q.restore();
      q.strokeStyle = '#6a4a30'; q.lineWidth = 12; q.strokeRect(wx, wy, ww, wh);
      q.lineWidth = 3.5;
      for (let k = 1; k < 6; k++) { q.beginPath(); q.moveTo(wx + (k * ww) / 6, wy); q.lineTo(wx + (k * ww) / 6, wy + wh); q.stroke(); }
      for (let k = 1; k < 5; k++) { q.beginPath(); q.moveTo(wx, wy + (k * wh) / 5); q.lineTo(wx + ww, wy + (k * wh) / 5); q.stroke(); }
      q.fillStyle = '#5a3e28'; q.fillRect(wx - 16, wy + wh + 4, ww + 32, 12);
      // 床：右侧，木架、挽起的白纱帐、枕头、空了的床褥
      q.fillStyle = K.lin(q, 0, 300, 0, 640, [[0, '#7a5236'], [1, '#4a2e1c']]);
      q.fillRect(1018, 250, 18, 400); q.fillRect(1018, 250, 300, 16);
      q.fillStyle = 'rgba(255,250,240,0.85)';
      q.beginPath(); q.moveTo(1036, 266); q.quadraticCurveTo(1090, 360, 1050, 470); q.lineTo(1036, 470); q.closePath(); q.fill();
      q.strokeStyle = '#c83c23'; q.lineWidth = 3; q.beginPath(); q.moveTo(1036, 380); q.quadraticCurveTo(1060, 392, 1076, 382); q.stroke();
      q.fillStyle = K.lin(q, 0, 468, 0, 560, [[0, '#8a6040'], [1, '#4a2e1c']]); q.fillRect(1000, 468, 320, 76);
      q.fillStyle = '#f2ece0'; q.beginPath(); q.moveTo(1004, 470); q.quadraticCurveTo(1150, 434, 1320, 450); q.lineTo(1320, 474); q.lineTo(1004, 474); q.closePath(); q.fill();
      q.fillStyle = '#e8dcc0'; q.beginPath(); q.ellipse(1210, 448, 50, 16, -0.05, 0, TAU); q.fill();
      q.fillStyle = '#3a2416'; q.fillRect(1006, 544, 20, 100);
      // 木地板：透视的板缝，窗光落在地上一片
      q.fillStyle = K.lin(q, 0, FL, 0, H + 20, [[0, '#b08a62'], [1, '#7a5636']]); q.fillRect(-40, FL, W + 80, H + 20 - FL);
      q.strokeStyle = 'rgba(70,44,26,0.3)'; q.lineWidth = 1.1;
      for (let k = 0; k < 6; k++) { const yy = FL + 6 + Math.pow(k / 6, 1.6) * 180; q.beginPath(); q.moveTo(-40, yy); q.lineTo(W + 40, yy); q.stroke(); }
      for (let k = -12; k <= 12; k++) { q.beginPath(); q.moveTo(640 + k * 70, FL + 6); q.lineTo(640 + k * 190, H + 20); q.stroke(); }
      q.fillStyle = 'rgba(80,50,30,0.25)'; q.fillRect(-40, FL, W + 80, 6);
      q.globalCompositeOperation = 'screen';
      q.fillStyle = 'rgba(255,236,190,0.42)';
      q.beginPath(); q.moveTo(wx - 140, FL + 8); q.lineTo(wx + ww - 140, FL + 8); q.lineTo(wx + ww - 380, H + 20); q.lineTo(wx - 560, H + 20); q.closePath(); q.fill();
      q.globalCompositeOperation = 'source-over';
      // 地上一双草鞋、一只翻倒的木凳
      q.fillStyle = '#9a7a48'; q.beginPath(); q.ellipse(400, 700, 30, 9, 0.1, 0, TAU); q.fill(); q.beginPath(); q.ellipse(444, 714, 30, 9, -0.15, 0, TAU); q.fill();
      q.save(); q.fillStyle = '#6a4630'; q.translate(1110, 690); q.rotate(-1.25); q.fillRect(-46, -9, 92, 16); q.fillRect(-40, 7, 9, 46); q.fillRect(32, 7, 9, 46); q.restore();
      // 窗里斜射下来的晨光
      q.globalCompositeOperation = 'screen'; q.globalAlpha = 0.66; q.drawImage(roomRays(), 0, 0, W, H); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    });
  }
  // 窗里斜射下来的晨光（烘成柔边贴图）
  function roomRays() {
    return K.cache('g06|roomRays2', W, H, 0.35, (q) => {
      try { q.filter = `blur(${6 * (XYT.sprites.S || 1) * 0.35}px)`; } catch (e) { /* 无滤镜 */ }
      const [wx, wy, ww, wh] = WIN18;
      for (let i = 0; i < 6; i++) {
        const u0 = i / 6 + 0.02, u1 = u0 + 0.11, x0 = wx + ww * u0, x1 = wx + ww * u1;
        const gr = q.createLinearGradient(0, wy + wh, 0, H);
        gr.addColorStop(0, 'rgba(255,240,200,0.8)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
        q.fillStyle = gr;
        q.beginPath(); q.moveTo(x0, wy + 40); q.lineTo(x1, wy + 40); q.lineTo(x1 - 560, H); q.lineTo(x0 - 600, H); q.closePath(); q.fill();
      }
    });
  }
  // 前景一幅轻纱帘（左侧，浅色，衬在歌词后面）
  function gauzeTex() {
    return K.cache('g06|gauze', 360, H + 40, 0.6, (q) => {
      for (let k = 0; k < 7; k++) {
        const x = 20 + k * 44, gr = q.createLinearGradient(x - 30, 0, x + 30, 0);
        gr.addColorStop(0, 'rgba(255,252,244,0)'); gr.addColorStop(0.5, `rgba(255,252,244,${0.32 + 0.12 * (k % 2)})`); gr.addColorStop(1, 'rgba(255,252,244,0)');
        q.fillStyle = gr;
        q.beginPath(); q.moveTo(x - 34, 0); q.bezierCurveTo(x - 20, 240, x - 50, 480, x - 30 + k * 6, H + 40); q.lineTo(x + 40 + k * 6, H + 40); q.bezierCurveTo(x + 10, 480, x + 40, 240, x + 30, 0); q.closePath(); q.fill();
      }
      q.fillStyle = 'rgba(255,252,244,0.35)'; q.fillRect(0, 0, 360, H + 40);
      q.globalCompositeOperation = 'destination-out';
      q.fillStyle = K.lin(q, 200, 0, 360, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]); q.fillRect(200, 0, 160, H + 40);
    });
  }
  // 蓝印花布的被子：像斗篷一样从肩头披下来，盖住后背，在身后地上堆成一团，一角缠在腿上
  function quiltCollar(g, p, s) {
    const sh = p.shoulderN, bk = p.back;
    g.beginPath();
    g.moveTo(sh[0] + 6 * s, sh[1] - 11 * s);
    g.quadraticCurveTo(bk[0] - 4 * s, bk[1] - 20 * s, bk[0] - 22 * s, bk[1] + 10 * s);
    g.quadraticCurveTo(bk[0] - 26 * s, bk[1] + 40 * s, bk[0] - 18 * s, bk[1] + 62 * s);
    g.quadraticCurveTo(bk[0] - 2 * s, bk[1] + 30 * s, sh[0] - 4 * s, sh[1] + 4 * s);
    g.closePath();
    g.fillStyle = K.lin(g, 0, sh[1] - 12 * s, 0, bk[1] + 62 * s, [[0, '#4e80b0'], [1, '#2a527e']]); g.fill();
    g.fillStyle = 'rgba(240,246,250,0.9)';
    for (let k = 0; k < 5; k++) { const px = lerp(bk[0] - 18 * s, sh[0], h2(k, 85)), py = lerp(sh[1], bk[1] + 40 * s, h2(k, 86)); g.beginPath(); g.arc(px, py, 1.8 * s, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(14,26,48,0.6)'; g.lineWidth = 1.2; g.stroke();
  }
  function quiltWrap(g, p, s, t, floor) {
    const sh = p.shoulderN, bk = p.back, pv = p.pelvis, kn = p.kneeN, wa = p.waist;
    const path = () => {
      g.beginPath();
      g.moveTo(sh[0] + 4 * s, sh[1] - 10 * s);
      g.quadraticCurveTo(bk[0] - 4 * s, bk[1] - 20 * s, bk[0] - 22 * s, bk[1] + 10 * s);
      g.bezierCurveTo(bk[0] - 40 * s, pv[1] - 20 * s, pv[0] - 70 * s, floor - 30 * s, pv[0] - 112 * s, floor + 2 * s);
      g.quadraticCurveTo(pv[0] - 60 * s, floor + 12 * s, kn[0] + 8 * s, floor + 6 * s);
      g.quadraticCurveTo(kn[0] + 22 * s, floor - 8 * s, kn[0] + 2 * s, floor - 18 * s);
      g.quadraticCurveTo(pv[0] + 6 * s, floor - 14 * s, wa[0] - 8 * s, wa[1] + 6 * s);
      g.quadraticCurveTo(sh[0] - 8 * s, wa[1] - 30 * s, sh[0] + 4 * s, sh[1] - 10 * s);
      g.closePath();
    };
    path();
    g.fillStyle = K.lin(g, 0, sh[1] - 20 * s, 0, floor, [[0, '#4a7aaa'], [1, '#22446e']]); g.fill();
    g.save(); path(); g.clip();
    // 白色碎花
    g.fillStyle = 'rgba(240,246,250,0.9)';
    for (let k = 0; k < 34; k++) {
      const px = lerp(pv[0] - 120 * s, kn[0] + 20 * s, h2(k, 81)), py = lerp(sh[1] - 20 * s, floor, h2(k, 82));
      for (let j = 0; j < 4; j++) { const a = (j / 4) * TAU + k; g.beginPath(); g.arc(px + Math.cos(a) * 2.4 * s, py + Math.sin(a) * 2.4 * s, 1.4 * s, 0, TAU); g.fill(); }
    }
    // 褶子
    g.strokeStyle = 'rgba(16,30,54,0.5)'; g.lineWidth = 1.5 * s;
    g.beginPath(); g.moveTo(bk[0] - 18 * s, bk[1] + 20 * s); g.quadraticCurveTo(pv[0] - 40 * s, pv[1], pv[0] - 80 * s, floor - 4 * s); g.stroke();
    g.beginPath(); g.moveTo(wa[0] - 4 * s, wa[1] + 10 * s); g.quadraticCurveTo(pv[0] - 10 * s, floor - 20 * s, pv[0] - 30 * s, floor + 4 * s); g.stroke();
    // 窗光从右上打在被头上
    g.fillStyle = 'rgba(255,236,190,0.16)'; g.beginPath(); g.ellipse(sh[0], sh[1] + 16 * s, 16 * s, 34 * s, 0.4, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(14,26,48,0.6)'; g.lineWidth = 1.2; path(); g.stroke();
  }
  // 扫帚：竹柄、扎起的帚头
  function broom(g, x0, y0, x1, y1, s) {
    g.strokeStyle = '#a8844c'; g.lineWidth = 4.5 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = 'rgba(255,240,200,0.5)'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x0 + 1, y0); g.lineTo(x1 + 1, y1); g.stroke();
    const an = Math.atan2(y1 - y0, x1 - x0);
    g.save(); g.translate(x1, y1); g.rotate(an);
    g.fillStyle = K.lin(g, 0, 0, 60 * s, 0, [[0, '#b88a40'], [1, '#e2c070']]);
    g.beginPath(); g.moveTo(-4 * s, -6 * s); g.lineTo(58 * s, -24 * s); g.quadraticCurveTo(68 * s, 0, 58 * s, 24 * s); g.lineTo(-4 * s, 6 * s); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(110,80,30,0.7)'; g.lineWidth = 1;
    for (let k = -5; k <= 5; k++) { g.beginPath(); g.moveTo(2 * s, k * 0.8 * s); g.lineTo(62 * s, k * 4.6 * s); g.stroke(); }
    g.fillStyle = '#c83c23'; g.fillRect(-7 * s, -7 * s, 7 * s, 14 * s);
    g.restore();
  }
  // 琉璃碎片：每柄剑碎成三片尖角，带白边，向外飞；之后化成桃花瓣
  function shardsAndPetals(g, c, age, shake) {
    const pt = V.util.petalTex;
    const m0 = g.getTransform();
    g.lineJoin = 'round';
    for (const s of SWORDS) {
      const d = s.row, ca = Math.cos(s.aim), sa = Math.sin(s.aim);
      for (let j = 0; j < 3; j++) {
        const id = s.k * 3 + j, off = (j - 1) * 30;
        const x0 = s.x + ca * off, y0 = s.y + sa * off + 20;
        let dx = x0 - FC[0], dy = y0 - FC[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const sp = (400 + 500 * h2(id, 91)) * (1.1 - d * 0.08), da = (h2(id, 92) - 0.5) * 0.7;
        const vx = dx * Math.cos(da) - dy * Math.sin(da), vy = dx * Math.sin(da) + dy * Math.cos(da);
        const drag = (1 - Math.exp(-age * 3.2)) / 3.2;
        const x = x0 + vx * sp * drag + Math.sin(c.t * 1.5 + id) * 16 * age + 24 * age;
        const y = y0 + vy * sp * drag + 60 * age * age;
        if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
        const rot = s.aim + age * (4 + 6 * h2(id, 93)) * (h2(id, 94) - 0.5) * 2;
        const m = smooth(seg(age, 0.35, 0.8)), sz = 30 + 30 * h2(id, 95);
        const cs = Math.cos(rot), sn = Math.sin(rot);
        g.setTransform(m0.a * cs + m0.c * sn, m0.b * cs + m0.d * sn, -m0.a * sn + m0.c * cs, -m0.b * sn + m0.d * cs, m0.a * x + m0.c * y + m0.e, m0.b * x + m0.d * y + m0.f);
        if (m < 1) {
          const k = (1 - m) * (1 - 0.4 * m);
          g.globalAlpha = k;
          g.beginPath(); g.moveTo(-sz * 0.5, -sz * 0.18 * k); g.lineTo(sz * 0.5 * k, -sz * 0.06); g.lineTo(-sz * 0.1, sz * 0.3 * k); g.closePath();
          g.fillStyle = 'rgba(255,238,180,0.55)'; g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.5; g.stroke();
        }
        if (m > 0) {
          const ps = (12 + 9 * h2(id, 96)) * (0.6 + 0.4 * m), fl = 0.4 + 0.6 * Math.abs(Math.cos(c.t * 2 + id));
          g.globalAlpha = m;
          g.drawImage(pt('peach', id % 4, false), -ps / 2, -ps * fl / 2, ps, ps * fl);
        }
      }
    }
    g.setTransform(m0); g.globalAlpha = 1;
  }

  XYT.registerShot('c1_swordarray', {
    name: '万剑梦碎', zone: 'left', night: false,
    text: '#1a2026', shadow: 'rgba(243,249,241,0.9)', accent: '#c83c23', bloom: 0.22,
    draw(g, c) {
      const t = c.t, lt = c.lt, ct = chars(c, T18);
      if (lt >= ct[10]) return drawRoom18(g, c, ct);
      if (lt >= ct[7]) return drawFall18(g, c, ct);
      const tCrack = ct[4], tShat = ct[5], tClaw = ct[6], tKnock = ct[6] + 0.1;
      // 手持的轻晃；「断」与挨爪时猛震
      const hk = (t0, d) => (lt > t0 ? Math.exp(-(lt - t0) / d) : 0), k1 = hk(tShat, 0.22), k2 = hk(tKnock, 0.2);
      const sx = (noise1(t * 1.4, 7) - 0.5) * 8 + (k1 * 16 + k2 * 20) * Math.sin(lt * 70), sy = (noise1(t * 1.2, 8) - 0.5) * 6 + (k1 * 12 + k2 * 16) * Math.cos(lt * 63);
      const z = 1.0 + 0.045 * seg(lt, 0, ct[7]);
      g.save();
      g.translate(640 + sx, 400 + sy); g.scale(z, z); g.translate(-640, -400);
      const bg = bg18();
      { const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(bg, -40, -20, bg.lw, bg.lh); g.imageSmoothingEnabled = sm; }
      const pulse = c.be(0.35);
      // 剑阵：开场从他背后一展而开；「〔第18句第1–4字〕」每字一排剑垂下、暗下去；「恩」起裂，「断」碎成琉璃片再化作桃花
      const live = 1 - 0.75 * seg(lt, ct[0], ct[3] + 0.3);
      if (lt < tShat) {
        dot(g, FC[0] + 20, FC[1] - 70, 230, '#fff0b0', 0.4 * live * (0.8 + 0.2 * pulse), 'screen');
        // 光剑直接用矢量画、按排合成一笔填充（旋转的贴图在软件光栅里很慢）
        const back = [HX - 14, HY - 120], ga0 = g.globalAlpha;
        const flashes = [];
        const rows = [[], [], [], []];
        for (const s of SWORDS) {
          const u = easeOut(seg(lt, -0.05 + 0.03 * (3 - s.row) + 0.006 * s.i, 0.24 + 0.03 * (3 - s.row)));
          if (u <= 0) continue;
          const dimT = ct[s.row], d = smooth(seg(lt, dimT - 0.02, dimT + 0.2));
          const jit = lt > tCrack ? (h2(s.k, Math.floor(lt * 30)) - 0.5) * 3 : 0;
          const hover = Math.sin(t * 2 + s.k * 0.7) * 3 * (1 - d);
          const droop = 0.4 * d * (Math.cos(s.aim) >= 0 ? 1 : -1);
          const a = lerp(s.ra, s.aim, u) + droop;
          const x = lerp(back[0], s.x, u) + Math.cos(a) * hover + jit, y = lerp(back[1], s.y, u) + Math.sin(a) * hover + 20 * d;
          rows[s.row].push([x, y, Math.cos(a), Math.sin(a), u]);
          const fl = lt - dimT;
          if (fl > 0 && fl < 0.18) flashes.push([x + Math.cos(a) * 40, y + Math.sin(a) * 40, 1 - fl / 0.18]);
        }
        const SHP = {
          glow2: [[-34, -11], [52, -9], [64, 0], [52, 9], [-34, 11]], glow1: [[-40, -6], [50, -5], [62, 0], [50, 5], [-40, 6]],
          blade: [[-38, -3.4], [44, -2.5], [58, 0], [44, 2.5], [-38, 3.4]], guard: [[-44, -7], [-38, -7], [-38, 7], [-44, 7]],
          hilt: [[-62, -2.2], [-44, -2.2], [-44, 2.2], [-62, 2.2]], tassel: [[-62, 0], [-70, 4], [-74, 11], [-70, 12], [-67, 5], [-61, 1.5]],
        };
        const poly = (list, shp) => { g.beginPath(); for (const [x, y, ca, sa] of list) { shp.forEach(([lx, ly], i) => { const px = x + ca * lx - sa * ly, py = y + sa * lx + ca * ly; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); } };
        for (let r = 0; r < 4; r++) {
          const list = rows[r];
          if (!list.length) continue;
          const d = smooth(seg(lt, ct[r] - 0.02, ct[r] + 0.2)), ua = list.reduce((m, q) => Math.max(m, q[4]), 0);
          g.globalAlpha = ga0 * ua;
          if (d < 1) {
            const k = (1 - d) * (0.8 + 0.2 * pulse), o = g.globalCompositeOperation;
            g.globalCompositeOperation = 'screen';
            g.fillStyle = rgba('#ffd870', 0.16 * k); poly(list, SHP.glow2); g.fill();
            g.fillStyle = rgba('#ffe490', 0.3 * k); poly(list, SHP.glow1); g.fill();
            g.globalCompositeOperation = o;
          }
          g.fillStyle = mix('#f2c43c', '#8a9ca4', d); poly(list, SHP.blade); g.fill();
          g.fillStyle = mix('#b8892c', '#5e6a70', d); poly(list, SHP.guard); g.fill();
          g.fillStyle = mix('#5a3e18', '#3a4248', d); poly(list, SHP.hilt); g.fill();
          g.fillStyle = mix('#c83c23', '#806060', d); poly(list, SHP.tassel); g.fill();
          g.strokeStyle = d < 0.5 ? 'rgba(255,255,248,0.95)' : 'rgba(220,230,236,0.6)'; g.lineWidth = 1;
          g.beginPath(); for (const [x, y, ca, sa] of list) { g.moveTo(x - ca * 36, y - sa * 36); g.lineTo(x + ca * 55, y + sa * 55); } g.stroke();
        }
        g.globalAlpha = ga0;
        for (const [x, y, a] of flashes) sparkle(g, x, y, 10, a);
        // 开阵那一下的金光
        if (lt < 0.4) dot(g, back[0], back[1], 260, '#fff4c0', 0.9 * (1 - seg(lt, 0.05, 0.4)), 'screen');
        // 裂纹：琉璃般的白线从阵心炸开
        if (lt > tCrack) {
          const u = easeOut(seg(lt, tCrack, tCrack + 0.3));
          const path = () => {
            g.beginPath();
            for (let i = 0; i < 16; i++) {
              let a = -PI * 0.95 + (i / 15) * PI * 0.9, r = 70, px = FC[0] + Math.cos(a) * r, py = FC[1] + Math.sin(a) * r * 0.86;
              g.moveTo(px, py);
              for (let k = 0; k < 7; k++) {
                a += (h2(i, k + 40) - 0.5) * 0.32; r += 46 * u;
                px = FC[0] + Math.cos(a) * r; py = FC[1] + Math.sin(a) * r * 0.86; g.lineTo(px, py);
                if (k === 3 && h2(i, 47) < 0.6) { const b = a + (h2(i, 48) - 0.5) * 1.2; g.lineTo(px + Math.cos(b) * 40 * u, py + Math.sin(b) * 40 * u); g.moveTo(px, py); }
              }
            }
          };
          const o = g.globalCompositeOperation;
          g.strokeStyle = 'rgba(214,246,255,0.35)'; g.lineWidth = 3.6; path(); g.stroke();
          g.globalCompositeOperation = o; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.5; path(); g.stroke();
          dot(g, FC[0], FC[1] - 40, 180, '#ffffff', 0.5 * (1 - seg(lt, tCrack, tCrack + 0.35)), 'screen');
        }
      } else {
        const age = lt - tShat;
        shardsAndPetals(g, c, age);
      }
      // 逍遥：开阵举手→「刀」举剑→「钝」刺→「刃」顶住→「乏」手一垂、跪倒；挨一爪后被打飞
      let hx = HX, hy = HY, rot = 0, pose = 'summon', lean = 0, head = 0, prop;
      if (lt >= ct[0]) pose = 'swordUp';
      if (lt >= ct[1]) pose = 'swordPoint';
      if (lt >= ct[2]) { lean = -0.16 * smooth(seg(lt, ct[2], ct[2] + 0.2)); hx -= 10 * smooth(seg(lt, ct[2], ct[2] + 0.3)); head = 0.15; }
      if (lt >= ct[3]) { pose = 'kneel'; prop = 'sword'; lean = 0.1; head = lt > tCrack ? -0.25 * smooth(seg(lt, tCrack, tCrack + 0.3)) : 0.3; hx = HX - 10; }
      if (lt > tKnock) {
        const u = seg(lt, tKnock, ct[7]);
        hx = lerp(HX - 10, HX - 230, easeOut(u)); hy = HY + 300 * u * u - 70 * u; rot = -easeOut(u) * 1.9; pose = 'fall'; prop = undefined; lean = 0; head = 0;
      }
      // 脚下一朵祥云（挨爪时散开）
      const nb = nimbusTex(), na = 1 - seg(lt, tKnock, tKnock + 0.4), bob = Math.sin(t * 1.8) * 3;
      if (na > 0) { const ga = g.globalAlpha, sp2 = 1 + 0.5 * (1 - na); g.globalAlpha = ga * na; g.drawImage(nb, HX - 150 * sp2, HY - 52 + bob, 300 * sp2, 110); g.globalAlpha = ga; }
      g.save(); g.translate(hx, hy - 90); g.rotate(rot); g.translate(-hx, -(hy - 90));
      const ho = { pose, facing: 1, wind: 0.75, seed: 2, prop, lean, head, rim: '#ffe6a0', light: [FC[0] - 80, FC[1] - 140] };
      F.draw(g, 'xiaoyao', hx, hy + bob, 1.05, t, ho);
      const hp = F.points('xiaoyao', hx, hy + bob, 1.05, t, ho);
      g.restore();
      // 「乏」：手中剑崩出缺口，火星四溅
      if (lt > ct[3] - 0.02 && lt < tKnock && hp.swordTip && hp.swordHilt) {
        const mx = lerp(hp.swordHilt[0], hp.swordTip[0], 0.45), my = lerp(hp.swordHilt[1], hp.swordTip[1], 0.45), cf = lt - ct[3];
        g.fillStyle = '#2a3036'; g.beginPath(); g.moveTo(mx + 1, my - 6); g.lineTo(mx + 7, my - 1); g.lineTo(mx + 1, my + 4); g.closePath(); g.fill();
        V.sparks(g, c, { at: ct[3], x: mx + 4, y: my, n: 60, speed: 600, gravity: 800, dur: 0.7, angle: -0.5, spread: 2.6, color: '#ffd06a', hot: '#fffbe8', blend: 'source-over' });
        if (cf > 0 && cf < 0.35) { sparkle(g, mx + 4, my, 40 * (1 - cf / 0.35 * 0.5), 1 - cf / 0.35); dot(g, mx + 4, my, 60, '#fff6d0', 0.8 * (1 - cf / 0.35), 'screen'); }
        if (cf > 0 && cf < 0.6) { const fx = mx + 6 + cf * 260, fy = my - cf * 220 + cf * cf * 500; g.save(); g.translate(fx, fy); g.rotate(cf * 18); g.fillStyle = '#e8eef0'; g.beginPath(); g.moveTo(-4, -3); g.lineTo(5, 0); g.lineTo(-3, 4); g.closePath(); g.fill(); g.restore(); }
      }
      // 鬼婆：右侧墨云，随剑阵暗下而逼近；「义」时一爪扑来
      const lean2 = 30 * seg(lt, ct[0], tClaw);
      const reach = lt < tClaw - 0.12 ? 0 : lt < tKnock ? easeIn(seg(lt, tClaw - 0.12, tKnock)) : 1 - easeOut(seg(lt, tKnock, tKnock + 0.7)) * 0.75;
      const spread = lt < tClaw - 0.12 ? 0.3 + 0.2 * pulse : 1;
      const gk = lt < tClaw - 0.12 ? 0 : 1 - seg(lt, tKnock, tKnock + 0.5);
      rakshasa(g, DEM[0] - lean2 + Math.sin(t * 0.8) * 8, DEM[1] + Math.sin(t * 1.1) * 8, 0.9, t, reach, HX + 40, HY - 130, spread, gk);
      // 爪痕：三道墨痕带冷光，划过他胸前
      const ca = lt - tKnock;
      if (ca > -0.05 && ca < 0.7) {
        const a = 1 - seg(ca, 0.25, 0.7), d = easeOut(seg(ca, -0.05, 0.08));
        for (let k = 0; k < 3; k++) {
          const L = [], R = [], n = 16;
          for (let j = 0; j <= n; j++) {
            const u = (j / n) * d, ang = -0.65 + u * 1.1, rr = 200 + k * 24;
            const px = HX + 130 + Math.cos(ang + PI * 0.75) * rr * 0.9, py = HY - 160 + Math.sin(ang + PI * 0.75) * rr * 0.55 + k * 10;
            const w = (2 + 13 * Math.sin(PI * (j / n))) * (1 - 0.3 * k);
            const nx = Math.cos(ang + PI * 0.75 + PI / 2), ny = Math.sin(ang + PI * 0.75 + PI / 2);
            L.push([px + nx * w / 2, py + ny * w / 2]); R.push([px - nx * w / 2, py - ny * w / 2]);
          }
          g.fillStyle = rgba('#161823', 0.92 * a);
          g.beginPath(); L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); g.fill();
          g.strokeStyle = rgba('#7ff6e0', 0.75 * a); g.lineWidth = 1.4;
          g.beginPath(); L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
        }
        g.fillStyle = rgba('#161823', 0.9 * a);
        for (let i = 0; i < 14; i++) { const r = 2 + 5 * h2(i, 97); g.beginPath(); g.arc(HX - 60 + h2(i, 98) * 220 - ca * 80, HY - 220 + h2(i, 99) * 200 + ca * ca * 300, r, 0, TAU); g.fill(); }
      }
      V.petals(g, c, { kind: 'peach', n: 10, seed: 18, wind: 30, fall: 40 });
      g.restore();
      // 「断」：整幅一白
      if (lt > tShat && lt < tShat + 0.14) { g.fillStyle = rgba('#ffffff', 0.6 * (1 - (lt - tShat) / 0.14)); g.fillRect(-10, -10, W + 20, H + 20); }
    },
  });

  // 坠落：跟拍他翻滚着穿过一层层云，越坠越快，天色由梦里的青金转成晨光，脚下涌上来余杭的屋顶
  const FALL_SKY = [[0, '#215a8e'], [0.3, '#6ab8cc'], [0.55, '#f6eed2'], [0.78, '#f8d4d0'], [1, '#ffe4c0']];
  function drawFall18(g, c, ct) {
    const t = c.t, lt = c.lt, f = lt - ct[7], u = seg(lt, ct[7], ct[10]);
    const scroll = 420 * f + 1300 * Math.pow(f, 2.2);
    const shx = (noise1(t * 6, 3) - 0.5) * (8 + 22 * u), shy = (noise1(t * 5, 4) - 0.5) * (6 + 18 * u);
    g.save();
    g.translate(640 + shx, 360 + shy); g.rotate(0.1 * Math.sin(lt * 2.2) + 0.12 * u); g.scale(1.1 + 0.1 * u, 1.1 + 0.1 * u); g.translate(-640, -360);
    const sy = -clamp(scroll * 0.45, 0, 2400 - H - 300) - 150;
    g.fillStyle = K.lin(g, 0, sy, 0, sy + 2400, FALL_SKY); g.fillRect(-120, -110, W + 240, H + 220);
    // 云往上掠：远的小而慢、近的大而快，都带金边；最近一层从他身前掠过
    const band = (L, b, n, sc, al, spd, seed) => {
      const span = H + 600, y = ((((b * 0.37 + L * 0.19) * span - scroll * spd) % span) + span) % span - 220;
      E.clouds(g, { t: 0, y, color: '#fff8e8', shade: L === 2 ? '#c8dcea' : '#8fb6d4', alpha: al, n, seed, speed: 0, scale: sc, style: 'cumulus', spread: 60, lightX: 640 });
    };
    for (let b = 0; b < 3; b++) band(0, b, 3, 0.55, 0.7, 0.5, 60 + b);
    for (let b = 0; b < 3; b++) band(1, b, 2, 1.0, 0.85, 1.05, 70 + b);
    // 速度线
    g.strokeStyle = rgba('#ffffff', 0.5); g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < 30; i++) {
      const x = h2(i, 25) * W, L = 50 + (200 + 500 * u) * h2(i, 26), y = ((h2(i, 27) * (H + 300) - scroll * 1.6) % (H + 300) + H + 300) % (H + 300) - 150;
      g.moveTo(x, y); g.lineTo(x, y + L);
    }
    g.stroke();
    // 快醒时脚下涌上来余杭的屋顶
    if (u > 0.35) {
      const k2 = seg(u, 0.35, 1), ty = lerp(H + 320, H - 60, Math.pow(k2, 1.3));
      E.jiangnanTown(g, { t, y: ty, x0: -300, x1: W + 300, scale: 1.5, color: '#efe6d6', roof: '#3a3a46', haze: '#f8e8d8', hazeA: 0.3 * (1 - k2), lit: 0, bank: false, smoke: 0, seed: 7 });
    }
    // 翻滚的他（越来越快）
    const rot = 1.2 + f * (2.2 + 5 * u);
    g.save(); g.translate(640, 380); g.rotate(rot); g.translate(-640, -380);
    F.draw(g, 'xiaoyao', 640, 470, 1.15, t, { pose: 'fall', facing: 1, wind: 1.1, windDir: 1, seed: 2, light: [640, 0] });
    g.restore();
    dot(g, 640, 390, 120, '#fff4d8', 0.3, 'screen');
    // 最近的一层云从他身前一闪而过
    band(2, 0, 1, 1.7, 0.55, 2.3, 80); band(2, 1, 1, 1.5, 0.5, 2.0, 83);
    // 桃花瓣迎面向上掠过
    V.petals(g, c, { kind: 'peach', n: 36, seed: 28, fall: -320 - 700 * u, wind: 10, sway: 30, size: [8, 26] });
    g.restore();
    // 临醒前一点暖白
    if (u > 0.75) { g.fillStyle = rgba('#fff4e0', 0.55 * seg(u, 0.75, 1)); g.fillRect(-10, -10, W + 20, H + 20); }
  }

  // 梦醒：「破」字硬切，咚一声摔在地上，被子裹在身上，怀里抱着扫帚发懵
  function drawRoom18(g, c, ct) {
    const t = c.t, lt = c.lt, age = lt - ct[10];
    const land = clamp(age / 0.12), bump = age > 0.1 && age < 0.6 ? Math.exp(-(age - 0.1) / 0.12) * Math.sin((age - 0.1) * 60) : 0;
    g.save();
    g.translate(bump * 8, Math.abs(bump) * 7);
    const rm = room18();
    { const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(rm, -40, -20, rm.lw, rm.lh); g.imageSmoothingEnabled = sm; }
    // 墙上的「侠」字条幅：被震得在钉子上来回晃，慢慢停
    {
      const sw = age > 0.1 ? 0.32 * Math.exp(-(age - 0.1) / 0.9) * Math.sin((age - 0.1) * 6.5) : 0;
      g.save(); g.translate(560, 74); g.rotate(sw);
      g.strokeStyle = '#6a4a30'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-26, 16); g.lineTo(0, 0); g.lineTo(26, 16); g.stroke();
      g.fillStyle = '#8a6a40'; g.fillRect(-48, 14, 96, 9);
      g.fillStyle = '#f4ecd6'; g.fillRect(-42, 23, 84, 200);
      g.strokeStyle = 'rgba(140,110,70,0.6)'; g.lineWidth = 1.5; g.strokeRect(-37, 28, 74, 190);
      g.fillStyle = '#2a2420'; g.font = '74px ' + XYT.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('侠', 0, 120);
      g.fillStyle = '#8a6a40'; g.fillRect(-48, 222, 96, 10);
      g.fillStyle = '#c83c23'; g.fillRect(16, 186, 13, 13);
      g.restore();
      g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(560, 74, 2.6, 0, TAU); g.fill();
    }
    // 窗光、浮尘
    dot(g, WIN18[0] + WIN18[2] * 0.55, WIN18[1] + WIN18[3] * 0.5, 230, '#fff6dc', 0.14 * c.be(0.5), 'screen');
    V.dust(g, c, { n: 36, light: { x: 990, y: 110, angle: 2.25, spread: 0.36, len: 760, start: 0.1 }, color: '#fff6dc', alpha: 0.85, blend: 'screen', seed: 4 });
    // 他：从半空砸下，坐在地上发懵；接下来两拍摇摇头
    const s = 2.2, X = 610, Y = 648 - (1 - land) * 130;
    let shake = 0;
    for (const bt of [ct[10] + 0.83, ct[10] + 1.66]) { const d = lt - bt; if (d > 0 && d < 0.7) shake += 0.26 * Math.sin(d * 22) * (1 - d / 0.7); }
    const sq = age > 0.1 && age < 0.3 ? 1 - 0.1 * Math.sin(seg(age, 0.1, 0.3) * PI) : 1;
    g.save(); g.translate(X, 648); g.scale(1 / sq, sq); g.translate(-X, -648);
    const o = { stage: 'youth', pose: 'sit', facing: 1, wind: 0.08, seed: 4, head: 0.22 + shake + 0.04 * Math.sin(t * 1.3), lean: 0.06, rim: '#fff0c8', light: [990, 100], rimAlpha: 0.9 };
    const p = F.points('xiaoyao', X, Y, s, t, o);
    quiltWrap(g, p, s, t, Y);
    F.draw(g, 'xiaoyao', X, Y, s, t, o);
    quiltCollar(g, p, s);
    // 扫帚斜靠在肩上，像抱着一把剑；帚头在脸旁
    broom(g, p.kneeN[0] + 34 * s, Y - 2, p.head[0] + 14 * s, p.head[1] - 34 * s, s * 0.9);
    g.restore();
    // 眼冒金星：几点碎金绕着头转
    const dz = seg(age, 0.15, 0.4) * (1 - seg(age, 1.3, 1.8));
    if (dz > 0) for (let k = 0; k < 4; k++) { const a = age * 7 + (k / 4) * TAU; sparkle(g, p.head[0] + Math.cos(a) * 46, p.head[1] - 46 + Math.sin(a) * 12, 7 + 3 * Math.sin(a * 2), dz * (0.6 + 0.4 * Math.sin(a))); }
    // 一片桃瓣落下来，在他头上弹一下
    {
      const t0 = 0.3, th = 0.85, a2 = age - t0;
      if (a2 > 0 && a2 < 2.4) {
        let px, py;
        if (age < th) { const u2 = a2 / (th - t0); px = p.head[0] - 30 + 30 * u2 + Math.sin(a2 * 6) * 14 * (1 - u2); py = lerp(-30, p.head[1] - 52, u2 * u2 * 0.4 + u2 * 0.6); }
        else { const b2 = age - th; px = p.head[0] + b2 * 110; py = p.head[1] - 52 - 120 * b2 + 260 * b2 * b2; if (py > 652) py = 652; }
        g.save(); g.translate(px, py); g.rotate(age * 3); g.drawImage(V.util.petalTex('peach', 1, false), -10, -10, 20, 20); g.restore();
        if (age > th && age < th + 0.2) sparkle(g, p.head[0], p.head[1] - 54, 9, 1 - (age - th) / 0.2);
      }
    }
    // 落地扬尘
    if (age < 1.6) V.smoke(g, c, { kind: 'puff', at: ct[10] + 0.1, x: X - 20, y: 654, w: 460, n: 8, size: 150, rise: 50, life: 1.5, drift: 34, color: '#ecdcbc', alpha: 0.9 });
    // 梦里的桃瓣还在屋里飘两拍
    const fadeP = 1 - seg(age, 1.0, 1.9);
    if (fadeP > 0) { g.globalAlpha = fadeP; V.petals(g, c, { kind: 'peach', n: 18, seed: 38, fall: 30, wind: 14, size: [8, 20] }); g.globalAlpha = 1; }
    // 前景的轻纱帘（左边，随风轻摆）
    { const gz = gauzeTex(), k = 0.03 * Math.sin(t * 0.9) + 0.06 * Math.exp(-Math.max(0, age - 0.1) / 0.5); g.save(); g.translate(0, -20); g.transform(1, 0, k, 1, 0, 0); g.drawImage(gz, -40, 0, gz.lw, gz.lh); g.restore(); }
    g.restore();
  }

  // =====================================================================
  // 第19句 负骨南行：〔第19句第1–4字〕｜〔第19句第5–8字〕｜〔第19句第9–11字〕
  // =====================================================================
  const T19 = [0.24, 0.62, 1.02, 1.44, 2.26, 2.68, 3.12, 3.52, 3.94, 4.34, 4.88];
  const HZ19 = 430;
  // 古道：从左下斜升到右上的地平线，带一点弯；近宽远窄
  const roadX = (y) => 300 + (H - y) * 2.6 + 30 * Math.sin((H - y) / 110);
  const roadDX = (y) => -2.6 - (30 / 110) * Math.cos((H - y) / 110);
  const roadW = (y) => 2 + 150 * Math.pow(clamp((y - HZ19) / (H - HZ19)), 1.15);
  const depthS = (y) => 2.0 * (y - HZ19) / (H - HZ19);
  // 四季加梯田：天、山、地、路、草色
  const SEAS = [
    { name: 'bare', sky: ['#6f8aa2', '#c4ccd0', '#e4e2d6'], mt: ['#9aa6ae', '#6f7c80', '#e6e0d0'], gr: ['#a8976c', '#4e4632', '#efe0b6'], road: ['#c8b28a', '#6a5a40'], blade: '#5e5236' },
    { name: 'spring', sky: ['#7cb8d8', '#e0eee8', '#f6f2e4'], mt: ['#9cc2c0', '#6f9e8a', '#f6f0d8'], gr: ['#8db06c', '#3c6a3e', '#f2f2c8'], road: ['#d8c49c', '#7a6a48'], blade: '#4a7a3e' },
    { name: 'summer', sky: ['#2f7eaa', '#9cd6dc', '#eef8f0'], mt: ['#5aa49a', '#2c7656', '#e8f0c8'], gr: ['#4f9a5a', '#1d5430', '#e6f4be'], road: ['#d2bf92', '#6a5a3a'], blade: '#1f5a32' },
    { name: 'autumn', sky: ['#6f8cba', '#eccaa0', '#f8e2be'], mt: ['#b09690', '#86665a', '#ffd8a8'], gr: ['#c08e48', '#66401e', '#ffe0a0'], road: ['#dcc49a', '#7a5a38'], blade: '#7a4a1e' },
    { name: 'terrace', sky: ['#2e2648', '#9a5266', '#f4a070'], mt: ['#7a4e5e', '#4e3048', '#ffb070'], gr: ['#8a4a40', '#3e2a34', '#ffc070'], road: ['#b07a58', '#4a2e2a'], blade: '#3e2a34' },
  ];
  // 远景层：天 + 远山（梯田那季的天单独缓存，太阳夹在天与山之间下沉）；春天远坡上一座小亭
  function farTex(k, part) {
    const S = SEAS[k];
    return K.cache('g06|far19b|' + k + part, W + 120, HZ19 + 40, 1, (q) => {
      q.translate(60, 0);
      if (part !== 'mtn') E.sky(q, { top: S.sky[0], mid: S.sky[1], bottom: S.sky[2], y0: 0, y1: HZ19 + 40, midAt: 0.6, haze: S.sky[2], hazeY: HZ19, hazeA: 0.45 });
      if (part === 'sky') return;
      E.mountains(q, { t: 0, lightDir: k === 4 ? 1 : -1, layers: [
        { kind: k === 4 ? 'karst' : 'far', color: S.mt[0], light: S.mt[2], litA: 0.45, y: HZ19 + 4, scaleY: k === 4 ? 0.5 : 0.36, speed: 0, seed: 3 + k, fog: S.sky[2], fogA: 0.45 },
        { kind: 'mid', color: S.mt[1], light: S.mt[2], litA: 0.5, y: HZ19 + 8, scaleY: 0.3, speed: 0, seed: 11 + k, fog: S.sky[2], fogA: 0.3 },
      ] });
      if (k === 1) {
        // 远坡上的小亭，亭边两株桃
        A.pavilion(q, 250, HZ19 - 6, 0.26, '#4a5a56', 0);
        for (const [x, s2] of [[214, 0.16], [292, 0.13]]) E.peachTree(q, { x, y: HZ19 - 4, s: s2, t: 0, seed: 9 });
      }
    });
  }
  // 苗疆梯田：一层层弯弯的田埂，田水映着晚霞；远坡上几座吊脚楼
  function terraces(q) {
    q.fillStyle = K.lin(q, 0, HZ19, 0, H + 40, [[0, '#5a3446'], [1, '#2a1a24']]); q.fillRect(-100, HZ19 - 10, W + 200, H - HZ19 + 60);
    const rows = 14;
    const lineY = (i, x) => {
      const v = i / rows, y = HZ19 + 8 + Math.pow(v, 1.45) * (H - HZ19 + 60), b = 30 + 160 * v * v, R = 220 + 320 * v;
      return y + b * (0.8 * Math.exp(-Math.pow((x - 300) / R, 2)) + Math.exp(-Math.pow((x - 1000) / (R * 1.15), 2))) - b * 0.85 + 5 * Math.sin(x * 0.016 + i * 2.1) * v;
    };
    for (let i = 0; i < rows; i++) {
      const v = i / rows, rice = h2(i, 5) < 0.25;
      q.beginPath();
      for (let x = -100; x <= W + 100; x += 12) q.lineTo(x, lineY(i, x));
      for (let x = W + 100; x >= -100; x -= 12) q.lineTo(x, lineY(i + 1, x) - 1 - 1.5 * v);
      q.closePath();
      const top = Math.min(lineY(i, 300), lineY(i, 1000)) - 20, bot = lineY(i + 1, 700);
      if (rice) q.fillStyle = K.lin(q, 0, top, 0, bot, [[0, '#7a7a3a'], [1, '#3e4a26']]);
      else q.fillStyle = K.lin(q, 0, top, 0, bot, [[0, '#ffd09a'], [0.5, '#f0956a'], [1, '#c8605a']]);
      q.fill();
      if (!rice) {
        // 水里倒映的晚霞与云影
        q.save(); q.clip();
        for (let k = 0; k < 3; k++) { q.fillStyle = rgba('#6a3a62', 0.16); q.beginPath(); q.ellipse(h2(i * 3 + k, 8) * W, (top + bot) / 2 + 8, 140 + 90 * v, 4 + 6 * v, 0, 0, TAU); q.fill(); }
        q.restore();
      } else {
        q.save(); q.clip(); q.strokeStyle = rgba('#2e3a18', 0.5); q.lineWidth = 0.6 + 0.8 * v;
        q.beginPath(); for (let x = -90 + (i % 2) * 7; x < W + 90; x += 9 + 10 * (1 - v)) { const yy = lerp(lineY(i, x), lineY(i + 1, x), 0.6); q.moveTo(x, yy); q.lineTo(x + 1, yy - 3 - 6 * v); } q.stroke();
        q.restore();
      }
      // 田埂：细细一道暗土，下沿一线亮水边
      q.strokeStyle = rgba('#3a2224', 0.75); q.lineWidth = 1 + 2 * v;
      q.beginPath(); for (let x = -100; x <= W + 100; x += 12) q.lineTo(x, lineY(i + 1, x) - 1 - 1.5 * v); q.stroke();
      q.strokeStyle = rgba('#ffe0a8', 0.75); q.lineWidth = 1;
      q.beginPath(); for (let x = -100; x <= W + 100; x += 12) q.lineTo(x, lineY(i + 1, x) - 2.5 - 2.5 * v); q.stroke();
    }
    // 吊脚楼：远坡右侧，大小不一，挑檐、木柱、炊烟
    for (let k = 0; k < 5; k++) {
      const s2 = [0.9, 0.7, 1.1, 0.6, 0.8][k], x = 990 + k * 58 + (k % 2) * 12, y = HZ19 + 10 + k * 4, w = 44 * s2, h = 24 * s2;
      q.fillStyle = '#3a2430';
      for (let j = 0; j < 4; j++) q.fillRect(x - w / 2 + 3 + j * (w - 6) / 3, y, 2, 14 * s2);
      q.fillRect(x - w / 2, y - h, w, h);
      q.beginPath(); q.moveTo(x - w / 2 - 12 * s2, y - h + 2); q.quadraticCurveTo(x - w * 0.3, y - h - 6 * s2, x, y - h - 18 * s2); q.quadraticCurveTo(x + w * 0.3, y - h - 6 * s2, x + w / 2 + 12 * s2, y - h + 2); q.lineTo(x + w / 2 + 14 * s2, y - h - 2); q.lineTo(x, y - h - 21 * s2); q.lineTo(x - w / 2 - 14 * s2, y - h - 2); q.closePath(); q.fill();
      q.fillStyle = rgba('#ffcf80', 0.85); q.fillRect(x - 7 * s2, y - h + 8 * s2, 6 * s2, 7 * s2); q.fillRect(x + 5 * s2, y - h + 8 * s2, 5 * s2, 7 * s2);
    }
  }
  // 近景层：草坡（或梯田）+ 古道（梯田那季是一条沿田埂弯过去的土路）
  function nearTex(k) {
    const S = SEAS[k];
    return K.cache('g06|near19b|' + k, W + 200, H - HZ19 + 60, 1, (q) => {
      q.translate(100, -(HZ19 - 40));
      if (k < 4) E.grassRoad(q, { t: 0, y: HZ19 + 14, color: S.gr[0], dark: S.gr[1], light: S.gr[2], path: false, n: 0, seed: 5 + k, haze: S.sky[2], hazeA: 0.4 });
      else terraces(q);
      if (k === 2) {
        // 夏：一条小溪弯弯地从远处流过草坡，映着天
        q.beginPath();
        const sx = (y) => 900 - (y - HZ19) * 1.7 + 60 * Math.sin((y - HZ19) / 40);
        for (let y = HZ19 + 4; y <= 640; y += 6) q.lineTo(sx(y) - 2 - (y - HZ19) * 0.22, y);
        for (let y = 640; y >= HZ19 + 4; y -= 6) q.lineTo(sx(y) + 2 + (y - HZ19) * 0.22, y);
        q.closePath();
        q.fillStyle = K.lin(q, 0, HZ19, 0, 640, [[0, '#eaf6f2'], [1, '#7cc4d4']]); q.fill();
        q.strokeStyle = 'rgba(255,255,255,0.6)'; q.lineWidth = 1;
        for (let i = 0; i < 18; i++) { const y = HZ19 + 10 + i * 11, x = sx(y); q.beginPath(); q.moveTo(x - 6 - i, y); q.lineTo(x + 4 + i, y + 1); q.stroke(); }
      }
      // 路面
      const dirt = k === 4;
      q.beginPath();
      for (let y = HZ19 + 2; y <= H + 30; y += 6) q.lineTo(roadX(y) - roadW(y) * (dirt ? 0.7 : 1), y);
      for (let y = H + 30; y >= HZ19 + 2; y -= 6) q.lineTo(roadX(y) + roadW(y) * (dirt ? 0.6 : 0.9), y);
      q.closePath();
      q.fillStyle = K.lin(q, 0, HZ19, 0, H, [[0, mix(S.road[0], S.sky[2], 0.4)], [1, S.road[0]]]); q.fill();
      q.save(); q.clip();
      const r = A.rng(190 + k);
      for (let i = 0; i < 260; i++) {
        const y = lerp(HZ19 + 4, H + 20, Math.pow(r(), 0.7)), w = roadW(y), x = roadX(y) + (r() - 0.5) * w * 1.8, sz = 0.6 + depthS(y) * 3;
        q.fillStyle = r() < 0.5 ? rgba(S.road[1], 0.3) : 'rgba(255,248,230,0.3)';
        q.beginPath(); q.ellipse(x, y, sz * 1.6, sz * 0.6, 0, 0, TAU); q.fill();
      }
      if (!dirt) { q.strokeStyle = rgba(S.road[1], 0.3); q.lineWidth = 2; for (const sd of [-0.45, 0.4]) { q.beginPath(); for (let y = HZ19 + 4; y <= H + 20; y += 8) q.lineTo(roadX(y) + roadW(y) * sd, y); q.stroke(); } }
      q.restore();
      // 路边压着的草
      q.lineCap = 'round';
      for (let i = 0; i < 420; i++) {
        const y = lerp(HZ19 + 4, H + 20, Math.pow(r(), 0.8)), sd = r() < 0.5 ? -1 : 0.9, x = roadX(y) + sd * roadW(y) * (0.92 + r() * 0.2) * (dirt ? 0.7 : 1), len = 2 + depthS(y) * 9;
        q.strokeStyle = rgba(r() < 0.5 ? S.gr[1] : S.gr[0], 0.8); q.lineWidth = 0.5 + depthS(y) * 0.7;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x - sd * len * 0.2, y - len * 0.6, x - sd * len * 0.45, y - len); q.stroke();
      }
    });
  }
  // 荒坡上的枯树：水墨笔意，粗细顿挫、带飞白
  function bareTreeTex() {
    return K.cache('g06|bare19b', 560, 560, 1, (q) => {
      const r = A.rng(77);
      q.lineCap = 'round'; q.lineJoin = 'round';
      const br = (x0, y0, a, len, w, d) => {
        let x = x0, y = y0, ang = a;
        const steps = Math.max(3, Math.round(len / 16));
        for (let i = 0; i < steps; i++) {
          const nx = x + Math.cos(ang) * len / steps, ny = y + Math.sin(ang) * len / steps, ww = w * (1 - i / steps * 0.55);
          q.strokeStyle = rgba('#2a2420', 0.85 + 0.15 * r()); q.lineWidth = ww;
          q.beginPath(); q.moveTo(x, y); q.lineTo(nx, ny); q.stroke();
          // 飞白：枝干里几道细白
          if (ww > 4) { q.strokeStyle = rgba('#d8d0c0', 0.35); q.lineWidth = 0.8; q.beginPath(); q.moveTo(x + ww * 0.2, y); q.lineTo(nx + ww * 0.15, ny); q.stroke(); }
          x = nx; y = ny; ang += (r() - 0.5) * 0.5 + 0.06;
          if (d > 0 && r() < 0.35) br(x, y, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), len * (0.4 + r() * 0.25), ww * 0.6, d - 1);
        }
        if (d > 0) { br(x, y, ang - 0.4 - r() * 0.3, len * 0.55, w * 0.42, d - 1); br(x, y, ang + 0.35 + r() * 0.3, len * 0.5, w * 0.4, d - 1); }
      };
      br(270, 552, -PI / 2 - 0.22, 230, 22, 3);
      q.fillStyle = rgba('#2a2420', 0.6); q.beginPath(); q.ellipse(270, 552, 40, 7, 0, 0, TAU); q.fill();
    });
  }
  // 骨灰坛：素白瓷、一圈青花，侧面一抹青灰、深色细描边
  function urn(g, x, y, s) {
    const body = () => { g.beginPath(); g.moveTo(x - 6 * s, y - 20 * s); g.bezierCurveTo(x - 17 * s, y - 14 * s, x - 15 * s, y + 4 * s, x - 9 * s, y + 8 * s); g.lineTo(x + 9 * s, y + 8 * s); g.bezierCurveTo(x + 15 * s, y + 4 * s, x + 17 * s, y - 14 * s, x + 6 * s, y - 20 * s); g.closePath(); };
    body(); g.fillStyle = K.lin(g, x - 14 * s, 0, x + 14 * s, 0, [[0, '#f8f6f0'], [0.45, '#fdfcf8'], [1, '#8a9aa8']]); g.fill();
    g.save(); body(); g.clip();
    g.fillStyle = '#3c62a0'; g.fillRect(x - 16 * s, y - 9 * s, 32 * s, 2.4 * s);
    g.fillStyle = 'rgba(60,98,160,0.5)'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(x + k * 5.5 * s, y - 2 * s, 1.4 * s, 0, TAU); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(40,40,48,0.85)'; g.lineWidth = 1.2; body(); g.stroke();
    g.fillStyle = '#e4e0d6'; g.beginPath(); g.ellipse(x, y - 21 * s, 7 * s, 2.6 * s, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#c8302a'; g.beginPath(); g.arc(x, y - 24 * s, 2.2 * s, 0, TAU); g.fill();
  }
  // 季节的落物（裁在新季那一侧）
  function seasonFx(g, c, k, t) {
    if (k === 0) {
      // 风卷沙尘：几团淡褐的尘烟贴地飘过
      for (let i = 0; i < 6; i++) {
        const u = ((t * 0.22 + h2(i, 11)) % 1), x = -200 + u * (W + 400), y = 470 + h2(i, 12) * 220, r = (90 + 80 * h2(i, 13)) * (0.6 + depthS(y) * 0.4);
        g.save(); g.translate(x, y); g.scale(1.8, 0.45); dot(g, 0, 0, r, '#c8b48c', 0.35 * Math.sin(PI * u), 'source-over'); g.restore();
      }
    } else if (k === 1) V.petals(g, c, { kind: 'peach', n: 40, seed: 19, wind: 50, fall: 46 });
    else if (k === 3) { V.petals(g, c, { kind: 'maple', n: 34, seed: 29, wind: 60, fall: 60 }); V.birds(g, c, { kind: 'v', n: 9, x: 1250, y: 196, dir: -1, speed: 110, size: 0.9, color: '#3a3030' }); }
    else if (k === 2) {
      for (let i = 0; i < 22; i++) {
        const z = 0.3 + 0.7 * h2(i, 23), x = ((h2(i, 21) * (W + 200) + t * (90 + 120 * z)) % (W + 200)) - 100, y = ((h2(i, 22) * (H + 100) + t * (30 + 30 * z)) % (H + 100)) - 50;
        g.save(); g.translate(x, y); g.rotate(t * (1 + h2(i, 24) * 2) + i); g.scale(1, Math.abs(Math.cos(t * 2 + i)) * 0.8 + 0.2);
        g.fillStyle = i % 3 ? '#4f9a5a' : '#8cc070';
        g.beginPath(); g.ellipse(0, 0, 9 * z + 3, 3 * z + 1.2, 0, 0, TAU); g.fill();
        g.restore();
      }
    } else {
      V.dust(g, c, { n: 30, area: [0, 260, W, H], color: '#ffd8a0', alpha: 0.7, size: [1, 3.4], seed: 9, blend: 'screen' });
      V.birds(g, c, { kind: 'flock', n: 9, x: 300, y: 200, dir: 1, speed: 46, size: 0.7, color: '#2a1e2a', spread: 220 });
    }
  }
  // 近处随风的长草：风一阵阵从左往右推过去
  function blades(g, t, col, wind, n) {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = h2(i, 7) * (W + 80) - 40, by = H + 8 - h2(i, 8) * 40, len = 50 + 90 * h2(i, 9);
      const gust = Math.max(0, Math.sin(x * 0.006 - t * 2.4)) ** 2;
      const sw = (0.35 + 0.15 * Math.sin(t * 1.8 + x * 0.012) + 0.8 * gust) * wind * len * 0.55;
      const bw = 1.6 + 2.2 * h2(i, 10);
      g.beginPath(); g.moveTo(x - bw, by); g.quadraticCurveTo(x + sw * 0.2, by - len * 0.55, x + sw, by - len + Math.abs(sw) * 0.35); g.quadraticCurveTo(x + sw * 0.2 + bw, by - len * 0.55, x + bw, by); g.fill();
    }
  }
  // 一段画面（某一季）：远景、云、近景、树、草
  function scene19(g, c, k, panF, panN) {
    const t = c.t, lt = c.lt, ct = chars(c, T19), S = SEAS[k];
    const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    if (k === 4) {
      const sk = farTex(4, 'sky');
      g.drawImage(sk, -60 + panF, 0, sk.lw, sk.lh);
      g.imageSmoothingEnabled = sm;
      const sy = lerp(330, HZ19 + 40, smooth(seg(lt, ct[7], c.dur + 0.4)));
      E.sun(g, { x: 930 + panF, y: sy, r: 40, color: '#ff8a4a', glow: 0.9, sink: HZ19 + 8 });
      g.imageSmoothingEnabled = false;
      const mt = farTex(4, 'mtn');
      g.drawImage(mt, -60 + panF, 0, mt.lw, mt.lh);
    } else {
      const far = farTex(k, 'all');
      g.drawImage(far, -60 + panF, 0, far.lw, far.lh);
    }
    const nr = nearTex(k);
    g.drawImage(nr, -100 + panN, HZ19 - 40, nr.lw, nr.lh);
    g.imageSmoothingEnabled = sm;
    if (k === 0) E.clouds(g, { t, y: 140, color: '#eef0f0', shade: '#7a8ea0', alpha: 0.6, n: 3, seed: 40, speed: 40, scale: 0.9 });
    else if (k < 4) E.clouds(g, { t, y: 120, color: '#ffffff', shade: mix(S.sky[0], '#ffffff', 0.4), alpha: 0.55, n: 3, seed: 40 + k, speed: 8, scale: 0.8 });
    // 树：荒的枯树、春桃、夏竹、秋枫
    const wind = k === 0 ? 0.9 : 0.5;
    if (k === 0) { const bt = bareTreeTex(), sw = 0.02 * Math.sin(t * 2.3) + 0.03 * Math.max(0, Math.sin(1000 * 0.006 - t * 2.4)) ** 2; g.save(); g.translate(1010 + panN, 744); g.transform(1, 0, -sw, 1, 0, 0); g.drawImage(bt, -270 * 0.85, -552 * 0.85, 560 * 0.85, 560 * 0.85); g.restore(); }
    if (k === 1) { E.peachTree(g, { x: 1130 + panN, y: 740, s: 1.15, t, wind, seed: 3 }); E.peachTree(g, { x: 560 + panN, y: 476, s: 0.32, t, seed: 5 }); }
    if (k === 2) { E.bamboo(g, { t, x0: 1010 + panN, x1: 1330 + panN, y: 750, h: 560, n: 9, color: '#2f6a3c', light: '#bfe0a0', wind: 0.6, seed: 4 }); }
    if (k === 3) { E.mapleTree(g, { x: 1140 + panN, y: 744, s: 1.1, t, wind, seed: 5 }); E.mapleTree(g, { x: 540 + panN, y: 474, s: 0.24, t, seed: 8 }); }
    if (k < 4) blades(g, t, S.blade, k === 0 ? 1.2 : 0.55, 30);
  }
  // 两人沿路走：横向速度严格等于脚下步幅速度（不打滑），纵向顺着路往上；走的「路程时间」τ 可以减速、停下、再走
  const SPD_X19 = 0.46, W19 = F.walkSpeed('xiaoyao', 1, { speed: SPD_X19 }), SPD_L19 = W19 / F.walkSpeed('linger', 1, { speed: 1 });
  const Y19 = 648;
  function pathY(tau) {
    let y = Y19;
    const n = Math.max(1, Math.ceil(Math.abs(tau) / 0.04)), dt = tau / n;
    for (let i = 0; i < n; i++) y -= (W19 * depthS(y) / Math.abs(roadDX(y))) * dt;
    return y;
  }
  // 路程时间：t0 起 d0 秒内减速停下，t1 起 d1 秒内重新走起来（之后每秒走 k）
  function walkT(lt, t0, d0, t1, d1, k) {
    if (lt < t0) return lt;
    if (lt < t0 + d0) { const u = lt - t0; return t0 + u - (u * u) / (2 * d0); }
    const stop = t0 + d0 / 2;
    if (lt < t1) return stop;
    if (lt < t1 + d1) { const u = lt - t1; return stop + (k * u * u) / (2 * d1); }
    return stop + (k * d1) / 2 + k * (lt - t1 - d1);
  }
  // 路边的村人（逐帧画，可指可凑）：返回指点的手和窃语的头的位置
  const VIL19 = [[318, 676, 0.92, 0, 1], [392, 662, 0.86, 1, -1], [356, 668, 0.84, 2, 1], [262, 690, 1.0, 3, 1]];
  // 村人剪影烘成贴图（锚点在脚下 (120, 250)）；姿势、前倾分档，逐帧只贴图
  function vilSpr(i, pose, part, lean) {
    const [x0, y0, s2, vv, f] = VIL19[i];
    return K.cache('g06|vil19|' + i + pose + part + lean.toFixed(2), 240, 270, 1, (q) => {
      F.draw(q, 'villager', 120, 250, s2, 0, { pose, part, lean, variant: vv, facing: f, wind: 0.3, seed: vv + 11, tone: 'silhouette', ink: '#2a1c24', rim: '#ffb070', light: [930 - x0 + 120, 330 - y0 + 250] });
    });
  }

  XYT.registerShot('c1_ashroad', {
    name: '负骨南行', zone: 'top', night: false,
    text: '#1a2026', shadow: 'rgba(246,240,226,0.9)', accent: '#9c5333', bloom: 0.24,
    draw(g, c) {
      const t = c.t, lt = c.lt, ct = chars(c, T19);
      // 季节切换：「〔第19句第5–8字〕」每字换一季，一道带毛边的竖笔从左往右扫过去
      const sw = [ct[4], ct[5], ct[6], ct[7]], WD = 0.22;
      let cur = 0;
      for (let k = 0; k < 4; k++) if (lt >= sw[k]) cur = k + 1;
      const wipeU = cur > 0 ? (lt - sw[cur - 1]) / WD : 1;
      const wiping = cur > 0 && wipeU < 1;
      const edge = wiping ? lerp(-140, W + 140, easeInOut(wipeU)) : 0;
      // 长卷横移：近景快、远景慢
      const panN = -12 * lt, panF = -4 * lt;
      const rag = (y) => edge + 26 * (noise1(y * 0.02 + cur * 3, 5) - 0.5) + 14 * Math.sin(y * 0.05 + lt * 8);
      // 毛边分界：裁剪区用对齐到设备像素的一条条横带拼成（斜边的抗锯齿裁剪在引擎里前后帧会不一样），交界再压一道干笔亮边
      const side = (right, fn) => {
        const m = g.getTransform(), cw = g.canvas.width, ch = g.canvas.height, step = 3;
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath();
        for (let Y = 0; Y < ch; Y += step) {
          const y = (Y + step / 2 - m.f) / m.d, X = Math.round(m.a * rag(y) + m.c * y + m.e);
          if (right) { if (X < cw) g.rect(Math.max(0, X), Y, cw - Math.max(0, X), step); } else if (X > 0) g.rect(0, Y, Math.min(cw, X), step);
        }
        g.clip(); g.setTransform(m); fn(g); g.restore();
      };
      if (!wiping) scene19(g, c, cur, panF, panN);
      else { side(true, (q) => scene19(q, c, cur - 1, panF, panN)); side(false, (q) => scene19(q, c, cur, panF, panN)); }
      // 路边的村人：剪影带暖色轮廓光；「没」字一人抬手指点，两人凑头窃语
      if (cur === 4) {
        const vin = smooth(seg(lt, ct[7] + 0.1, ct[8] - 0.1)), ga = g.globalAlpha, bt = c.be(0.3);
        g.globalAlpha = ga * vin;
        const vx = panN * 0.9;
        VIL19.forEach(([x0, y0, s2, vv, f], i) => {
          const x = x0 + vx, put = (spr) => g.drawImage(spr, x - 120, y0 - 250, 240, 270);
          if (vv === 0) {
            // 指点的人：身子先贴，手臂在 0.2 秒里绕肩抬起来
            put(vilSpr(i, 'stand', 'back', 0));
            const up = smooth(seg(lt, ct[8] - 0.05, ct[8] + 0.15)), p = F.points('villager', x, y0, s2, 0, { pose: 'reach', variant: vv, facing: f, seed: vv + 11, lean: 0.05 });
            g.save(); g.translate(p.shoulderN[0], p.shoulderN[1]); g.rotate((1 - up) * 1.35 * f); g.translate(-p.shoulderN[0], -p.shoulderN[1]);
            put(vilSpr(i, 'reach', 'front', 0.05));
            g.restore();
          } else {
            const wh = lt > ct[8] && (vv === 1 || vv === 2);
            put(vilSpr(i, wh ? 'whisper' : 'stand', 'all', wh ? 0.08 + 0.1 * Math.round(bt * 3) / 3 : 0));
          }
        });
        g.globalAlpha = ga;
      }
      // 两人：沿古道往右上走，越走越远越小；「没」她停步低头抱紧坛子，「人」他赶上来侧身揽住她，「懂」后一起往夕阳里走
      const tauL = walkT(lt, ct[8], 0.25, ct[10], 0.35, 0.85), tauX = walkT(lt, ct[9] - 0.25, 0.25, ct[10], 0.35, 0.85) - 0.62;
      const yL = pathY(tauL), yX = pathY(tauX);
      const sL = depthS(yL - 4), sX = depthS(yX + 6);
      const lx = roadX(yL) + panN + roadW(yL) * 0.12, ly = yL - 4;
      const xx = roadX(yX) + panN - roadW(yX) * 0.18, xy = yX + 6;
      const rim = cur === 4 ? '#ffc890' : null, light = [930, 360];
      const stopL = lt > ct[8] + 0.25 && lt < ct[10], stopX = lt > ct[9] && lt < ct[10];
      const sb = c.t - lt;   // 歌曲时间基准：步伐用路程时间推进
      const headL = lt > ct[8] ? 0.32 * smooth(seg(lt, ct[8], ct[8] + 0.3)) * (1 - 0.6 * smooth(seg(lt, ct[10], ct[10] + 0.6))) : 0;
      const lo = { facing: 1, wind: 0.5, seed: 6, speed: SPD_L19, head: headL, rim, light };
      const walkL = !stopL, tL = walkL ? sb + tauL : t;
      // 灵儿：身子、坛子、抱着坛子的手臂（袖子盖住坛子下半）
      F.draw(g, 'linger', lx, ly, sL, tL, Object.assign({ pose: walkL ? 'walk' : 'stand', part: 'back' }, lo));
      const lp = F.points('linger', lx, ly, sL, tL, Object.assign({ pose: 'pray' }, lo));
      urn(g, lp.chest[0] + 7 * sL, lp.chest[1] + 22 * sL - 4 * smooth(seg(lt, ct[8], ct[8] + 0.3)) * sL, sL * 0.95);
      F.draw(g, 'linger', lx, ly, sL, tL, Object.assign({ pose: 'pray', part: 'front' }, lo, { rim: null }));
      // 逍遥：「人」字起回头望着村人，一只手揽到她背上；「懂」后揽着她接着走
      const shield = lt > ct[9] - 0.05;
      const xo = { facing: 1, wind: 0.55, seed: 2, speed: SPD_X19, rim, light };
      const tX = stopX ? t : sb + tauX;
      if (!shield) F.draw(g, 'xiaoyao', xx, xy, sX, tX, Object.assign({ pose: 'walk' }, xo));
      else {
        const look = lt < ct[10] + 0.2;
        F.draw(g, 'xiaoyao', xx, xy, sX, tX, Object.assign({ pose: stopX ? (look ? 'lookBack' : 'stand') : 'walk', part: 'back' }, xo));
        const up = smooth(seg(lt, ct[9] - 0.05, ct[9] + 0.2)), p = F.points('xiaoyao', xx, xy, sX, tX, Object.assign({ pose: 'reach', lean: -0.16 }, xo));
        g.save(); g.translate(p.shoulderN[0], p.shoulderN[1]); g.rotate(1.3 - 0.85 * up); g.translate(-p.shoulderN[0], -p.shoulderN[1]);
        F.draw(g, 'xiaoyao', xx, xy, sX, tX, Object.assign({ pose: 'reach', part: 'front', lean: -0.16 }, xo, { rim: null }));
        g.restore();
      }
      // 窃语：从村人头边飘向她的几点墨痕
      if (cur === 4 && lt > ct[8]) {
        g.fillStyle = '#2e1e20';
        for (let i = 0; i < 9; i++) {
          const age = lt - ct[8] - i * 0.12;
          if (age < 0 || age > 1.4) continue;
          const u = age / 1.4, x0 = 390 + panN * 0.9 + (i % 3) * 14, y0 = 560 + (i % 2) * 10, x1 = lx - 12, y1 = ly - 70 * sL;
          const x = lerp(x0, x1, u) + Math.sin(u * 9 + i) * 10, y = lerp(y0, y1, u) - Math.sin(PI * u) * 40;
          g.globalAlpha = 0.6 * Math.sin(PI * u);
          g.beginPath(); g.ellipse(x, y, 3.2 - u, 1.6, u * 4 + i, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
      }
      // 季节的落物：只落在新季那一侧
      if (!wiping) seasonFx(g, c, cur, t);
      else {
        side(true, (q) => seasonFx(q, c, cur - 1, t));
        side(false, (q) => seasonFx(q, c, cur, t));
        // 交界处一道干笔亮边
        g.strokeStyle = 'rgba(255,250,236,0.75)'; g.lineWidth = 3;
        g.beginPath(); for (let y = -100; y <= H + 100; y += 20) g.lineTo(rag(y), y); g.stroke();
      }
      if (cur === 4) {
        // 太阳落到梯田水面：田水里一道金色光柱，强拍时一亮
        const sx = 930 + panF, gk = 0.45 + 0.4 * c.de(0.6) + 0.3 * smooth(seg(lt, ct[10] + 0.5, c.dur));
        const o = g.globalCompositeOperation; g.globalCompositeOperation = 'screen';
        g.fillStyle = K.lin(g, sx - 70, 0, sx + 70, 0, [[0, 'rgba(255,200,120,0)'], [0.5, rgba('#ffd890', Math.min(1, 0.7 * gk))], [1, 'rgba(255,200,120,0)']]);
        g.fillRect(sx - 70, HZ19 + 6, 140, H - HZ19);
        g.globalCompositeOperation = o;
        for (let i = 0; i < 18; i++) {
          const x = sx + (h2(i, 61) - 0.5) * (60 + 200 * h2(i, 62)), y = HZ19 + 16 + Math.pow(h2(i, 62), 1.3) * 270;
          const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (2 + 3 * h2(i, 63)) + i), 6);
          dot(g, x, y, 6 + 10 * h2(i, 64), '#ffd090', tw * 0.8, 'screen');
        }
      }
    },
  });

  // =====================================================================
  // 第20句 街头陌路：〔第20句第1–11字〕｜〔第20句第12–15字〕
  // =====================================================================
  const T20 = [0.3, 0.58, 0.96, 1.46, 1.82, 2.18, 2.68, 3.14, 3.44, 3.9, 4.24, 4.69, 5.14, 5.54, 6.0];
  const SY = 500, TS20 = 1.12;          // 街面远沿、灵儿一组的缩放
  const SUN20 = [1010, 300];            // 午后逆光：长街尽头的一道日光缺口
  const CURB = SY + 62;                 // 远处街面与近处街面的分界（一道石沿）
  const HS20 = 1.42, X020 = 430;        // 他的缩放、起步处（世界坐标）
  const V20 = F.walkSpeed('xiaoyao', HS20, { speed: 0.5 });
  const CAM_STOP = 4.24;                // 长句末尾镜头硬停
  const camX20 = (lt) => V20 * 0.92 * clamp(lt, 0, CAM_STOP);
  // 走路剪影的帧：按步态相位缓存（远处人群只贴图，不逐帧解骨架）；淡紫墨色
  const NF = 8;
  function walker(who, variant, j, facing, opt) {
    const key = 'g06|wk2|' + who + variant + '|' + j + '|' + facing + (opt || '');
    return K.cache(key, 150, 220, 1, (q) => {
      F.draw(q, who, 75, 206, 1, 0, { pose: 'walk', variant, seed: variant + 3, facing, phase: (TAU * j) / NF, wind: 0.35, tone: 'silhouette', ink: opt === 'far' ? '#5a4a5e' : '#2e2434', rim: null });
    });
  }
  // 失焦副本：一次性用 filter 模糊后缓存
  function blurred(key, src, px) {
    return K.cache(key + '|b' + px, src.lw + px * 6, src.lh + px * 6, 0.5, (q) => {
      try { q.filter = `blur(${px * 0.5 * (XYT.sprites.S || 1)}px)`; } catch (e) { /* 无滤镜时略硬 */ }
      q.drawImage(src, px * 3, px * 3, src.lw, src.lh);
    });
  }
  // 两名拜月教徒（黑袍、月牙袖口），站在灵儿两侧稍后
  function cultists(q, x, y, s) {
    const cult = { pose: 'stand', prop: 'none', wind: 0.3, tone: 'silhouette', ink: '#141218', rim: '#c8b8f0', light: [SUN20[0] - x + 150, SUN20[1] - y + 270], rimAlpha: 0.7 };
    F.draw(q, 'jinyuan', x - 70 * s, y - 6, s * 1.02, 0, Object.assign({ facing: 1, seed: 21, lean: 0.06 }, cult));
    F.draw(q, 'jinyuan', x + 70 * s, y - 6, s * 1.04, 0, Object.assign({ facing: -1, seed: 22, lean: 0.04 }, cult));
    for (const [cx, f] of [[x - 70 * s, 1], [x + 70 * s, -1]]) {
      const p = F.points('jinyuan', cx, y - 6, s, 0, Object.assign({ facing: f }, cult));
      q.strokeStyle = '#e0d8ff'; q.lineWidth = 1.8 * s;
      q.beginPath(); q.arc(p.handN[0] - f * 4 * s, p.handN[1] - 4 * s, 5.5 * s, -PI * 0.2, PI * 0.9); q.stroke();
    }
  }
  const cultTex = () => K.cache('g06|cult2', 340, 290, 1, (qq) => cultists(qq, 170, 270, TS20));
  // 灵儿：白衣，月白的轮廓光；head 低头/抬头，look 回头目送
  function lingerOpts(head, look) {
    return { pose: look ? 'lookBack' : 'stand', facing: -1, wind: 0.45, seed: 9, head, rim: '#e3f9fd', light: SUN20, rimAlpha: 0.95 };
  }
  function trioBlur() {
    const sharp = K.cache('g06|trio2', 340, 290, 1, (q) => { q.drawImage(cultTex(), 0, 0, 340, 290); F.draw(q, 'linger', 170, 276, TS20, 0, lingerOpts(-0.18, false)); });
    return blurred('g06|trio2', sharp, 7);
  }
  // 莲花灯
  function lotusLamp(g, x, y, s) {
    g.save(); g.translate(x, y);
    g.strokeStyle = '#2a1c14'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 16 * s); g.stroke();
    g.translate(0, 16 * s);
    for (let k = -2; k <= 2; k++) {
      g.save(); g.rotate(k * 0.38); g.fillStyle = k % 2 ? '#f6b0b8' : '#f8c8c8';
      g.beginPath(); g.moveTo(0, 18 * s); g.quadraticCurveTo(-9 * s, 6 * s, 0, -6 * s); g.quadraticCurveTo(9 * s, 6 * s, 0, 18 * s); g.fill();
      g.restore();
    }
    g.fillStyle = '#f2d080'; g.beginPath(); g.ellipse(0, 18 * s, 10 * s, 3 * s, 0, 0, TAU); g.fill();
    A.glow(g, 0, 10 * s, 26 * s, '#ffd8b0', 0.5);
    g.restore();
  }
  // 一串灯笼整条烘成贴图（绳、灯、灯晕），逐帧只整条轻轻摆
  const STR20 = [[160, 46, 0.85, 3, 80, 0], [128, 70, 1.3, 11, 96, 1]];
  function lanternStrip(k) {
    const [y0, sag, s, seedB, gap, kind] = STR20[k], Lw = W + 520, x0 = -260;
    return K.cache('g06|lstrip' + k, Lw, 200, 1, (q) => {
      q.translate(-x0, -(y0 - 30));
      q.strokeStyle = 'rgba(30,20,16,0.85)'; q.lineWidth = 1.2;
      q.beginPath();
      for (let x = x0; x < x0 + Lw; x += 20) { const u = (((x - x0) % 480) / 480); q.lineTo(x, y0 + sag * Math.sin(u * PI)); }
      q.stroke();
      for (let i = 0; x0 + i * gap < x0 + Lw - 40; i++) {
        const x = x0 + 30 + i * gap, u = (((x - x0) % 480) / 480), y = y0 + sag * Math.sin(u * PI);
        const kd = (i + kind) % 3 === 2 ? 'lotus' : i % 2 ? 'palace' : 'round';
        if (kd === 'lotus') lotusLamp(q, x, y, s);
        else E.lantern(q, { x, y, s, t: 0, kind: kd, color: '#e0a030', glowColor: '#ffb040', swing: 0, seed: seedB + i, cord: 10, tassel: '#c83c23' });
      }
    });
  }
  // 街景远层：逆光的店铺、远处屋脊、长街尽头的日光缺口、斜下来的光柱（随 0.5 倍视差移动）
  function facade20() {
    return K.cache('g06|facade20', W + 600, CURB + 10, 1, (q) => {
      q.translate(200, 0);
      // 天色铺满整张（E.sky 只铺 -80..W+80，这张更宽）
      q.fillStyle = K.lin(q, 0, 0, 0, SY, [[0, '#b07a3e'], [0.5, '#f0c860'], [1, '#fff0c8']]); q.fillRect(-200, 0, W + 600, CURB + 10);
      E.sky(q, { top: '#b07a3e', mid: '#f0c860', bottom: '#fff0c8', y0: 0, y1: SY, midAt: 0.5 });
      A.glow(q, SUN20[0], SUN20[1], 560, '#fff4d0', 0.95);
      A.glow(q, SUN20[0], SUN20[1] + 40, 220, '#ffffff', 0.9);
      E.jiangnanTown(q, { t: 0, y: SY - 90, x0: -200, x1: W + 400, scale: 0.9, color: '#a88a7a', roof: '#4a3a4a', haze: '#f6d48a', hazeA: 0.55, lit: 0, bank: false, smoke: 0, seed: 12 });
      E.inn(q, { x: 60, y: SY + 6, s: 1.0, t: 0, lit: 0.6, wind: 0, haze: '#d8a878', hazeA: 0.3, lightColor: '#ffc060' });
      E.teahouse(q, { x: 520, y: SY + 6, s: 1.05, t: 0, lit: 0.6, wind: 0, steam: false, haze: '#d8a878', hazeA: 0.3 });
      E.inn(q, { x: 1480, y: SY + 6, s: 1.0, t: 0, lit: 0.5, wind: 0, sign: '酒', haze: '#d8a878', hazeA: 0.34, lightColor: '#ffc060' });
      E.teahouse(q, { x: 1880, y: SY + 6, s: 1.0, t: 0, lit: 0.5, wind: 0, steam: false, haze: '#d8a878', hazeA: 0.34 });
      // 阴影一侧泛淡紫
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = K.lin(q, -200, 0, W + 400, 0, [[0, 'rgba(150,130,210,0.22)'], [0.5, 'rgba(150,130,210,0)'], [1, 'rgba(150,130,210,0.22)']]); q.fillRect(-200, 160, W + 600, SY);
      q.globalCompositeOperation = 'source-over';
      // 街心尽头的日光缺口：一团亮白从街口漫出来
      A.glow(q, SUN20[0], SY - 30, 300, '#fffaf0', 0.85);
      // 逆光的光柱
      q.globalCompositeOperation = 'screen';
      try { q.filter = `blur(${8 * (XYT.sprites.S || 1)}px)`; } catch (e) { /* 无滤镜 */ }
      for (let i = 0; i < 11; i++) {
        const a = PI / 2 + (h2(i, 3) - 0.5) * 2.2, L = 900, w = 24 + 70 * h2(i, 4);
        q.save(); q.translate(SUN20[0], SUN20[1]); q.rotate(a);
        q.fillStyle = K.lin(q, 0, 0, L, 0, [[0, rgba('#fff0c0', 0.34 * (0.5 + 0.5 * h2(i, 5)))], [0.2, rgba('#ffe0a0', 0.24 * (0.5 + 0.5 * h2(i, 5)))], [1, 'rgba(255,224,160,0)']]);
        q.beginPath(); q.moveTo(0, -4); q.lineTo(L, -w); q.lineTo(L, w); q.lineTo(0, 4); q.closePath(); q.fill();
        q.restore();
      }
      q.filter = 'none';
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 远处街面（0.8 倍视差）：金色石板、几个小摊、两把伞
  function floorFar20() {
    return K.cache('g06|floorFar20', W + 700, CURB - SY + 120, 1, (q) => {
      q.translate(250, -(SY - 100));
      q.fillStyle = K.lin(q, 0, SY, 0, CURB, [[0, '#f0c880'], [1, '#c8945a']]); q.fillRect(-250, SY, W + 700, CURB - SY + 4);
      q.strokeStyle = 'rgba(90,60,40,0.3)'; q.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const yy = SY + 8 + k * 18; q.beginPath(); q.moveTo(-250, yy); q.lineTo(W + 450, yy); q.stroke(); }
      for (let k = -24; k <= 24; k++) { q.beginPath(); q.moveTo(640 + k * 48, SY); q.lineTo(640 + k * 60, CURB); q.stroke(); }
      // 小摊与伞（逆光剪影，带一线金边）
      for (const [x, kind] of [[-120, 0], [250, 1], [760, 0], [1180, 1], [1460, 0]]) {
        q.fillStyle = '#3a2c3a';
        if (kind === 0) {
          q.beginPath(); q.moveTo(x - 60, SY - 46); q.lineTo(x + 60, SY - 46); q.lineTo(x + 70, SY - 30); q.lineTo(x - 70, SY - 30); q.closePath(); q.fill();
          q.fillRect(x - 56, SY - 30, 4, 46); q.fillRect(x + 52, SY - 30, 4, 46); q.fillRect(x - 50, SY - 2, 100, 10);
          for (let i = 0; i < 6; i++) { q.beginPath(); q.arc(x - 40 + i * 16, SY - 6, 5, PI, TAU); q.fill(); }
          q.strokeStyle = 'rgba(255,220,150,0.7)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(x - 60, SY - 46); q.lineTo(x + 60, SY - 46); q.stroke();
        } else {
          q.beginPath(); q.moveTo(x - 46, SY - 50); q.quadraticCurveTo(x, SY - 82, x + 46, SY - 50); q.closePath(); q.fill();
          q.fillRect(x - 1.5, SY - 72, 3, 82);
          q.strokeStyle = 'rgba(255,220,150,0.7)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(x - 46, SY - 50); q.quadraticCurveTo(x, SY - 82, x + 46, SY - 50); q.stroke();
        }
      }
      // 石沿
      q.fillStyle = '#8a6440'; q.fillRect(-250, CURB - 4, W + 700, 6);
      q.fillStyle = 'rgba(255,230,170,0.5)'; q.fillRect(-250, CURB - 4, W + 700, 1.5);
    });
  }
  // 近处街面（1 倍视差，与人同步）
  function floorNear20() {
    return K.cache('g06|floorNear20', W + 900, H - CURB + 30, 1, (q) => {
      q.translate(300, -CURB);
      q.fillStyle = K.lin(q, 0, CURB, 0, H + 20, [[0, '#d8a868'], [0.45, '#9a7048'], [1, '#3e2e2e']]); q.fillRect(-300, CURB, W + 900, H + 30 - CURB);
      q.strokeStyle = 'rgba(60,40,26,0.32)'; q.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const yy = CURB + 6 + Math.pow(k / 7, 1.5) * (H - CURB); q.beginPath(); q.moveTo(-300, yy); q.lineTo(W + 600, yy); q.stroke(); }
      for (let k = -30; k <= 30; k++) { q.beginPath(); q.moveTo(640 + k * 64, CURB); q.lineTo(640 + k * 180, H + 20); q.stroke(); }
      // 街心被日光照亮的一条
      q.globalCompositeOperation = 'screen';
      q.fillStyle = K.lin(q, 0, CURB, 0, H, [[0, 'rgba(255,230,170,0.5)'], [1, 'rgba(255,230,170,0)']]);
      q.beginPath(); q.moveTo(SUN20[0] - 120, CURB); q.lineTo(SUN20[0] + 120, CURB); q.lineTo(SUN20[0] + 520, H + 20); q.lineTo(SUN20[0] - 520, H + 20); q.closePath(); q.fill();
      q.globalCompositeOperation = 'source-over';
      // 阴影里泛淡紫
      q.fillStyle = K.lin(q, 0, CURB, 0, H + 20, [[0, 'rgba(176,164,227,0)'], [1, 'rgba(120,100,180,0.28)']]); q.fillRect(-300, CURB, W + 900, H + 30 - CURB);
    });
  }
  // 头顶的屋檐（前景，压暗上方，好让月白歌词看清）
  function eaves(g, t, c, off) {
    const bt = c.be(0.4);
    g.fillStyle = K.lin(g, 0, 0, 0, 132, [[0, '#1e1418'], [0.8, '#2c1e24'], [1, 'rgba(44,30,36,0)']]); g.fillRect(-60, -40, W + 120, 172);
    g.fillStyle = '#1a1014';
    for (let k = -2; k < 18; k++) { const x = ((k * 90 + off) % 1800 + 1800) % 1800 - 200; g.fillRect(x, 96, 10, 28); }
    // 两道灯串：远的小、近的大；整条随拍轻摇
    for (let k = 0; k < 2; k++) {
      const [y0, , , , , ] = STR20[k], par = k ? 1 : 0.55, spr = lanternStrip(k);
      // 整条随拍左右一荡（只平移，不旋转：旋转的大贴图很慢）
      const o = (((off * par + (3 + 4 * bt) * Math.sin(t * 1.4 + k * 2)) % 480) + 480) % 480;
      const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
      g.drawImage(spr, o - 500, y0 - 30, spr.lw, spr.lh);
      g.imageSmoothingEnabled = sm;
    }
  }
  // 工笔淡彩的侧脸（3/4 侧向左）：wet 0..1 泪光聚起；drop 0..1 泪珠沿脸颊滚落、挂在下颌
  function face20(g, x, y, s, t, wet, drop) {
    const LINE = '#8a5a50', HAIR = '#1c1418';
    g.save(); g.translate(x, y); g.scale(s, s);
    const sway = Math.sin(t * 1.7), br = Math.sin(t * 1.1) * 0.6;
    // 后发：长发从脑后垂到肩背
    g.fillStyle = HAIR;
    g.beginPath(); g.moveTo(-40, -118); g.bezierCurveTo(20, -170, 120, -150, 118, -50); g.bezierCurveTo(132, 40, 120, 160, 158 + sway * 4, 300); g.lineTo(20, 300); g.bezierCurveTo(46, 210, 56, 130, 34, 70); g.closePath(); g.fill();
    // 颈（细一些）、白纱交领、淡紫披帛
    g.fillStyle = K.lin(g, 0, 50, 0, 140, [[0, '#ecd4cc'], [1, '#f6e6de']]);
    g.beginPath(); g.moveTo(-16, 62); g.bezierCurveTo(-13, 90, -12, 112, -15, 136); g.lineTo(32, 136); g.bezierCurveTo(27, 110, 25, 86, 30, 46); g.closePath(); g.fill();
    g.fillStyle = 'rgba(200,150,140,0.28)'; g.beginPath(); g.moveTo(-16, 66); g.quadraticCurveTo(4, 84, 30, 52); g.lineTo(30, 78); g.quadraticCurveTo(4, 96, -14, 88); g.fill();
    g.fillStyle = '#fcf8f6'; g.beginPath(); g.moveTo(-120, 260); g.bezierCurveTo(-100, 180, -52, 132, -6, 122); g.bezierCurveTo(40, 128, 116, 166, 160, 260); g.closePath(); g.fill();
    g.strokeStyle = '#eaa6b8'; g.lineWidth = 3; g.beginPath(); g.moveTo(-80, 250); g.bezierCurveTo(-50, 176, -20, 138, 2, 126); g.bezierCurveTo(38, 144, 80, 190, 98, 260); g.stroke();
    g.strokeStyle = rgba(LINE, 0.5); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-20, 154); g.quadraticCurveTo(10, 200, 18, 260); g.stroke();
    g.fillStyle = rgba('#d7c3ee', 0.78); g.beginPath(); g.moveTo(44, 160); g.bezierCurveTo(96, 180, 140, 224, 176, 260); g.lineTo(112, 260); g.bezierCurveTo(90, 222, 70, 190, 44, 160); g.fill();
    // 脸：额、眉骨、鼻梁、鼻尖、人中、唇在侧影里面一点、小下巴、柔和的下颌
    const facePath = () => {
      g.beginPath();
      g.moveTo(26, -112);
      g.bezierCurveTo(-18, -118, -48, -98, -56, -70);
      g.quadraticCurveTo(-60, -56, -61, -46);
      g.quadraticCurveTo(-60, -36, -64, -22);
      g.quadraticCurveTo(-72, -4, -76, 6);
      g.quadraticCurveTo(-77, 12, -70, 13);
      g.quadraticCurveTo(-66, 15, -66, 20);
      g.quadraticCurveTo(-67, 25, -64, 28);
      g.quadraticCurveTo(-62, 31, -64, 35);
      g.quadraticCurveTo(-64, 41, -58, 46);
      g.bezierCurveTo(-50, 56, -34, 60, -18, 56);
      g.bezierCurveTo(4, 50, 24, 34, 38, 12);
      g.bezierCurveTo(46, -4, 50, -24, 52, -50);
      g.lineTo(56, -80); g.closePath();
    };
    facePath();
    g.fillStyle = K.lin(g, -76, 0, 56, 0, [[0, '#fff8f2'], [0.55, '#f9ece4'], [1, '#ecd6cc']]); g.fill();
    g.save(); facePath(); g.clip();
    // 层层淡彩：腮红、眼窝、下颌阴影、侧脸阴影、颧骨高光
    g.fillStyle = K.rad(g, -30, 10, 2, 40, [[0, 'rgba(244,150,160,0.34)'], [1, 'rgba(244,150,160,0)']]); g.fillRect(-80, -30, 120, 90);
    g.fillStyle = K.rad(g, -26, -34, 2, 26, [[0, 'rgba(236,160,170,0.22)'], [1, 'rgba(236,160,170,0)']]); g.fillRect(-60, -64, 70, 60);
    g.fillStyle = K.lin(g, 0, 30, 0, 62, [[0, 'rgba(200,154,144,0)'], [1, 'rgba(200,154,144,0.32)']]); g.fillRect(-70, 28, 130, 40);
    g.fillStyle = K.lin(g, 10, 0, 56, 0, [[0, 'rgba(216,168,152,0)'], [1, 'rgba(200,144,126,0.38)']]); g.fillRect(10, -120, 50, 200);
    g.fillStyle = K.rad(g, -44, -8, 2, 22, [[0, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-70, -32, 50, 48);
    g.restore();
    g.strokeStyle = rgba(LINE, 0.9); g.lineWidth = 0.8 / 1; facePath(); g.stroke();
    g.lineCap = 'round';
    // 远山眉：细长、淡
    g.strokeStyle = rgba('#6a5050', 0.62); g.lineWidth = 2;
    g.beginPath(); g.moveTo(-44, -58); g.quadraticCurveTo(-24, -68, 4, -60); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(4, -60); g.quadraticCurveTo(10, -58, 13, -54); g.stroke();
    g.lineWidth = 1.4; g.beginPath(); g.moveTo(-60, -54); g.quadraticCurveTo(-56, -57, -52, -57); g.stroke();
    // 花钿
    g.fillStyle = '#e8607c';
    for (let k = 0; k < 3; k++) { const a = -PI / 2 + (k - 1) * 0.7; g.beginPath(); g.ellipse(-36 + Math.cos(a) * 2.6, -80 + Math.sin(a) * 2.6, 1.5, 3, a + PI / 2, 0, TAU); g.fill(); }
    // 近眼：杏眼，细长（不再是大圆眼）；双眼皮一线、眸光；泪水在下睑聚起
    g.fillStyle = K.rad(g, -22, -36, 2, 24, [[0, 'rgba(240,160,180,0.3)'], [1, 'rgba(240,160,180,0)']]); g.fillRect(-56, -60, 70, 50);
    const eye = () => { g.beginPath(); g.moveTo(-42, -33); g.bezierCurveTo(-34, -41, -12, -43, -2, -37); g.bezierCurveTo(-12, -31, -32, -29, -42, -33); };
    eye(); g.fillStyle = '#fffaf8'; g.fill();
    g.save(); eye(); g.clip();
    g.fillStyle = K.rad(g, -22 + br, -36, 1, 7, [[0, '#6a4a3e'], [0.6, '#3a2a2c'], [1, '#1a1214']]); g.beginPath(); g.arc(-22 + br, -36, 6.4, 0, TAU); g.fill();
    g.fillStyle = '#0e0a0c'; g.beginPath(); g.arc(-22.5 + br, -36, 2.8, 0, TAU); g.fill();
    g.fillStyle = 'rgba(60,30,40,0.2)'; g.fillRect(-44, -44, 44, 6);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-25 + br, -38.5, 1.6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(-19 + br, -33.5, 0.8, 0, TAU); g.fill();
    if (wet > 0) { g.fillStyle = rgba('#e8f4ff', 0.55 * wet); g.beginPath(); g.ellipse(-20, -31, 18, 2 + 1.6 * wet, -0.06, 0, TAU); g.fill(); }
    g.restore();
    g.strokeStyle = '#2a1a1c'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(-43, -32.5); g.bezierCurveTo(-34, -42, -12, -44, -1, -37.5); g.stroke();
    g.lineWidth = 0.9; g.beginPath(); g.moveTo(-1, -37.5); g.lineTo(6, -41); g.moveTo(-6, -41.5); g.lineTo(-2, -46); g.moveTo(-12, -42.5); g.lineTo(-9, -47); g.stroke();
    g.strokeStyle = rgba(LINE, 0.6); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-36, -44); g.bezierCurveTo(-26, -50, -12, -50, -4, -44); g.stroke();
    g.beginPath(); g.moveTo(-40, -31.5); g.bezierCurveTo(-30, -27, -14, -28.5, -3, -35); g.stroke();
    // 下睑一线湿亮的泪光
    if (wet > 0) {
      g.strokeStyle = rgba('#ffffff', 0.95 * wet); g.lineWidth = 1.5; g.beginPath(); g.moveTo(-38, -30.5); g.bezierCurveTo(-28, -26.5, -14, -28, -4, -34); g.stroke();
      dot(g, -8, -31, 6, '#ffffff', 0.9 * wet, 'screen');
    }
    // 远眼只露出睫线
    g.strokeStyle = '#2a1a1c'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-60, -36); g.quadraticCurveTo(-57, -39, -53, -38); g.stroke();
    // 鼻翼、唇（在侧影里面一点）
    g.strokeStyle = rgba(LINE, 0.55); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-66, 10); g.quadraticCurveTo(-61, 15, -67, 16); g.stroke();
    g.fillStyle = '#e48c92';
    g.beginPath(); g.moveTo(-62, 28); g.quadraticCurveTo(-57, 25, -52, 27); g.quadraticCurveTo(-48, 25.5, -44, 28.5); g.quadraticCurveTo(-53, 30, -62, 29); g.fill();
    g.fillStyle = '#ec9ea0'; g.beginPath(); g.moveTo(-61, 30); g.quadraticCurveTo(-53, 29.5, -46, 29.5); g.quadraticCurveTo(-52, 37, -59, 35); g.fill();
    g.strokeStyle = rgba('#9a4a52', 0.8); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-62, 29); g.quadraticCurveTo(-53, 30.5, -44, 28.5); g.stroke();
    // 泪珠：从下睑沁出，顺着脸颊的弧度滚下，留一道湿亮的泪痕，最后挂在下颌
    if (drop > 0) {
      const P = [[-28, -29], [-36, -12], [-42, 8], [-40, 30], [-34, 50], [-30, 57]];
      const at = (u) => { const f = clamp(u) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)), k = f - i; return [lerp(P[i][0], P[i + 1][0], k), lerp(P[i][1], P[i + 1][1], k)]; };
      const u = easeInOut(clamp(drop)), [dx, dy] = at(u);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.6;
      g.beginPath(); for (let k = 0; k <= 16; k++) { const p = at((k / 16) * u); (k ? g.lineTo : g.moveTo).call(g, p[0], p[1]); } g.stroke();
      const r = 3.2 + 1.6 * Math.min(1, drop * 3) + (u > 0.95 ? 0.8 : 0);
      g.fillStyle = 'rgba(214,236,250,0.9)'; g.beginPath(); g.ellipse(dx, dy + r * 0.2, r * 0.82, r * 1.18, 0.12, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(140,170,200,0.6)'; g.lineWidth = 0.6; g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(dx - r * 0.28, dy - r * 0.3, r * 0.32, 0, TAU); g.fill();
      dot(g, dx, dy, 12, '#ffffff', 0.55, 'screen');
    }
    // 刘海：一绺绺细细的，不成一整片
    g.fillStyle = HAIR;
    g.beginPath(); g.moveTo(-40, -124); g.bezierCurveTo(-70, -112, -70, -94, -62, -80); g.bezierCurveTo(-50, -100, -24, -110, 8, -110); g.bezierCurveTo(26, -96, 36, -56, 40, -16); g.bezierCurveTo(46, 30, 42, 80, 30, 120); g.bezierCurveTo(66, 70, 80, -56, 42, -118); g.closePath(); g.fill();
    for (const [x0, x1, y1, w] of [[-8, -40, -74, 6], [8, -18, -80, 5], [20, 2, -88, 5], [-24, -54, -68, 4]]) {
      g.beginPath(); g.moveTo(x0 - w, -110); g.quadraticCurveTo(x0 - w * 1.5, -92, x1, y1 + Math.sin(t * 1.8 + x0) * 1.5); g.quadraticCurveTo(x0 + w * 0.2, -94, x0 + w, -110); g.closePath(); g.fill();
    }
    // 发丝：深色发团上一根根细亮的丝
    g.strokeStyle = 'rgba(120,100,120,0.45)'; g.lineWidth = 0.6;
    for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(-30 + k * 10, -132 + k * 2); g.quadraticCurveTo(54 + k * 5, -140 + k * 3, 104 - k * 3, -40 + k * 14); g.stroke(); }
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(40 + k * 4, 30); g.quadraticCurveTo(52 + k * 5 + sway * 3, 130, 36 + k * 7 + sway * 6, 220); g.stroke(); }
    // 两缕散发被风吹着，从额角拂过脸颊
    g.strokeStyle = 'rgba(28,20,24,0.85)'; g.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      const w1 = Math.sin(t * 1.3 + k * 1.7) * 8, w2 = Math.sin(t * 0.9 + k) * 10;
      g.beginPath(); g.moveTo(-34 + k * 10, -108); g.bezierCurveTo(-58 + w1, -70, -44 + w2, -10, -52 + w1 - k * 6, 40 + k * 10); g.stroke();
    }
    // 发髻、桃花簪、淡紫发带
    g.fillStyle = HAIR; g.beginPath(); g.ellipse(50, -136, 46, 28, -0.3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,100,120,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(50, -136, 36, 18, -0.3, PI * 1.05, PI * 1.85); g.stroke();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.3; g.fillStyle = k % 2 ? '#f9c4d2' : '#f6b0c4'; g.beginPath(); g.ellipse(14 + Math.cos(a) * 8, -146 + Math.sin(a) * 8, 7, 5, a, 0, TAU); g.fill(); }
    g.fillStyle = '#e27b9c'; g.beginPath(); g.arc(14, -146, 3, 0, TAU); g.fill();
    g.fillStyle = '#ffe08a'; for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.beginPath(); g.arc(14 + Math.cos(a) * 2.2, -146 + Math.sin(a) * 2.2, 0.8, 0, TAU); g.fill(); }
    g.strokeStyle = '#c9a24a'; g.lineWidth = 2; g.beginPath(); g.moveTo(22, -142); g.lineTo(84, -116); g.stroke();
    const rb = Math.sin(t * 2.2) * 12, rb2 = Math.sin(t * 2.2 - 1) * 18;
    g.fillStyle = rgba('#cdb8e6', 0.88);
    g.beginPath(); g.moveTo(82, -146); g.bezierCurveTo(138, -134 + rb, 166, -76 + rb2, 194 + rb2, -20); g.lineTo(182 + rb2, -14); g.bezierCurveTo(148, -76 + rb2, 128, -114 + rb, 80, -134); g.closePath(); g.fill();
    g.fillStyle = rgba('#bfa8e0', 0.82);
    g.beginPath(); g.moveTo(86, -136); g.bezierCurveTo(128, -106 + rb2, 148, -40 + rb, 166 + rb, 34); g.lineTo(156 + rb, 36); g.bezierCurveTo(132, -40 + rb, 118, -96 + rb2, 82, -126); g.closePath(); g.fill();
    // 逆光：灯火在发丝与侧脸上描一道金边、一道月白
    g.save(); g.globalCompositeOperation = 'screen';
    g.strokeStyle = rgba('#ffd890', 0.7); g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(42, -116); g.bezierCurveTo(86, -158, 126, -116, 118, -40); g.stroke();
    g.beginPath(); g.ellipse(50, -136, 46, 28, -0.3, PI * 1.1, PI * 1.9); g.stroke();
    g.strokeStyle = rgba('#e3f9fd', 0.6); g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(-56, -70); g.quadraticCurveTo(-60, -56, -61, -46); g.quadraticCurveTo(-60, -36, -64, -22); g.quadraticCurveTo(-72, -4, -76, 6); g.stroke();
    g.restore();
    g.restore();
  }
  // 近景：她的侧脸，泪光一点点聚起，「滚滚」时落下；镜头慢慢推近
  function drawFace20(g, c, ct) {
    const t = c.t, lt = c.lt, u = seg(lt, ct[7], ct[11]);
    const z = 1 + 0.1 * smooth(u);
    g.fillStyle = '#2a1a1c'; g.fillRect(-100, -100, W + 200, H + 200);
    g.save(); g.translate(700, 440); g.scale(z, z); g.translate(-700, -440);
    // 背后的灯海失焦成光斑（暖金里夹着淡紫）
    const bk = K.cache('g06|facebg2', W, H, 0.5, (q) => {
      q.fillStyle = K.lin(q, 0, 0, W, H, [[0, '#2e2034'], [0.55, '#6a3a3a'], [1, '#c88a3a']]); q.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) A.glow(q, h2(i, 3) * W, 140 + h2(i, 4) * 520, 30 + 70 * h2(i, 5), i % 4 === 0 ? '#b0a4e3' : i % 3 ? '#ffb040' : '#ffd890', 0.3 + 0.3 * h2(i, 6));
    });
    g.drawImage(bk, -40, -30, W + 80, H + 60);
    V.bokeh(g, c, { n: 12, colors: ['#ffb040', '#ffd890', '#b0a4e3'], alpha: 0.3, size: [40, 120], drift: 6, area: [0, 120, W, H], blend: 'screen', night: true });
    // 「尘」字泪光聚起，「滚」泪珠沿脸颊滚落，第二个「滚」挂在下颌
    face20(g, 724, 474, 1.6, t, smooth(seg(lt, ct[8] - 0.1, ct[9])), seg(lt, ct[9], ct[10] + 0.1));
    V.dust(g, c, { n: 36, area: [0, 160, W, H], color: '#ffe0a0', alpha: 0.75, size: [1, 3.4], blend: 'screen', seed: 8 });
    g.restore();
  }

  XYT.registerShot('c1_stranger', {
    name: '街头陌路', zone: 'top', night: false,
    text: '#e9f1f6', shadow: 'rgba(24,16,20,0.9)', accent: '#f0c239', bloom: 0.36,
    draw(g, c) {
      const t = c.t, lt = c.lt, ct = chars(c, T20);
      const tFace = ct[7], tBack = ct[11];
      if (lt >= tFace && lt < tBack) return drawFace20(g, c, ct);
      const tBow = ct[13], tPass = ct[14];
      // 世界坐标：他一直走，「看」字前停在她面前三十来步处作揖，「透」字前后加快侧身走过去
      const stopAt = tBow - 0.12, passAt = tBow + 0.36, pk = 2.2;
      const walkT = Math.min(lt, stopAt) + Math.max(0, lt - passAt) * pk;
      const Xw = X020 + V20 * walkT;
      const Lw = X020 + V20 * stopAt + 100;
      const camX = camX20(lt);
      const bowing = lt >= stopAt && lt < passAt;
      // 远层（0.5 倍视差）、远街面（0.8）、近街面（1.0）
      const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
      const fc = facade20(); g.drawImage(fc, -200 - camX * 0.5, 0, fc.lw, fc.lh);
      const ff = floorFar20(); g.drawImage(ff, -250 - camX * 0.8, SY - 100, ff.lw, ff.lh);
      const fn = floorNear20(); g.drawImage(fn, -300 - camX, CURB, fn.lw, fn.lh);
      g.imageSmoothingEnabled = sm;
      // 人与人的长影子：逆光，影子都朝镜头这边拖
      const shadows = [];
      const drawWalker = (q, x, y, s, vv, dir, j, far) => { const img = walker('villager', vv, j, dir, far ? 'far' : ''); q.drawImage(img, x - 75 * s, y - 206 * s, 150 * s, 220 * s); };
      // 后排人流：两层，小、慢，多半向左（各自的视差层上脚下不滑）
      const crowd = (n, seed, y0, s, par, far) => {
        for (let i = 0; i < n; i++) {
          const dir = h2(i, seed) < 0.72 ? -1 : 1, v = 26 * s * (0.8 + 0.4 * h2(i, seed + 1));
          const span = 2000, x = ((h2(i, seed + 2) * span + dir * v * lt - camX * par) % span + span) % span - 300, y = y0 + h2(i, seed + 3) * 8;
          const cyc = (v * lt) / (126 * s) + h2(i, seed + 4), j = ((Math.floor(cyc * NF) % NF) + NF) % NF;
          if (x < -80 || x > W + 80) continue;
          drawWalker(g, x, y, s, i % 4, dir, j, far);
          if (!far) shadows.push([x, y, s]);
        }
      };
      crowd(12, 5, SY + 26, 0.5, 0.72, true);
      crowd(11, 15, SY + 48, 0.72, 0.84, false);
      // 灵儿一组：街心；「穿」字时焦点从前景人流移到她身上
      const focus = smooth(seg(lt, ct[5] - 0.1, ct[5] + 0.5));
      const lx = Lw - camX, ly = SY + 118, ls = TS20;
      shadows.push([lx, ly, ls * 1.6]);
      const front = [];
      for (let i = 0; i < 5; i++) {
        const dir = i === 2 ? 1 : -1, v = 30 * (0.8 + 0.4 * h2(i, 16));
        const span = 2100, x = ((h2(i, 17) * span + dir * v * lt - camX) % span + span) % span - 300;
        front.push([x, SY + 196 + h2(i, 18) * 8, 1.3, (i + 2) % 4, dir, v, i + 20]);
      }
      const hx = Xw - camX, hy = SY + 192;
      // 合拢的人潮：「我」字起从她两边几步外走过来，挡到她身前（与步幅同速，不滑）
      const closers = [];
      if (lt > tBack - 0.05) {
        for (const [dx0, dir, vv, dy, sd] of [[-250, 1, 1, 154, 0.3], [260, -1, 3, 160, 0.6], [400, -1, 0, 148, 0.1]]) {
          const sc = 1.18, v = F.walkSpeed('villager', sc), d = v * Math.max(0, lt - (tBack - 0.05));
          const x = lx + dx0 + dir * d, j = ((Math.floor((d / (126 * sc) + sd) * NF) % NF) + NF) % NF;
          closers.push([x, SY + dy, sc, vv, dir, j]);
          shadows.push([x, SY + dy, sc]);
        }
      }
      for (const w of front) shadows.push([w[0], w[1], w[2]]);
      shadows.push([hx, hy, HS20]);
      // 先铺影子（一笔填完）
      g.fillStyle = 'rgba(40,24,44,0.3)'; g.beginPath();
      for (const [x, y, s] of shadows) { g.moveTo(x + 26 * s, y + 4); g.ellipse(x + 6 * s, y + 10 * s, 26 * s, 9 * s + 6, 0.16, 0, TAU); }
      g.fill();
      if (focus < 1) { const b = trioBlur(); g.globalAlpha = 1 - focus; g.drawImage(b, lx - 170 - 21, ly - 276 - 21, b.lw, b.lh); g.globalAlpha = 1; }
      if (focus > 0) {
        g.globalAlpha = focus;
        const ct2 = cultTex(); g.drawImage(ct2, lx - 170, ly - 270, ct2.lw, ct2.lh);
        const look = lt > tPass - 0.1;
        F.draw(g, 'linger', lx - 4, ly + 6, ls, t, lingerOpts(look ? 0.1 : -0.18 + 0.1 * smooth(seg(lt, tBack, tBow)), look));
        g.globalAlpha = 1;
      }
      // 前排人流（大，逆着他向左）、他、合拢的人
      const ho = { pose: bowing ? 'pray' : 'walk', facing: 1, wind: 0.4, seed: 2, speed: lt > passAt ? 0.5 * pk : 0.5, rim: '#ffe2a8', light: SUN20, lean: bowing ? 0.5 * Math.sin(PI * seg(lt, stopAt, passAt)) : 0, head: bowing ? 0.42 * Math.sin(PI * seg(lt, stopAt, passAt)) : 0 };
      const fwalk = (w) => { const [x, y, s, vv, dir, v, i] = w, cyc = (v * lt) / (126 * s) + h2(i, 9), j = ((Math.floor(cyc * NF) % NF) + NF) % NF; drawWalker(g, x, y, s, vv, dir, j, false); };
      for (const [x, y, s, vv, dir, j] of closers) drawWalker(g, x, y, s, vv, dir, j, false);
      for (const w of front) if (w[0] < hx - 40) fwalk(w);
      F.draw(g, 'xiaoyao', hx, hy, HS20, t, ho);
      for (const w of front) if (w[0] >= hx - 40) fwalk(w);
      // 脚下扬起的金色尘土（逆光里）
      V.dust(g, c, { n: 36, light: { x: SUN20[0] - camX * 0.5, y: SUN20[1], angle: PI / 2, spread: 1.1, len: 520, start: 0.15 }, color: '#ffe6b0', alpha: 0.9, size: [1, 4], blend: 'screen', seed: 6 });
      // 前景失焦的过客：「穿」字前清晰，之后虚化（按焦点挑一张，只画一次）
      for (let i = 0; i < 2; i++) {
        const x = ((h2(i, 33) * 1900 - 70 * lt - camX * 1.5) % 1900 + 1900) % 1900 - 300, y = H + 230, s = 2.7;
        if (x < -300 || x > W + 300) continue;
        const j = (Math.floor(lt * 3 + i * 3)) % NF, vv = (i + 1) % 4, sharp = walker('villager', vv, j, -1, '');
        const lvl = focus < 0.33 ? 0 : focus < 0.66 ? 5 : 10;
        if (!lvl) g.drawImage(sharp, x - 75 * s, y - 206 * s, 150 * s, 220 * s);
        else { const bl = blurred('g06|fg' + vv + j, sharp, lvl), k = s * 150 / sharp.lw; g.globalAlpha = 0.92; g.drawImage(bl, x - 75 * s - 3 * lvl * k, y - 206 * s - 3 * lvl * k, bl.lw * k, bl.lh * k); g.globalAlpha = 1; }
      }
      eaves(g, t, c, -camX * 1.3);
    },
  });

  // ---------- 空闲时预热本组的静态贴图（内容与现建完全相同，只是免得切镜头时第一帧卡顿） ----------
  const WARM = [
    () => lotusField(), () => bg17(), () => sky17(), () => skiffTex(), () => skiffRefl(), () => bg18(), () => room18(), 
    () => nimbusTex(), () => demonBody(), () => gauzeTex(),
    () => bareTreeTex(), () => facade20(), () => floorFar20(), () => floorNear20(), () => lanternStrip(0), () => lanternStrip(1), () => cultTex(), () => trioBlur(),
  ];
  WARM.push(() => { vilSpr(0, 'stand', 'back', 0); vilSpr(0, 'reach', 'front', 0.05); for (const i of [1, 2, 3]) vilSpr(i, 'stand', 'all', 0); for (const i of [1, 2]) for (let k = 0; k < 4; k++) vilSpr(i, 'whisper', 'all', 0.08 + 0.1 * k / 3); });
  for (let k = 0; k < 5; k++) WARM.push(() => (k === 4 ? (farTex(4, 'sky'), farTex(4, 'mtn')) : farTex(k, 'all')), () => nearTex(k));
  for (let v = 0; v < 4; v++) for (const f of [1, -1]) for (const op of ['', 'far']) WARM.push(() => { for (let j = 0; j < NF; j++) walker('villager', v, j, f, op); });
  for (const v of [1, 2]) for (const lv of [5, 10]) WARM.push(() => { for (let j = 0; j < NF; j++) blurred('g06|fg' + v + j, walker('villager', v, j, -1, ''), lv); });
  // 再在极小的离屏画布上把各段画一遍：工具包自己的树、花瓣、云等贴图也就建好了
  let wcv = null;
  const warmFrame = (id, lt) => () => {
    if (!wcv) { wcv = document.createElement('canvas'); wcv.width = 64; wcv.height = 36; }
    const q = wcv.getContext('2d'), sc = XYT.scenes[id];
    q.setTransform(0.05, 0, 0, 0.05, 0, 0);
    sc.draw(q, { t: 200 + lt, lt, dur: 6.67, p: lt / 6.67, inten: 1, rms: 0.5, onset: 0, low: 0.5, high: 0.5, be: () => 0, de: () => 0, b: { i: 0, ph: 0, since: 0.5, period: 0.83, down: false, sinceDown: 0.5, bar: 0, x: 0, str: 0.5 } });
  };
  for (const [id, lts] of [['c1_lotusboat', [0.3, 2.5, 4.4]], ['c1_swordarray', [0.5, 2.6, 4.0, 5.2]], ['c1_ashroad', [0.5, 2.4, 2.9, 3.3, 4.6]], ['c1_stranger', [1, 3.5, 5.6]]]) for (const lt of lts) WARM.push(warmFrame(id, lt));
  const idle = (f) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 5000 }) : setTimeout(f, 300));
  let wi = 0;
  const warmStep = (dl) => {
    if (!XYT.sprites || !XYT.sprites.S || !XYT.env || !XYT.fig) { idle(warmStep); return; }
    do { try { WARM[wi](); } catch (e) { /* 预热失败不影响逐帧现建 */ } wi++; } while (wi < WARM.length && dl && dl.timeRemaining && dl.timeRemaining() > 12);
    if (wi < WARM.length) idle(warmStep);
  };
  try { idle(warmStep); } catch (e) { /* 无空闲接口 */ }
})();
