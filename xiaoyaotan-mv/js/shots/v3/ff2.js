/* 第三版镜头组 ff2：b2_lantern、c1_cobweb、c1_inkdesk。画面只由时间决定，不含歌词。 */
(function () {
  'use strict';
  const A = XYT.art, K = XYT.kit, W = A.W, H = A.H, TAU = Math.PI * 2;
  const { clamp, lerp, smooth, easeOut, easeInOut, h2, noise1, rgba } = A;
  const ss = (a, b, x) => smooth((x - a) / (b - a));
  const cache = (k, w, h, fn, sc) => K.cache('ff2_' + k, w, h, sc || 1, fn);
  const S = () => (XYT.sprites && XYT.sprites.S) || 1;
  // 第 off 句第 k 字的镜头内时间；没有歌词时用分镜表里的秒数
  const ct = (c, k, off, fb) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? fb : v - (c.t - c.lt);
  };
  // 平滑步进的积分：用于转速平滑变化时求转角
  const sInt = (x) => (x <= 0 ? 0 : x < 1 ? x * x * x - 0.5 * x * x * x * x : x - 0.5);
  // 拍点包络：约 40 ms 起、再缓慢回落（避免单帧跳变）
  const beatEnv = (c, d, att) => {
    att = att || 0.045;
    const s = Math.max(0, c.b && c.b.since != null ? c.b.since : 9);
    const sp = att * Math.log((att + d) / att), pk = (1 - Math.exp(-sp / att)) * Math.exp(-sp / d);
    const str = c.b && c.b.str != null ? c.b.str : 1;
    return ((1 - Math.exp(-s / att)) * Math.exp(-s / d) / pk) * (0.4 + 0.6 * str);
  };
  const silMod = () => {
    const s = XYT.sil;
    if (s && s.draw) return s;
    return null;
  };
  // 柔光圆斑贴图
  const glowSpr = (col) => cache('glow_' + col, 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.25, rgba(col, 0.55)); gr.addColorStop(0.6, rgba(col, 0.14)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  const glowAt = (g, x, y, rx, ry, col, a) => {
    if (a <= 0.002) return;
    const o = g.globalAlpha; g.globalAlpha = o * a;
    g.drawImage(glowSpr(col), x - rx, y - ry, rx * 2, ry * 2);
    g.globalAlpha = o;
  };
  // 建缓存用：先画到临时画布，再整体模糊一次（模糊半径按设备像素换算，不随分辨率变化）
  const fblur = (g, px) => { g.filter = 'blur(' + (px * g.getTransform().a).toFixed(2) + 'px)'; };
  function blurPass(g, w, h, px, fn, op) {
    const k = g.getTransform().a;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    const t = cv.getContext('2d'); t.scale(k, k); fn(t);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (op) g.globalCompositeOperation = op;
    g.filter = 'blur(' + (px * k).toFixed(2) + 'px)'; g.drawImage(cv, 0, 0); g.restore();
  }
  // 渐细肢体：关节圆 + 梯形段（每块单独填充，绕向不同也不会互相抵消出镂空）
  function limb(g, pts) {
    for (let i = 0; i < pts.length; i++) {
      const [x, y, w] = pts[i];
      g.beginPath(); g.arc(x, y, w / 2, 0, TAU); g.fill();
      if (i < pts.length - 1) {
        const [x2, y2, w2] = pts[i + 1];
        const dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        g.beginPath(); g.moveTo(x + nx * w / 2, y + ny * w / 2); g.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
        g.lineTo(x2 - nx * w2 / 2, y2 - ny * w2 / 2); g.lineTo(x - nx * w / 2, y - ny * w / 2); g.closePath(); g.fill();
      }
    }
  }
  function hoof(g, x, y, ang, s) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(-2.6 * s, -2 * s); g.lineTo(2.6 * s, -2 * s); g.lineTo(3.6 * s, 3.2 * s); g.lineTo(-3.2 * s, 3.2 * s); g.closePath(); g.fill();
    g.restore();
  }

  // =====================================================================
  // b2_lantern
  // =====================================================================
  const LCX = 640, LY0 = 162, LY1 = 540, RIB = [420, 530, 750, 860];
  const RS = 214, CIRC = TAU * RS, SY0 = 188, SH = 330, GY = 292, PAD = 70;

  // 剪纸马（侧面，朝右）：原点在马腹下方地面，y 向上为负
  function horse(g) {
    g.beginPath();
    g.moveTo(22, -90);
    g.bezierCurveTo(36, -100, 51, -115, 61, -126);
    g.bezierCurveTo(63, -128, 66, -128, 69, -125);
    g.bezierCurveTo(78, -118, 88, -108, 93, -102);
    g.bezierCurveTo(96, -99, 95, -95, 91, -94);
    g.bezierCurveTo(86, -93, 82, -95, 77, -97);
    g.bezierCurveTo(72, -99, 68, -101, 65, -105);
    g.bezierCurveTo(61, -103, 58, -96, 55, -88);
    g.bezierCurveTo(52, -80, 50, -74, 47, -70);
    g.bezierCurveTo(45, -64, 40, -60, 32, -58);
    g.bezierCurveTo(14, -53, -14, -53, -30, -57);
    g.bezierCurveTo(-36, -58, -42, -60, -46, -64);
    g.bezierCurveTo(-52, -66, -58, -72, -57, -80);
    g.bezierCurveTo(-56, -88, -48, -94, -38, -94);
    g.bezierCurveTo(-26, -94, -14, -87, -4, -86);
    g.bezierCurveTo(6, -85, 14, -88, 22, -90);
    g.closePath(); g.fill();
    // 耳
    g.beginPath(); g.moveTo(60, -125); g.quadraticCurveTo(58, -134, 61, -139); g.quadraticCurveTo(65, -133, 66, -126); g.closePath(); g.fill();
    // 鬃毛：沿颈脊一条向后飘的波浪带，外缘五个浅弧
    {
      const N = 50, crest = (u) => [lerp(22, 62, u), lerp(-90, -126, u)];
      g.beginPath();
      for (let k = 0; k <= N; k++) {
        const u = k / N, [x, y] = crest(u);
        const o = (2.5 + 4.5 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.04))) + 1.8 * Math.abs(Math.sin(5 * Math.PI * u));
        const px = x - 0.67 * o - 0.35 * o, py = y - 0.74 * o;
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      for (let k = N; k >= 0; k--) { const u = k / N, [x, y] = crest(u); g.lineTo(x + 0.67 * 4, y + 0.74 * 4); }
      g.closePath(); g.fill();
    }
    // 尾（奔跑时扬起后飘）
    g.beginPath();
    g.moveTo(-52, -88);
    g.bezierCurveTo(-64, -98, -82, -96, -94, -86);
    g.bezierCurveTo(-100, -80, -104, -72, -108, -64);
    g.bezierCurveTo(-100, -70, -96, -74, -90, -77);
    g.bezierCurveTo(-94, -70, -96, -64, -98, -58);
    g.bezierCurveTo(-88, -68, -76, -80, -56, -80);
    g.closePath(); g.fill();
    // 四腿：远前腿前探、近前腿屈收、远后腿着地、近后腿后蹬
    limb(g, [[33, -62, 15], [46, -40, 7.5], [60, -21, 5], [64, -15, 5.5]]); hoof(g, 66, -13, -0.5, 1);
    limb(g, [[27, -62, 15], [43, -45, 7.5], [31, -35, 5], [32, -29, 5.2]]); hoof(g, 33, -27, 0.2, 0.95);
    limb(g, [[-35, -66, 18], [-44, -36, 7.5], [-35, -9, 5], [-31, -4, 5.5]]); hoof(g, -30, -3, -0.25, 1);
    limb(g, [[-44, -68, 17], [-64, -42, 7.5], [-78, -20, 5], [-82, -15, 5.2]]); hoof(g, -84, -13, 0.9, 0.95);
    // 鞍、鞍鞯、马镫、缰绳
    g.beginPath(); g.moveTo(-14, -88); g.quadraticCurveTo(-12, -97, -6, -95); g.lineTo(12, -94); g.quadraticCurveTo(18, -97, 20, -90); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-16, -89); g.lineTo(20, -91); g.lineTo(22, -66); g.quadraticCurveTo(3, -61, -16, -66); g.closePath(); g.fill();
    g.fillRect(4.3, -88, 1.6, 36); g.beginPath(); g.ellipse(5, -50, 4, 3, 0, 0, TAU); g.fill();
    g.lineWidth = 1.2; g.strokeStyle = g.fillStyle;
    g.beginPath(); g.moveTo(16, -112); g.quadraticCurveTo(52, -96, 89, -98); g.stroke();
    // 剪纸镂空：鞍鞯上的菱形纹与马颈上的月牙纹
    g.save(); g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const x = -10 + i * 8.5 + (j % 2) * 4.2, y = -82 + j * 8;
      g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 2.6, y); g.lineTo(x, y + 3); g.lineTo(x - 2.6, y); g.closePath(); g.fill();
    }
    g.beginPath(); g.moveTo(-12, -68.5); g.quadraticCurveTo(3, -65, 18, -69.5); g.lineTo(18, -68); g.quadraticCurveTo(3, -63.5, -12, -67); g.closePath(); g.fill();
    g.beginPath(); g.arc(-30, -76, 6, 0.3, 2.6); g.arc(-30, -74, 4.4, 2.6, 0.3, true); g.closePath(); g.fill();
    g.restore();
  }
  // 剪纸松树：弯曲的树干、三根侧枝，枝端是上缘起伏、下缘锯齿的松针簇
  function pine(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const cl = [[0, 0], [-3, -22], [3, -46], [-2, -68], [1, -92]], wd = [10, 7, 5.4, 4, 2.2];
    const L = [], Rt = [];
    for (let k = 0; k < cl.length; k++) {
      const a = cl[Math.max(0, k - 1)], b = cl[Math.min(cl.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l, w = wd[k] / 2;
      L.push([cl[k][0] - nx * w, cl[k][1] - ny * w]); Rt.push([cl[k][0] + nx * w, cl[k][1] + ny * w]);
    }
    g.beginPath(); g.moveTo(L[0][0] - 2, 0);
    for (let k = 1; k < L.length; k++) { const m = [(L[k - 1][0] + L[k][0]) / 2, (L[k - 1][1] + L[k][1]) / 2]; g.quadraticCurveTo(L[k - 1][0], L[k - 1][1], m[0], m[1]); }
    g.lineTo(Rt[Rt.length - 1][0], Rt[Rt.length - 1][1]);
    for (let k = Rt.length - 2; k >= 0; k--) { const m = [(Rt[k + 1][0] + Rt[k][0]) / 2, (Rt[k + 1][1] + Rt[k][1]) / 2]; g.quadraticCurveTo(Rt[k + 1][0], Rt[k + 1][1], m[0], m[1]); }
    g.lineTo(Rt[0][0] + 2, 0); g.closePath(); g.fill();
    // 侧枝（略向上弯）
    for (const [x0, y0, x1, y1, w] of [[-2, -30, -27, -42, 4.2], [2, -51, 24, -61, 3.6], [-1, -70, -19, -78, 3]]) {
      const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 2, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2;
      g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.quadraticCurveTo(mx + nx * 0.6, my + ny * 0.6, x1, y1); g.quadraticCurveTo(mx - nx * 0.6, my - ny * 0.6, x0 - nx, y0 - ny); g.closePath(); g.fill();
    }
    // 松针簇：扇形，上缘起伏、下缘锯齿，镂出放射状的针纹
    const CL = [[-28, -47, 38, 15, 1], [25, -66, 34, 14, 2], [-19, -83, 28, 12, 3], [1, -99, 24, 11, 4]];
    for (const [cx, cy, w, h, sd] of CL) {
      g.beginPath();
      const n = 18;
      for (let k = 0; k <= n; k++) {
        const u = k / n, e = Math.pow(Math.sin(Math.PI * u), 0.6);
        const yy = cy - h * (0.1 + 0.9 * e) + 1.8 * Math.sin(u * 3 * Math.PI + sd) * e;
        k ? g.lineTo(cx - w / 2 + w * u, yy) : g.moveTo(cx - w / 2, cy);
      }
      const teeth = Math.max(5, Math.round(w / 3.4));
      for (let k = teeth * 2; k >= 0; k--) {
        const u = k / (teeth * 2), e = Math.pow(Math.sin(Math.PI * u), 0.5);
        g.lineTo(cx - w / 2 + w * u, cy + (k % 2 ? h * 0.3 * e : -h * 0.04));
      }
      g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    for (const [cx, cy, w, h] of CL) {
      for (let k = -3; k <= 3; k++) {
        const a = k * 0.32, l0 = h * 0.25, l1 = h * 0.82 * (1 - 0.12 * Math.abs(k));
        const ox = cx + k * w * 0.02, oy = cy + h * 0.15, ux = Math.sin(a) * (w / h) * 0.55, uy = -Math.cos(a);
        g.beginPath(); g.moveTo(ox + ux * l0 - 0.45, oy + uy * l0); g.lineTo(ox + ux * l1, oy + uy * l1); g.lineTo(ox + ux * l0 + 0.45, oy + uy * l0); g.closePath(); g.fill();
      }
    }
    g.restore();
  }
  function goose(g, x, y, s, ph) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(0, -1, 9, -1); g.lineTo(12, -1.5); g.lineTo(9, 1); g.quadraticCurveTo(0, 2, -9, 0); g.fill();
    g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(-6, -8 - ph, -12, -11 - ph); g.quadraticCurveTo(-4, -6, 3, 0); g.fill();
    g.restore();
  }
  // 乌篷船：整块实心船身（平底、舷线向船头翘起成尖），船上一段低长的篷，篷上斜向编织缝
  function boatCut(g, x, y) {
    g.save(); g.translate(x, y);
    g.beginPath();
    g.moveTo(-52, -11);
    g.quadraticCurveTo(-12, -5, 30, -7);
    g.quadraticCurveTo(50, -9, 62, -19);
    g.quadraticCurveTo(55, -6, 43, 3);
    g.lineTo(-38, 4);
    g.quadraticCurveTo(-48, 2, -55, -5);
    g.closePath(); g.fill();
    // 主篷（低长的拱）与船尾一段略矮的小篷
    g.beginPath(); g.moveTo(-32, -6); g.lineTo(-32, -17); g.quadraticCurveTo(-2, -31, 28, -17); g.lineTo(28, -6); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-44, -7); g.lineTo(-44, -13); g.quadraticCurveTo(-39, -21, -31, -19); g.lineTo(-31, -7); g.closePath(); g.fill();
    // 篷上的斜向编织缝（细长平行四边形）
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 5; k++) {
      const cx = -22 + k * 10.5, cy = -14;
      g.beginPath(); g.moveTo(cx - 0.6 + 1.6, cy - 4); g.lineTo(cx + 0.6 + 1.6, cy - 4); g.lineTo(cx + 0.6 - 1.6, cy + 4); g.lineTo(cx - 0.6 - 1.6, cy + 4); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // 篙斜插入水，系住船头
    g.lineWidth = 1.8; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(47, -50); g.lineTo(37, 12); g.stroke();
    g.restore();
  }
  const RIDER_HAT = true;
  // 转轮展开图（一周）：剪纸全部画成黑色，最后统一着色
  function lanternStrip(blur) {
    const sp = silMod() ? 'p' : 'n';
    const raw = cache('lan_strip_raw_' + sp, CIRC + PAD, SH, (g) => {
      g.fillStyle = '#000'; g.strokeStyle = '#000';
      const rep = (fn) => { for (const off of [0, CIRC]) { g.save(); g.translate(off, 0); fn(); g.restore(); } };
      const w0 = 690, w1 = 1010;
      const groundY = (s) => {
        const u = s / CIRC * TAU;
        const land = GY + 5 * Math.sin(u * 3 + 0.7) + 3 * Math.sin(u * 7 + 2.1);
        const dw = ss(w0 - 40, w0 + 10, s) * (1 - ss(w1 - 10, w1 + 40, s));
        return lerp(land, GY + 10, dw);
      };
      rep(() => {
        // 远山（浅一层的薄纸）
        g.save(); g.globalAlpha = 0.3;
        g.beginPath(); g.moveTo(600, GY);
        for (let s = 600; s <= 1110; s += 6) {
          const u = (s - 600) / 510;
          const y = GY - 40 - 95 * Math.pow(Math.sin(u * Math.PI), 0.8) * (0.62 + 0.38 * Math.abs(Math.sin(u * 7.3 + 0.5))) - 10 * Math.sin(u * 23);
          g.lineTo(s, y);
        }
        g.lineTo(1110, GY); g.closePath(); g.fill();
        g.globalAlpha = 0.2;
        g.beginPath(); g.moveTo(560, GY);
        for (let s = 560; s <= 760; s += 6) { const u = (s - 560) / 200; g.lineTo(s, GY - 30 - 120 * Math.pow(Math.sin(u * Math.PI), 1.3) - 6 * Math.sin(u * 19)); }
        g.lineTo(760, GY); g.closePath(); g.fill();
        g.restore();
        // 地面与水
        g.beginPath(); g.moveTo(-10, SH);
        for (let s = -10; s <= CIRC + 10; s += 4) g.lineTo(s, groundY(s));
        g.lineTo(CIRC + 10, SH); g.closePath(); g.fill();
        // 草丛
        for (let i = 0; i < 70; i++) {
          const s = h2(i, 11) * CIRC;
          if (s > w0 - 30 && s < w1 + 30) continue;
          const y = groundY(s), hh = 6 + h2(i, 12) * 9;
          g.beginPath(); g.moveTo(s - 4, y + 1); g.quadraticCurveTo(s - 2, y - hh * 0.6, s - 5, y - hh); g.quadraticCurveTo(s, y - hh * 0.5, s + 1, y + 1);
          g.quadraticCurveTo(s + 3, y - hh * 0.7, s + 6, y - hh * 0.85); g.quadraticCurveTo(s + 3, y - hh * 0.3, s + 4, y + 1); g.closePath(); g.fill();
        }
        // 浪花镂空
        g.save(); g.globalCompositeOperation = 'destination-out';
        for (let s = w0 + 20; s < w1 - 20; s += 22) {
          if (s > 786 && s < 916) continue;
          const y = GY + 14 + 3 * Math.sin(s * 0.13);
          g.beginPath(); g.arc(s, y, 6, Math.PI * 1.05, Math.PI * 1.95); g.arc(s + 1.5, y + 1, 4, Math.PI * 1.95, Math.PI * 1.05, true); g.closePath(); g.fill();
        }
        g.restore();
        // 芦苇
        for (let i = 0; i < 9; i++) {
          const s = w1 + 6 + i * 7 + h2(i, 31) * 4, y = groundY(s), hh = 24 + h2(i, 32) * 18, lean = -4 - h2(i, 33) * 5;
          g.lineWidth = 1.4; g.beginPath(); g.moveTo(s, y); g.quadraticCurveTo(s + lean * 0.3, y - hh * 0.6, s + lean, y - hh); g.stroke();
          g.beginPath(); g.ellipse(s + lean, y - hh - 4, 1.8, 5, lean * 0.04, 0, TAU); g.fill();
        }
        pine(g, 560, groundY(560) + 2, 1.0);
        boatCut(g, 850, GY + 9);
        for (let i = 0; i < 4; i++) goose(g, 1130 + i * 26 + (i % 2) * 6, 92 + i * 9 - (i % 2) * 4, 0.9 - i * 0.08, i % 2 ? 2 : -1);
        // 马与骑者、背剑少年（剪纸刚体，不做关节动作）
        g.save(); g.translate(380, groundY(380) + 1); g.scale(1.22, 1.22); horse(g);
        const SL = silMod();
        // 骑者：整身侧坐剪影坐在鞍上（与马同色，腿与马身连成整块）
        if (SL) SL.draw(g, 'old', 'sitSide', 1, -90, 112, 0.5, { facing: 1, wind: 0.55, windDir: -1, body: '#000', accent: '#000', rim: null, hat: RIDER_HAT });
        g.restore();
        if (SL) {
          // 少年前倾追赶（整张剪纸绕脚底倾斜，不改姿势）
          g.save(); g.translate(200, groundY(200) + 1); g.rotate(0.16);
          SL.draw(g, 'youth', 'standSide', 0, 0, 138, 0.5, { facing: 1, wind: 0.9, windDir: -1, body: '#000', accent: '#000', rim: null });
          g.restore();
        }
      });
      // 统一着色为影子色
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#4a2814'; g.fillRect(0, 0, CIRC + PAD, SH);
    });
    if (!blur) return raw;
    return cache('lan_strip_b' + blur + '_' + sp, CIRC + PAD, SH, (g) => {
      fblur(g, blur); g.drawImage(raw, 0, 0, CIRC + PAD, SH); g.filter = 'none';
    });
  }
  // 左右翻转的展开图：背面的影子透过来是反的，逐列取样时列内的内容也要反向
  function lanternStripM(blur) {
    const src = lanternStrip(blur);
    return cache('lan_strip_m' + blur + '_' + (silMod() ? 'p' : 'n'), CIRC + PAD, SH, (g) => {
      g.translate(CIRC + PAD, 0); g.scale(-1, 1); g.drawImage(src, 0, 0, CIRC + PAD, SH);
    });
  }
  // 把展开图按圆柱投影逐列贴到灯罩上（前面压缩变淡，背面几乎看不见且反向）
  let drumBuf = null;
  function drumLayer(th) {
    const sc = S() * 0.6;
    const front = lanternStrip(1.1), back = lanternStripM(3.2);
    // 底下多留 3px 透明行：地面的下沿在缓冲内由插值过渡（推镜时不整像素跳）
    const wpx = Math.ceil(2 * RS * sc), hpx = Math.ceil(SH * sc), hb = hpx + 3;
    if (!drumBuf) drumBuf = document.createElement('canvas');
    if (drumBuf.width !== wpx || drumBuf.height !== hb) { drumBuf.width = wpx; drumBuf.height = hb; }
    const g = drumBuf.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, wpx, hb);
    const k = front.width / front.lw;
    const step1 = 2;
    for (let pass = 0; pass < 2; pass++) {
      const src = pass ? front : back;
      const step = pass ? step1 : step1 * 2;
      for (let px = 0; px < wpx; px += step) {
        const u = ((px + step / 2) / sc - RS) / RS;
        if (Math.abs(u) > 0.99) continue;
        const psi = Math.asin(u), cp = Math.cos(psi);
        const ang = pass ? psi : Math.PI - psi;
        let s = ((ang - th) * RS) % CIRC; if (s < 0) s += CIRC;
        const sw = step / sc / cp;
        g.globalAlpha = pass ? ss(0.06, 0.55, cp) : 0.1 * ss(0.05, 0.4, cp);
        let sx = s;
        if (!pass) { const s2 = s < sw / 2 ? s + CIRC : s; sx = CIRC + PAD - s2 - sw / 2; }
        g.drawImage(src, sx * k, 0, Math.max(0.5, sw * k), src.height, px, 0, step, hpx);
      }
    }
    return drumBuf;
  }
  // 灯罩轮廓（六角形透视：两侧面上沿略低、下沿略高）
  function shadePath(g) {
    g.beginPath();
    g.moveTo(RIB[0], LY0 + 5); g.lineTo(RIB[1], LY0); g.lineTo(RIB[2], LY0); g.lineTo(RIB[3], LY0 + 5);
    g.lineTo(RIB[3], LY1 - 5); g.lineTo(RIB[2], LY1); g.lineTo(RIB[1], LY1); g.lineTo(RIB[0], LY1 - 5); g.closePath();
  }
  const lanBg = () => cache('lan_bg', W, H, (g) => {
    // 后墙：旧木板
    const gr = g.createRadialGradient(640, 340, 40, 640, 360, 820);
    gr.addColorStop(0, '#3a2a22'); gr.addColorStop(0.45, '#241913'); gr.addColorStop(1, '#0d0a09');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const R = A.rng(812);
    for (let x = -20; x < W; x += 92 + R() * 20) {
      g.fillStyle = 'rgba(8,5,4,0.5)'; g.fillRect(x, 0, 2, H);
      g.fillStyle = 'rgba(120,80,50,0.05)'; g.fillRect(x + 2, 0, 1.5, H);
      for (let k = 0; k < 14; k++) {
        const gx = x + 8 + R() * 76, a = 0.03 + R() * 0.04;
        g.strokeStyle = `rgba(${R() < 0.5 ? '10,6,4' : '110,74,48'},${a})`; g.lineWidth = 0.8 + R() * 1.4;
        g.beginPath(); g.moveTo(gx, 0);
        for (let y = 0; y <= H; y += 40) g.lineTo(gx + Math.sin(y * 0.01 + k) * 3 + (R() - 0.5) * 2, y);
        g.stroke();
      }
    }
    // 远处虚化的两三盏灯（更远、更暗）
    for (const [x, y, r, a] of [[170, 300, 46, 0.28], [1108, 232, 34, 0.22], [1192, 452, 22, 0.16]]) {
      const b = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
      b.addColorStop(0, `rgba(240,170,90,${a * 0.5})`); b.addColorStop(1, 'rgba(240,170,90,0)');
      g.fillStyle = b; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      const d = g.createRadialGradient(x, y - r * 0.1, r * 0.1, x, y, r);
      d.addColorStop(0, `rgba(255,214,150,${a * 1.6})`); d.addColorStop(0.8, `rgba(232,160,88,${a * 1.2})`); d.addColorStop(1, 'rgba(232,160,88,0)');
      g.fillStyle = d; g.beginPath(); g.ellipse(x, y, r * 0.86, r, 0, 0, TAU); g.fill();
    }
    // 顶梁
    const bg = g.createLinearGradient(0, 0, 0, 40);
    bg.addColorStop(0, '#0a0706'); bg.addColorStop(0.8, '#17100c'); bg.addColorStop(1, '#2a1c14');
    g.fillStyle = bg; g.fillRect(0, 0, W, 38);
    g.fillStyle = 'rgba(170,110,60,0.18)'; g.fillRect(380, 36, 520, 2);
    // 中景右侧立柱
    const pg = g.createLinearGradient(1004, 0, 1070, 0);
    pg.addColorStop(0, '#2e1f17'); pg.addColorStop(0.2, '#1a110d'); pg.addColorStop(1, '#0c0807');
    g.fillStyle = pg; g.fillRect(1004, 38, 66, H);
    // 冷色暗角（墙角的蓝灰阴影）
    const cg = g.createLinearGradient(0, 0, 0, H);
    cg.addColorStop(0, 'rgba(45,90,107,0.10)'); cg.addColorStop(0.5, 'rgba(45,90,107,0)'); cg.addColorStop(1, 'rgba(45,90,107,0.08)');
    g.fillStyle = cg; g.fillRect(0, 0, W, H);
    // 灯光映到墙上的暖晕（I=1）、右柱迎光一侧的暖边
    g.globalCompositeOperation = 'lighter';
    const w1 = g.createRadialGradient(640, 370, 0, 640, 370, 640);
    w1.addColorStop(0, 'rgba(168,88,42,0.4)'); w1.addColorStop(0.25, 'rgba(168,88,42,0.22)'); w1.addColorStop(0.6, 'rgba(168,88,42,0.056)'); w1.addColorStop(1, 'rgba(168,88,42,0)');
    g.fillStyle = w1; g.save(); g.translate(640, 370); g.scale(1, 520 / 640); g.translate(-640, -370); g.fillRect(0, -200, W, H + 400); g.restore();
    const w2 = g.createRadialGradient(640, 350, 0, 640, 350, 340);
    w2.addColorStop(0, 'rgba(232,160,88,0.2)'); w2.addColorStop(0.25, 'rgba(232,160,88,0.11)'); w2.addColorStop(0.6, 'rgba(232,160,88,0.028)'); w2.addColorStop(1, 'rgba(232,160,88,0)');
    g.fillStyle = w2; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(224,154,88,0.16)'; g.fillRect(1004, 40, 2.5, H);
    g.globalCompositeOperation = 'source-over';
  });
  // 木案（灯下）
  const lanTable = () => cache('lan_table2', W, 112, (g) => {
    g.translate(0, 2);
    const y0 = 0;
    const tg = g.createLinearGradient(0, y0, 0, 110);
    tg.addColorStop(0, '#2c1d15'); tg.addColorStop(1, '#170f0b');
    g.fillStyle = tg;
    g.beginPath(); g.moveTo(120, y0); g.lineTo(1160, y0); g.lineTo(1250, 110); g.lineTo(30, 110); g.closePath(); g.fill();
    const R = A.rng(55);
    for (let k = 0; k < 40; k++) {
      const y = y0 + 3 + R() * 104;
      g.strokeStyle = `rgba(${R() < 0.5 ? '8,5,3' : '120,80,50'},${0.05 + R() * 0.06})`; g.lineWidth = 0.6 + R();
      g.beginPath(); g.moveTo(40, y);
      for (let x = 40; x <= 1240; x += 60) g.lineTo(x, y + Math.sin(x * 0.006 + k) * 1.6);
      g.stroke();
    }
    g.fillStyle = 'rgba(190,130,70,0.35)'; g.fillRect(120, y0, 1040, 1.5);
  });
  const lanFore = () => cache('lan_fore', 200, H, (g) => {
    fblur(g, 7);
    const fg = g.createLinearGradient(0, 0, 150, 0);
    fg.addColorStop(0, '#070504'); fg.addColorStop(0.8, '#120c09'); fg.addColorStop(1, '#3a2418');
    g.fillStyle = fg; g.fillRect(-30, -20, 150, H + 40);
    g.filter = 'none';
  });
  // 泪滴形的烛焰亮核（已模糊，像隔着纸）：焰根在贴图 86% 高处。颜色固定为暖琥珀，用普通叠加画上，不会把红色顶满而偏黄绿
  const flameSpr = () => cache('lan_flame2', 64, 128, (g) => {
    fblur(g, 5);
    const gr = g.createRadialGradient(32, 92, 2, 32, 84, 34);
    gr.addColorStop(0, 'rgba(255,210,124,1)'); gr.addColorStop(0.5, 'rgba(252,190,106,0.8)'); gr.addColorStop(1, 'rgba(240,150,72,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(32, 16); g.bezierCurveTo(41, 46, 50, 70, 48, 92); g.bezierCurveTo(46, 108, 18, 108, 16, 92); g.bezierCurveTo(14, 70, 23, 46, 32, 16); g.fill();
    g.filter = 'none';
  });
  // 灯罩纸纹
  const paperTex = () => cache('lan_paper', 440, 380, (g) => {
    const R = A.rng(99);
    for (let i = 0; i < 900; i++) {
      const x = R() * 440, y = R() * 380, l = 3 + R() * 14, a = R() * TAU;
      g.strokeStyle = `rgba(${R() < 0.6 ? '120,70,30' : '255,240,210'},${0.05 + R() * 0.08})`; g.lineWidth = 0.4 + R() * 0.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + R() * 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const x = R() * 440, y = R() * 380;
      g.fillStyle = `rgba(150,90,40,${0.03 + R() * 0.04})`; g.beginPath(); g.ellipse(x, y, 6 + R() * 18, 4 + R() * 10, R() * 3, 0, TAU); g.fill();
    }
  });
  const shadeTex = () => cache('lan_shade2', 440, 380, (g) => {
    const fx = g.createLinearGradient(0, 0, 440, 0);
    fx.addColorStop(0, '#7e3420'); fx.addColorStop(0.12, '#b0642f'); fx.addColorStop(0.25, '#c88a4a');
    fx.addColorStop(0.5, '#cf9a5a'); fx.addColorStop(0.75, '#c88a4a'); fx.addColorStop(0.88, '#b0642f'); fx.addColorStop(1, '#7e3420');
    g.fillStyle = fx; g.fillRect(0, 0, 440, 380);
    const fv = g.createLinearGradient(0, 0, 0, 380);
    fv.addColorStop(0, 'rgba(60,20,8,0.42)'); fv.addColorStop(0.3, 'rgba(60,20,8,0.06)'); fv.addColorStop(0.75, 'rgba(60,20,8,0)'); fv.addColorStop(1, 'rgba(60,20,8,0.3)');
    g.fillStyle = fv; g.fillRect(0, 0, 440, 380);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.drawImage(paperTex(), 0, 0, 440, 380);
  });
  // 灯罩上静止的彩绘边（红底金线回纹），画在外层纸上，不随转轮转动
  // 上下各留 2px 透明边：推镜时边缘由贴图插值过渡，不会整像素跳动
  const borderTex = () => cache('lan_border2', 440, 22, (g) => {
    g.translate(0, 2);
    g.fillStyle = '#b84a34'; g.fillRect(0, 0, 440, 18);
    g.strokeStyle = '#e7b766'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(0, 2); g.lineTo(440, 2); g.moveTo(0, 16); g.lineTo(440, 16); g.stroke();
    g.strokeStyle = 'rgba(80,24,14,0.7)'; g.lineWidth = 1.4;
    for (let x = 5; x < 440; x += 18) {
      g.beginPath(); g.moveTo(x, 13); g.lineTo(x, 5.5); g.lineTo(x + 10, 5.5); g.lineTo(x + 10, 11); g.lineTo(x + 4, 11); g.lineTo(x + 4, 8.5); g.stroke();
    }
  });
  // 侧面按六角透视斜切：外缘上沿低 5px、下沿高 5px
  const PERS = 5;
  function onFace(g, face, sg, fn) {
    g.save();
    if (face === 0) { g.translate(RIB[1], 0); g.transform(1, -sg * PERS / 110, 0, 1, 0, 0); g.translate(-RIB[1], 0); }
    if (face === 2) { g.translate(RIB[2], 0); g.transform(1, sg * PERS / 110, 0, 1, 0, 0); g.translate(-RIB[2], 0); }
    fn(); g.restore();
  }
  function tassel(g, x, y, len, wid, t, i, I, side) {
    const sw = 0.5 * Math.sin(t * 1.1 + i * 1.7);
    g.strokeStyle = '#5a1e14'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + sw * 0.1, y + 12); g.stroke();
    // 盘长结
    g.save(); g.translate(x + sw * 0.15, y + 19); g.rotate(Math.PI / 4);
    g.fillStyle = '#962f20'; g.fillRect(-5.5, -5.5, 11, 11);
    g.strokeStyle = 'rgba(40,8,4,0.6)'; g.lineWidth = 0.8; g.strokeRect(-3, -3, 6, 6);
    g.restore();
    // 青玉珠
    g.fillStyle = '#2d5a6b'; g.beginPath(); g.arc(x + sw * 0.25, y + 33, 4.4, 0, TAU); g.fill();
    g.fillStyle = rgba('#a8d8de', 0.55); g.beginPath(); g.arc(x + sw * 0.25 + side * 1.4, y + 31.6, 1.5, 0, TAU); g.fill();
    // 流苏：上紧下散
    g.fillStyle = '#7e2416';
    g.beginPath(); g.moveTo(x - 3, y + 38); g.lineTo(x + 3, y + 38); g.lineTo(x + 2.5, y + 44); g.lineTo(x - 2.5, y + 44); g.closePath(); g.fill();
    const n = Math.round(wid / 1.1);
    for (let k = 0; k <= n; k++) {
      const u = k / n - 0.5, x0 = x + u * 5;
      g.strokeStyle = k % 3 === 0 ? '#8a281a' : k % 3 === 1 ? '#a8422f' : '#952f20'; g.lineWidth = 1.05;
      g.beginPath(); g.moveTo(x0, y + 43); g.quadraticCurveTo(x + u * wid * 0.8 + sw * 0.5, y + 43 + len * 0.5, x + u * wid + sw, y + 43 + len - Math.abs(u) * 4); g.stroke();
    }
    // 迎光一侧的暖边
    g.strokeStyle = rgba('#f4c070', 0.3 * I); g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - side * 2.5, y + 45); g.quadraticCurveTo(x - side * wid * 0.4 + sw * 0.5, y + 43 + len * 0.5, x - side * wid * 0.5 + sw, y + 40 + len); g.stroke();
  }
  function lanternShot(g, c) {
    const lt = c.lt, dur = c.dur;
    const tA = ct(c, 0, 1, 2.731), tB = ct(c, 7, 1, 5.611);
    // 灯焰：缓慢摇曳 + 第11句随拍 ±6% + 第12句第1字拔高变亮 + 第12句第8字一晃回落
    const up = easeOut(clamp((lt - tA) / 0.6)), dn = smooth(clamp((lt - tB - 0.1) / 0.8));
    const boost = 0.15 * up * (1 - dn);
    const wob = lt > tB ? 0.035 * Math.sin((lt - tB) * TAU * 3.2) * Math.exp(-(lt - tB) / 0.28) : 0;
    const flick = 0.022 * (noise1(lt * 3.1, 7) - 0.5) * 2 + 0.01 * Math.sin(lt * 9.3);
    const beatK = 1 - 0.6 * smooth(clamp((lt - (tA - 0.6)) / 0.6));
    // 拍点亮度脉冲用约 80 ms 的起音，三四帧内升起，不是一帧跳亮
    const I = 1 + flick + 0.06 * beatEnv(c, 0.3, 0.08) * beatK + boost + wob;
    const flameH = 1 + 0.5 * up * (1 - dn) + wob * 3;
    // 转轮：4 s 一圈，追逐的一对约在 1.3 s（第11句中段）与 4.7 s 经过正面；第12句第1字后 1.5 s 平滑加快到 2.6 s 一圈；第12句第8字后 1.5 s 平滑回落
    const w0 = TAU / 4, w1 = TAU / 2.6, D = 1.5;
    const th = 3.2 + w0 * lt + (w1 - w0) * D * (sInt((lt - tA) / D) - sInt((lt - tB) / D));

    // 镜头：整镜 1.00→1.04 缓推（含入场转场段，保持连续）
    const pc = clamp((lt + 0.7) / (dur + 0.7));
    const z = 1 + 0.04 * easeInOut(pc);
    const cam = (k) => { const zz = 1 + (z - 1) * k; g.translate(640, 372); g.scale(zz, zz); g.translate(-640, -372); };

    // 后墙（含 I=1 时的暖光，已烘焙）；只叠加灯焰亮度的变化量。墙更远，推镜量取一半
    g.save(); cam(0.5);
    g.drawImage(lanBg(), 0, 0, W, H);
    if (I > 1.005) { g.globalCompositeOperation = 'lighter'; glowAt(g, 640, 360, 330, 300, '#c8783a', (I - 1) * 1.8); }
    else if (I < 0.995) glowAt(g, 640, 360, 330, 300, '#0c0806', (1 - I) * 2.4);
    g.globalCompositeOperation = 'lighter';
    [[230, 300, 46], [1108, 232, 34], [1192, 452, 22]].forEach(([x, y, r], i) => glowAt(g, x, y, r * 1.5, r * 1.6, '#e8a060', 0.10 + 0.03 * noise1(lt * 1.7 + i * 5, 3 + i)));
    g.globalCompositeOperation = 'source-over';
    g.restore();

    g.save(); cam(1);
    // 木案与灯下光池
    // 案面后沿压低，灯下的流苏与案面之间留出明显空隙
    g.drawImage(lanTable(), 0, 658, W, 112);
    g.globalCompositeOperation = 'lighter';
    glowAt(g, 640, 704, 430, 64, '#c87838', 0.55 * I);
    glowAt(g, 640, 698, 150, 20, '#ffd090', 0.45 * I * (0.9 + 0.1 * flameH));
    g.globalCompositeOperation = 'source-over';
    // 吊绳与宝顶（葫芦形）
    // 吊绳细而暗（上方是歌词区）
    g.strokeStyle = '#26100a'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(640, 36); g.lineTo(640, 129); g.stroke();
    g.fillStyle = '#1e120c';
    g.beginPath(); g.ellipse(640, 132.5, 5.5, 4, 0, 0, TAU); g.fill();
    g.fillStyle = rgba('#e0a050', 0.25 * I); g.beginPath(); g.ellipse(640, 134.5, 4, 1.6, 0, 0, Math.PI); g.fill();
    // 上层小顶
    g.fillStyle = '#1e120c';
    g.beginPath(); g.moveTo(612, 136); g.lineTo(668, 136); g.lineTo(700, 144); g.lineTo(580, 144); g.closePath(); g.fill();
    // 主檐：六角飞檐，外角龙头挑角上翘；檐底受灯光照亮
    g.beginPath();
    g.moveTo(574, 143); g.lineTo(706, 143);
    g.quadraticCurveTo(800, 150, 880, 152); g.quadraticCurveTo(896, 151, 902, 140); g.quadraticCurveTo(906, 150, 896, 158);
    g.lineTo(892, 163); g.lineTo(388, 163); g.lineTo(384, 158); g.quadraticCurveTo(374, 150, 378, 140); g.quadraticCurveTo(384, 151, 400, 152);
    g.quadraticCurveTo(480, 150, 574, 143); g.closePath(); g.fill();
    g.fillStyle = rgba('#e8a050', 0.55 * I); g.fillRect(392, 160, 496, 3.5);
    g.fillStyle = rgba('#b8822e', 0.45); g.fillRect(576, 143, 128, 1.5);
    g.fillStyle = rgba('#e8a050', 0.25 * I); g.beginPath(); g.arc(902, 141, 2.2, 0, TAU); g.arc(378, 141, 2.2, 0, TAU); g.fill();
    // 灯罩
    g.save(); shadePath(g); g.clip();
    // 纸面底色（两侧暗、正面亮、上下渐暗、纸纹），静态缓存
    g.drawImage(shadeTex(), RIB[0], LY0, 440, 380);
    // 灯焰透过纸面的亮斑：竖长、偏下，不是一轮落日
    g.globalCompositeOperation = 'lighter';
    const fy = 398 - 16 * (flameH - 1);
    glowAt(g, 640, fy, 320, 320 * (0.92 + 0.08 * flameH), '#e0904c', 0.11 * I);
    glowAt(g, 640, fy + 20, 120, 170 * flameH, '#f0a058', 0.05 * I);
    // 烛焰透过纸的泪滴形亮核：焰根固定在烛芯，拔高时向上长（普通叠加，红色不溢出）
    g.globalCompositeOperation = 'source-over';
    {
      const fh = 74 * flameH, fw = 38 * (0.92 + 0.08 * flameH), base = 470;
      const o = g.globalAlpha; g.globalAlpha = o * clamp(0.9 + 0.5 * (I - 1), 0, 1);
      g.drawImage(flameSpr(), 640 - fw / 2, base - fh * 0.86, fw, fh);
      g.globalAlpha = o;
    }
    g.globalCompositeOperation = 'multiply';
    // 转轮剪纸影
    { const db = drumLayer(th); g.drawImage(db, LCX - RS, SY0, RS * 2, SH * db.height / (db.height - 3)); }
    g.globalCompositeOperation = 'source-over';
    // 侧面斜看更暗
    const sd = g.createLinearGradient(RIB[0], 0, RIB[1], 0);
    sd.addColorStop(0, 'rgba(40,12,6,0.5)'); sd.addColorStop(1, 'rgba(40,12,6,0.1)');
    g.fillStyle = sd; g.fillRect(RIB[0], LY0, RIB[1] - RIB[0], LY1 - LY0);
    const sd2 = g.createLinearGradient(RIB[3], 0, RIB[2], 0);
    sd2.addColorStop(0, 'rgba(40,12,6,0.5)'); sd2.addColorStop(1, 'rgba(40,12,6,0.1)');
    g.fillStyle = sd2; g.fillRect(RIB[2], LY0, RIB[3] - RIB[2], LY1 - LY0);
    // 彩绘边（外层纸上，静止）
    g.globalCompositeOperation = 'multiply';
    const bt = borderTex();
    for (const [yy, dy] of [[180, 1], [503, -1]]) {
      g.drawImage(bt, 110, 0, 220, 22, RIB[1], yy - 2, 220, 22);
      onFace(g, 0, dy, () => g.drawImage(bt, 0, 0, 110, 22, RIB[0], yy - 2, 110, 22));
      onFace(g, 2, dy, () => g.drawImage(bt, 330, 0, 110, 22, RIB[2], yy - 2, 110, 22));
    }
    g.globalCompositeOperation = 'source-over';
    // 整体亮度随灯焰
    if (I > 1) { g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#e89450', clamp((I - 1) * 0.3, 0, 0.08)); g.fillRect(RIB[0], LY0, 440, 380); }
    else { g.fillStyle = rgba('#200a04', clamp((1 - I) * 1.2, 0, 0.3)); g.fillRect(RIB[0], LY0, 440, 380); }
    g.globalCompositeOperation = 'source-over';
    g.restore();
    // 每面的木框（上下横档 + 竖骨），竖骨背光为深色，内缘一线暖光
    g.fillStyle = '#26170f';
    onFace(g, 0, 1, () => g.fillRect(RIB[0], LY0, 110, 9)); onFace(g, 0, -1, () => g.fillRect(RIB[0], LY1 - 9, 110, 9));
    onFace(g, 2, 1, () => g.fillRect(RIB[2], LY0, 110, 9)); onFace(g, 2, -1, () => g.fillRect(RIB[2], LY1 - 9, 110, 9));
    g.fillRect(RIB[1], LY0, 220, 9); g.fillRect(RIB[1], LY1 - 9, 220, 9);
    g.fillStyle = rgba('#e8a858', 0.28 * I);
    g.fillRect(RIB[1], LY0 + 9, 220, 1.2); g.fillRect(RIB[1], LY1 - 10.2, 220, 1.2);
    RIB.forEach((x, i) => {
      const outer = i === 0 || i === 3, w = outer ? 9 : 7;
      const y0 = LY0 + (outer ? PERS : 0), y1 = LY1 - (outer ? PERS : 0);
      g.fillStyle = '#2b1a12'; g.fillRect(x - w / 2, y0, w, y1 - y0);
      g.fillStyle = rgba('#e8a858', 0.3 * I); g.fillRect(x + (x < 640 ? w / 2 - 1.4 : -w / 2), y0 + 9, 1.4, y1 - y0 - 18);
    });
    // 底座：略外扩的六角底板（上沿受光），下接收窄的底和中心流苏
    g.fillStyle = '#21140e';
    g.beginPath(); g.moveTo(398, LY1 - 2); g.lineTo(882, LY1 - 2); g.quadraticCurveTo(892, LY1 + 2, 896, LY1 - 6); g.quadraticCurveTo(896, LY1 + 8, 880, LY1 + 14);
    g.lineTo(400, LY1 + 14); g.quadraticCurveTo(384, LY1 + 8, 384, LY1 - 6); g.quadraticCurveTo(388, LY1 + 2, 398, LY1 - 2); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(430, LY1 + 14); g.lineTo(850, LY1 + 14); g.lineTo(730, LY1 + 28); g.lineTo(550, LY1 + 28); g.closePath(); g.fill();
    g.fillStyle = rgba('#e8a858', 0.4 * I); g.fillRect(400, LY1 - 2, 480, 1.6);
    g.fillStyle = rgba('#e8a858', 0.1 * I); g.fillRect(550, LY1 + 27, 180, 1.2);
    // 流苏：两外角长穗系于檐角外，底部中心一穗
    tassel(g, 380, 146, 118, 13, lt, 0, I, -1);
    tassel(g, 900, 146, 118, 13, lt, 1, I, 1);
    tassel(g, 640, LY1 + 28, 22, 11, lt, 2, I, 0);
    // 灯周围的暖光微尘，缓慢上升（淡入淡出，不凭空出现）
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 34; i++) {
      const L = 5 + h2(i, 3) * 4, u = ((lt + 10 + h2(i, 4) * L) / L) % 1;
      const x = 640 + (h2(i, 5) - 0.5) * 680 + 14 * Math.sin(lt * 0.4 + i), y = 620 - u * 540;
      const d = Math.hypot((x - 640) / 400, (y - 360) / 300);
      // 靠近灯体 30 px 内渐隐，进入灯体范围时已完全透明（不在灯框边缘突然消失）
      const e = Math.max(RIB[0] - 6 - x, x - (RIB[3] + 6), LY0 - 30 - y, y - (LY1 + 20));
      const a = Math.sin(Math.PI * u) * clamp(1.15 - d, 0, 1) * (0.35 + 0.25 * beatEnv(c, 0.4)) * I * ss(0, 30, e);
      if (a < 0.003) continue;
      const r = 1 + h2(i, 6) * 1.6;
      g.fillStyle = rgba('#ffd9a0', a); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.restore();

    // 前景虚化的暗柱
    g.save(); cam(1.6);
    g.drawImage(lanFore(), -40, 0, 200, H);
    g.restore();
  }
  XYT.registerShot('b2_lantern', {
    name: '走马灯', zone: 'top', night: true, text: '#f7e7c6', shadow: 'rgba(26,14,8,0.9)', accent: '#f0b860', bloom: 0.42,
    draw: lanternShot,
  });
  // =====================================================================
  // c1_cobweb
  // =====================================================================
  const HX = 926, HY = 334, WR = 104, NR = 28, NK = 21;
  const SWP = [782, 248], SWE = [728, 588], SWROT = Math.atan2(54, 340), SWLEN = Math.hypot(54, 340);
  const swAt = (u) => [SWP[0] + (SWE[0] - SWP[0]) * u / SWLEN, SWP[1] + (SWE[1] - SWP[1]) * u / SWLEN];
  const GUARD = (() => { const [x, y] = swAt(68); return [x + Math.cos(SWROT) * 26, y + Math.sin(SWROT) * 26]; })();
  // 狗尾草茎（锚在右侧）
  const stemX = (y) => 1090 - (650 - y) * 0.04 - 6 * Math.sin((650 - y) / 160);
  const TA = [stemX(212), 212], TB = [stemX(458), 458];
  const GRAV = 3724; // 像素/秒²（剑约 1 m ≈ 380 px）
  // 蛛网静态几何（只依赖常量，算一次）
  const WEB = (() => {
    const rad = [];
    for (let i = 0; i < NR; i++) {
      const a = (i + 0.35 * (h2(i, 1) - 0.5)) * TAU / NR;
      const ro = WR * (1 + 0.05 * Math.sin(3 * a + 1) + 0.035 * Math.sin(5 * a + 2));
      rad.push({ a, ro, c: Math.cos(a), s: Math.sin(a) });
    }
    const rin = 15, sp = [];
    for (let k = 0; k < NK; k++) for (let i = 0; i < NR; i++) {
      const q = (k + i / NR) / NK, R = rad[i];
      const r = (rin + (R.ro * 0.93 - rin) * q) * (1 + 0.035 * (h2(k * 31 + i, 5) - 0.5));
      sp.push([HX + R.c * r, HY + R.s * r, i, r, h2(k * 17 + i, 6) < 0.05]);
    }
    const near = (deg) => { let b = 0, bd = 9; rad.forEach((R, i) => { let d = Math.abs(((R.a - deg * Math.PI / 180) % TAU + TAU + Math.PI) % TAU - Math.PI); if (d < bd) { bd = d; b = i; } }); return b; };
    const iL = near(180), iT = near(-55), iB = near(52), iTop = near(-95);
    // 露珠：附着于螺旋丝上，下半部更大
    const beads = [];
    for (let j = 0; j < sp.length - 1; j++) {
      if (sp[j + 1][2] === 0 && sp[j][2] !== NR - 1) continue;
      if (sp[j][4]) continue;
      const n = h2(j, 7) < 0.3 ? 1 : h2(j, 8) < 0.16 ? 2 : 0;
      for (let m = 0; m < n; m++) {
        const u = 0.2 + 0.6 * h2(j * 3 + m, 9);
        const yy = lerp(sp[j][1], sp[j + 1][1], u);
        const big = clamp((yy - HY + 40) / 140, 0, 1);
        beads.push({ j, u, r: 0.5 + Math.pow(h2(j * 5 + m, 10), 2) * 1.8 + big * 1.1, tw: h2(j, 11) });
      }
    }
    // 下落的露珠：附着于左下半边的径向丝上
    const drops = [];
    const cand = rad.map((R, i) => [i, R.a]).filter(([i, a]) => { const d = ((a * 180 / Math.PI) % 360 + 360) % 360; return d > 125 && d < 232; });
    for (let k = 0; k < 6; k++) {
      const [i] = cand[Math.round(k * (cand.length - 1) / 5)];
      drops.push({ i, r0: rad[i].ro * (0.5 + 0.22 * h2(k, 21)), size: 2.2 + h2(k, 22) * 0.8 });
    }
    return { rad, sp, iL, iT, iB, iTop, beads, drops };
  })();
  // 蛛网形变：锚丝断后左半边失去支撑，向下垂落并带阻尼摆动
  function webState(lt, tS) {
    const tau = lt - tS;
    if (tau <= 0) return { on: false, tau };
    const wn = TAU / 1.15, zt = 0.42;
    const resp = 1 - Math.exp(-tau / zt) * (Math.cos(wn * tau) + Math.sin(wn * tau) / (zt * wn));
    const swing = Math.exp(-tau / 0.9) * Math.sin(wn * tau);
    return { on: true, tau, resp, swing };
  }
  function webDef(x, y, st, out) {
    if (!st.on) { out[0] = x; out[1] = y; return out; }
    const rx = (HX - x) / WR;
    const w = smooth((rx + 0.12) / 1.02);
    const vy = clamp((y - (HY - WR)) / (2 * WR), 0, 1);
    const f = 1 - 0.45 * vy;
    const R = st.resp;
    out[0] = x + (HX - x) * 0.2 * w * R + 24 * w * st.swing + 5 * R;
    out[1] = y + 104 * w * f * R + 5 * R * (1 - w) + 4 * w * Math.abs(st.swing);
    return out;
  }
  const _p = [0, 0], _q = [0, 0];
  // 一段丝：松弛时按重力下垂（二次曲线）
  function seg(g, ax, ay, bx, by, L0) {
    const L = Math.hypot(bx - ax, by - ay);
    g.moveTo(ax, ay);
    if (L < L0 - 0.3) {
      const sag = 0.45 * Math.sqrt(L0 * L0 - L * L);
      g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by);
    } else g.lineTo(bx, by);
  }
  const segPt = (ax, ay, bx, by, L0, u, out) => {
    const L = Math.hypot(bx - ax, by - ay);
    const sag = L < L0 - 0.3 ? 0.45 * Math.sqrt(L0 * L0 - L * L) : 0;
    const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
    out[0] = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * mx + u * u * bx;
    out[1] = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * my + u * u * by;
    return out;
  };
  const beadSpr = () => cache('cob_bead', 24, 24, (g) => {
    const gr = g.createRadialGradient(12, 12, 0, 12, 12, 12);
    gr.addColorStop(0, 'rgba(255,250,228,0.95)'); gr.addColorStop(0.28, 'rgba(255,240,200,0.75)'); gr.addColorStop(0.45, 'rgba(240,230,190,0.25)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 24, 24);
  }, 2);
  const starSpr = () => cache('cob_star', 48, 48, (g) => {
    const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,252,236,1)'); gr.addColorStop(0.15, 'rgba(255,246,214,0.6)'); gr.addColorStop(0.5, 'rgba(255,240,200,0.12)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
    g.fillStyle = 'rgba(255,250,230,0.8)';
    g.beginPath(); g.moveTo(24, 2); g.lineTo(25.2, 22.8); g.lineTo(46, 24); g.lineTo(25.2, 25.2); g.lineTo(24, 46); g.lineTo(22.8, 25.2); g.lineTo(2, 24); g.lineTo(22.8, 22.8); g.closePath(); g.fill();
  }, 2);
  // 背景：逆光的草坡（左低右高，朝阳在右上坡脊后的画外）、坡脊亮边、丁达尔光
  const cobRidge = (x) => 430 - 250 * Math.pow(x / 1280, 1.35) + 16 * Math.sin(x * 0.0085 + 0.6) + 7 * Math.sin(x * 0.023 + 2) + 3 * Math.sin(x * 0.061);
  const cobBg = () => cache('cob_bg', W, H, (g) => {
    const sky = g.createLinearGradient(0, 0, 1280, 200);
    sky.addColorStop(0, '#efe8c4'); sky.addColorStop(0.6, '#f8f0cc'); sky.addColorStop(1, '#fffaea');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const sun0 = g.createRadialGradient(1330, 70, 0, 1330, 70, 900);
    sun0.addColorStop(0, 'rgba(255,253,240,1)'); sun0.addColorStop(0.2, 'rgba(255,246,214,0.7)'); sun0.addColorStop(0.55, 'rgba(250,236,190,0.2)'); sun0.addColorStop(1, 'rgba(250,236,190,0)');
    g.fillStyle = sun0; g.fillRect(0, 0, W, H);
    const R = A.rng(404);
    // 远处更淡的山影（偏蓝绿，多一层景深）
    blurPass(g, W, H, 6, (t) => {
      t.fillStyle = 'rgba(160,184,150,0.55)';
      t.beginPath(); t.moveTo(-40, 520);
      for (let x = -40; x <= 900; x += 16) t.lineTo(x, 330 - 40 * Math.sin(x * 0.006 + 0.4) - 18 * Math.sin(x * 0.017 + 1.3) + x * 0.04);
      t.lineTo(900, 520); t.closePath(); t.fill();
      t.fillStyle = 'rgba(190,206,170,0.5)';
      t.beginPath(); t.moveTo(-40, 520);
      for (let x = -40; x <= 700; x += 16) t.lineTo(x, 300 - 26 * Math.sin(x * 0.009 + 2.2) + x * 0.08);
      t.lineTo(700, 520); t.closePath(); t.fill();
    });
    // 天空里极淡的暖色云絮
    blurPass(g, W, H, 20, (t) => {
      for (let i = 0; i < 6; i++) {
        t.fillStyle = `rgba(255,250,232,${0.25 + R() * 0.2})`;
        t.beginPath(); t.ellipse(80 + R() * 900, 60 + R() * 160, 120 + R() * 160, 18 + R() * 20, -0.08, 0, TAU); t.fill();
      }
    });
    // 坡面：坡脊附近被逆光照透偏黄绿，越往下越深；坡上虚化的草影；坡脊逆光亮边
    blurPass(g, W, H, 13, (t) => {
      const sl = t.createLinearGradient(0, 170, 0, 720);
      sl.addColorStop(0, '#9fbb72'); sl.addColorStop(0.18, '#6f9a5a'); sl.addColorStop(0.55, '#4f7444'); sl.addColorStop(1, '#3a4a30');
      t.fillStyle = sl; t.beginPath(); t.moveTo(-40, H + 40);
      for (let x = -40; x <= W + 40; x += 16) t.lineTo(x, cobRidge(x));
      t.lineTo(W + 40, H + 40); t.closePath(); t.fill();
      for (let k = 0; k < 420; k++) {
        const x = R() * (W + 80) - 40, top = cobRidge(x);
        const y0 = top + 10 + Math.pow(R(), 0.8) * (H - top), hh = 14 + R() * 50 * (0.5 + (y0 - top) / 400);
        const lit = R() < 0.4;
        t.strokeStyle = lit ? `rgba(214,226,150,${0.18 + R() * 0.25})` : `rgba(48,72,40,${0.2 + R() * 0.3})`; t.lineWidth = 2 + R() * 4;
        t.beginPath(); t.moveTo(x, y0); t.quadraticCurveTo(x + (R() - 0.5) * 14, y0 - hh * 0.6, x + (R() - 0.5) * 24, y0 - hh); t.stroke();
      }
      for (let pass = 0; pass < 2; pass++) {
        t.strokeStyle = pass ? 'rgba(255,250,226,0.9)' : 'rgba(255,240,190,0.5)'; t.lineWidth = pass ? 3 : 12;
        t.beginPath(); for (let x = 200; x <= W + 40; x += 16) x === 200 ? t.moveTo(x, cobRidge(x) + 3) : t.lineTo(x, cobRidge(x) + 3); t.stroke();
      }
    });
    // 坡脊上一排被逆光照透的草穗
    blurPass(g, W, H, 2.5, (t) => {
      for (let i = 0; i < 260; i++) {
        const x = 260 + R() * 1060, y = cobRidge(x) + 4 + R() * 6, hh = 6 + R() * 16 * (0.4 + x / 1280);
        t.strokeStyle = R() < 0.6 ? `rgba(255,246,206,${0.35 + R() * 0.4})` : `rgba(120,150,90,${0.5 + R() * 0.3})`; t.lineWidth = 1 + R() * 1.2;
        t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x - 2, y - hh * 0.6, x - 4 + R() * 3, y - hh); t.stroke();
      }
    });
    // 左侧（歌词区）薄雾，让底色平稳
    const hz = g.createLinearGradient(0, 0, 760, 0);
    hz.addColorStop(0, 'rgba(246,240,206,0.62)'); hz.addColorStop(0.45, 'rgba(246,240,206,0.3)'); hz.addColorStop(1, 'rgba(246,240,206,0)');
    g.fillStyle = hz; g.fillRect(0, 0, 760, H);
    // 丁达尔光：从右上斜向左下
    blurPass(g, W, H, 16, (t) => {
      for (let k = 0; k < 8; k++) {
        const a = 2.42 + (R() - 0.5) * 0.4, wd = 24 + R() * 50;
        t.fillStyle = `rgba(255,236,190,${0.035 + R() * 0.04})`;
        t.save(); t.translate(1330, 70); t.rotate(a); t.fillRect(140, -wd / 2, 1400, wd); t.restore();
      }
    }, 'lighter');
  });
  // 中景虚化光斑（坡上的露水反光），静止
  const cobBokeh = () => cache('cob_bokeh', W, H, (g) => {
    const R = A.rng(77);
    for (let i = 0; i < 40; i++) {
      const x = 330 + R() * 960, top = cobRidge(x), y = top + 40 + R() * (560 - top), r = 4 + R() * 15;
      if (Math.hypot(x - HX, y - HY) < WR + 10) continue;
      const a = 0.12 + R() * 0.26;
      const gr = g.createRadialGradient(x, y, r * 0.3, x, y, r);
      gr.addColorStop(0, `rgba(255,248,220,${a * 0.6})`); gr.addColorStop(0.8, `rgba(255,246,214,${a})`); gr.addColorStop(1, 'rgba(255,246,214,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  });
  // 剑（本地坐标：剑首在原点，沿 +y 向下）
  const swordSpr = () => cache('cob_sword', 70, 420, (g) => {
    g.translate(35, 0);
    const R = A.rng(31);
    // 剑身（含入土部分），刃口有缺口（已钝）
    const bl = new Path2D();
    bl.moveTo(-10.5, 74);
    for (let y = 74; y <= 414; y += 6) { const nk = h2(y, 3) < 0.12 ? 1.6 : 0; bl.lineTo(-10.5 + (y - 74) * 0.007 + nk, y); }
    for (let y = 414; y >= 74; y -= 6) { const nk = h2(y, 4) < 0.12 ? 1.6 : 0; bl.lineTo(10.5 - (y - 74) * 0.007 - nk, y); }
    bl.closePath();
    g.save(); g.clip(bl);
    const bg = g.createLinearGradient(-11, 0, 11, 0);
    bg.addColorStop(0, '#3e3c36'); bg.addColorStop(0.48, '#57544a'); bg.addColorStop(0.52, '#4a4740'); bg.addColorStop(1, '#6a6152');
    g.fillStyle = bg; g.fillRect(-12, 70, 24, 350);
    // 锈斑
    for (let i = 0; i < 160; i++) {
      const y = 76 + R() * 340, x = -11 + R() * 22, rr = 1 + R() * 6;
      g.fillStyle = R() < 0.6 ? `rgba(138,90,58,${0.35 + R() * 0.45})` : R() < 0.5 ? `rgba(107,63,38,${0.4 + R() * 0.4})` : `rgba(168,105,62,${0.3 + R() * 0.4})`;
      g.beginPath(); g.ellipse(x, y, rr, rr * (0.6 + R() * 0.8), R() * 3, 0, TAU); g.fill();
    }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(40,26,18,${0.3 + R() * 0.4})`; g.fillRect(-11 + R() * 22, 76 + R() * 340, 0.8 + R() * 1.2, 0.8 + R() * 1.2); }
    // 中脊
    g.strokeStyle = 'rgba(30,24,18,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-0.5, 76); g.lineTo(-0.5, 414); g.stroke();
    g.strokeStyle = 'rgba(220,180,120,0.25)'; g.beginPath(); g.moveTo(0.6, 76); g.lineTo(0.6, 414); g.stroke();
    g.restore();
    // 迎光（右）刃口一线暖光
    g.strokeStyle = 'rgba(255,214,150,0.55)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(10, 76); g.lineTo(10.5 - 340 * 0.007, 414); g.stroke();
    // 剑格
    g.fillStyle = '#4e3a24';
    g.beginPath(); g.moveTo(-26, 64); g.quadraticCurveTo(-28, 72, -22, 75); g.lineTo(22, 75); g.quadraticCurveTo(28, 72, 26, 64); g.quadraticCurveTo(0, 60, -26, 64); g.closePath(); g.fill();
    g.fillStyle = 'rgba(138,90,58,0.6)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(-22 + R() * 44, 64 + R() * 10, 0.8 + R() * 2, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,220,160,0.6)'; g.fillRect(-22, 62.6, 46, 1.2);
    // 剑柄（缠绳）
    g.fillStyle = '#3a2a1c'; g.fillRect(-5.5, 14, 11, 49);
    g.strokeStyle = 'rgba(110,80,52,0.8)'; g.lineWidth = 1.6;
    for (let y = 16; y < 62; y += 4.2) { g.beginPath(); g.moveTo(-5.5, y + 2.4); g.lineTo(5.5, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,214,150,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(5.2, 15); g.lineTo(5.2, 62); g.stroke();
    // 剑首
    g.fillStyle = '#4e3a24'; g.beginPath(); g.ellipse(0, 8, 8.5, 7.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#3a2a1c'; g.fillRect(-4, 12, 8, 3);
    g.strokeStyle = 'rgba(255,224,170,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 8, 7.8, -1.4, 0.4); g.stroke();
  }, 1.5);
  // 草叶：弯曲的细长叶，逆光一侧有亮边，叶尖透黄
  function blade(g, x, y, hh, lean, wd, col, rim) {
    const tx = x + lean, ty = y - hh;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - wd, y);
    g.bezierCurveTo(x - wd * 0.8, y - hh * 0.45, tx - lean * 0.35 - wd * 0.3, ty + hh * 0.2, tx, ty);
    g.bezierCurveTo(tx - lean * 0.3 + wd * 0.5, ty + hh * 0.25, x + wd * 0.9, y - hh * 0.4, x + wd, y);
    g.closePath(); g.fill();
    if (rim) {
      g.strokeStyle = rim; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x + wd * 0.9, y - hh * 0.1); g.bezierCurveTo(x + wd * 0.9, y - hh * 0.4, tx - lean * 0.3 + wd * 0.5, ty + hh * 0.25, tx, ty); g.stroke();
    }
  }
  const cobGrass = () => cache('cob_grass', W, H, (g) => {
    const R = A.rng(919);
    // 地面
    const gg = g.createLinearGradient(0, 560, 0, 720);
    gg.addColorStop(0, 'rgba(52,70,40,0)'); gg.addColorStop(0.25, 'rgba(48,64,38,0.85)'); gg.addColorStop(1, '#26321f');
    g.fillStyle = gg; g.fillRect(0, 560, W, 160);
    const mg = g.createRadialGradient(728, 596, 2, 728, 600, 70);
    mg.addColorStop(0, 'rgba(72,54,34,0.9)'); mg.addColorStop(1, 'rgba(60,50,34,0)');
    g.fillStyle = mg; g.beginPath(); g.ellipse(728, 598, 70, 16, 0, 0, TAU); g.fill();
    // 三排草：后排浅而短，前排深而高；成丛生长
    const rows = [[584, 80, 0.5, [100, 134, 74]], [606, 90, 0.75, [72, 100, 54]], [640, 110, 1, [48, 64, 36]]];
    rows.forEach(([base, n, k, rgb], ri) => {
      for (let c = 0; c < n; c++) {
        const cx = 380 + R() * 940, cnt = 2 + (R() * 6 | 0);
        if (R() > ss(380, 600, cx)) continue;
        for (let m = 0; m < cnt; m++) {
          const x = cx + (R() - 0.5) * 18, b = base + R() * 30;
          const near = Math.abs(x - 728) < 90 ? 1.25 : 1;
          const hh = (20 + Math.pow(R(), 2.2) * 150) * k * near, lean = (R() - 0.45) * hh * 0.9;
          const v = 0.85 + R() * 0.3;
          blade(g, x, b, hh, lean, 1.4 + R() * 1.8 * k, `rgb(${rgb[0] * v | 0},${rgb[1] * v | 0},${rgb[2] * v | 0})`, `rgba(250,240,180,${0.35 + 0.3 * k})`);
        }
      }
    });
    // 几根带穗的草
    for (let i = 0; i < 7; i++) {
      const x = 560 + R() * 650, b = 620, hh = 90 + R() * 70, lean = (R() - 0.5) * 30;
      g.strokeStyle = '#5a7444'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, b); g.quadraticCurveTo(x + lean * 0.3, b - hh * 0.6, x + lean, b - hh); g.stroke();
      g.fillStyle = 'rgba(232,226,170,0.8)'; g.beginPath(); g.ellipse(x + lean, b - hh - 5, 2, 7, lean * 0.02, 0, TAU); g.fill();
    }
    // 狗尾草的叶
    blade(g, 1092, 660, 170, -70, 4.5, '#4c6438', 'rgba(255,240,190,0.6)');
    blade(g, 1088, 660, 130, 60, 4, '#56703f', 'rgba(255,240,190,0.55)');
  });
  // 狗尾草（茎、弯垂的穗、逆光茸毛）
  const cobStem = () => cache('cob_stem', W, H, (g) => {
    g.lineCap = 'round';
    g.strokeStyle = '#4f6a38'; g.lineWidth = 3.4;
    g.beginPath(); for (let y = 662; y >= 172; y -= 6) y === 662 ? g.moveTo(stemX(y), y) : g.lineTo(stemX(y), y); g.stroke();
    g.strokeStyle = 'rgba(255,240,196,0.75)'; g.lineWidth = 1;
    g.beginPath(); for (let y = 640; y >= 174; y -= 6) y === 640 ? g.moveTo(stemX(y) + 1.5, y) : g.lineTo(stemX(y) + 1.5, y); g.stroke();
    // 茎节
    for (const y of [330, 520]) { g.fillStyle = '#3e5a2c'; g.fillRect(stemX(y) - 2.4, y - 1.5, 4.8, 3); }
    // 穗：从茎顶向右弯垂的毛茸茸圆柱，逆光下刚毛透亮
    const x0 = stemX(172), y0 = 172;
    const pt = (u) => [x0 + 46 * Math.sin(u * 1.5), y0 - 16 * Math.sin(u * 2.4) + 62 * u * u];
    const rad = (u) => 6.5 * Math.sin(Math.min(1, u * 1.1 + 0.08) * Math.PI) + 1.8;
    const R = A.rng(5);
    // 刚毛（先画，越靠外越亮）
    for (let k = 0; k < 1300; k++) {
      const u = R(), [x, y] = pt(u), r0 = rad(u);
      const a = R() * TAU, l = r0 + 5 + R() * 9;
      g.strokeStyle = `rgba(255,${238 + R() * 14 | 0},${190 + R() * 34 | 0},${0.3 + R() * 0.45})`; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // 穗轴与小穗（逆光下偏暗的黄绿）
    for (let k = 0; k <= 34; k++) { const u = k / 34, [x, y] = pt(u); g.fillStyle = '#6a763c'; g.beginPath(); g.arc(x, y, rad(u), 0, TAU); g.fill(); }
    for (let k = 0; k < 200; k++) { const u = R(), [x, y] = pt(u), a = R() * TAU, r = rad(u) * Math.sqrt(R()); g.fillStyle = R() < 0.5 ? 'rgba(150,160,88,0.95)' : 'rgba(88,100,54,0.95)'; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.3, 0, TAU); g.fill(); }
    // 迎光上缘一线亮边
    g.strokeStyle = 'rgba(255,246,214,0.6)'; g.lineWidth = 1.2;
    g.beginPath(); for (let k = 0; k <= 34; k++) { const u = k / 34, [x, y] = pt(u), r = rad(u); k ? g.lineTo(x + r * 0.45, y - r * 0.9) : g.moveTo(x + r * 0.45, y - r * 0.9); } g.stroke();
  });
  // 前景虚化的大草叶（左下浅、右下深）
  const cobFore = () => cache('cob_fore', W, H, (g) => {
    const R = A.rng(61);
    blurPass(g, W, H, 8, (t) => {
      const bt = t.createLinearGradient(0, 630, 0, 740);
      bt.addColorStop(0, 'rgba(60,82,48,0)'); bt.addColorStop(0.5, 'rgba(56,76,44,0.85)'); bt.addColorStop(1, 'rgba(40,54,32,1)');
      t.fillStyle = bt; t.fillRect(-20, 630, W + 40, 120);
      // 左下（歌词区下方）是被晨光照透的浅色虚草，向右渐隐
      const bl = t.createLinearGradient(0, 0, 560, 0);
      bl.addColorStop(0, 'rgba(140,164,104,0.95)'); bl.addColorStop(0.55, 'rgba(140,164,104,0.6)'); bl.addColorStop(1, 'rgba(140,164,104,0)');
      t.save(); t.beginPath(); t.moveTo(-20, 760); t.lineTo(-20, 560); t.bezierCurveTo(200, 540, 420, 580, 600, 640); t.lineTo(600, 760); t.closePath(); t.clip();
      t.fillStyle = bl; t.fillRect(-20, 520, 640, 240); t.restore();
      for (let i = 0; i < 46; i++) {
        const x = -40 + R() * 1360, left = x < 420;
        const base = 770, hh = 80 + Math.pow(R(), 1.3) * (left ? 240 : 190);
        const col = left ? `rgba(${136 + R() * 30 | 0},${160 + R() * 26 | 0},${100 + R() * 20 | 0},${0.45 + R() * 0.3})` : `rgba(${34 + R() * 16 | 0},${48 + R() * 18 | 0},${28 + R() * 12 | 0},${0.7 + R() * 0.25})`;
        blade(t, x, base, hh, (R() < 0.5 ? -1 : 1) * hh * (0.3 + R() * 0.6), 8 + R() * 12, col, null);
      }
    });
  });
  const cobBack = () => cache('cob_back', W, H, (g) => {
    g.drawImage(cobBg(), 0, 0, W, H);
    // 网后的坡面略压暗，让逆光的丝与露珠更透亮
    const dk = g.createRadialGradient(HX, HY + 20, 30, HX, HY + 20, 260);
    dk.addColorStop(0, 'rgba(40,62,36,0.32)'); dk.addColorStop(0.6, 'rgba(40,62,36,0.14)'); dk.addColorStop(1, 'rgba(40,62,36,0)');
    g.fillStyle = dk; g.fillRect(HX - 270, HY - 250, 540, 540);
    g.drawImage(cobBokeh(), 0, 0, W, H);
    const gr = g.createRadialGradient(1290, 60, 0, 1290, 60, 420);
    gr.addColorStop(0, 'rgba(255,240,200,0.18)'); gr.addColorStop(0.25, 'rgba(255,240,200,0.1)'); gr.addColorStop(0.6, 'rgba(255,240,200,0.025)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(800, 0, 480, 400); g.globalCompositeOperation = 'source-over';
  });
  const CFY = 120;
  const cobFront = () => cache('cob_front', W, H - CFY, (g) => {
    g.translate(0, -CFY);
    g.drawImage(cobStem(), 0, 0, W, H);
    g.drawImage(cobGrass(), 0, 0, W, H);
    g.drawImage(cobFore(), 0, 0, W, H);
  });
  function cobwebShot(g, c) {
    const lt = c.lt;
    const t0 = ct(c, 0, 0, 0.309), t3 = ct(c, 3, 0, 1.489), tS = ct(c, 5, 0, 2.529), tD0 = ct(c, 8, 0, 3.849), tD1 = ct(c, 10, 0, 4.709);
    // 镜头：第18句第1字起缓推，在第6字之前停住；smoothstep 峰值斜率 1.5，峰值推速约 1.9%/秒
    // 起点取 1.0005 而非 1：推镜层从第一帧起就走插值采样，起推时不会出现一帧锐→柔的跳变
    const zc = 1.0005 + 0.0265 * smooth((lt - t0) / Math.max(0.5, tS - 0.15 - t0));
    const cam = (k) => { const z = 1 + (zc - 1) * k; g.translate(880, 380); g.scale(z, z); g.translate(-880, -380); };
    // 阳光扫过剑身锈迹
    const sweep = clamp((lt - t0) / (t3 - t0), 0, 1), swA = Math.sin(Math.PI * sweep);

    // 远景（坡、光斑、晨光）合成一层，不随推镜缩放
    g.drawImage(cobBack(), 0, 0, W, H);
    const be = beatEnv(c, 0.5);

    g.save(); cam(1);
    // 剑
    g.save(); g.translate(SWP[0], SWP[1]); g.rotate(SWROT);
    g.drawImage(swordSpr(), -35, 0, 70, 420);
    if (swA > 0.001) {
      // 扫过的暖色反光带（只在剑身上）
      g.save();
      g.beginPath(); g.rect(-10.5, 74, 21, 300); g.clip();
      g.globalCompositeOperation = 'lighter';
      const by = 74 + 290 * easeInOut(sweep);
      const gr = g.createLinearGradient(0, by - 50, 0, by + 50);
      gr.addColorStop(0, 'rgba(255,190,110,0)'); gr.addColorStop(0.5, `rgba(255,200,120,${0.38 * swA})`); gr.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = gr; g.fillRect(-11, by - 50, 22, 100);
      g.fillStyle = `rgba(255,214,150,${0.08 * swA})`; g.fillRect(-11, 74, 22, 300);
      g.restore();
    }
    g.restore();
    // 蛛网
    const st = webState(lt, tS);
    const { rad, sp, iL, iT, iB, beads, drops } = WEB;
    const trem = st.on ? 0 : 0.35;
    const D = (x, y, o) => {
      webDef(x, y, st, o);
      if (trem) { o[0] += trem * Math.sin(lt * 2.3 + y * 0.05); o[1] += trem * Math.sin(lt * 1.9 + x * 0.05); }
      return o;
    };
    const hub = D(HX, HY, [0, 0]);
    const outer = rad.map((R) => D(HX + R.c * R.ro, HY + R.s * R.ro, [0, 0]));
    const spd = sp.map((v) => D(v[0], v[1], [0, 0]));
    // 逆光丝亮度：与光线方向呈一定角度的丝更亮，形成斜向亮带
    const lightA = -0.75;
    const bright = (ax, ay, bx, by) => { const a = Math.atan2(by - ay, bx - ax); return 0.2 + 0.8 * Math.pow(Math.abs(Math.sin(a - lightA)), 10); };
    const NB = 4, paths = [];
    for (let b = 0; b < NB; b++) paths.push(new Path2D());
    const addSeg = (ax, ay, bx, by, L0) => {
      const k = Math.min(NB - 1, Math.floor(bright(ax, ay, bx, by) * NB));
      seg(paths[k], ax, ay, bx, by, L0);
    };
    rad.forEach((R, i) => addSeg(hub[0], hub[1], outer[i][0], outer[i][1], R.ro));
    for (let i = 0; i < NR; i++) {
      const j = (i + 1) % NR, a = outer[i], b = outer[j];
      const L0 = Math.hypot((rad[j].c * rad[j].ro - rad[i].c * rad[i].ro), (rad[j].s * rad[j].ro - rad[i].s * rad[i].ro));
      addSeg(a[0], a[1], b[0], b[1], L0);
    }
    for (let j = 0; j < sp.length - 1; j++) {
      if (sp[j][4]) continue;
      const L0 = Math.hypot(sp[j + 1][0] - sp[j][0], sp[j + 1][1] - sp[j][1]);
      addSeg(spd[j][0], spd[j][1], spd[j + 1][0], spd[j + 1][1], L0);
    }
    // 中心网眼
    for (const rr of [4, 7.5, 11]) for (let i = 0; i < NR; i += 2) {
      const j = (i + 2) % NR, R1 = rad[i], R2 = rad[j];
      const a = D(HX + R1.c * rr, HY + R1.s * rr, _p), ax = a[0], ay = a[1];
      const b = D(HX + R2.c * rr, HY + R2.s * rr, _q);
      addSeg(ax, ay, b[0], b[1], rr * 0.45);
    }
    // 右侧两根锚丝
    const aT = outer[iT], aB = outer[iB];
    addSeg(aT[0], aT[1], TA[0], TA[1], 0); addSeg(aB[0], aB[1], TB[0], TB[1], 0);
    g.lineCap = 'round';
    g.globalCompositeOperation = 'lighter';
    for (let b = 0; b < NB; b++) {
      const lv = (b + 0.5) / NB;
      g.strokeStyle = `rgba(255,236,190,${0.03 + 0.08 * lv})`; g.lineWidth = 2.4; g.stroke(paths[b]);
    }
    g.globalCompositeOperation = 'source-over';
    for (let b = 0; b < NB; b++) {
      const lv = (b + 0.5) / NB;
      g.strokeStyle = `rgba(255,250,232,${0.12 + 0.75 * lv * lv})`; g.lineWidth = 0.65; g.stroke(paths[b]);
    }
    // 左侧锚丝（剑格 → 网缘），第18句第6字时在中间断开并回弹
    const aL = outer[iL];
    const restL = [HX + rad[iL].c * rad[iL].ro, HY + rad[iL].s * rad[iL].ro];
    const LA = Math.hypot(restL[0] - GUARD[0], restL[1] - GUARD[1]);
    g.strokeStyle = 'rgba(255,250,232,0.85)'; g.lineWidth = 0.8;
    if (!st.on) {
      g.beginPath(); g.moveTo(GUARD[0], GUARD[1]); g.lineTo(aL[0], aL[1]); g.stroke();
    } else {
      const tau = st.tau, rec = easeOut(clamp(tau / 0.3)), hang = smooth(clamp((tau - 0.15) / 0.8));
      const piece = (ox, oy, dirx, diry, len0, sgn) => {
        const len = len0 * (1 - 0.55 * rec);
        // 方向由原方向转到竖直下垂
        let ax = lerp(dirx, 0, hang), ay = lerp(diry, 1, hang); const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
        const kink = 3.2 * Math.exp(-tau / 0.12) * Math.sin(tau * 60);
        g.beginPath(); g.moveTo(ox, oy);
        for (let k = 1; k <= 6; k++) {
          const u = k / 6, cx = ox + ax * len * u, cy = oy + ay * len * u;
          const curl = (1 - hang) * rec * 3 * Math.sin(u * 5 + sgn) + kink * u;
          g.lineTo(cx - ay * curl, cy + ax * curl);
        }
        g.stroke();
      };
      const dx = (restL[0] - GUARD[0]) / LA, dy = (restL[1] - GUARD[1]) / LA;
      piece(GUARD[0], GUARD[1], dx, dy, LA * 0.45, 0);
      piece(aL[0], aL[1], -dx, -dy, LA * 0.55, 2);
      // 断点一闪
      const fl = Math.exp(-tau / 0.09) * (tau < 0.5 ? 1 : 0);
      if (fl > 0.02) {
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = fl * 0.9;
        const bx = lerp(GUARD[0], restL[0], 0.45), by = lerp(GUARD[1], restL[1], 0.45);
        g.drawImage(starSpr(), bx - 9, by - 9, 18, 18);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
    }
    // 露珠（逆光闪烁；随拍有一小批轻轻亮起）
    const bs = beadSpr();
    g.globalCompositeOperation = 'lighter';
    for (const bd of beads) {
      const j = bd.j, a = spd[j], b = spd[j + 1];
      const L0 = Math.hypot(sp[j + 1][0] - sp[j][0], sp[j + 1][1] - sp[j][1]);
      segPt(a[0], a[1], b[0], b[1], L0, bd.u, _p);
      const tw = 0.7 + 0.3 * Math.sin(lt * (1.3 + bd.tw * 2) + bd.tw * 30) + (bd.tw > 0.75 ? 0.5 * be : 0);
      const r = bd.r * 2.3;
      g.globalAlpha = clamp(0.5 * tw, 0, 1);
      g.drawImage(bs, _p[0] - r, _p[1] - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    // 下落的露珠：沿丝滑到末端，停一下，再自由落体，在逆光里闪成光点
    const nD = drops.length;
    drops.forEach((dp, k) => {
      const td = tD0 + 0.3 + k * (tD1 - tD0 - 0.3) / (nD - 1);
      const R = rad[dp.i];
      const s0 = td - 0.3, tau = lt - s0;
      let x, y, glint = 0.6, rr = dp.size;
      if (lt < td - 0.05) {
        const u = tau <= 0 ? 0 : easeInOut(tau / 0.25);
        const r = lerp(dp.r0, R.ro * 0.97, u);
        D(HX + R.c * r, HY + R.s * r, _p); x = _p[0]; y = _p[1];
      } else {
        D(HX + R.c * R.ro * 0.97, HY + R.s * R.ro * 0.97, _p);
        const ft = lt - td;
        if (ft < 0) { x = _p[0]; y = _p[1] + 1.5; rr *= 1.12; }
        else {
          x = _p[0]; const y0 = _p[1] + 1.5;
          const yl = 578 + 14 * h2(k, 31), tf = Math.sqrt(2 * (yl - y0) / GRAV);
          if (ft > tf) {
            // 落进草里：几个细小的光点散开淡去
            const sp2 = ft - tf;
            if (sp2 < 0.22) {
              const a = (1 - sp2 / 0.22);
              for (let m = 0; m < 3; m++) {
                const ang = -Math.PI / 2 + (m - 1) * 0.9, d = 2 + 9 * easeOut(sp2 / 0.22);
                g.globalAlpha = 0.6 * a; g.drawImage(bs, x + Math.cos(ang) * d - 2.5, yl + Math.sin(ang) * d - 2.5, 5, 5);
              }
              g.globalAlpha = 1;
            }
            return;
          }
          y = y0 + 0.5 * GRAV * ft * ft;
          const v = GRAV * ft;
          glint = 0.6 + 0.9 * Math.sin(Math.PI * ft / tf);
          // 运动拖影
          const ln = Math.min(26, v / 60);
          const gr = g.createLinearGradient(x, y - ln, x, y);
          gr.addColorStop(0, 'rgba(255,248,224,0)'); gr.addColorStop(1, `rgba(255,248,224,${0.45 * glint})`);
          g.strokeStyle = gr; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y - ln); g.lineTo(x, y); g.stroke();
        }
      }
      const r = rr * 3.4;
      g.globalAlpha = clamp(0.8 * glint, 0, 1); g.drawImage(bs, x - r, y - r, r * 2, r * 2);
      if (glint > 0.9) { const s2 = 7 + 9 * (glint - 0.9); g.globalAlpha = clamp((glint - 0.9) * 1.3, 0, 0.9); g.drawImage(starSpr(), x - s2, y - s2, s2 * 2, s2 * 2); }
      g.globalAlpha = 1;
    });
    g.globalCompositeOperation = 'source-over';
    // 草茎、剑脚的草、前景虚草合成一层（盖住入土处）
    g.drawImage(cobFront(), 0, CFY, W, H - CFY);
    g.restore();
  }
  XYT.registerShot('c1_cobweb', {
    name: '剑锈网断', zone: 'left', night: false, text: '#2c3320', shadow: 'rgba(255,250,232,0.92)', accent: '#8a5a3a', bloom: 0.3,
    draw: cobwebShot,
  });
  // =====================================================================
  // c1_inkdesk
  // 统一的针孔相机：X 右、Y 上（案面 Y=0）、Z 深；视平线 y=300，眼高案面上 0.35 m，焦距 772 px
  // 月亮在窗口里 (165,95)，月光平行入射：每向镜头前进 1 m，向右 LXd、向下 LYd
  // =====================================================================
  const IF = 772, IHY = 300, IE = 0.35, IZW = 2.4;
  const MOONX = 165, MOONY = 95;
  const LXd = (640 - MOONX) / IF, LYd = (IHY - MOONY) / IF;
  const OPN = { x0: -1.58, x1: -1.03, y0: 0.30, y1: 1.06 };
  const DESK = { zf: 0.88, zb: 1.55, xr: 0.42, th: 0.035 };
  const pj = (X, Y, Z, o) => { o = o || [0, 0]; o[0] = 640 + IF * X / Z; o[1] = IHY + IF * (IE - Y) / Z; return o; };
  const WSX = (X) => 640 + IF * X / IZW, WSY = (Y) => IHY + IF * (IE - Y) / IZW;
  // 某点是否处于经由敞开窗扇射入的月光里（带半影）
  function inBeam(X, Y, Z) {
    const s = IZW - Z; if (s <= 0) return 0;
    const xw = X - LXd * s, yw = Y + LYd * s, pw = 0.008 + 0.012 * s;
    return ss(-pw, pw, xw - OPN.x0) * ss(-pw, pw, OPN.x1 - xw) * ss(-pw, pw, yw - OPN.y0) * ss(-pw, pw, OPN.y1 - yw);
  }
  // 案面上的窗形光斑（世界坐标四角）
  const PATCH = (() => {
    const sb = OPN.y0 / LYd, zb = IZW - sb, sf = IZW - DESK.zf;
    return [[OPN.x0 + LXd * sb, zb], [OPN.x1 + LXd * sb, zb], [OPN.x1 + LXd * sf, DESK.zf], [OPN.x0 + LXd * sf, DESK.zf]];
  })();
  const patchPath = (g, grow) => {
    g.beginPath();
    const cx = (PATCH[0][0] + PATCH[2][0]) / 2, cz = (PATCH[0][1] + PATCH[2][1]) / 2;
    PATCH.forEach(([x, z], i) => { const p = pj(cx + (x - cx) * (1 + grow), 0, z + (z - cz) * grow * 0.4); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.closePath();
  };
  // 窗外竹子（屏幕坐标，绕根部摆动）
  const BAMBOO = [
    { x: 150, lean: 0.05, w: 7, k: 1.0, sprays: [[0.62, -0.9, 1.0], [0.8, 0.6, 0.9], [0.95, -0.4, 1.1]] },
    { x: 262, lean: 0.11, w: 8, k: 1.15, sprays: [[0.55, 0.7, 1.1], [0.74, -0.8, 1.0], [0.9, 0.5, 1.2]] },
    { x: 392, lean: -0.04, w: 7, k: 0.9, sprays: [[0.6, -0.6, 1.0], [0.83, 0.8, 1.1]] },
    { x: 470, lean: 0.06, w: 6, k: 1.05, sprays: [[0.5, 0.6, 0.9], [0.72, -0.7, 1.0], [0.92, 0.4, 1.0]] },
  ];
  const BBASE = 430, BLEN = 470;
  const spraySpr = (v) => cache('ink_spray' + v, 120, 90, (g) => {
    g.translate(60, 12);
    const R = A.rng(300 + v);
    const n = 6 + v;
    for (let i = 0; i < n; i++) {
      const a = 0.25 + (i / (n - 1)) * 2.6 + (R() - 0.5) * 0.2, l = 30 + R() * 22, wd = 4 + R() * 2.5;
      const ex = Math.cos(a) * l, ey = Math.sin(a) * l * 0.85 + 8;
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(ex * 0.5 - Math.sin(a) * wd, ey * 0.5 + Math.cos(a) * wd, ex, ey);
      g.quadraticCurveTo(ex * 0.5 + Math.sin(a) * wd * 0.6, ey * 0.5 - Math.cos(a) * wd * 0.6, 0, 0);
      g.fill();
    }
    g.lineWidth = 1.4; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(-14, -8); g.quadraticCurveTo(-4, -4, 0, 0); g.stroke();
  }, 1.5);
  function bambooAngle(b, lt, amp, lean) {
    return amp * b.k * (0.011 * Math.sin(lt * 1.15 + b.x * 0.03) + 0.006 * Math.sin(lt * 2.3 + b.x * 0.07)) + lean * b.k * 0.022;
  }
  // 画一组竹子（col 为颜色；用于窗外剪影、窗纸上的影、案上光斑里的影）
  function drawBamboo(g, lt, amp, lean, col, dx, dy, sc) {
    g.fillStyle = col; g.strokeStyle = col;
    for (const b of BAMBOO) {
      const ang = bambooAngle(b, lt, amp, lean) + b.lean;
      g.save(); g.translate(b.x * sc + dx, BBASE * sc + dy); g.rotate(ang); g.scale(sc, sc);
      g.fillRect(-b.w / 2, -BLEN, b.w, BLEN);
      for (let k = 1; k < 6; k++) g.fillRect(-b.w / 2 - 1, -k * 92, b.w + 2, 3);
      for (const [at, side, s] of b.sprays) {
        const y = -BLEN * at;
        g.save(); g.translate(0, y); g.scale(side < 0 ? -s : s, s); g.rotate(Math.abs(side) * 0.3);
        g.drawImage(spraySpr((b.x + at * 10) % 3 | 0), -60 + 14, -12 - 8, 120, 90);
        g.restore();
      }
      g.restore();
    }
  }
  // 抽象书法笔触（纸面局部坐标 a∈[-0.5,0.5]·w, b∈[-0.5,0.5]·d），竖行、从右往左
  function strokesFor(seed) {
    const R = A.rng(seed), out = [];
    const cols = 4;
    for (let c = 0; c < cols; c++) {
      const a0 = 0.33 - c * 0.22;
      const rows = 5 + (R() * 2 | 0);
      for (let r = 0; r < rows; r++) {
        const b0 = -0.36 + r * (0.72 / rows) + 0.06;
        if (R() < 0.08) continue;
        const cs = 0.62 / rows; // 字格大小（b 方向），a 方向按纸宽换算
        const n = 2 + (R() * 3 | 0);
        const ink = 0.55 + R() * 0.45;
        for (let k = 0; k < n; k++) {
          const kind = R();
          const ca = a0 + (R() - 0.5) * 0.11, cb = b0 + (R() - 0.5) * cs * 0.8;
          let da, db;
          if (kind < 0.35) { da = 0.07 + R() * 0.05; db = (R() - 0.5) * 0.02; }       // 横
          else if (kind < 0.65) { da = (R() - 0.5) * 0.02; db = cs * (0.5 + R() * 0.5); } // 竖
          else if (kind < 0.85) { da = (R() < 0.5 ? -1 : 1) * (0.04 + R() * 0.04); db = cs * (0.3 + R() * 0.3); } // 撇捺
          else { da = 0.012; db = 0.012; }                                              // 点
          out.push([[ca - da / 2, cb - db / 2], [ca + da * 0.05, cb + db * 0.05], [ca + da / 2, cb + db / 2], ink, 0.7 + R() * 0.6]);
        }
      }
    }
    return out;
  }
  const SW = 0.2, SD = 0.14;
  // 砚台、纸叠（世界坐标）
  const INK = { X: -0.27, Z: 1.0, w: 0.16, d: 0.105, h: 0.022 };
  const STK = { X: -0.55, Z: 1.13, yaw: 0.08, w: 0.22, d: 0.15, top: 0.012 };
  // 散放的五张纸：依次被风掀起。keys 为 [起飞后秒数, X, Y, Z, 'z' 表示此处水平速度为零]，三次 Hermite 插值
  // 最后一张（i=1）在第21句第9字时摆荡滑下，盖在砚台上；i=2、4 贴着案面被吹过前沿：越出前沿的部分失去托举，
  // 整张绕前沿线向前下方倾（keys 是倾翻前的位置，高度只是贴面的气垫），之后顺着倾斜的纸面加速滑落出画
  const SHEETS = [
    { X: -0.80, Z: 1.24, yaw: 0.25, yaw1: 0.62, dt: 0.0, seed: 11, pB: 0.24, rB: -0.12, pA: 0.22, rA: 0.26, cA: 0.032, cB: 0.02, fq: 1.15, spin: 0.3,
      keys: [[0, -0.80, 0.0006, 1.24], [0.5, -0.70, 0.12, 1.21], [1.0, -0.46, 0.20, 1.12], [1.5, -0.19, 0.13, 1.035], [2.05, 0.0, 0.0006, 0.985]] },
    { X: -0.62, Z: 1.40, yaw: -0.15, yaw1: 0.1, dt: 0.1, seed: 12, pB: 0.3, rB: -0.16, pA: 0.16, rA: 0.2, cA: 0.03, cB: 0.022, fq: 0.95, spin: -0.2, last: 1 },
    // 案前的两张贴着案面被吹向前沿，越过前沿时向前下方倾翻，很快出画
    { X: -0.74, Z: 0.94, yaw: -0.35, yaw1: -0.05, dt: 0.24, seed: 13, pB: 0.02, rB: 0, pA: 0.08, rA: 0.1, cA: 0.016, cB: 0.012, fq: 1.3, spin: 0.15, off: 1,
      keys: [[0, -0.74, 0.0006, 0.94], [0.35, -0.73, 0.02, 0.90], [0.6, -0.71, 0.014, 0.855], [0.85, -0.69, 0.01, 0.78], [1.1, -0.67, 0.008, 0.64], [1.4, -0.65, 0.006, 0.36], [1.8, -0.63, 0.005, -0.12]] },
    { X: -0.10, Z: 1.13, yaw: 0.1, yaw1: -0.3, dt: 0.4, seed: 14, pB: 0.12, rB: -0.06, pA: 0.12, rA: 0.14, cA: 0.024, cB: 0.016, fq: 1.2, spin: -0.25,
      keys: [[0, -0.10, 0.0006, 1.13], [0.45, -0.01, 0.09, 1.10], [1.1, 0.14, 0.07, 1.06], [1.7, 0.24, 0.0006, 1.02]] },
    { X: -0.04, Z: 0.96, yaw: 0.4, yaw1: 0.6, dt: 0.55, seed: 15, pB: 0.02, rB: 0, pA: 0.08, rA: 0.1, cA: 0.016, cB: 0.012, fq: 1.25, spin: 0.12, off: 1,
      keys: [[0, -0.04, 0.0006, 0.96], [0.35, 0.02, 0.02, 0.92], [0.6, 0.07, 0.014, 0.875], [0.85, 0.12, 0.01, 0.80], [1.1, 0.16, 0.008, 0.66], [1.4, 0.20, 0.006, 0.38], [1.8, 0.24, 0.005, -0.1]] },
  ];
  const STROKES = SHEETS.map((s) => strokesFor(s.seed));
  // 静止时纸角已伸出前沿的比例（越出比例从这里起算，静止的纸不倾）
  const restOverhang = (s) => {
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    let z0 = 9, z1 = -9;
    for (const [a, b] of [[-SW / 2, -SD / 2], [SW / 2, -SD / 2], [SW / 2, SD / 2], [-SW / 2, SD / 2]]) { const z = s.Z - a * sn + b * c; z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return clamp((DESK.zf - z0) / (z1 - z0));
  };
  SHEETS.forEach((s) => { s.f0 = s.off ? restOverhang(s) : 0; });
  // 最后一张的落点：盖住砚台大半（左前角与笔头仍露出），右侧与后侧垂下
  const LAND = { X: -0.235, Z: 1.03, yaw: 0.1, Y: INK.h + 0.0018 };
  // 关键帧三次 Hermite 插值（Catmull-Rom 切线，首尾速度为零）
  function spl(keys, tau, c) {
    const n = keys.length;
    if (tau <= keys[0][0]) return keys[0][c];
    if (tau >= keys[n - 1][0]) return keys[n - 1][c];
    let k = 0; while (k < n - 2 && tau > keys[k + 1][0]) k++;
    const ta = keys[k][0], h = keys[k + 1][0] - ta, s = (tau - ta) / h;
    const tan = (j) => (j === 0 || j === n - 1 || (c !== 2 && keys[j][4] === 'z')) ? 0 : (keys[j + 1][c] - keys[j - 1][c]) / (keys[j + 1][0] - keys[j - 1][0]);
    const m0 = tan(k) * h, m1 = tan(k + 1) * h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * keys[k][c] + (s3 - 2 * s2 + s) * m0 + (3 * s2 - 2 * s3) * keys[k + 1][c] + (s3 - s2) * m1;
  }
  const lastKeys = (t0, t2) => {
    const g0 = t2 - t0, T = g0 + 0.8;
    return [[0, -0.62, 0.0006, 1.40], [0.6, -0.55, 0.15, 1.33], [1.25, -0.45, 0.19, 1.22], [g0, -0.37, 0.165, 1.13],
      [g0 + 0.4, -0.29, 0.085, 1.07], [T - 0.14, LAND.X, LAND.Y + 0.011, LAND.Z, 'z'], [T, LAND.X, LAND.Y, LAND.Z]];
  };
  // 支撑面高度（案面、砚台顶、纸叠顶）：边缘外 6 mm 内连续降到下一层，案前沿外连续下降，约束随时间连续
  function floorAt(X, Z) {
    let f = 0.0006 - Math.max(0, DESK.zf - Z, X - DESK.xr) * 40;
    const oi = Math.max(Math.abs(X - INK.X) - INK.w / 2, Math.abs(Z - INK.Z) - INK.d / 2) - 0.002;
    if (oi < 0.006) f = Math.max(f, (INK.h + 0.0008) * (1 - smooth(oi / 0.006)));
    const dx = X - STK.X, dz = Z - STK.Z, c = Math.cos(STK.yaw), s = Math.sin(STK.yaw);
    const os = Math.max(Math.abs(dx * c - dz * s) - STK.w / 2, Math.abs(dx * s + dz * c) - STK.d / 2) - 0.003;
    if (os < 0.006) f = Math.max(f, (STK.top + 0.0016) * (1 - smooth(os / 0.006)));
    return f;
  }
  // 只用于让倾斜随高度平滑收敛：取纸面中心与四角下方最高的支撑面；案前沿外是一段连续下降的假想面
  const fadeFloor1 = (X, Z) => (Z >= DESK.zf ? Math.max(0, floorAt(X, Z)) : -(DESK.zf - Z) * 2);
  function fadeFloor(X, Z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let f = fadeFloor1(X, Z);
    for (const [a, b] of [[-SW / 2, -SD / 2], [SW / 2, -SD / 2], [SW / 2, SD / 2], [-SW / 2, SD / 2]]) f = Math.max(f, fadeFloor1(X + a * c + b * s, Z - a * s + b * c));
    return f;
  }
  // 纸的位姿：{ X, Y, Z, yaw, pitch, roll, curlA, curlB, drape }
  function sheetPose(s, i, lt, t1, t2) {
    const t0 = t1 + s.dt;
    const keys = s.last ? lastKeys(t0, t2) : s.keys;
    const T = keys[keys.length - 1][0];
    const tau = lt - t0;
    const P = { X: s.X, Y: 0.0006, Z: s.Z, yaw: s.yaw, pitch: 0, roll: 0, curlA: 0, curlB: 0, drape: 0, tip: 0, hy: 0.0006, bend: s.off ? 1 : 0, gone: false, fine: !!s.last };
    if (tau <= 0) return P;
    // 落定前 0.12 s 起，伸出砚台的纸边已开始下垂（不是硬卡片落地后才弯）
    const drapeAt = (x) => smooth(clamp((x - T + 0.12) / 0.47));
    if (tau >= T) {
      const k = keys[keys.length - 1];
      P.X = k[1]; P.Y = k[2]; P.Z = k[3]; P.yaw = s.yaw1;
      if (s.off) P.gone = true;
      if (s.last) P.drape = drapeAt(tau);
      return P;
    }
    const u = tau / T;
    P.X = spl(keys, tau, 1); P.Y = spl(keys, tau, 2); P.Z = spl(keys, tau, 3);
    // 最后一张：第21句第9字起的滑落段左右摆荡（落叶式），落定前 0.14 s 摆动已停
    let bank = 0;
    if (s.last) {
      const g0 = t2 - t0, v = (tau - g0) / (T - 0.14 - g0);
      if (v > 0 && v < 1) {
        const sw = (x) => 0.045 * Math.sin(TAU * 1.0 * x) * Math.pow(Math.sin(Math.PI * x), 2);
        P.X += sw(v); P.Z -= 0.3 * sw(v);
        bank = -(sw(v + 0.01) - sw(v - 0.01)) / 0.02 * 2.0;
      }
    }
    // 倾斜与卷曲：起飞后渐起、落定前收敛；离支撑面越近越平
    P.yaw = lerp(s.yaw, s.yaw1, smooth(u)) + s.spin * Math.sin(Math.PI * u);
    const hA = P.Y - fadeFloor(P.X, P.Z, P.yaw);
    const env = smooth(clamp(u / 0.12)) * smooth(clamp((1 - u) / 0.25)) * ss(0.004, 0.07, hA);
    const ph = s.seed * 1.7, w = TAU * s.fq;
    P.pitch = env * (-s.pB + s.pA * Math.sin(w * tau + ph));
    P.roll = env * (s.rB + s.rA * Math.sin(w * 0.77 * tau + ph * 1.3)) + bank * ss(0.004, 0.07, hA);
    P.curlA = env * s.cA * Math.sin(w * 1.21 * tau + ph * 0.7);
    P.curlB = env * s.cB * Math.sin(w * 0.93 * tau + ph * 2.1);
    if (s.last) P.drape = drapeAt(tau);
    // 越过前沿：按伸出前沿的比例（扣除静止时已伸出的一角）绕前沿线向前下方倾，最大约 63°
    if (s.off) {
      P.bend = 0;
      sheetMesh(P, meshBuf, 6, 4);
      let z0 = 9, z1 = -9;
      for (let k = 0; k < 35; k++) { const z = meshBuf[k][2]; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const f = (DESK.zf - z0) / (z1 - z0), f0 = s.f0;
      P.tip = 0.9 * smooth(clamp((f - f0) / (1 - f0)));
      P.hy = P.Y;
      P.bend = 1;
    }
    // 安全约束：网格最低点不低于其下方的支撑面（倾斜已随高度收敛，正常情况下不会触发）
    sheetMesh(P, meshBuf, 6, 4);
    let lift = 0;
    for (let k = 0; k < 35; k++) { const m = meshBuf[k], f = floorAt(m[0], m[2]); if (f - m[1] > lift) lift = f - m[1]; }
    P.Y += lift; P.hy += lift;
    return P;
  }
  // 纸垂过砚台边缘：沿纸面弧长积分，弯角由 0 渐增；碰到案面后平铺
  function bendOver(sLen, d, base, out) {
    const n = 8, ds = sLen / n, L = 0.014, tm = 1.0 * d;
    let x = 0, y = 0;
    for (let k = 0; k < n; k++) {
      const s = (k + 0.5) * ds;
      const th = y < base - 0.0009 ? tm * (1 - Math.exp(-s / L)) : 0;
      x += Math.cos(th) * ds; y = Math.min(base - 0.0008, y + Math.sin(th) * ds);
    }
    out[0] = x; out[1] = y; return out;
  }
  const _bd = [0, 0];
  // 越出前沿的部分失去托举而下弯：沿前沿外一段弯道（曲率 EK，弯过 ED 后变直）贴放，弧长不变
  const EK = 5, ED = 0.07, ET = EK * ED;
  function edgeBend(o, hy) {
    const d = DESK.zf - o[2];
    if (d <= 0) return;
    const dy = o[1] - hy;
    let zt, yt, th;
    if (d <= ED) { th = EK * d; zt = -Math.sin(th) / EK; yt = -(1 - Math.cos(th)) / EK; }
    else { th = ET; zt = -Math.sin(ET) / EK - (d - ED) * Math.cos(ET); yt = -(1 - Math.cos(ET)) / EK - (d - ED) * Math.sin(ET); }
    o[2] = DESK.zf + zt - dy * Math.sin(th); o[1] = hy + yt + dy * Math.cos(th);
  }
  // 纸面网格点（世界坐标）；返回纸面中心法线。MA×MB 为当前网格分辨率
  let MA = 6, MB = 4;
  function sheetMesh(P, out, na, nb) {
    MA = na; MB = nb;
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch), cr = Math.cos(P.roll), sr = Math.sin(P.roll);
    const rot = (x, y, z, o) => {
      // 先绕本地 b 轴（roll），再绕 a 轴（pitch），再绕竖轴（yaw）
      const x1 = x * cr - y * sr, y1 = x * sr + y * cr, z1 = z;
      const y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp, x2 = x1;
      o[0] = x2 * cy + z2 * sy; o[1] = y2; o[2] = -x2 * sy + z2 * cy;
      return o;
    };
    const base = P.Y, ct = Math.cos(P.tip || 0), st = Math.sin(P.tip || 0);
    let k = 0;
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const a = (i / na - 0.5) * SW, b = (j / nb - 0.5) * SD, qa = 2 * a / SW, qb = 2 * b / SD;
      const h = P.curlA * (qa * qa - 0.35) + P.curlB * (qb * qb - 0.35);
      const o = out[k] || (out[k] = [0, 0, 0]);
      rot(a, h, b, o); o[0] += P.X; o[1] += P.Y; o[2] += P.Z;
      if (P.bend) edgeBend(o, P.hy);
      if (P.tip) { const dz = o[2] - DESK.zf, dy = o[1] - P.hy; o[1] = P.hy + dy * ct + dz * st; o[2] = DESK.zf + dz * ct - dy * st; }
      if (P.drape > 0) {
        const ox = Math.abs(o[0] - INK.X) - INK.w / 2, oz = Math.abs(o[2] - INK.Z) - INK.d / 2;
        let dy = 0;
        if (ox > 0) { bendOver(ox, P.drape, base, _bd); o[0] = INK.X + Math.sign(o[0] - INK.X) * (INK.w / 2 + _bd[0]); dy = _bd[1]; }
        if (oz > 0) { bendOver(oz, P.drape, base, _bd); o[2] = INK.Z + Math.sign(o[2] - INK.Z) * (INK.d / 2 + _bd[0]); dy = Math.max(dy, _bd[1]); }
        o[1] -= dy;
      }
      k++;
    }
    const n = rot(0, 1, 0, [0, 0, 0]);
    const tb = (P.tip || 0) + (P.bend ? EK * clamp(DESK.zf - P.Z, 0, ED) : 0);
    if (tb) { const c2 = Math.cos(tb), s2 = Math.sin(tb), ny = n[1], nz = n[2]; n[1] = ny * c2 + nz * s2; n[2] = nz * c2 - ny * s2; }
    return n;
  }
  const meshBuf = [], scrBuf = [], cellB = [], cellF = [], cellD = [], vtxB = [], vtxN = [], order = [];
  const paperCol = (b) => `rgb(${(232 * b + 6) | 0},${(222 * b + 8) | 0},${(206 * b + 16) | 0})`;
  const LdN = Math.hypot(LXd, LYd, 1), LFx = -LXd / LdN, LFy = LYd / LdN, LFz = 1 / LdN;
  // 纸面明暗：每个网格点按相邻格的法线与是否在月光里求亮度（迎光一面直接受光，背光一面只有透过纸的弱光），
  // 每格用线性渐变近似四角亮度，格与格之间连续，不出现台阶
  function shadeMesh(na, nb, briConst) {
    const idx = (i, j) => j * (na + 1) + i, nV = (na + 1) * (nb + 1);
    for (let k = 0; k < nV; k++) { const v = vtxN[k] || (vtxN[k] = [0, 0, 0]); v[0] = v[1] = v[2] = 0; }
    for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
      const m0 = meshBuf[idx(i, j)], m1 = meshBuf[idx(i + 1, j)], m2 = meshBuf[idx(i + 1, j + 1)], m3 = meshBuf[idx(i, j + 1)];
      const ax = m2[0] - m0[0], ay = m2[1] - m0[1], az = m2[2] - m0[2], bx = m3[0] - m1[0], by = m3[1] - m1[1], bz = m3[2] - m1[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const cx = (m0[0] + m2[0]) / 2, cyy = (m0[1] + m2[1]) / 2, cz = (m0[2] + m2[2]) / 2;
      const q = j * na + i;
      cellD[q] = cx * cx + (cyy - IE) * (cyy - IE) + cz * cz;
      cellF[q] = nx * -cx + ny * (IE - cyy) + nz * -cz > 0;
      for (const k of [idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)]) { const v = vtxN[k]; v[0] += nx; v[1] += ny; v[2] += nz; }
    }
    for (let k = 0; k < nV; k++) {
      if (briConst != null) { vtxB[k] = briConst; continue; }
      const m = meshBuf[k], v = vtxN[k];
      let nx = v[0], ny = v[1], nz = v[2]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      if (nx * -m[0] + ny * (IE - m[1]) + nz * -m[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const lit = inBeam(m[0], m[1], m[2]), ndl = nx * LFx + ny * LFy + nz * LFz;
      const amb = 0.1 + 0.08 * Math.max(0, -nx * 0.5 + ny * 0.6 + nz * 0.6);
      vtxB[k] = amb + lit * (ndl >= 0 ? 0.3 + 0.62 * ndl : 0.26 + 0.2 * ndl);
    }
  }
  // 把投影后的网格画成纸：由远到近逐格填充（格子外扩半像素互相压住，不留缝）→ 外缘细边 → 朝向镜头那一面的笔触
  function paintSheet(g, si, front, scale, briConst) {
    const na = MA, nb = MB, idx = (i, j) => j * (na + 1) + i, nC = na * nb;
    shadeMesh(na, nb, briConst);
    let sum = 0;
    for (let q = 0; q < nC; q++) {
      const i = q % na, j = (q / na) | 0;
      cellB[q] = (vtxB[idx(i, j)] + vtxB[idx(i + 1, j)] + vtxB[idx(i + 1, j + 1)] + vtxB[idx(i, j + 1)]) / 4; sum += cellB[q];
      order[q] = q;
    }
    order.length = nC;
    order.sort((x, y) => cellD[y] - cellD[x]);
    const avg = sum / nC;
    for (let o = 0; o < nC; o++) {
      const q = order[o], i = q % na, j = (q / na) | 0;
      const ks = [idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)];
      const P0 = scrBuf[ks[0]], P1 = scrBuf[ks[1]], P2 = scrBuf[ks[2]], P3 = scrBuf[ks[3]];
      const cx = (P0[0] + P1[0] + P2[0] + P3[0]) / 4, cyy = (P0[1] + P1[1] + P2[1] + P3[1]) / 4;
      // 屏幕上的亮度梯度：由两条对角线解 2×2 方程
      const d1x = P2[0] - P0[0], d1y = P2[1] - P0[1], d2x = P3[0] - P1[0], d2y = P3[1] - P1[1];
      const db1 = vtxB[ks[2]] - vtxB[ks[0]], db2 = vtxB[ks[3]] - vtxB[ks[1]];
      const det = d1x * d2y - d1y * d2x;
      let fill = paperCol(cellB[q]);
      if (Math.abs(det) > 0.5) {
        const gx = (db1 * d2y - db2 * d1y) / det, gy = (d1x * db2 - d2x * db1) / det, gl = Math.hypot(gx, gy);
        if (gl > 1e-4) {
          const L = Math.max(Math.hypot(d1x, d1y), Math.hypot(d2x, d2y)) * 0.5 + 1, ux = gx / gl, uy = gy / gl;
          const gr = g.createLinearGradient(cx - ux * L, cyy - uy * L, cx + ux * L, cyy + uy * L);
          gr.addColorStop(0, paperCol(clamp(cellB[q] - gl * L, 0, 1.2))); gr.addColorStop(1, paperCol(clamp(cellB[q] + gl * L, 0, 1.2)));
          fill = gr;
        }
      }
      g.fillStyle = fill; g.beginPath();
      for (let k = 0; k < 4; k++) {
        const p = scrBuf[ks[k]], dx = p[0] - cx, dy = p[1] - cyy, dl = Math.hypot(dx, dy) || 1, e = 0.6 / dl;
        k ? g.lineTo(p[0] + dx * e, p[1] + dy * e) : g.moveTo(p[0] + dx * e, p[1] + dy * e);
      }
      g.closePath(); g.fill();
    }
    g.lineWidth = 0.6; g.strokeStyle = `rgba(16,18,26,${0.22 + 0.2 * (1 - avg)})`;
    g.beginPath();
    for (let i = 0; i <= na; i++) { const p = scrBuf[idx(i, 0)]; i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
    for (let j = 1; j <= nb; j++) { const p = scrBuf[idx(na, j)]; g.lineTo(p[0], p[1]); }
    for (let i = na - 1; i >= 0; i--) { const p = scrBuf[idx(i, nb)]; g.lineTo(p[0], p[1]); }
    for (let j = nb - 1; j > 0; j--) { const p = scrBuf[idx(0, j)]; g.lineTo(p[0], p[1]); }
    g.closePath(); g.stroke();
    const map = (a, b, o) => {
      const fi = (a + 0.5) * na, fj = (b + 0.5) * nb;
      const i0 = Math.min(na - 1, Math.max(0, fi | 0)), j0 = Math.min(nb - 1, Math.max(0, fj | 0));
      const u = fi - i0, v = fj - j0;
      const p00 = scrBuf[idx(i0, j0)], p10 = scrBuf[idx(i0 + 1, j0)], p01 = scrBuf[idx(i0, j0 + 1)], p11 = scrBuf[idx(i0 + 1, j0 + 1)];
      o[0] = (p00[0] * (1 - u) + p10[0] * u) * (1 - v) + (p01[0] * (1 - u) + p11[0] * u) * v;
      o[1] = (p00[1] * (1 - u) + p10[1] * u) * (1 - v) + (p01[1] * (1 - u) + p11[1] * u) * v;
      return o;
    };
    g.lineCap = 'round';
    const strokes = STROKES[si];
    for (let k = 0; k < strokes.length; k++) {
      const st = strokes[k], ink = st[3] || 1;
      const ca = front ? st[1][0] : -st[1][0], cb = st[1][1];
      const fi = Math.min(na - 1, Math.max(0, ((ca + 0.5) * na) | 0)), fj = Math.min(nb - 1, Math.max(0, ((cb + 0.5) * nb) | 0));
      const q = fj * na + fi;
      // 只画在朝向镜头且是同一面的格子上（垂到背后的纸边不透出字）
      if (briConst == null && cellF[q] !== cellF[(nb >> 1) * na + (na >> 1)]) continue;
      const bri = cellB[q];
      g.strokeStyle = front ? `rgba(14,14,18,${(0.45 + 0.4 * bri) * ink})` : `rgba(30,30,36,${0.16 * (0.5 + bri) * ink})`;
      g.lineWidth = Math.max(0.45, 1.5 * scale * (st[4] || 1));
      g.beginPath();
      for (let q2 = 0; q2 < 3; q2++) { const [a, b] = st[q2]; map(front ? a : -a, b, _p); q2 ? g.lineTo(_p[0], _p[1]) : g.moveTo(_p[0], _p[1]); }
      g.stroke();
    }
    return avg;
  }
  // 最后一张（主体）始终用细网格，垂边时不换分辨率
  const meshRes = (P) => (P.fine ? [16, 10] : [6, 4]);
  function drawSheet(g, P, idx) {
    const [na, nb] = meshRes(P);
    const n = sheetMesh(P, meshBuf, na, nb);
    const N = (na + 1) * (nb + 1);
    for (let k = 0; k < N; k++) { const m = meshBuf[k]; scrBuf[k] = pj(m[0], m[1], m[2], scrBuf[k]); }
    const c = meshBuf[(nb >> 1) * (na + 1) + (na >> 1)];
    const toCam = -(n[0] * c[0] + n[1] * (c[1] - IE) + n[2] * c[2]);
    return paintSheet(g, idx, toCam > 0, IF * SW / c[2] / 120);
  }
  // 多边形按 f(p) ≥ 0 裁切（Sutherland–Hodgman）
  function clipPoly(poly, f) {
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  // 纸在案面上的影子：沿月光把纸的外缘投到 Y=0，在世界坐标里裁到案面范围内（飞高的纸影子落到案外）
  function sheetShadow(g, P) {
    if (P.Y < 0.002 || P.gone) return;
    const [na, nb] = meshRes(P);
    sheetMesh(P, meshBuf, na, nb);
    const ring = [], st = Math.max(1, na >> 2);
    for (let i = 0; i < na; i += st) ring.push(i);
    for (let j = 0; j < nb; j += st) ring.push(j * (na + 1) + na);
    for (let i = na; i > 0; i -= st) ring.push(nb * (na + 1) + i);
    for (let j = nb; j > 0; j -= st) ring.push(j * (na + 1));
    let poly = ring.map((k) => { const m = meshBuf[k], t = Math.max(0, m[1]) / LYd; return [m[0] + LXd * t, m[2] - t]; });
    poly = clipPoly(poly, (p) => p[1] - DESK.zf);
    if (poly.length > 2) poly = clipPoly(poly, (p) => DESK.zb - p[1]);
    if (poly.length > 2) poly = clipPoly(poly, (p) => DESK.xr - p[0]);
    if (poly.length < 3) return;
    g.beginPath();
    poly.forEach((q, n) => { const p = pj(q[0], 0, q[1], _p); n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.closePath();
    // 刚离开案面时影子藏在纸下，随高度渐显
    g.fillStyle = `rgba(8,10,16,${lerp(0.5, 0.36, P.drape) * (1 - smooth(P.Y / 0.3)) * ss(0.0006, 0.012, P.Y)})`; g.fill();
  }
  // 静态底层：墙、窗框、书架、案面（暗部）
  const inkRoom = () => cache('ink_room', W, H, (g) => {
    const wg = g.createLinearGradient(0, 0, 0, 480);
    wg.addColorStop(0, '#191d29'); wg.addColorStop(1, '#141720');
    g.fillStyle = wg; g.fillRect(0, 0, W, H);
    // 墙面粉壁的斑驳
    const R = A.rng(207);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '40,46,62' : '10,12,18'},${0.05 + R() * 0.06})`; g.beginPath(); g.ellipse(R() * W, R() * 480, 10 + R() * 50, 6 + R() * 30, R() * 3, 0, TAU); g.fill(); }
    // 窗下墙裙
    g.fillStyle = 'rgba(8,9,13,0.5)'; g.fillRect(0, WSY(0.12), W, 120);
    // 书架（右侧，歌词区：低对比）
    g.fillStyle = '#0e1016'; g.fillRect(900, 0, 380, 480);
    g.fillStyle = '#1a1d26';
    for (const y of [70, 190, 310, 430]) g.fillRect(900, y, 380, 9);
    g.fillRect(900, 0, 10, 480); g.fillRect(1270, 0, 10, 480);
    for (const [y0, y1] of [[79, 190], [199, 310], [319, 430]]) {
      let x = 916;
      while (x < 1260) {
        const kind = R(), wd = kind < 0.6 ? 14 + R() * 18 : 30 + R() * 30, hh = (y1 - y0) * (kind < 0.6 ? 0.55 + R() * 0.35 : 0.25 + R() * 0.2);
        g.fillStyle = `rgba(${30 + R() * 14 | 0},${32 + R() * 14 | 0},${42 + R() * 14 | 0},1)`;
        if (kind < 0.6) g.fillRect(x, y1 - hh, wd, hh);
        else { for (let k = 0; k < 3; k++) g.fillRect(x, y1 - (k + 1) * hh / 3 + 1, wd, hh / 3 - 2); }
        g.fillStyle = 'rgba(120,135,165,0.06)'; g.fillRect(x, y1 - hh, wd, 1.2);
        x += wd + 3 + R() * 10;
      }
    }
    // 墙上挂一幅旧山水立轴（抽象墨色，无字），很暗
    {
      const x0 = 612, x1 = 712, y0 = 52, y1 = 368;
      g.fillStyle = '#1b1e26'; g.fillRect(x0 - 6, y0, x1 - x0 + 12, y1 - y0);
      g.fillStyle = '#23262d'; g.fillRect(x0, y0 + 30, x1 - x0, y1 - y0 - 60);
      g.fillStyle = 'rgba(14,16,22,0.7)';
      g.beginPath(); g.moveTo(x0, 250); for (let x = x0; x <= x1; x += 4) g.lineTo(x, 250 - 60 * Math.pow(Math.sin((x - x0) / (x1 - x0) * Math.PI), 2) - 10 * Math.sin(x * 0.2)); g.lineTo(x1, 300); g.lineTo(x0, 300); g.closePath(); g.fill();
      g.fillStyle = 'rgba(14,16,22,0.4)';
      g.beginPath(); g.moveTo(x0, 200); for (let x = x0; x <= x1; x += 4) g.lineTo(x, 190 - 30 * Math.sin((x - x0) / 30) - 20); g.lineTo(x1, 230); g.lineTo(x0, 230); g.closePath(); g.fill();
      g.fillStyle = '#121318'; g.fillRect(x0 - 9, y0 - 4, x1 - x0 + 18, 6); g.fillRect(x0 - 9, y1 - 3, x1 - x0 + 18, 7);
      g.strokeStyle = 'rgba(16,18,24,0.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + 20, y0 - 3); g.lineTo(662, 30); g.lineTo(x1 - 20, y0 - 3); g.stroke();
    }
    // 左侧立柱
    const pg = g.createLinearGradient(30, 0, 96, 0);
    pg.addColorStop(0, '#0b0c11'); pg.addColorStop(1, '#151820');
    g.fillStyle = pg; g.fillRect(30, 0, 66, 480);
    // 案面（暗）：后沿到前沿
    const dk = [pj(-1.6, 0, DESK.zb), pj(DESK.xr, 0, DESK.zb), pj(DESK.xr, 0, DESK.zf), pj(-1.6, 0, DESK.zf)];
    const tg = g.createLinearGradient(0, dk[0][1], 0, dk[2][1]);
    tg.addColorStop(0, '#15161b'); tg.addColorStop(1, '#1d1e24');
    g.fillStyle = tg; g.beginPath(); dk.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    // 木纹（沿 X 方向）
    for (let k = 0; k < 60; k++) {
      const z = lerp(DESK.zf, DESK.zb, R()), a = pj(-1.6, 0, z), b = pj(DESK.xr, 0, z);
      g.strokeStyle = `rgba(${R() < 0.5 ? '0,0,0' : '70,64,66'},${0.03 + R() * 0.05})`; g.lineWidth = 0.5 + R() * 1.4;
      g.beginPath(); g.moveTo(a[0], a[1]);
      for (let q = 1; q <= 8; q++) { const x = lerp(-1.6, DESK.xr, q / 8), pp = pj(x, 0, z + 0.004 * Math.sin(q * 1.7 + k)); g.lineTo(pp[0], pp[1]); }
      g.stroke();
    }
    // 案沿（前立面）与案下暗处
    const f0 = pj(-1.6, 0, DESK.zf), f1 = pj(DESK.xr, 0, DESK.zf), f2 = pj(DESK.xr, -DESK.th, DESK.zf);
    g.fillStyle = '#0c0d11'; g.fillRect(-10, f0[1], f1[0] + 10, f2[1] - f0[1]);
    g.fillStyle = 'rgba(90,96,120,0.25)'; g.fillRect(-10, f0[1], f1[0] + 10, 1);
    g.fillStyle = '#07080b'; g.fillRect(-10, f2[1], f1[0] + 10, H - f2[1]);
    g.fillStyle = '#0a0b0f'; g.fillRect(-10, f2[1], f1[0] + 10, 16);
    // 案右端（向后收的斜边）与其下的墙
    const r0 = pj(DESK.xr, 0, DESK.zb);
    g.fillStyle = '#101219'; g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(f1[0], f1[1]); g.lineTo(f2[0], f2[1]); g.lineTo(f2[0], H); g.lineTo(W, H); g.lineTo(W, r0[1]); g.closePath(); g.fill();
    g.fillStyle = '#0b0c11'; g.beginPath(); g.moveTo(f1[0], f1[1]); g.lineTo(f2[0], f2[1]); g.lineTo(f2[0] - 4, H); g.lineTo(f1[0] - 18, H); g.closePath(); g.fill();
    // 窗框
    const ox0 = WSX(OPN.x0), ox1 = WSX(OPN.x1), oy0 = WSY(OPN.y1), oy1 = WSY(OPN.y0);
    g.fillStyle = '#0d0f15';
    g.fillRect(120, 60, 400, 12); g.fillRect(120, oy1, 400, 330 - oy1 + 6);
    g.fillRect(120, 60, ox0 - 120, 276); g.fillRect(ox1, 60, WSX(-0.96) - ox1, 276); g.fillRect(WSX(-0.41), 60, 520 - WSX(-0.41), 276);
    // 窗台
    g.fillStyle = '#111319'; g.fillRect(112, 328, 416, 10);
  });
  // 夜空、远竹、月亮（窗洞里）
  const inkSky = () => cache('ink_sky', W, 340, (g) => {
    const sg = g.createLinearGradient(0, 60, 0, 330);
    sg.addColorStop(0, '#222838'); sg.addColorStop(1, '#3b3f52');
    g.fillStyle = sg; g.fillRect(100, 40, 460, 300);
    const halo = g.createRadialGradient(MOONX, MOONY, 20, MOONX, MOONY, 230);
    halo.addColorStop(0, 'rgba(201,211,230,0.55)'); halo.addColorStop(0.3, 'rgba(160,172,200,0.2)'); halo.addColorStop(1, 'rgba(124,138,166,0)');
    g.fillStyle = halo; g.fillRect(100, 40, 460, 300);
    // 远处竹林（淡、偏蓝，虚）
    blurPass(g, W, 340, 2.2, (t) => {
      t.fillStyle = 'rgba(52,60,82,0.85)';
      for (let i = 0; i < 9; i++) { const x = 120 + i * 48 + (i % 3) * 7; t.fillRect(x, 120 + (i % 4) * 25, 3, 240); }
      for (let i = 0; i < 26; i++) { const x = 120 + (i * 37) % 420, y = 150 + (i * 53) % 150; t.beginPath(); t.ellipse(x, y, 16, 4, (i % 5) * 0.4 - 0.8, 0, TAU); t.fill(); }
    });
    // 月亮
    const mg = g.createRadialGradient(MOONX - 6, MOONY - 6, 2, MOONX, MOONY, 26);
    mg.addColorStop(0, '#f6eedb'); mg.addColorStop(0.8, '#e9dcc0'); mg.addColorStop(1, '#d9cfb8');
    g.fillStyle = mg; g.beginPath(); g.arc(MOONX, MOONY, 26, 0, TAU); g.fill();
    g.fillStyle = 'rgba(160,160,150,0.18)';
    for (const [x, y, r] of [[-8, -4, 7], [6, 6, 5], [8, -9, 4], [-3, 10, 3.5]]) { g.beginPath(); g.arc(MOONX + x, MOONY + y, r, 0, TAU); g.fill(); }
  });
  // 窗纸（右扇，关着）：透光的纸 + 格子
  const inkPaperWin = () => cache('ink_paperwin', W, 340, (g) => {
    const x0 = WSX(-0.96), x1 = WSX(-0.41), y0 = WSY(OPN.y1), y1 = WSY(OPN.y0);
    const pg = g.createRadialGradient(x0 - 40, y0 + 40, 10, x0, y0 + 60, 320);
    pg.addColorStop(0, '#c9d3e6'); pg.addColorStop(0.6, '#a2adc6'); pg.addColorStop(1, '#7c8aa6');
    g.fillStyle = pg; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const R = A.rng(17);
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '255,255,255' : '60,70,90'},${0.05 + R() * 0.06})`; g.lineWidth = 0.5; const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 10, y + (R() - 0.5) * 10); g.stroke(); }
  });
  const inkLattice = () => cache('ink_lattice', W, 340, (g) => {
    const x0 = WSX(-0.96), x1 = WSX(-0.41), y0 = WSY(OPN.y1), y1 = WSY(OPN.y0);
    g.fillStyle = '#121419';
    const nx = 5, ny = 7;
    for (let i = 1; i < nx; i++) g.fillRect(x0 + (x1 - x0) * i / nx - 1.5, y0, 3, y1 - y0);
    for (let j = 1; j < ny; j++) g.fillRect(x0, y0 + (y1 - y0) * j / ny - 1.5, x1 - x0, 3);
  });
  function inkdeskShot(g, c) {
    const lt = c.lt;
    const t1 = ct(c, 4, 0, 2.017), t2 = ct(c, 8, 0, 3.957);
    // 风：第21句第5字起吹入，第9字后平息
    const gust = ss(t1 - 0.15, t1 + 0.45, lt) * (1 - ss(t2, t2 + 0.7, lt));
    const amp = lerp(0.45, 1.6, gust) * (1 - ss(t2, t2 + 0.75, lt));
    const lean = gust;
    g.drawImage(inkRoom(), 0, 0, W, H);
    // 窗洞：夜空、月、近竹剪影
    const ox0 = WSX(OPN.x0), ox1 = WSX(OPN.x1), oy0 = WSY(OPN.y1), oy1 = WSY(OPN.y0);
    g.save(); g.beginPath(); g.rect(ox0, oy0, ox1 - ox0, oy1 - oy0); g.clip();
    g.drawImage(inkSky(), 0, 0, W, 340);
    drawBamboo(g, lt, amp, lean, '#0f1117', 0, 0, 1);
    g.restore();
    // 窗纸上的竹影（同一丛竹子，同步摇动）
    const px0 = WSX(-0.96), px1 = WSX(-0.41);
    g.save(); g.beginPath(); g.rect(px0, oy0, px1 - px0, oy1 - oy0); g.clip();
    g.drawImage(inkPaperWin(), 0, 0, W, 340);
    for (const [ox, oy] of [[-1.6, 0], [1.6, 0], [0, 1.6], [0, -1.6]]) { g.globalAlpha = 0.09; drawBamboo(g, lt, amp, lean, '#2e3448', 70 + ox, 10 + oy, 1); }
    g.globalAlpha = 1;
    g.drawImage(inkLattice(), 0, 0, W, 340);
    g.restore();
    // 窗台上沿、窗洞右侧（中梃的侧面）受月光
    g.fillStyle = 'rgba(201,211,230,0.45)'; g.fillRect(ox0, 328, ox1 - ox0, 1.6);
    g.fillStyle = 'rgba(201,211,230,0.22)'; g.fillRect(ox1 - 3, oy0, 3, oy1 - oy0);
    // 窗纸透出的柔光照亮附近墙面
    g.globalCompositeOperation = 'lighter';
    glowAt(g, (px0 + px1) / 2, 200, 320, 260, '#7c8aa6', 0.12);
    glowAt(g, MOONX + 40, 200, 300, 240, '#7c8aa6', 0.10);
    g.globalCompositeOperation = 'source-over';

    // 案面光斑（窗形，带半影）与光斑里的竹影
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let k = 3; k >= 0; k--) { patchPath(g, k * 0.022); g.fillStyle = `rgba(150,164,196,${k ? 0.06 : 0.3})`; g.fill(); }
    g.globalCompositeOperation = 'source-over';
    patchPath(g, 0.02); g.clip();
    // 竹影：把窗外竹子沿月光压到案面（近似为仿射映射），并用柔和的低透明度表现
    {
      const a = pj(PATCH[3][0], 0, PATCH[3][1]), b = pj(PATCH[2][0], 0, PATCH[2][1]), d = pj(PATCH[0][0], 0, PATCH[0][1]);
      // 窗洞底边一段（y 260..316）对应光斑前后
      const sx0 = ox0, sx1 = ox1, syF = oy0, syB = oy1;
      g.save();
      const m11 = (b[0] - a[0]) / (sx1 - sx0), m12 = (b[1] - a[1]) / (sx1 - sx0);
      const m21 = (d[0] - a[0]) / (syB - syF), m22 = (d[1] - a[1]) / (syB - syF);
      g.transform(m11, m12, m21, m22, a[0] - m11 * sx0 - m21 * syF, a[1] - m12 * sx0 - m22 * syF);
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, 2]]) { g.globalAlpha = 0.2; drawBamboo(g, lt, amp, lean, '#05060a', ox, oy, 1); }
      g.globalAlpha = 1;
      g.restore();
    }
    g.restore();
    // 月光透过空气（窗洞下沿 → 光斑后沿），极淡
    {
      const b0 = pj(PATCH[0][0], 0, PATCH[0][1]), b1 = pj(PATCH[1][0], 0, PATCH[1][1]);
      const gr = g.createLinearGradient(0, oy1, 0, b0[1]);
      gr.addColorStop(0, 'rgba(170,184,214,0.07)'); gr.addColorStop(1, 'rgba(170,184,214,0.025)');
      g.globalCompositeOperation = 'lighter'; g.fillStyle = gr;
      g.beginPath(); g.moveTo(ox0, oy1); g.lineTo(ox1, oy1); g.lineTo(b1[0], b1[1]); g.lineTo(b0[0], b0[1]); g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    // 光斑之外的窗纸柔光（右扇透出的漫射光）
    g.globalCompositeOperation = 'lighter';
    { const p = pj(0.02, 0, 1.05); glowAt(g, p[0], p[1], 260, 50, '#7c8aa6', 0.13); }
    g.globalCompositeOperation = 'source-over';

    // 案上物件与纸：按深度排序
    const poses = SHEETS.map((s, i) => sheetPose(s, i, lt, t1, t2));
    // 纸的影子
    g.save(); patchPath(g, 0.02); g.clip();
    poses.forEach((P) => sheetShadow(g, P));
    g.restore();
    const items = [];
    items.push({ z: STK.Z, f: () => drawStack(g, lt, t1, t2, gust) });
    items.push({ z: INK.Z, f: () => drawInk(g) });
    items.push({ z: 0.93, f: () => drawBrush(g) });
    // 物件上方（比它高）的纸画在它之后；盖在砚台上的纸画在砚台之后、笔之前
    const OBS = [[STK.X, STK.Z, STK.Z, 0.075, 0.3], [INK.X, INK.Z, INK.Z, INK.h, 0.25], [-0.44, 0.925, 0.93, 0.03, 0.12]];
    poses.forEach((P, i) => {
      if (P.gone) return;
      let z = P.Z;
      for (const [ox, oz, zz, top, r] of OBS) if (P.Y > top && Math.hypot(P.X - ox, P.Z - oz) < r) z = Math.min(z, zz - 0.005);
      items.push({ z, f: () => drawSheet(g, P, i) });
    });
    items.sort((a, b) => b.z - a.z);
    items.forEach((it) => it.f());

    // 月光里的浮尘（3D 位置，亮度由是否在光束内决定，自然淡入淡出）
    g.globalCompositeOperation = 'lighter';
    const be = beatEnv(c, 0.5);
    for (let i = 0; i < 110; i++) {
      const sx = 0.6 * Math.sin(lt * 0.21 + i);
      const drift = 0.02 * lt + 0.18 * (lt > t1 ? sInt((lt - t1) / 0.8) * 0.8 - sInt((lt - t2) / 0.8) * 0.8 : 0) * 0.5;
      let X = -1.4 + ((h2(i, 41) * 1.6 + drift + 0.02 * sx) % 1.6 + 1.6) % 1.6;
      const Z = 0.95 + h2(i, 42) * 1.35, Y = 0.02 + ((Math.pow(h2(i, 43), 1.6) * 0.9 + 0.012 * lt + 0.02 * Math.sin(lt * 0.5 + i)) % 0.9);
      const b = inBeam(X, Y, Z);
      if (b < 0.02) continue;
      const p = pj(X, Y, Z, _p);
      const a = b * (0.35 + 0.35 * h2(i, 44)) * (0.8 + 0.4 * (h2(i, 45) > 0.7 ? be : 0));
      g.fillStyle = rgba('#dfe6f4', a); g.beginPath(); g.arc(p[0], p[1], 0.7 + 1.1 * h2(i, 46) / Z, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  // 一叠写满的纸（露出的上角在风里翻动）
  function drawStack(g, lt, t1, t2, gust) {
    const { X, Z, yaw, w, d } = STK, n = 9;
    const corner = (a, b, y) => { const ca = Math.cos(yaw), sa = Math.sin(yaw); return pj(X + a * ca + b * sa, y, Z - a * sa + b * ca); };
    const top = 0.012;
    const lit = inBeam(X, top, Z);
    // 侧面层叠
    const p0 = corner(-w / 2, -d / 2, top), p1 = corner(w / 2, -d / 2, top), q1 = corner(w / 2, -d / 2, 0), q0 = corner(-w / 2, -d / 2, 0);
    g.fillStyle = '#2a2b31'; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(q1[0], q1[1]); g.lineTo(q0[0], q0[1]); g.closePath(); g.fill();
    g.strokeStyle = `rgba(200,205,220,${0.12 + 0.25 * lit})`; g.lineWidth = 0.6;
    for (let k = 1; k < n; k++) { const y = top * k / n, a = corner(-w / 2, -d / 2, y), b = corner(w / 2, -d / 2, y); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    // 影子（向前右）
    if (lit > 0.05) {
      const t = top / LYd, s0 = corner(-w / 2, -d / 2, 0), s1 = corner(w / 2, -d / 2, 0);
      const sh = (a, b) => { const ca = Math.cos(yaw), sa = Math.sin(yaw); return pj(X + a * ca + b * sa + LXd * t, 0, Z - a * sa + b * ca - t); };
      const s2 = sh(w / 2, -d / 2), s3 = sh(-w / 2, -d / 2);
      g.fillStyle = `rgba(6,8,12,${0.45 * lit})`; g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0], s1[1]); g.lineTo(s2[0], s2[1]); g.lineTo(s3[0], s3[1]); g.closePath(); g.fill();
    }
    // 顶面两张：靠窗的一角随风掀动
    for (let k = 0; k < 2; k++) {
      const P = { X, Y: top + k * 0.0015, Z, yaw: yaw + (k ? 0.04 : -0.03), pitch: 0, roll: 0, curlA: 0, curlB: 0, drape: 0 };
      const flap = gust * (k ? 1 : 0.6) * (0.5 + 0.5 * Math.sin(lt * (7 + k * 2.3) + k)) * (0.6 + 0.4 * Math.sin(lt * 3.1));
      drawSheetFlap(g, P, k ? 3 : 4, flap, lit);
    }
  }
  function drawSheetFlap(g, P, si, flap, lit) {
    const na = 5, nb = 4;
    sheetMesh(P, meshBuf, na, nb);
    // 左后角（靠窗）抬起
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const m = meshBuf[j * (na + 1) + i];
      const w = Math.max(0, 1 - (i / na) * 1.6) * (j / nb);
      m[1] += flap * 0.05 * w * w;
      scrBuf[j * (na + 1) + i] = pj(m[0], m[1], m[2], scrBuf[j * (na + 1) + i]);
    }
    paintSheet(g, si, true, IF * SW / P.Z / 120, 0.17 + lit * 0.62);
  }
  // 干涸的砚台
  function drawInk(g) {
    const { X, Z, w, d, h } = INK;
    const P = (a, y, b) => pj(X + a, y, Z + b);
    const lit = inBeam(X, h, Z);
    // 影子（向前右）
    const t = h / LYd;
    const sh = [P(-w / 2, 0, -d / 2), P(w / 2, 0, -d / 2), pj(X + w / 2 + LXd * t, 0, Z - d / 2 - t), pj(X - w / 2 + LXd * t, 0, Z - d / 2 - t)];
    g.fillStyle = `rgba(4,5,8,${0.55 * lit})`; g.beginPath(); sh.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    // 前立面、右侧面（背光，暗）
    const f = [P(-w / 2, h, -d / 2), P(w / 2, h, -d / 2), P(w / 2, 0, -d / 2), P(-w / 2, 0, -d / 2)];
    g.fillStyle = '#121318'; g.beginPath(); f.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    const r = [P(w / 2, h, -d / 2), P(w / 2, h, d / 2), P(w / 2, 0, d / 2), P(w / 2, 0, -d / 2)];
    g.fillStyle = '#0e0f13'; g.beginPath(); r.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    // 顶面
    const tp = [P(-w / 2, h, d / 2), P(w / 2, h, d / 2), P(w / 2, h, -d / 2), P(-w / 2, h, -d / 2)];
    const tb = 0.3 + 0.7 * lit;
    g.fillStyle = `rgb(${(58 * tb + 20) | 0},${(62 * tb + 22) | 0},${(74 * tb + 28) | 0})`;
    g.beginPath(); tp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    // 砚面：四周留一圈砚边，中间是略深的砚堂；后端是月牙形墨池，干涸，只剩灰白墨垢与裂纹
    const quad = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); };
    const inset = 0.012;
    quad([P(-w / 2 + inset, h, d / 2 - inset), P(w / 2 - inset, h, d / 2 - inset), P(w / 2 - inset, h, -d / 2 + inset), P(-w / 2 + inset, h, -d / 2 + inset)], `rgba(10,11,15,${0.35})`);
    const well = [];
    for (let k = 0; k <= 16; k++) { const a = Math.PI * k / 16; well.push(P(-Math.cos(a) * w * 0.34, h, d * 0.18 + Math.sin(a) * d * 0.22)); }
    quad(well, '#08090c');
    const crust = [];
    for (let k = 0; k <= 16; k++) { const a = Math.PI * k / 16; crust.push(P(-Math.cos(a) * w * 0.3, h, d * 0.2 + Math.sin(a) * d * 0.17)); }
    quad(crust, `rgba(104,106,112,${0.22 + 0.3 * lit})`);
    g.strokeStyle = 'rgba(8,8,12,0.75)'; g.lineWidth = 0.7;
    for (let k = 0; k < 8; k++) {
      const a0 = (h2(k, 51) - 0.5) * w * 0.48, b0 = d * (0.22 + 0.14 * h2(k, 52));
      const p1 = P(a0, h, b0), p2 = P(a0 + (h2(k, 53) - 0.5) * 0.03, h, b0 + 0.016 * h2(k, 54));
      g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
    }
    // 砚堂上残留的一抹干墨
    const st = P(-w * 0.05, h, -d * 0.16);
    g.fillStyle = 'rgba(64,66,74,0.4)'; g.beginPath(); g.ellipse(st[0], st[1], 18, 3.6, 0, 0, TAU); g.fill();
    // 背光一侧的边缘亮线（后沿、左沿）
    g.strokeStyle = `rgba(201,211,230,${0.25 + 0.5 * lit})`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(tp[3][0], tp[3][1]); g.lineTo(tp[0][0], tp[0][1]); g.lineTo(tp[1][0], tp[1][1]); g.stroke();
  }
  // 搁在砚边的毛笔（笔头干、散）
  function drawBrush(g) {
    const a = pj(-0.355, 0.024, 0.945), b = pj(-0.53, 0.006, 0.905);
    const lit = inBeam(-0.44, 0.02, 0.92);
    // 影
    const t = 0.024 / LYd, sa = pj(-0.355 + LXd * t, 0, 0.945 - t), sb = pj(-0.53 + LXd * 0.006 / LYd, 0, 0.905 - 0.006 / LYd);
    g.strokeStyle = `rgba(4,5,8,${0.45 * lit})`; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sa[0], sa[1]); g.lineTo(sb[0], sb[1]); g.stroke();
    // 笔杆
    g.strokeStyle = '#4a3c2a'; g.lineWidth = 6.5; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.strokeStyle = `rgba(201,211,230,${0.2 + 0.45 * lit})`; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(a[0], a[1] - 2.6); g.lineTo(b[0], b[1] - 2.6); g.stroke();
    // 笔帽端
    g.fillStyle = '#2a2018'; g.beginPath(); g.arc(b[0], b[1], 3.4, 0, TAU); g.fill();
    // 笔头（干，分叉）
    const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    g.fillStyle = '#18181c';
    g.beginPath(); g.moveTo(a[0] - uy * 3.6, a[1] + ux * 3.6); g.quadraticCurveTo(a[0] + ux * 14 - uy * 4, a[1] + uy * 14 + ux * 4, a[0] + ux * 26, a[1] + uy * 26);
    g.quadraticCurveTo(a[0] + ux * 14 + uy * 4, a[1] + uy * 14 - ux * 4, a[0] + uy * 3.6, a[1] - ux * 3.6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,40,46,0.9)'; g.lineWidth = 0.8;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(a[0] + ux * 16, a[1] + uy * 16); g.lineTo(a[0] + ux * (25 + Math.abs(k)) - uy * k * 2.2, a[1] + uy * (25 + Math.abs(k)) + ux * k * 2.2); g.stroke(); }
  }
  XYT.registerShot('c1_inkdesk', {
    name: '墨尽纸飞', zone: 'right', night: true, text: '#ece6d6', shadow: 'rgba(8,10,18,0.9)', accent: '#c9d3e6', bloom: 0.38,
    draw: inkdeskShot,
  });
})();
