/* 第三版镜头组 fg7：e4_redsand、f1_snowhut、f3_pines。不含歌词。 */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, h2, rgba, mix, noise1, noise2 } = A;
  // 第 off 句第 k 字的时间（相对镜头起点）；没有歌词时用分镜表的秒数
  const CT = (c, k, def, off) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? def : v - (c.t - c.lt);
  };
  const fbm2 = (x, y, seed, oct) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += a * noise2(x * f, y * f, seed + i * 13); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  };
  const hexArr = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const mixA = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // 建缓存时：先画到临时画布，再带模糊合成进缓存（ctx.filter 只在这里用）
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
  // 逐像素生成的贴图（只在建缓存时算一次）：fn(u, v, out) 写入 [r, g, b, a(0..1)]，(u, v) 为贴图本地坐标
  function pixelTex(key, x0, y0, w, h, scale, fn, blur) {
    return K.cache(key, w, h, scale, (g) => {
      const cv = g.canvas, pw = cv.width, ph = cv.height;
      const tmp = blur ? document.createElement('canvas') : cv;
      if (blur) { tmp.width = pw; tmp.height = ph; }
      const tg = blur ? tmp.getContext('2d') : g;
      const img = tg.createImageData(pw, ph), d = img.data, o = [0, 0, 0, 0];
      for (let j = 0; j < ph; j++) {
        const v = y0 + (j + 0.5) * h / ph;
        for (let i = 0; i < pw; i++) {
          const u = x0 + (i + 0.5) * w / pw;
          o[3] = 0; fn(u, v, o);
          const k = (j * pw + i) * 4;
          d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = clamp(o[3]) * 255;
        }
      }
      tg.putImageData(img, 0, 0);
      if (blur) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = `blur(${blur}px)`; g.drawImage(tmp, 0, 0); g.restore(); }
    });
  }
  // 柔光圆点贴图
  const dot = (col, core) => K.cache(`fg7dot:${col}:${core}`, 64, 64, 1, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(core, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  // 速度从 v0 在 [a, a+d] 内平滑升到 v1 时，到 t 为止走过的距离（位置连续、速度连续）
  const rampDist = (t, a, d, v0, v1) => {
    let r;
    if (t <= a) r = 0;
    else if (t >= a + d) r = d * 0.5 + (t - a - d);
    else { const u = (t - a) / d; r = d * (u * u * u - u * u * u * u / 2); }
    return v0 * t + (v1 - v0) * r;
  };
  const sil = (g, who, pose, x, y, h, t, o) => XYT.sil.draw(g, who, pose, x, y, h, t, o);
  // 只把贴图落在画面内的部分画出来（贴图逻辑尺寸 lw×lh，画在 dx,dy 原大；top：贴图上部跳过的逻辑像素）
  function blitCrop(g, img, lw, lh, dx, dy, top) {
    const k = img.width / lw;
    const x0 = Math.max(0, -dx), y0 = Math.max(top || 0, -dy);
    const x1 = Math.min(lw, W - dx), y1 = Math.min(lh, H - dy);
    if (x1 <= x0 || y1 <= y0) return;
    g.drawImage(img, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, dx + x0, dy + y0, x1 - x0, y1 - y0);
  }

  // 横向可循环的贴图预先平铺成一条 1:1 的长条（建缓存时用 repeat-x 图案填，没有接缝）；
  // 每帧按整数像素位移贴一次，走快速的整像素拷贝
  function tileStrip(key, tex, tw, th, len) {
    return K.cache(key, len, th, 1, (g) => {
      const p = g.createPattern(tex, 'repeat-x');
      p.setTransform(new DOMMatrix([tw / tex.width, 0, 0, th / tex.height, 0, 0]));
      g.fillStyle = p; g.fillRect(0, 0, len, th);
    });
  }
  // 从长条里取 [off, off+W) 一段贴到 y 处（off 在长条逻辑坐标里，取整到设备像素）
  function stripBlit(g, strip, off, y) {
    const k = strip.width / strip.lw;
    g.drawImage(strip, Math.round(off * k), 0, Math.round(W * k), strip.height, 0, Math.round(y), W, strip.lh);
  }
  // 低分辨率生成的贴图放大成 1:1 的缓存（只在建缓存时缩放一次）
  const fullRes = (key, tex, w, h) => K.cache(key, w, h, 1, (g) => g.drawImage(tex, 0, 0, w, h));

  // ============================================================
  // e4_redsand：黄昏荒原，红色沙墙翻涌逼近，行路人顶风而立，终被沙尘吞没
  // ============================================================
  (function () {
    const HOR = 470;                       // 地平线
    const F = 1000, HC = 1.105;            // 透视：焦距（像素）、机位高（米）；人在 z≈8.5 米处高 200 像素
    const SUN = [880, 300], SUNR = 25;
    const FIG = { x: 380, y: 600, h: 200 };
    const WALL_BASE = 486;                 // 远处沙墙的墙脚
    // 远墙前沿（屏幕 x）：越近越快
    const wallX = (t, tW) => { const d = tW - t; return 440 + 60 * d - 2.0 * d * d; };
    // 近处贴地尘幕前沿：比远墙快（视差），第1句第12字时恰到人物
    const veilX = (t, tW) => { const d = tW - t; return d > 0 ? FIG.x + 230 * d + 25 * d * d : FIG.x + 230 * d; };
    const gy = (z) => HOR + F * HC / z;    // 地面深度 z 处的屏幕 y

    // ---------- 天空 ----------
    const skyLayer = () => K.cache('e4:sky', W, HOR + 40, 0.5, (g) => {
      let gr = g.createLinearGradient(0, 0, 0, HOR + 40);
      gr.addColorStop(0, '#2a110c'); gr.addColorStop(0.3, '#4a1a10'); gr.addColorStop(0.62, '#82301c');
      gr.addColorStop(0.88, '#b24a28'); gr.addColorStop(1, '#c05a34');
      g.fillStyle = gr; g.fillRect(0, 0, W, HOR + 40);
      gr = g.createRadialGradient(SUN[0], SUN[1], 0, SUN[0], SUN[1], 820);
      gr.addColorStop(0, 'rgba(233,138,74,0.5)'); gr.addColorStop(0.35, 'rgba(194,83,46,0.26)'); gr.addColorStop(1, 'rgba(194,83,46,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, HOR + 40);
      // 高空悬尘：几道很淡的横向尘带
      blurInto(g, W, HOR + 40, 16, (b) => {
        const r = A.rng(4401);
        for (let i = 0; i < 9; i++) {
          const y = 60 + r() * 330, w = 300 + r() * 700, x = r() * W - 200;
          b.fillStyle = rgba(i % 3 ? '#9a3a22' : '#d07040', 0.07 + r() * 0.07);
          b.beginPath(); b.ellipse(x + w / 2, y, w / 2, 6 + r() * 14, 0, 0, TAU); b.fill();
        }
      });
    });
    // ---------- 远处台地（地平线上的低矮方山，被尘气冲淡）----------
    const farLayer = () => K.cache('e4:far', W, 140, 1, (g) => {
      const base = 102;
      blurInto(g, W, 140, 1.2, (b) => {
        // 方山：平顶、两侧是带凹弧的碎石坡；底下一条低缓的地脊
        const ridge = (seed, n, hMax, col, x0, x1) => {
          const r = A.rng(seed), M = [];
          for (let i = 0; i < n; i++) M.push({ cx: x0 + r() * (x1 - x0), w: 30 + r() * 90, h: hMax * (0.5 + 0.5 * r()), s: 18 + r() * 26 });
          b.fillStyle = col; b.beginPath(); b.moveTo(0, base + 4);
          for (let x = 0; x <= W; x += 3) {
            let hh = hMax * 0.1 * (0.5 + noise1(x / 70, seed));
            for (const m of M) {
              const q = clamp((m.w + m.s - Math.abs(x - m.cx)) / m.s);
              hh = Math.max(hh, m.h * Math.pow(q, 0.6) * (1 - 0.04 * noise1(x / 9, seed + 2)));
            }
            b.lineTo(x, base - hh);
          }
          b.lineTo(W, base + 4); b.closePath(); b.fill();
        };
        ridge(51, 5, 30, '#a2472a', 0, W);
        ridge(77, 3, 18, '#83361f', 0, 700);
      });
    });
    // ---------- 地面（龟裂的土地，透视）----------
    const groundLayer = () => K.cache('e4:ground', W, H - HOR + 4, 1, (g) => {
      const oy = HOR - 2;
      g.translate(0, -oy);
      let gr = g.createLinearGradient(0, HOR, 0, H);
      gr.addColorStop(0, '#7a3220'); gr.addColorStop(0.08, '#5e2617'); gr.addColorStop(0.28, '#451b12');
      gr.addColorStop(0.62, '#2c130c'); gr.addColorStop(1, '#1c0d09');
      g.fillStyle = gr; g.fillRect(0, HOR - 2, W, H - HOR + 6);
      gr = g.createRadialGradient(SUN[0], HOR, 0, SUN[0], HOR, 700);
      gr.addColorStop(0, 'rgba(210,100,56,0.3)'); gr.addColorStop(1, 'rgba(210,100,56,0)');
      g.fillStyle = gr; g.fillRect(0, HOR - 2, W, H - HOR + 6);
      // 土色的大块起伏（低对比）
      blurInto(g, W, H, 10, (b) => {
        const r = A.rng(818);
        for (let i = 0; i < 40; i++) {
          const z = 6 + Math.pow(r(), 1.5) * 60, x = (r() - 0.5) * z * 1.6;
          const sx = 640 + F * x / z, sy = gy(z), w = 2.4 * F / z * (0.6 + r());
          b.fillStyle = r() < 0.5 ? 'rgba(18,7,4,0.16)' : 'rgba(150,64,36,0.1)';
          b.beginPath(); b.ellipse(sx, sy, w, w * HC / z * 0.9 + 1, 0, 0, TAU); b.fill();
        }
      });
      // 龟裂：地面上抖动的网格（世界坐标）投影到屏幕；主裂缝沿格边、粗而暗，格内再随机劈一两道细缝，板块大小不一
      const r = A.rng(7307);
      const nx = 70, nz = 80;
      const P = [];
      for (let j = 0; j <= nz; j++) {
        const row = [];
        const sz = 0.95 * Math.pow(1.045, j);
        let z0 = 4.0; for (let q = 0; q < j; q++) z0 += 0.95 * Math.pow(1.045, q);
        for (let i = 0; i <= nx; i++) {
          const x = (i - nx / 2) * sz;
          row.push([x + (r() - 0.5) * sz * 0.85, z0 + (r() - 0.5) * sz * 0.75]);
        }
        P.push(row);
      }
      const pr = (p) => [640 + F * p[0] / p[1], gy(p[1])];
      g.lineCap = 'round'; g.lineJoin = 'round';
      const crack = (u, w, z, a, thick) => {
        const wgt = clamp(4.5 / z, 0.12, 1.0);
        const m = [(u[0] + w[0]) / 2 + (r() - 0.5) * 0.18 * Math.hypot(w[0] - u[0], w[1] - u[1]), (u[1] + w[1]) / 2 + (r() - 0.5) * 0.1];
        const A0 = pr(u), B0 = pr(w), M0 = pr(m);
        g.strokeStyle = `rgba(14,6,4,${(thick ? 0.72 : 0.42) * a})`; g.lineWidth = (thick ? 1.7 : 0.8) * wgt + 0.25;
        g.beginPath(); g.moveTo(A0[0], A0[1]); g.quadraticCurveTo(M0[0], M0[1], B0[0], B0[1]); g.stroke();
        if (thick) {
          g.strokeStyle = `rgba(206,112,66,${0.14 * a * a})`; g.lineWidth = 0.7 * wgt + 0.2;
          g.beginPath(); g.moveTo(A0[0], A0[1] + 1.3 * wgt); g.quadraticCurveTo(M0[0], M0[1] + 1.3 * wgt, B0[0], B0[1] + 1.3 * wgt); g.stroke();
        }
      };
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const p = P[j][i], q = P[j][i + 1], s2 = P[j + 1][i], t4 = P[j + 1][i + 1];
          const z = p[1], sx = 640 + F * p[0] / z, sy = gy(z);
          if (sx < -300 || sx > W + 300) continue;
          const a = clamp(1.05 - z / 45, 0, 1) * (sy > 610 ? 0.6 : 1);
          if (a <= 0.02) continue;
          // 板块顶面：同色系的明暗
          const v = r(), Q = [p, q, t4, s2].map(pr);
          g.fillStyle = v < 0.45 ? `rgba(20,8,5,${0.13 * a})` : v < 0.8 ? `rgba(150,66,38,${0.06 * a})` : `rgba(0,0,0,0)`;
          g.beginPath(); g.moveTo(Q[0][0], Q[0][1]); for (let k = 1; k < 4; k++) g.lineTo(Q[k][0], Q[k][1]); g.closePath(); g.fill();
          // 主裂缝：大部分格边（个别格边没裂，两块连成一大块）
          if (r() < 0.85) crack(p, q, z, a, true);
          if (r() < 0.85) crack(p, s2, z, a, true);
          // 细缝：在格内劈一刀（对边上任取两点）
          if (r() < 0.55) {
            const u1 = 0.25 + 0.5 * r(), u2 = 0.25 + 0.5 * r();
            const e1 = r() < 0.5 ? [lerp(p[0], q[0], u1), lerp(p[1], q[1], u1)] : [lerp(p[0], s2[0], u1), lerp(p[1], s2[1], u1)];
            const e2 = r() < 0.5 ? [lerp(s2[0], t4[0], u2), lerp(s2[1], t4[1], u2)] : [lerp(q[0], t4[0], u2), lerp(q[1], t4[1], u2)];
            crack(e1, e2, z, a, false);
          }
        }
      }
      // 零星的小枯草（被风压向左）
      for (let k = 0; k < 18; k++) {
        const z = 7 + Math.pow(r(), 1.3) * 40, x = (r() - 0.5) * z * 1.4;
        const sx = 640 + F * x / z, sy = gy(z), sc = 7 / z;
        if (Math.abs(sx - FIG.x) < 70 && Math.abs(sy - FIG.y) < 50) continue;
        g.strokeStyle = 'rgba(26,11,7,0.85)'; g.lineWidth = Math.max(0.5, 1.4 * sc);
        for (let bb = 0; bb < 6; bb++) {
          const L = (10 + r() * 10) * sc, lean = 0.5 + r() * 0.5;
          const bx = sx + (bb - 2.5) * 2 * sc;
          g.beginPath(); g.moveTo(bx, sy);
          g.quadraticCurveTo(bx - L * 0.15, sy - L * 0.7, bx - L * lean, sy - L * 0.85);
          g.stroke();
        }
      }
    });

    // ---------- 沙墙（逐像素：体积尘团，逆光上缘亮）----------
    const C = {
      dark: hexArr('#2e120b'), mid: hexArr('#5a2216'), top: hexArr('#7a2e1e'), lit: hexArr('#c2532e'), glow: hexArr('#f0a060'),
    };
    const WB = { x0: -170, y0: -450, w: 1720, h: 520 };
    const topAt = (u) => -318 - 20 * Math.sin(u / 190 + 0.7) - 12 * Math.sin(u / 83 + 2.1) + 40 * smooth((80 - u) / 160);
    const edgeAt = (v) => { const q = clamp(-v / 330); return -40 * Math.pow(Math.sin(Math.PI * Math.min(1, q * 1.1)), 0.8) + 70 * q * q * q; };
    const wallS = (u, v) => {
      const n1 = fbm2(u / 108, v / 100, 11, 3), n2 = fbm2(u / 44, v / 44, 23, 2);
      const s = Math.min(v - topAt(u), (u - edgeAt(v)) * 0.9) + (n1 - 0.5) * 130 + (n2 - 0.5) * 26;
      return [s, n1];
    };
    // 墙体在本地坐标 (u, v) 处的浓度（贴图与太阳透光共用）
    const wallDens = (u, v, s) => smooth((s + 8) / 44) * lerp(0.5, 1, smooth((v + 320) / 260)) * (1 - smooth((v - 6) / 18));
    const wallBody = () => pixelTex('e4:wall', WB.x0, WB.y0, WB.w, WB.h, 0.36, (u, v, o) => {
      if (v > 70) return;
      const [s, n1] = wallS(u, v);
      // 墙脚前的地面：太阳被沙墙挡住，墙脚下一带落进墙影，贴地一层暗尘；影子左缘随透视向左下张开
      let shA = 0;
      if (v > -16) {
        const e = u - edgeAt(0) + 0.5 * Math.max(0, v) + 46 * (n1 - 0.5);
        shA = 0.9 * smooth((e + 30) / 110) * (1 - smooth((v - 8) / 58));
      }
      if (s < -20 && shA <= 0.002) return;
      let aW = 0, col = C.dark;
      if (s >= -20) {
        const [sl, nl] = wallS(u + 7, v - 9);
        // 底部浓、上部薄：太阳从顶部的薄尘里透出来；墙脚一直浓到地面
        aW = wallDens(u, v, s);
        const top = smooth((-v - 90) / 220);
        const thin = 1 - smooth(s / 80);
        const emb = clamp((s - sl) / 14) * 0.6 + clamp((n1 - nl) * 9) * 0.4;
        col = mixA(C.dark, C.mid, smooth((-v + 20) / 200));
        col = mixA(col, C.top, top * 0.7);
        col = mixA(col, C.lit, clamp(0.5 * emb + 0.45 * thin * (0.3 + 0.7 * top)));
        col = mixA(col, C.glow, clamp(thin * thin * top * 0.55));
        // 墙脚：暗，不带墙体的明暗
        col = mixA(col, C.dark, smooth((v + 40) / 40));
      }
      const a = aW + shA * (1 - aW);
      if (a <= 0.002) return;
      const m = mixA(C.dark, col, aW / a);
      o[0] = m[0]; o[1] = m[1]; o[2] = m[2]; o[3] = a;
    }, 1.2);
    // 墙顶被风吹出的尘缕（两种）：横向拉长的薄尘，左端渐散
    const WS = { w: 420, h: 120 };
    const wisp = (k) => pixelTex('e4:wisp' + k, 0, 0, WS.w, WS.h, 0.4, (u, v, o) => {
      const sd = 800 + k * 29, q = u / WS.w;
      const n = fbm2(u / 70, v / 18, sd, 4);
      const mid = WS.h * (0.55 - 0.15 * q) + 10 * (noise1(u / 90, sd) - 0.5);
      const hw = WS.h * (0.12 + 0.2 * q);
      const prof = Math.exp(-Math.pow((v - mid) / hw, 2));
      const a = clamp(prof * (n - 0.2) * 2.6) * smooth(q / 0.7) * (1 - smooth((q - 0.85) / 0.15));
      const col = mixA(C.lit, C.glow, clamp(0.2 + (n - 0.5) * 1.2));
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; o[3] = a;
    }, 1.2);

    // ---------- 近处贴地风沙（与人物同一深度及更近，画在人物前面）----------
    const VEIL = { w: 1800, h: 600, top: 120 };
    // 本地坐标：前沿在 u≈0，v=0 对应屏幕 y=120，人物脚下 v=480。
    // 前沿是一道贴地的浓沙裙（约人高一半），后面渐高、越过人头；团块朝光（右上）的一面亮，薄边逆光发亮
    const veilS = (u, v, sd) => {
      const lump = fbm2(u / 64, v / 46, sd, 3);
      const topY = 380 - 196 * smooth((u - 40) / 620) + 38 * (fbm2(u / 120, 1.7, sd + 3, 3) - 0.5) * 2;
      const uf = 16 + 36 * (1 - smooth((v - 360) / 160)) + 54 * (fbm2(v / 46, 2.3, sd + 4, 3) - 0.5);
      // 顶缘与前缘的交角磨圆（沙头是圆钝的）
      const a = v - topY, b = (u - uf) * 0.9, R = 80;
      const m = Math.min(a, b) >= R ? Math.min(a, b) : R - Math.hypot(Math.max(R - a, 0), Math.max(R - b, 0));
      return m + (lump - 0.5) * 76;
    };
    const veilTex = (k) => pixelTex('e4:veil' + k, 0, 0, VEIL.w, VEIL.h, 0.3, (u, v, o) => {
      const sd = 500 + k * 77;
      const S = veilS(u, v, sd);
      if (S < -12) return;
      const Sl = veilS(u + 6, v - 8, sd);
      const str = fbm2(u / 300, v / 14, sd + 9, 3);
      const d = smooth((S + 8) / 34);
      const base = lerp(0.6, 0.97, smooth((v - 300) / 100));
      const dens = d * clamp(base + 0.22 * (str - 0.5) * 2);
      if (dens <= 0.002) return;
      // 只有外缘一圈受光：朝右上的团块顶亮，薄边透光；里面是暗沙，只带横向的风纹
      const rimZ = 1 - smooth((S - 6) / 44), thin = (1 - smooth(S / 36)) * (1 - 0.75 * smooth((v - 430) / 90));
      const emb = clamp((S - Sl) / 10) * rimZ;
      let col = mixA(hexArr('#22100a'), C.mid, 0.75 * clamp(1 - (v - 250) / 300));
      // 沙裙里面也在翻滚：大团块朝右上（光的方向）的一面略亮、背面略暗，越往里越弱
      const bl = fbm2(u / 120, v / 40, sd + 11, 3), blU = fbm2((u + 10) / 120, (v - 7) / 40, sd + 11, 3);
      const inner = 1 - rimZ;
      col = mixA(col, C.mid, clamp((bl - blU) * 9 + 0.5 * (bl - 0.45)) * 0.55 * inner);
      col = mixA(col, hexArr('#160a06'), clamp((0.42 - bl) * 2.2) * 0.5 * inner);
      col = mixA(col, C.lit, clamp(emb * 0.8 + thin * 0.4 + (str - 0.5) * 0.3 * (1 - smooth((v - 420) / 100))));
      col = mixA(col, hexArr('#e98a4a'), clamp(emb * thin * 0.45));
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; o[3] = dens;
    }, 0.7);
    // 横向流动的浮尘（可平铺）：两份噪声按 u 交叉淡化，首尾相接
    const HZ = { w: 1024, h: 400 };
    const hazeTex = () => pixelTex('e4:haze', 0, 0, HZ.w, HZ.h, 0.3, (u, v, o) => {
      const f = (uu) => fbm2(uu / 210, v / 26, 71, 4);
      const w = u / HZ.w, n = f(u) * (1 - w) + f(u - HZ.w) * w;
      const a = clamp((n - 0.42) * 2.2) * (0.55 + 0.45 * Math.sin(Math.PI * v / HZ.h));
      const col = mixA(C.mid, C.lit, clamp((n - 0.5) * 2.5));
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; o[3] = a;
    });
    // 贴地沙流：可横向平铺的细纹
    const flowTex = () => K.cache('e4:flow', 512, 48, 1, (g) => {
      const r = A.rng(77);
      blurInto(g, 512, 48, 0.8, (b) => {
        for (let i = 0; i < 40; i++) {
          const y = 8 + r() * 34, x = r() * 512, L = 50 + r() * 170, a = 0.12 + r() * 0.26;
          b.strokeStyle = rgba(r() < 0.5 ? '#d08a5a' : '#b0603a', a); b.lineWidth = 0.6 + r() * 1.3; b.lineCap = 'round';
          for (const ox of [-512, 0, 512]) {
            b.beginPath(); b.moveTo(x + ox, y);
            b.bezierCurveTo(x + ox + L * 0.3, y - 3 * r(), x + ox + L * 0.6, y + 3 * r(), x + ox + L, y + (r() - 0.5) * 3);
            b.stroke();
          }
        }
      });
    });
    // 吞没时整幅的尘幕：竖向是暗红—赭红—暗褐的明暗，叠上横向拉长的尘纹；横向首尾相接
    const engTex = () => pixelTex('e4:eng', 0, 0, W, H, 0.25, (u, v, o) => {
      const f = (uu) => fbm2(uu / 230, v / 30, 73, 4);
      const w = u / W, n = f(u) * (1 - w) + f(u - W) * w;
      const q = v / H;
      const base = q < 0.42 ? mixA(hexArr('#4a1a10'), hexArr('#7a2c1a'), q / 0.42) : q < 0.75 ? mixA(hexArr('#7a2c1a'), hexArr('#5a2014'), (q - 0.42) / 0.33) : mixA(hexArr('#5a2014'), hexArr('#2c120c'), (q - 0.75) / 0.25);
      const col = mixA(base, C.lit, clamp((n - 0.5) * 1.6) * 0.45 * (1 - smooth((q - 0.7) / 0.3)));
      const dk = clamp((0.45 - n) * 1.2) * 0.25;
      o[0] = col[0] * (1 - dk); o[1] = col[1] * (1 - dk); o[2] = col[2] * (1 - dk); o[3] = 1;
    });
    // 人物的模糊剪影（被尘吞没后叠在尘上，尘里只看得出一个人形）
    const figBlur = () => K.cache('e4:figblur', 240, 260, 0.5, (g) => {
      blurInto(g, 240, 260, 4, (b) => {
        sil(b, 'traveler', 'leanSide', 110, 230, FIG.h, 0, { facing: 1, wind: 1, windDir: -1, body: '#1a0c08' });
        // 贴地的尘最浓：腿脚比头肩更模糊
        const gr = b.createLinearGradient(0, 30, 0, 232);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.8)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
        b.globalCompositeOperation = 'destination-in'; b.fillStyle = gr; b.fillRect(0, 0, 240, 260);
      });
    });
    // 日轮：墙后的实盘（暗红）、透过墙顶薄尘的软盘、吞没后尘里剩下的暗红圆盘
    const sunSpr = () => K.cache('e4:sun', 120, 120, 1, (g) => {
      blurInto(g, 120, 120, 1.6, (b) => {
        const gr = b.createRadialGradient(60, 60, 0, 60, 60, SUNR);
        gr.addColorStop(0, '#f0a070'); gr.addColorStop(0.7, '#d0603a'); gr.addColorStop(1, '#a83e24');
        b.fillStyle = gr; b.beginPath(); b.arc(60, 60, SUNR, 0, TAU); b.fill();
      });
    });
    const sunSoft = () => K.cache('e4:sunsoft', 120, 120, 1, (g) => {
      blurInto(g, 120, 120, 6, (b) => {
        b.fillStyle = '#b8462a'; b.beginPath(); b.arc(60, 60, SUNR, 0, TAU); b.fill();
        b.fillStyle = 'rgba(220,112,66,0.55)'; b.beginPath(); b.arc(60, 60, SUNR * 0.62, 0, TAU); b.fill();
      });
    });
    const sunDim = () => K.cache('e4:sundim', 120, 120, 1, (g) => {
      blurInto(g, 120, 120, 5, (b) => {
        const gr = b.createRadialGradient(60, 60, 0, 60, 60, SUNR * 1.04);
        gr.addColorStop(0, '#a83e24'); gr.addColorStop(0.75, '#8a2a18'); gr.addColorStop(1, '#6a2014');
        b.fillStyle = gr; b.beginPath(); b.arc(60, 60, SUNR * 1.04, 0, TAU); b.fill();
      });
    });

    // 日轮四周的前向散射光（1:1 缓存，整像素贴）
    const scatter = () => K.cache('e4:scatter', 480, 480, 1, (g) => {
      const gr = g.createRadialGradient(240, 240, 0, 240, 240, 240);
      gr.addColorStop(0, 'rgba(208,96,58,1)'); gr.addColorStop(0.2, 'rgba(208,96,58,0.55)'); gr.addColorStop(1, 'rgba(208,96,58,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 480, 480);
    });
    // 墙影的竖向剖面：顶部 40 像素渐实；本体一段实、最后 150 像素渐淡
    const SB = { n: 900 };
    const shadeRamp = () => K.cache('e4:shramp', W, 40, 1, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 40);
      gr.addColorStop(0, 'rgba(22,8,5,0)'); gr.addColorStop(1, 'rgba(22,8,5,1)');
      g.fillStyle = gr; g.fillRect(0, 0, W, 40);
    });
    const shadeBody = () => K.cache('e4:shbody', W, SB.n, 1, (g) => {
      const gr = g.createLinearGradient(0, SB.n - 150, 0, SB.n);
      gr.addColorStop(0, 'rgba(22,8,5,1)'); gr.addColorStop(1, 'rgba(22,8,5,0)');
      g.fillStyle = 'rgba(22,8,5,1)'; g.fillRect(0, 0, W, SB.n - 150);
      g.fillStyle = gr; g.fillRect(0, SB.n - 150, W, 150);
    });
    // 静态底图：天空、远处台地、地面、地平线上的尘气（尘气在沙墙之后，墙脚压在它上面）
    const bgLayer = () => K.cache('e4:bg', W, H, 1, (g) => {
      g.drawImage(skyLayer(), 0, 0, W, HOR + 40);
      g.drawImage(farLayer(), 0, HOR - 102, W, 140);
      g.drawImage(groundLayer(), 0, HOR - 2, W, H - HOR + 4);
      const gr = g.createLinearGradient(0, HOR - 40, 0, HOR + 60);
      gr.addColorStop(0, 'rgba(184,78,42,0)'); gr.addColorStop(0.42, 'rgba(184,78,42,0.6)'); gr.addColorStop(1, 'rgba(184,78,42,0)');
      g.fillStyle = gr; g.fillRect(0, HOR - 40, W, 100);
    });
    XYT.registerShot('e4_redsand', {
      name: '红尘风沙', zone: 'bottom', night: false, text: '#f6d2a2', shadow: 'rgba(26,12,8,0.92)', accent: '#ff9a52', bloom: 0.2,
      draw(g, c) {
        const t = c.lt, dur = c.dur;
        const tG = CT(c, 7, 3.083), tW = CT(c, 11, 4.763);         // 第1句第8字阵风先到；第12字沙尘到人
        const gust = smooth((t - tG + 0.15) / 0.6);              // 阵风到
        const eng = smooth((t - tW) / 1.5);                        // 沙裙到脚下之后才开始吞没
        const engA = 0.84 * eng + 0.16 * smooth((eng - 0.85) / 0.15);   // 尘幕不透明度，最后全盖
        const vis = 1 - smooth((eng - 0.45) / 0.5);              // 被尘幕盖住的图层随之淡出，看不见了就不画
        const vis2 = 1 - smooth((eng - 0.88) / 0.11);            // 贴地沙裙最后才淡出（人影先淡完，腿不会重新露出来）
        const be = c.be ? c.be(0.32) : 0;
        const appr = easeInOut((t + 0.7) / (dur + 0.7));          // 沙墙逼近 0..1
        const wx = wallX(t, tW), ws = 1 + 0.3 * appr;
        // 日轮处墙体的浓度：尘团从日前飘过时日轮随之明暗（变化很慢）
        let thick = 0;
        for (const [dx, dy] of [[0, 0], [-14, 8], [12, -8]]) {
          const u = (SUN[0] + dx - wx) / ws, v = (SUN[1] + dy - WALL_BASE) / ws;
          thick += wallDens(u, v, wallS(u, v)[0]) / 3;
        }
        const trans = clamp(1.3 - thick);
        const fade = 1 - 0.8 * eng;
        if (engA < 0.999) {
          g.drawImage(bgLayer(), 0, 0, W, H);
          // 墙后的日轮
          g.globalAlpha = (0.8 - 0.35 * appr) * fade;
          g.drawImage(sunSpr(), SUN[0] - 60, SUN[1] - 60, 120, 120);
          g.globalAlpha = 1;
        }
        // 远墙：以墙脚前沿为锚点放大 1.0→1.3
        if (vis > 0.03) {
          g.globalAlpha = vis;
          g.save();
          g.translate(wx, WALL_BASE); g.scale(ws, ws);
          g.drawImage(wallBody(), WB.x0, WB.y0, WB.w, WB.h);
          g.restore();
          // 墙顶前沿被风刮出的尘缕：从墙体里淡入，向左飘出、拉长、散去
          for (let k = 0; k < 3; k++) {
            const T = 3.6 + 1.2 * h2(k, 5), ph = (t + 30) / T + h2(k, 6), a = ph % 1, cyc = Math.floor(ph);
            const v = -330 + 120 * h2(k * 7 + cyc, 7);
            const x0 = wx + (edgeAt(v) + 60) * ws, y0 = WALL_BASE + v * ws;
            const x = x0 - a * T * (34 + 18 * h2(k, 8)), y = y0 - a * 26;
            const sc = (0.7 + 0.5 * a) * ws;
            g.globalAlpha = 0.6 * Math.pow(Math.sin(Math.PI * a), 1.4) * vis;
            g.drawImage(wisp(k % 2), x - 40 * sc, y - WS.h * 0.55 * sc, WS.w * sc * (0.8 + 0.4 * a), WS.h * sc);
          }
          g.globalAlpha = 1;
        }
        if (engA < 0.999) {
          // 透过墙顶薄尘的日轮：软边暗红，随墙逼近、尘变厚而变暗
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.62 * trans * (1 - 0.5 * appr) * fade;
          g.drawImage(sunSoft(), SUN[0] - 60, SUN[1] - 60, 120, 120);
          // 尘里日光的前向散射：日轮四周一团暖光
          g.globalAlpha = (0.22 + 0.04 * be) * (1 - 0.4 * appr) * fade;
          g.drawImage(scatter(), SUN[0] - 240, SUN[1] - 240, 480, 480);
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
          // 墙的阴影由远及近盖过地面（从地平线下 40 像素处才变实，不在地平线上留硬边）
          // 剖面：地平线下 40 像素内渐实，之后一段实，前沿 shY−120 → shY+30 渐淡（两张缓存条，整像素贴）
          const shY = lerp(HOR + 20, H + 160, smooth((t + 0.6) / (tW + 1.2)));
          const shA = 0.42 * smooth((shY - HOR) / 120);
          if (shA > 0.002) {
            g.globalAlpha = shA;
            const rmp = shadeRamp(), body = shadeBody(), k = body.height / body.lh;
            // 本体：第 SB.n 行处 alpha 降到 0；对齐到 shY+30
            const top = HOR + 40, endY = Math.round(shY + 30);
            const y0 = top, y1 = Math.min(H, endY);
            if (y1 > y0) {
              const sy = SB.n - (endY - y0);
              g.drawImage(body, 0, Math.max(0, sy) * k, body.width, (y1 - y0 - Math.max(0, -sy)) * k, 0, y0 + Math.max(0, -sy), W, y1 - y0 - Math.max(0, -sy));
            }
            // 顶部渐实，接到本体顶端的浓度上
            g.globalAlpha = shA * clamp((endY - y0) / 150);
            g.drawImage(rmp, 0, 0, rmp.width, rmp.height, 0, HOR, W, 40);
            g.globalAlpha = 1;
          }
        }
        // 贴地沙流：分几条深度带，越近越快越大；阵风后加速
        if (vis > 0.03) {
          const ft = flowTex();
          const D = rampDist(t + 1, tG + 0.8, 0.7, 2.0, 6.0);  // 世界里沙流走过的米数
          for (let i = 0; i < 6; i++) {
            const z = 7 + i * i * 1.3 + i * 2.2, y = gy(z), k = 8.5 / z;
            const sh = 44 * k, a = (0.22 + 0.4 * gust) * clamp(1.2 - z / 90) * (y > 610 ? 0.4 : 1) * vis;
            if (y - sh > H) continue;
            const tw = 512 * k, off = ((D * F / z) % tw + tw) % tw;
            g.globalAlpha = a;
            // 沙向左流：贴图向左走，取段的起点向右移
            stripBlit(g, tileStrip('e4:flowS' + i, ft, tw, sh, W + tw + 4), off, y - sh * 0.8);
          }
          g.globalAlpha = 1;
        }
        if (vis > 0.03) {
          // 人物：接触阴影（太阳在尘后，光很散，只剩脚下一团）
          const gr = g.createRadialGradient(FIG.x + 6, FIG.y + 1, 0, FIG.x + 6, FIG.y + 1, 52);
          gr.addColorStop(0, 'rgba(14,6,4,0.6)'); gr.addColorStop(1, 'rgba(14,6,4,0)');
          g.save(); g.translate(FIG.x + 6, FIG.y + 1); g.scale(1, 0.14); g.translate(-FIG.x - 6, -FIG.y - 1);
          g.globalAlpha = vis;
          g.fillStyle = gr; g.fillRect(FIG.x - 50, FIG.y - 52, 112, 104); g.restore();
          sil(g, 'traveler', 'leanSide', FIG.x, FIG.y, FIG.h, c.t, {
            facing: 1, wind: 0.75 + 0.25 * gust, windDir: -1, body: '#22120d', rim: '#f2904e', rimSide: 1, alpha: vis,
          });
          g.globalAlpha = 1;
        }
        // 近处贴地风沙：在人物前面，从右向左推进，第1句第12字时前沿到脚下
        const vx = veilX(t, tW);
        if (vx < W + 40 && vis2 > 0.03) {
          g.globalAlpha = vis2;
          blitCrop(g, fullRes('e4:veilF', veilTex(0), VEIL.w, VEIL.h), VEIL.w, VEIL.h, Math.round(vx - 30), VEIL.top, 140);
          g.globalAlpha = 1;
        }
        // 浮尘横飞：阵风后变浓、变快
        const ho = rampDist(t + 1, tG + 0.8, 0.7, 110, 480);
        if (vis > 0.03) {
          g.globalAlpha = (0.1 + 0.22 * gust + 0.35 * eng) * vis;
          stripBlit(g, tileStrip('e4:hazeS', hazeTex(), HZ.w, 340, W + HZ.w + 4), ho % HZ.w, 370);
          g.globalAlpha = 1;
        }
        // 沙粒：阵风起后从画右进入，掠过前景（拍点上略密）
        if (t > tG - 0.15 && vis > 0.03) {
          g.strokeStyle = '#d98a54'; g.lineCap = 'round';
          for (let bk = 0; bk < 6; bk++) {
            const hi = bk % 3, lo = bk >= 3;            // 三档透明度 × 上下两区（歌词区里更淡）
            g.globalAlpha = (0.2 + 0.14 * hi) * (0.75 + 0.25 * be) * (lo ? 0.45 : 1) * (1 - 0.6 * eng) * vis;
            g.lineWidth = 0.8 + 0.5 * hi;
            g.beginPath();
            for (let i = 0; i < 90; i++) {
              if (Math.floor(h2(i, 15) * 3) !== hi) continue;
              const act = tG - 0.15 + h2(i, 11) * 0.8;
              if (t < act) continue;
              const v = 900 + 700 * h2(i, 12), L = W + 300;
              const run = (t - act) * v, lap = Math.floor(run / L);
              const x = W + 60 - (run - lap * L);
              const y0 = 330 + h2(i + lap * 131, 13) * 390;
              if ((y0 > 610) !== lo) continue;          // 按基准高度分区，不随摆动换区
              const y = y0 + Math.sin(t * 3 + i) * 5;
              const len = 6 + 18 * h2(i, 14) * h2(i, 17);
              g.moveTo(x, y); g.lineTo(x + len, y - len * 0.04);
            }
            g.stroke();
          }
          g.globalAlpha = 1;
        }
        // 吞没：整幅红色沙尘，只剩暗红日轮和模糊人影
        if (eng > 0.001) {
          // 一张横向可循环的尘幕（竖向明暗 + 流动的尘纹），随浮尘一起向左流
          g.globalAlpha = engA;
          stripBlit(g, tileStrip('e4:engS', engTex(), W, H, 2 * W + 4), ho % W, 0);
          // 尘里剩下的暗红日轮（不加亮，只是比尘略红）和一圈很淡的光
          g.globalAlpha = 0.6 * eng; g.drawImage(sunDim(), SUN[0] - 60, SUN[1] - 60, 120, 120);
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.07 * eng; g.drawImage(dot('#a83e24', 0.25), SUN[0] - 110, SUN[1] - 110, 220, 220);
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 0.45 * eng; g.drawImage(figBlur(), FIG.x - 110, FIG.y - 230, 240, 260);
          g.globalAlpha = 1;
        }
      },
    });
  })();

  // 雪松：一层层下垂的枝团（下缘是圆钝的针叶簇），每层上面压一溜团块状的积雪
  function snowPine(b, x, y, h, seed, body, snow, o) {
    o = o || {};
    const r = A.rng(seed);
    const n = o.tiers || (7 + Math.floor(r() * 3));
    const lean = (r() - 0.5) * 0.04 * h;
    b.fillStyle = o.trunk || body;
    b.beginPath(); b.moveTo(x - h * 0.016, y + 2); b.lineTo(x + lean - h * 0.005, y - h * 0.96); b.lineTo(x + lean + h * 0.005, y - h * 0.96); b.lineTo(x + h * 0.016, y + 2); b.closePath(); b.fill();
    const bez = (A0, C0, B0, u) => [(1 - u) * (1 - u) * A0[0] + 2 * (1 - u) * u * C0[0] + u * u * B0[0], (1 - u) * (1 - u) * A0[1] + 2 * (1 - u) * u * C0[1] + u * u * B0[1]];
    for (let i = 0; i < n; i++) {
      const q = i / n;
      const ty = y - h * (0.16 + 0.78 * q), cx = x + lean * (0.16 + 0.78 * q);
      const w = h * (0.25 * Math.pow(1 - q, 0.9) + 0.03) * (0.8 + 0.4 * r());
      const th = h * 0.03 + w * 0.1;
      for (const side of [-1, 1]) {
        const ww = w * (0.7 + 0.5 * r()), droop = ww * (0.26 + 0.18 * r());
        const P0 = [cx, ty - th], C0 = [cx + side * ww * 0.55, ty - th * 0.7], P1 = [cx + side * ww, ty + droop];
        b.fillStyle = body;
        b.beginPath(); b.moveTo(P0[0], P0[1]);
        for (let k = 1; k <= 10; k++) { const p = bez(P0, C0, P1, k / 10); b.lineTo(p[0], p[1]); }
        // 下缘：几簇圆钝的针叶团
        const m = 4 + Math.floor(r() * 2);
        let px = P1[0], py = P1[1];
        for (let k = 1; k <= m; k++) {
          const u = 1 - k / m;
          const bx = cx + side * ww * u, by = ty + droop * Math.pow(u, 1.4) + th * 0.8 * (1 - u);
          const sag = th * (0.5 + 0.7 * r());
          b.quadraticCurveTo((px + bx) / 2, Math.max(py, by) + sag, bx, by);
          px = bx; py = by;
        }
        b.lineTo(cx, ty + th * 0.8); b.closePath(); b.fill();
        // 积雪：沿枝团上缘一溜团块，末梢变薄
        if (snow) {
          const sT = (o.snowT || 1) * (h * 0.011 + w * 0.05);
          b.fillStyle = snow;
          // 先一条连续的薄雪带
          b.beginPath();
          const top = [], bot = [];
          for (let k = 0; k <= 10; k++) {
            const u = 0.06 + 0.84 * k / 10, p = bez(P0, C0, P1, u);
            const tk = sT * 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1));
            top.push([p[0], p[1] - tk * 0.3]); bot.push([p[0], p[1] + tk * 0.7]);
          }
          b.moveTo(top[0][0], top[0][1]);
          for (const p of top) b.lineTo(p[0], p[1]);
          for (let k = bot.length - 1; k >= 0; k--) b.lineTo(bot[k][0], bot[k][1]);
          b.closePath(); b.fill();
          for (let k = 0; k <= 9; k++) {
            const u = 0.1 + 0.78 * k / 9, p = bez(P0, C0, P1, u);
            const tk = sT * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (0.6 + 0.6 * r());
            if (tk < 0.4) continue;
            b.beginPath(); b.ellipse(p[0], p[1] + tk * 0.15, tk * (1.6 + r()), tk * 0.7, Math.atan2(P1[1] - P0[1], P1[0] - P0[0]) * 0.6, 0, TAU); b.fill();
          }
        }
      }
    }
    b.fillStyle = body;
    b.beginPath(); b.moveTo(x + lean - h * 0.018, y - h * 0.9); b.quadraticCurveTo(x + lean, y - h * 0.97, x + lean, y - h * 1.0); b.quadraticCurveTo(x + lean, y - h * 0.97, x + lean + h * 0.018, y - h * 0.9); b.closePath(); b.fill();
    if (snow) { b.fillStyle = snow; b.beginPath(); b.ellipse(x + lean, y - h * 0.925, h * 0.014, h * 0.007, 0, 0, TAU); b.fill(); }
  }

  // ============================================================
  // f1_snowhut：雪夜草庐门开着，白发人坐在火盆前独坐；青烟从门楣下溢出，直上夜空，慢慢消失
  // ============================================================
  (function () {
    const HOR = 400;
    const DOOR = { x0: 560, x1: 862, y0: 318, y1: 626 };   // 门洞（门槛顶面 626）
    const BASE = 636;                                        // 屋外地面（墙脚）
    const BACK = 594;                                        // 屋里后墙脚
    const EAVE = 266, RIDGE = 172;
    const MAN = { x: 745, y: 552, h: 240 };                 // 坐面
    const FIRE = { x: 598, y: 568 };                         // 火盆炭面
    const LIGHT = [598, 540];
    const CAM = [700, 430];

    // ---------- 夜空、远山、远林、雪原（静态）----------
    const bgLayer = () => K.cache('f1:bg', W, H, 1, (g) => {
      let gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#0b101b'); gr.addColorStop(0.35, '#141c2b'); gr.addColorStop(0.56, '#243042'); gr.addColorStop(0.7, '#2a3648');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // 远山：雪夜里只剩一层淡影
      blurInto(g, W, H, 3, (b) => {
        b.fillStyle = '#34425a'; b.beginPath(); b.moveTo(0, HOR + 30);
        for (let x = 0; x <= W; x += 8) b.lineTo(x, HOR - 40 - 46 * noise1(x / 260, 31) - 18 * noise1(x / 70, 32));
        b.lineTo(W, HOR + 30); b.closePath(); b.fill();
      });
      // 雪原（向远处渐暗渐淡）
      gr = g.createLinearGradient(0, HOR + 30, 0, H);
      gr.addColorStop(0, '#5d6a80'); gr.addColorStop(0.35, '#717e94'); gr.addColorStop(1, '#8592a8');
      g.fillStyle = gr; g.fillRect(0, HOR + 30, W, H - HOR - 30);
      // 远林（三层，越远越淡越小，雪幕里发灰）
      const rows = [
        { y: HOR + 52, h: [60, 120], n: 46, body: '#3e4b60', snow: '#5e6c82', x0: -40, x1: 1300, s: 1 },
        { y: HOR + 78, h: [100, 180], n: 22, body: '#2a3446', snow: '#505e75', x0: -40, x1: 560, s: 2 },
        { y: HOR + 120, h: [180, 290], n: 9, body: '#18202d', snow: '#5d6a80', x0: 120, x1: 520, s: 3 },
      ];
      for (const R of rows) {
        const r = A.rng(900 + R.s);
        blurInto(g, W, H, R.s === 1 ? 2 : R.s === 2 ? 1.4 : 1, (b) => {
          for (let i = 0; i < R.n; i++) {
            const x = lerp(R.x0, R.x1, (i + r() * 0.8) / R.n), hh = lerp(R.h[0], R.h[1], r());
            snowPine(b, x, R.y + r() * 14, hh, 1000 + R.s * 100 + i, R.body, R.snow);
          }
        });
        // 每层之间一层雪雾
        gr = g.createLinearGradient(0, R.y - 140, 0, R.y + 30);
        gr.addColorStop(0, 'rgba(40,52,70,0)'); gr.addColorStop(0.7, 'rgba(48,60,80,0.35)'); gr.addColorStop(1, 'rgba(60,72,92,0.2)');
        g.fillStyle = gr; g.fillRect(0, R.y - 140, W, 170);
      }
      // 屋后松林：在屋脊上方露出几个树梢
      const r = A.rng(977);
      blurInto(g, W, H, 2.2, (b) => {
        for (let i = 0; i < 8; i++) {
          const x = 760 + i * 75 + r() * 40, hh = 330 + r() * 160;
          snowPine(b, x, 330, hh, 1400 + i, '#111722', '#323c4f', { snowT: 0.45 });
        }
      });
      // 雪原上的起伏
      blurInto(g, W, H, 6, (b) => {
        const rr = A.rng(311);
        for (let i = 0; i < 26; i++) {
          const y = HOR + 140 + rr() * 200, x = rr() * W, w = 120 + rr() * 260;
          b.fillStyle = rr() < 0.5 ? 'rgba(150,164,186,0.18)' : 'rgba(40,50,68,0.16)';
          b.beginPath(); b.ellipse(x, y, w, 6 + rr() * 8, 0, 0, TAU); b.fill();
        }
      });
    });

    // ---------- 屋里（后墙、地面、木柱、矮凳、火盆）：只用暗底色，火光另画 ----------
    const interior = () => K.cache('f1:int', DOOR.x1 - DOOR.x0 + 40, DOOR.y1 - DOOR.y0 + 30, 1, (g) => {
      g.translate(-DOOR.x0 + 20, -DOOR.y0 + 10);
      // 后墙：泥墙
      let gr = g.createLinearGradient(0, DOOR.y0, 0, BACK);
      gr.addColorStop(0, '#1c1410'); gr.addColorStop(1, '#2a1c14');
      g.fillStyle = gr; g.fillRect(DOOR.x0 - 20, DOOR.y0 - 10, DOOR.x1 - DOOR.x0 + 40, BACK - DOOR.y0 + 10);
      blurInto(g, W, H, 0.8, (b) => {
        const r = A.rng(121);
        for (let i = 0; i < 160; i++) {
          const x = DOOR.x0 + r() * (DOOR.x1 - DOOR.x0), y = DOOR.y0 + r() * (BACK - DOOR.y0);
          b.strokeStyle = r() < 0.5 ? 'rgba(90,64,40,0.25)' : 'rgba(8,5,3,0.3)'; b.lineWidth = 0.8;
          const a = (r() - 0.5) * 1.2, L = 3 + r() * 8;
          b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); b.stroke();
        }
      });
      // 屋柱（后墙里的两根立柱、一道横梁）
      g.fillStyle = '#140d09';
      g.fillRect(668, DOOR.y0 - 10, 14, BACK - DOOR.y0 + 10);
      g.fillRect(DOOR.x0 - 20, 352, DOOR.x1 - DOOR.x0 + 40, 10);
      // 墙上挂一件蓑衣（远离火盆一侧）
      g.fillStyle = '#17100b';
      g.beginPath(); g.moveTo(818, 376); g.lineTo(840, 372); g.lineTo(850, 440); g.lineTo(808, 444); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(70,48,30,0.5)'; g.lineWidth = 1;
      for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(810 + i * 4.4, 442); g.lineTo(809 + i * 4.6, 450); g.stroke(); }
      // 地面：夯土
      gr = g.createLinearGradient(0, BACK, 0, DOOR.y1);
      gr.addColorStop(0, '#1e140e'); gr.addColorStop(1, '#2c1e15');
      g.fillStyle = gr; g.fillRect(DOOR.x0 - 20, BACK, DOOR.x1 - DOOR.x0 + 40, DOOR.y1 - BACK + 10);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(DOOR.x0 - 20, BACK - 1, DOOR.x1 - DOOR.x0 + 40, 3);
    });
    // 火盆（三足铁盆）与矮凳：在人和火之间按前后次序画
    const brazier = () => K.cache('f1:brz', 120, 80, 2, (g) => {
      g.translate(60, 10);
      // 足
      g.strokeStyle = '#0e0a08'; g.lineWidth = 3.4; g.lineCap = 'round';
      for (const dx of [-24, 0, 24]) { g.beginPath(); g.moveTo(dx * 0.8, 38); g.lineTo(dx, 52); g.stroke(); }
      // 盆身
      const gr = g.createLinearGradient(-34, 0, 34, 0);
      gr.addColorStop(0, '#3a2416'); gr.addColorStop(0.35, '#2a1a10'); gr.addColorStop(1, '#0f0a07');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-34, 4); g.quadraticCurveTo(-30, 34, -14, 40); g.lineTo(14, 40); g.quadraticCurveTo(30, 34, 34, 4); g.closePath(); g.fill();
      // 口沿
      g.fillStyle = '#4a2e1c'; g.beginPath(); g.ellipse(0, 4, 35, 5, 0, 0, TAU); g.fill();
      // 炭
      g.fillStyle = '#ff9a40'; g.beginPath(); g.ellipse(0, 3, 30, 3.6, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffd890'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(-22 + i * 7.4, 2.4 + (i % 2), 3.2, 1.6, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(40,14,6,0.7)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(-19 + i * 7.6, 3.6, 2.4, 1.2, 0, 0, TAU); g.fill(); }
    });
    // 小酒壶（执壶）：圆腹、细颈、壶嘴朝右上、把手在左；坐在炭面上，底被火盆口沿挡住一点
    const potPath = (g) => {
      g.beginPath();
      g.moveTo(14, 36); g.quadraticCurveTo(7, 34, 8, 27); g.quadraticCurveTo(9, 19, 16, 17);
      g.lineTo(17, 12); g.lineTo(23, 12); g.lineTo(24, 17); g.quadraticCurveTo(31, 19, 32, 27); g.quadraticCurveTo(33, 34, 26, 36); g.closePath();
    };
    const winePot = () => K.cache('f1:pot', 40, 40, 2, (g) => {
      g.fillStyle = '#1e1714';
      potPath(g); g.fill();
      g.beginPath(); g.ellipse(20, 11.5, 4.2, 1.5, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(20, 9.5, 1.4, 0, TAU); g.fill();
      // 壶嘴
      g.strokeStyle = '#1e1714'; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(30, 25); g.quadraticCurveTo(35, 22, 37, 15); g.stroke();
      // 把手
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(9, 21); g.quadraticCurveTo(2, 22, 4, 28); g.quadraticCurveTo(5, 31, 9, 30); g.stroke();
    });
    // 迎火一侧的暖光（加亮用）
    const winePotLit = () => K.cache('f1:potlit', 40, 40, 2, (g) => {
      g.save(); potPath(g); g.clip();
      const gr = g.createLinearGradient(6, 0, 24, 0);
      gr.addColorStop(0, 'rgba(255,160,80,0.9)'); gr.addColorStop(0.35, 'rgba(230,120,60,0.35)'); gr.addColorStop(1, 'rgba(230,120,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 40, 40);
      g.restore();
      g.strokeStyle = 'rgba(255,170,90,0.7)'; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(5, 22); g.quadraticCurveTo(2.5, 25, 4.5, 28.5); g.stroke();
    });
    const stool = () => K.cache('f1:stool', 80, 80, 2, (g) => {
      g.translate(40, 6);
      g.fillStyle = '#140d09';
      g.fillRect(-26, 0, 52, 7);
      g.fillRect(-22, 7, 5, 56); g.fillRect(17, 7, 5, 56);
      g.fillRect(-20, 36, 40, 4);
    });

    // ---------- 草庐外观（门洞留空）----------
    const hutLayer = () => K.cache('f1:hut', W, H, 1, (g) => {
      // 墙
      const wall = new Path2D();
      wall.rect(470, EAVE - 4, W - 470 + 60, BASE - EAVE + 4);
      const hole = new Path2D(); hole.rect(DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, DOOR.y1 - DOOR.y0);
      g.save();
      g.beginPath(); g.rect(0, 0, W, H); g.rect(DOOR.x1, DOOR.y0, DOOR.x0 - DOOR.x1, DOOR.y1 - DOOR.y0); g.clip('evenodd');
      let gr = g.createLinearGradient(0, EAVE, 0, BASE);
      gr.addColorStop(0, '#111318'); gr.addColorStop(0.18, '#1d1f25'); gr.addColorStop(1, '#22232a');
      g.fillStyle = gr; g.fill(wall);
      // 一根旧立柱（低对比）
      g.fillStyle = 'rgba(14,12,12,0.7)';
      g.beginPath(); g.moveTo(1084, EAVE); g.lineTo(1097, EAVE); g.lineTo(1099, BASE); g.lineTo(1083, BASE); g.closePath(); g.fill();
      // 泥墙里的草筋与裂纹
      blurInto(g, W, H, 0.6, (b) => {
        const r = A.rng(55);
        b.save(); b.clip(wall);
        for (let i = 0; i < 700; i++) {
          const x = 470 + r() * 820, y = EAVE + r() * (BASE - EAVE);
          b.strokeStyle = r() < 0.55 ? 'rgba(120,112,100,0.16)' : 'rgba(8,8,10,0.25)'; b.lineWidth = 0.8;
          const a = (r() - 0.5) * 1.6, L = 3 + r() * 9;
          b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); b.stroke();
        }
        // 墙脚受潮发暗
        const g2 = b.createLinearGradient(0, BASE - 90, 0, BASE);
        g2.addColorStop(0, 'rgba(10,10,14,0)'); g2.addColorStop(1, 'rgba(10,10,14,0.35)');
        b.fillStyle = g2; b.fillRect(470, BASE - 90, 820, 90);
        b.restore();
      });
      // 木柱、门框、门楣
      g.fillStyle = '#17120f';
      g.fillRect(470, EAVE, 18, BASE - EAVE);
      g.fillRect(DOOR.x0 - 16, DOOR.y0 - 20, 16, DOOR.y1 - DOOR.y0 + 30);
      g.fillRect(DOOR.x1, DOOR.y0 - 20, 16, DOOR.y1 - DOOR.y0 + 30);
      g.fillRect(DOOR.x0 - 30, DOOR.y0 - 20, DOOR.x1 - DOOR.x0 + 60, 18);
      g.fillStyle = 'rgba(150,150,160,0.12)';
      g.fillRect(DOOR.x0 - 30, DOOR.y0 - 20, DOOR.x1 - DOOR.x0 + 60, 2);
      // 门槛
      g.fillStyle = '#1d1611'; g.fillRect(DOOR.x0 - 6, DOOR.y1, DOOR.x1 - DOOR.x0 + 12, BASE - DOOR.y1);
      g.restore();
      // 屋檐下的阴影带
      gr = g.createLinearGradient(0, EAVE, 0, EAVE + 50);
      gr.addColorStop(0, 'rgba(4,5,8,0.75)'); gr.addColorStop(1, 'rgba(4,5,8,0)');
      g.fillStyle = gr; g.fillRect(470, EAVE, W, 50);
      // 屋顶：茅草上压着厚雪。坡面朝天、受夜空散光，屋脊一带最亮，向檐口略暗；几团很大的软雪包（上半迎天亮、下沿略暗）；
      // 边上不起亮棱——雪面在边缘向下卷，只会略暗
      const ridgeY = (x) => RIDGE + 6 + 6 * Math.sin(Math.PI * clamp((x - 540) / 900));
      const eaveY = (x) => EAVE + 4 * Math.sin(Math.PI * clamp((x - 440) / 1000));
      const hipX = (y) => 440 + (540 - 440) * (EAVE - y) / (EAVE - RIDGE);
      const roof = new Path2D();
      roof.moveTo(434, eaveY(434));
      for (let x = 434; x <= W + 60; x += 20) roof.lineTo(x, eaveY(x));
      for (let x = W + 60; x >= 540; x -= 20) roof.lineTo(x, ridgeY(x));
      for (let y = RIDGE + 8; y <= EAVE; y += 8) roof.lineTo(hipX(y) - 8 * Math.sin(Math.PI * (y - RIDGE) / (EAVE - RIDGE)), y);
      roof.closePath();
      gr = g.createLinearGradient(0, RIDGE, 0, EAVE);
      gr.addColorStop(0, '#cfd8e6'); gr.addColorStop(1, '#aebccd');
      g.fillStyle = gr; g.fill(roof);
      g.save(); g.clip(roof);
      blurInto(g, W, H, 9, (b) => {
        // 大雪包：x, y, 半宽, 半高
        for (const [x, y, rx, ry] of [[612, 228, 150, 17], [842, 206, 220, 20], [1062, 232, 185, 16], [1222, 204, 150, 18]]) {
          b.fillStyle = 'rgba(78,92,118,0.13)';
          b.beginPath(); b.ellipse(x, y + ry * 0.5, rx, ry * 0.7, 0, 0, TAU); b.fill();
          b.fillStyle = 'rgba(238,243,250,0.2)';
          b.beginPath(); b.ellipse(x - rx * 0.04, y - ry * 0.2, rx * 0.86, ry * 0.75, 0, 0, TAU); b.fill();
        }
        // 左侧斜脊：雪面向左卷下去，渐暗
        const g3 = b.createLinearGradient(426, 0, 600, 0);
        g3.addColorStop(0, 'rgba(70,84,110,0.26)'); g3.addColorStop(1, 'rgba(70,84,110,0)');
        b.fillStyle = g3; b.fillRect(400, RIDGE - 20, 220, EAVE - RIDGE + 40);
        // 屋脊雪下与坡面相接处一线极淡的凹影
        b.strokeStyle = 'rgba(90,104,130,0.16)'; b.lineWidth = 5;
        b.beginPath(); for (let x = 548; x <= W + 60; x += 16) { const y = ridgeY(x) + 10; x === 548 ? b.moveTo(x, y) : b.lineTo(x, y); } b.stroke();
      });
      g.restore();
      // 屋脊上圆鼓的积雪，顶边与夜空相接处柔和
      blurInto(g, W, H, 1.6, (b) => {
        b.fillStyle = '#d4dce9';
        b.beginPath(); b.moveTo(532, ridgeY(532) + 7);
        b.quadraticCurveTo(530, ridgeY(532) - 9, 548, ridgeY(548) - 9);
        for (let x = 548; x <= W + 60; x += 16) b.lineTo(x, ridgeY(x) - 9 - 4 * noise1(x / 60, 71));
        for (let x = W + 60; x >= 532; x -= 16) b.lineTo(x, ridgeY(x) + 7);
        b.closePath(); b.fill();
      });
      // 檐口：茅草断面（暗）
      g.fillStyle = '#16130f';
      g.beginPath(); g.moveTo(436, eaveY(436) - 2);
      for (let x = 436; x <= W + 60; x += 6) g.lineTo(x, eaveY(x) + 15 + 3 * noise1(x / 7, 72));
      g.lineTo(W + 60, eaveY(W + 60) - 2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,72,56,0.35)'; g.lineWidth = 0.9;
      const r2 = A.rng(73);
      for (let x = 438; x < W + 40; x += 3.2) { const L = 8 + r2() * 9, y0 = eaveY(x) + 2; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r2() - 0.5) * 2, y0 + L); g.stroke(); }
      // 雪檐：一道圆鼓的厚雪（约 15–18 px），顶与坡面相接不起棱；上半迎天、往下转向地面渐暗；垂下几条不规则的雪舌
      blurInto(g, W, H, 0.9, (b) => {
        const crest = (x) => eaveY(x) - 13 - 1.5 * noise1(x / 40, 74);
        const bot = (x) => eaveY(x) + 2 + 2 * noise1(x / 31, 75);
        const lipCol = (y0, y1) => {
          const gg = b.createLinearGradient(0, y0, 0, y1);
          gg.addColorStop(0, '#b0bdce'); gg.addColorStop(0.3, '#a6b3c5'); gg.addColorStop(0.62, '#8794aa'); gg.addColorStop(0.86, '#69758b'); gg.addColorStop(1, '#556075');
          return gg;
        };
        const lip = new Path2D();
        lip.moveTo(440, crest(440));
        for (let x = 444; x <= W + 60; x += 4) lip.lineTo(x, crest(x));
        for (let x = W + 60; x >= 440; x -= 4) lip.lineTo(x, bot(x));
        // 左端圆头
        lip.bezierCurveTo(430, bot(440) - 1, 427, crest(440) + 3, 440, crest(440));
        lip.closePath();
        // 雪檐下沿在茅草上的一线接触暗影
        b.strokeStyle = 'rgba(6,6,8,0.55)'; b.lineWidth = 2.5;
        b.beginPath(); for (let x = 438; x <= W + 60; x += 4) { const y = bot(x) + 1.2; x === 438 ? b.moveTo(x, y) : b.lineTo(x, y); } b.stroke();
        b.save(); b.clip(lip);
        for (let x = 424; x <= W + 60; x += 4) { b.fillStyle = lipCol(crest(x), bot(x)); b.fillRect(x, crest(x) - 2, 4.5, bot(x) - crest(x) + 4); }
        b.restore();
        // 雪舌：x、宽、长、歪斜、舌头半宽比例；从雪檐下沿软软垂下，上宽下窄，头部圆钝（不是冰凌那样的尖）
        const tongues = [[514, 30, 8, -2, 0.3], [648, 38, 13, 3, 0.24], [806, 26, 6, 1, 0.34], [962, 42, 11, -3, 0.27], [1121, 32, 14, 2, 0.22], [1238, 36, 9, -1, 0.3]];
        for (const [tx, tw, tl, sk, hr] of tongues) {
          const yb = bot(tx) - 3, ye = yb + 3 + tl, rx = tw * hr, ry = Math.min(rx, tl * 0.5 + 1.5);
          const p = new Path2D();
          p.moveTo(tx - tw / 2, yb);
          p.bezierCurveTo(tx - tw * 0.3, yb + 1, tx - rx - 1.5 + sk * 0.5, ye - ry - tl * 0.35, tx - rx + sk, ye - ry);
          p.ellipse(tx + sk, ye - ry, rx, ry, 0, Math.PI, 0, true);
          p.bezierCurveTo(tx + rx + 1.5 + sk * 0.5, ye - ry - tl * 0.35, tx + tw * 0.3, yb + 1, tx + tw / 2, yb);
          p.closePath();
          const gg = b.createLinearGradient(0, yb, 0, ye);
          gg.addColorStop(0, '#5b667b'); gg.addColorStop(0.55, '#67738a'); gg.addColorStop(1, '#5a657b');
          b.fillStyle = gg; b.fill(p);
          // 圆头下沿迎着雪地反上来的一点冷光
          b.strokeStyle = 'rgba(124,136,158,0.3)'; b.lineWidth = 1;
          b.beginPath(); b.ellipse(tx + sk, ye - ry, Math.max(0.5, rx - 0.6), Math.max(0.5, ry - 0.6), 0, Math.PI * 0.2, Math.PI * 0.8); b.stroke();
        }
      });
      // 檐下靠墙码着一垛松木柴（端面朝外），垛顶前沿压一溜雪，搁着一捆松枝；屋檐只挡住靠墙那一半
      blurInto(g, W, H, 0.5, (b) => {
        const r = A.rng(5151);
        const x0 = 938, x1 = 1196, yb = BASE + 2, rowH = 22, rows = 4;
        const topY = yb - rows * rowH - 4;
        // 垛的轮廓里先铺暗色（柴缝）
        b.fillStyle = '#101114';
        b.beginPath(); b.moveTo(x0, yb); b.lineTo(x0 + 3, topY + 6); b.quadraticCurveTo((x0 + x1) / 2, topY - 4, x1 - 3, topY + 6); b.lineTo(x1, yb); b.closePath(); b.fill();
        for (let row = 0; row < rows; row++) {
          const y = yb - rowH * 0.5 - row * rowH + (r() - 0.5) * 2;
          let x = x0 + 2 + (row % 2) * 10 + r() * 3;
          while (true) {
            const rr = 8 + r() * 4.5;
            if (x + rr * 2 > x1 - 2) break;
            const cx = x + rr, cy = y + (r() - 0.5) * 2;
            // 端面：木色很暗，冷的夜光里只比墙亮一点
            // 下面几排离天光远、更暗
            b.fillStyle = mix(mix('#29262a', '#3a342f', r()), '#1c1b1e', 0.25 * (rows - 1 - row) / (rows - 1));
            b.beginPath(); b.ellipse(cx, cy, rr, rr * 0.94, 0, 0, TAU); b.fill();
            // 上半个端面迎着天光略亮
            b.fillStyle = 'rgba(120,128,146,0.05)';
            b.beginPath(); b.ellipse(cx, cy - rr * 0.25, rr * 0.8, rr * 0.6, 0, Math.PI, TAU); b.fill();
            // 年轮与干裂
            b.strokeStyle = 'rgba(18,15,12,0.4)'; b.lineWidth = 0.7;
            b.beginPath(); b.ellipse(cx, cy, rr * 0.58, rr * 0.54, 0, 0, TAU); b.stroke();
            const ang = r() * TAU;
            b.beginPath(); b.moveTo(cx, cy); b.lineTo(cx + Math.cos(ang) * rr * 0.85, cy + Math.sin(ang) * rr * 0.8); b.stroke();
            // 树皮一圈
            b.strokeStyle = 'rgba(12,10,9,0.85)'; b.lineWidth = 1.5;
            b.beginPath(); b.ellipse(cx, cy, rr, rr * 0.94, 0, 0, TAU); b.stroke();
            x += rr * 2 + 0.4;
          }
        }
        // 垛顶搁着的一捆松枝（针叶团，暗绿近黑）
        b.fillStyle = '#121a16';
        for (let k = 0; k < 9; k++) {
          const bx = 968 + k * 22 + r() * 8, by = topY + 2 + r() * 3;
          b.beginPath(); b.ellipse(bx, by, 16 + r() * 8, 5 + r() * 2, (r() - 0.5) * 0.3, 0, TAU); b.fill();
        }
        b.strokeStyle = '#151a16'; b.lineWidth = 1.6; b.lineCap = 'round';
        b.beginPath(); b.moveTo(952, topY + 4); b.lineTo(1188, topY + 1); b.stroke();
        // 垛顶的雪：只在朝外的前沿厚，团块状，末端变薄
        b.fillStyle = '#7d8a9f';
        b.beginPath(); b.moveTo(x0 + 2, topY + 8);
        const capY = (x) => topY - 1 - 5 * Math.sin(Math.PI * (x - x0) / (x1 - x0)) - 4 * Math.pow(noise1(x / 21, 83), 1.5) - 1.5 * noise1(x / 7, 85);
        for (let x = x0 + 2; x <= x1 - 2; x += 4) b.lineTo(x, capY(x));
        // 前沿略垂下一点，搭着最上排柴头
        for (let x = x1 - 2; x >= x0 + 2; x -= 4) b.lineTo(x, topY + 5 + 3 * Math.pow(noise1(x / 13, 84), 2));
        b.closePath(); b.fill();
        b.strokeStyle = 'rgba(176,188,206,0.45)'; b.lineWidth = 1.2;
        b.beginPath(); for (let x = x0 + 4; x <= x1 - 4; x += 4) { const y = capY(x) + 0.6; x === x0 + 4 ? b.moveTo(x, y) : b.lineTo(x, y); } b.stroke();
        // 两只干葫芦吊于檐下木钉（无风，直直下垂），墙面一点软影
        for (const [gx, len, s0] of [[1016, 22, 1], [1034, 34, 0.86]]) {
          const top = 300, gy0 = top + len;
          b.fillStyle = 'rgba(6,6,8,0.35)';
          b.beginPath(); b.ellipse(gx + 4, gy0 + 9 * s0 + 3, 7 * s0, 12 * s0, 0, 0, TAU); b.fill();
          b.strokeStyle = '#2a241c'; b.lineWidth = 1;
          b.beginPath(); b.moveTo(gx, top); b.lineTo(gx, gy0 - 5 * s0); b.stroke();
          b.fillStyle = '#2e251b';
          b.beginPath(); b.ellipse(gx, gy0, 5 * s0, 6 * s0, 0, 0, TAU); b.fill();
          b.beginPath(); b.ellipse(gx, gy0 + 12 * s0, 8 * s0, 9 * s0, 0, 0, TAU); b.fill();
          // 下沿被雪地反上来的冷光照出一线
          b.strokeStyle = 'rgba(120,132,154,0.28)'; b.lineWidth = 1;
          b.beginPath(); b.ellipse(gx, gy0 + 12 * s0, 8 * s0 - 0.5, 9 * s0 - 0.5, 0, 0.25 * Math.PI, 0.75 * Math.PI); b.stroke();
        }
        b.fillStyle = '#1a1510'; b.fillRect(1012, 297, 26, 3);
      });
      // 墙脚积雪（门前被扫开）
      blurInto(g, W, H, 1, (b) => {
        b.fillStyle = '#8693a8';
        b.beginPath(); b.moveTo(450, BASE + 6);
        for (let x = 450; x <= W + 20; x += 8) {
          const gap = smooth((Math.abs(x - (DOOR.x0 + DOOR.x1) / 2) - 140) / 50);
          b.lineTo(x, BASE - 4 - 14 * gap * (0.6 + 0.4 * noise1(x / 50, 81)));
        }
        b.lineTo(W + 20, BASE + 6); b.closePath(); b.fill();
      });
    });

    // ---------- 屋外近处雪地 ----------
    const groundLayer = () => K.cache('f1:ground', W, H - BASE + 30, 1, (g) => {
      g.translate(0, -(BASE - 20));
      blurInto(g, W, H, 2, (b) => {
        const gr = b.createLinearGradient(0, BASE - 10, 0, H);
        gr.addColorStop(0, '#7d8aa0'); gr.addColorStop(1, '#8e9bb1');
        b.fillStyle = gr;
        b.beginPath(); b.moveTo(0, BASE + 2);
        for (let x = 0; x <= W; x += 10) b.lineTo(x, BASE + 2 + 3 * noise1(x / 90, 91));
        b.lineTo(W, H + 10); b.lineTo(0, H + 10); b.closePath(); b.fill();
        const r = A.rng(92);
        for (let i = 0; i < 18; i++) {
          const x = r() * W, y = BASE + 14 + r() * 70, w = 80 + r() * 200;
          b.fillStyle = r() < 0.5 ? 'rgba(168,180,200,0.25)' : 'rgba(50,60,80,0.15)';
          b.beginPath(); b.ellipse(x, y, w, 4 + r() * 5, 0, 0, TAU); b.fill();
        }
      });
    });
    // 门光照在雪地上的梯形：火在门里偏左，所以光斑向右张得多；门槛处最亮、向外按距离衰减，边缘清楚
    // col：贴图颜色（同一形状做两张：一张给雪染暖色的乘色，一张加光）
    const doorSpill = (col) => K.cache('f1:spill:' + col, W, H - BASE + 30, 1, (g) => {
      g.translate(0, -(BASE - 20));
      blurInto(g, W, H, 6, (b) => {
        const gr = b.createLinearGradient(0, BASE - 4, 0, H);
        gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.12, rgba(col, 0.86)); gr.addColorStop(0.45, rgba(col, 0.5)); gr.addColorStop(1, rgba(col, 0.2));
        b.fillStyle = gr;
        b.beginPath(); b.moveTo(DOOR.x0 + 4, BASE - 2); b.lineTo(DOOR.x1 - 4, BASE - 2); b.lineTo(DOOR.x1 + 230, H + 10); b.lineTo(DOOR.x0 - 150, H + 10); b.closePath(); b.fill();
        // 横向：中线（门中偏右）最亮，两侧略暗
        b.globalCompositeOperation = 'destination-out';
        const gx = b.createLinearGradient(DOOR.x0 - 150, 0, DOOR.x1 + 230, 0);
        gx.addColorStop(0, 'rgba(0,0,0,0.45)'); gx.addColorStop(0.45, 'rgba(0,0,0,0)'); gx.addColorStop(0.62, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,0.5)');
        b.fillStyle = gx; b.fillRect(DOOR.x0 - 160, BASE - 10, DOOR.x1 - DOOR.x0 + 400, H - BASE + 30);
      });
    });
    // 只贴光斑所在的一段（x 400–1100）
    function spillBlit(g, img) {
      const k = img.width / W, x0 = 400, x1 = 1100;
      g.drawImage(img, x0 * k, 0, (x1 - x0) * k, img.height, x0, BASE - 20, x1 - x0, H - BASE + 30);
    }
    // 近景：左边一株大松（歌词区里只是暗部）
    const nearPine = () => K.cache('f1:near', 420, H, 1, (g) => {
      blurInto(g, 420, H, 2.6, (b) => {
        snowPine(b, 150, H + 220, 1100, 2201, '#080b11', '#283244', { snowT: 0.7, tiers: 11 });
      });
    });
    // 屋主的影子贴图（投在后墙上，软边）
    const manShadow = () => K.cache('f1:mshadow', 220, 260, 0.5, (g) => {
      blurInto(g, 220, 260, 3, (b) => {
        sil(b, 'old', 'sitSide', 130, 170, MAN.h, 0, { facing: -1, body: '#000000' });
        b.globalCompositeOperation = 'source-in'; b.fillStyle = '#000'; b.fillRect(0, 0, 220, 260);
      });
    });

    // 静态底图：夜空、远林、草庐、屋外雪地，最后是左边的近景大松（远、中景的雪按松树的遮挡淡掉，见 pineOcc）
    const baseLayer = () => K.cache('f1:base', W, H, 1, (g) => {
      g.drawImage(bgLayer(), 0, 0, W, H);
      g.drawImage(hutLayer(), 0, 0, W, H);
      g.drawImage(groundLayer(), 0, BASE - 20, W, H - BASE + 30);
      g.drawImage(nearPine(), -60, 0, 420, H);
    });
    // 近景大松的遮挡网格（4 像素一格，取格内最大不透明度）：由松树缓存算一次
    const OCC = { x0: -60, w: 420, cell: 4 };
    let occSrc = null, occ = null;
    function pineOcc(x, y) {
      const src = nearPine();
      if (src !== occSrc) {
        occSrc = src;
        const k = src.width / OCC.w, d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
        const nx = Math.ceil(OCC.w / OCC.cell), ny = Math.ceil(H / OCC.cell);
        occ = new Float32Array(nx * ny); occ.nx = nx; occ.ny = ny;
        for (let j = 0; j < src.height; j++) for (let i = 0; i < src.width; i++) {
          const a = d[(j * src.width + i) * 4 + 3] / 255;
          const ci = Math.min(nx - 1, Math.floor(i / k / OCC.cell)), cj = Math.min(ny - 1, Math.floor(j / k / OCC.cell));
          if (a > occ[cj * nx + ci]) occ[cj * nx + ci] = a;
        }
      }
      // 双线性取样（格心在 (i+0.5)·cell），雪片掠过松枝软边时平滑变化
      const fx = (x - OCC.x0) / OCC.cell - 0.5, fy = y / OCC.cell - 0.5;
      const i0 = Math.floor(fx), j0 = Math.floor(fy), ax = fx - i0, ay = fy - j0;
      const at = (i, j) => (i < 0 || i >= occ.nx || j < 0 || j >= occ.ny ? 0 : occ[j * occ.nx + i]);
      const v = (at(i0, j0) * (1 - ax) + at(i0 + 1, j0) * ax) * (1 - ay) + (at(i0, j0 + 1) * (1 - ax) + at(i0 + 1, j0 + 1) * ax) * ay;
      return clamp(v * 1.3);
    }
    XYT.registerShot('f1_snowhut', {
      name: '雪庐笑饮', zone: 'left', night: true, text: '#e7ecf3', shadow: 'rgba(8,10,16,0.9)', accent: '#f2a24a', bloom: 0.3,
      draw(g, c) {
        const t = c.lt, dur = c.dur;
        // 第1句第5字炭爆；第9字添柴烟浓；第11字烟稀
        const tPop = CT(c, 4, 2.082), tSm = CT(c, 8, 3.942), tGone = CT(c, 10, 4.822);
        const be = c.be ? c.be(0.4) : 0;
        // 火光：两三个频率叠加的轻微闪动（±8%），炭爆时快起慢落 +10%
        const fl = 0.55 * noise1(c.t * 5.3, 7) + 0.3 * noise1(c.t * 11.7, 8) + 0.15 * noise1(c.t * 23, 9);
        const pop = t > tPop ? (1 - Math.exp(-(t - tPop) / 0.03)) * Math.exp(-(t - tPop) / 0.45) : 0;
        const fresh = smooth((t - tSm) / 0.5) * (1 - 0.6 * smooth((t - tSm - 1.2) / 1.5));   // 添了松枝：火略旺
        const L = 0.92 + 0.16 * fl + 0.1 * pop + 0.06 * fresh + 0.03 * be;
        // 镜头：1.05 → 1.00 缓拉
        const z = 1.05 - 0.05 * easeInOut((t + 0.8) / (dur + 0.8));
        g.save();
        g.translate(CAM[0], CAM[1]); g.scale(z, z); g.translate(-CAM[0], -CAM[1]);
        // 静态底图：夜空、远林、草庐外观（门洞里先露着背景，随后被屋里盖住）、屋外雪地
        g.drawImage(baseLayer(), 0, 0, W, H);
        // 远处的雪：在草庐后面落，落到屋顶轮廓后面时按被遮的比例淡掉
        drawSnow(g, c, 0, t);
        // ---- 屋里 ----
        g.save();
        g.beginPath(); g.rect(DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, DOOR.y1 - DOOR.y0 + 2); g.clip();
        g.drawImage(interior(), DOOR.x0 - 20, DOOR.y0 - 10, DOOR.x1 - DOOR.x0 + 40, DOOR.y1 - DOOR.y0 + 30);
        // 火光照亮后墙与地面
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(0.62 * L);
        g.drawImage(dot('#d07a38', 0.3), LIGHT[0] - 300, LIGHT[1] - 260, 600, 520);
        g.globalAlpha = clamp(0.35 * L);
        g.drawImage(dot('#f2a24a', 0.25), LIGHT[0] - 120, LIGHT[1] - 100, 240, 200);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        // 人影投在后墙上（火在他左前方、偏低，影子落在右上方，放大约 1.55 倍），随火苗微颤
        const ks = 1.55 + 0.025 * (fl - 0.5) * 2;
        g.save();
        g.beginPath(); g.rect(DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, BACK - DOOR.y0); g.clip();
        g.translate(LIGHT[0], LIGHT[1] + 4); g.scale(ks, ks); g.translate(-LIGHT[0], -LIGHT[1] - 4);
        g.globalAlpha = 0.42;
        g.drawImage(manShadow(), MAN.x - 130, MAN.y - 170, 220, 260);
        g.restore();
        g.globalAlpha = 1;
        // 矮凳、人、火盆
        g.drawImage(stool(), MAN.x - 40 + 6, MAN.y - 6, 80, 80);
        sil(g, 'old', 'sitSide', MAN.x, MAN.y, MAN.h, c.t, {
          facing: -1, wind: 0, body: '#1a1512', rim: rimCol(L), rimSide: -1,
        });
        g.drawImage(brazier(), FIRE.x - 60, FIRE.y - 10, 120, 80);
        // 火盆沿上温着一把小酒壶：迎火的左侧亮
        g.drawImage(winePot(), FIRE.x + 8, FIRE.y - 30, 40, 40);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(0.55 * L);
        g.drawImage(winePotLit(), FIRE.x + 8, FIRE.y - 30, 40, 40);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        V().flame(g, c, { kind: 'fire', x: FIRE.x, y: FIRE.y + 1, s: 0.3 * (1 + 0.18 * fresh + 0.12 * pop), burn: 1, glow: 0.8, beat: 0.4, seed: 411, embers: true, night: true });
        // 炭爆：一小簇火星升起再熄灭
        if (t > tPop - 0.01 && t < tPop + 1.8) drawSparks(g, t - tPop);
        g.restore();
        // 门框内侧被火光照亮的一道边
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(0.35 * L);
        g.fillStyle = '#c8783a';
        g.fillRect(DOOR.x0 - 2, DOOR.y0, 2, DOOR.y1 - DOOR.y0);
        g.fillRect(DOOR.x0 - 16, DOOR.y1 - 1, DOOR.x1 - DOOR.x0 + 32, 2);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        // ---- 门光照在屋外雪地上：先把雪染成暖色（乘色），再加一层暖光 ----
        g.globalCompositeOperation = 'multiply';
        g.globalAlpha = clamp(0.74 * L);
        spillBlit(g, doorSpill('#ffb070'));
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(0.58 * L);
        spillBlit(g, doorSpill('#a85a1e'));
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        // ---- 青烟：从门楣下溢出，沿墙升起，无风直上，渐宽渐淡 ----
        drawSmoke(g, t, tSm, tGone, dur, L);
        // 中景的雪（在近景大松后面）、近景的雪；近门处被门光照暖
        drawSnow(g, c, 1, t);
        drawSnow(g, c, 2, t);
        g.restore();
      },
    });
    const V = () => XYT.vfx;
    const rimCols = [];
    function rimCol(L) {
      const k = clamp(Math.round((L - 0.85) / 0.35 * 7), 0, 7);
      if (!rimCols[k]) rimCols[k] = mix('#a8562a', '#ffbe72', k / 7);
      return rimCols[k];
    }
    // 火星：初速向上、带一点横向，受热气上托与空气阻力，冷却变暗
    function drawSparks(g, a) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const life = 0.6 + 0.8 * h2(i, 3);
        if (a < 0 || a > life) continue;
        const vx = (h2(i, 4) - 0.5) * 120, vy = -(150 + 150 * h2(i, 5)), kd = 2.6, up = -70;
        const e = (1 - Math.exp(-kd * a)) / kd;
        const pos = (s) => { const ee = (1 - Math.exp(-kd * s)) / kd; return [FIRE.x + (h2(i, 6) - 0.5) * 20 + vx * ee, FIRE.y - 6 + (vy - up / kd) * ee + up * s / kd]; };
        const [x, y] = pos(a), [xp, yp] = pos(Math.max(0, a - 0.035));
        const u = a / life, br = smooth(a / 0.04) * (1 - u) * (1 - u);
        g.globalAlpha = clamp(br);
        g.strokeStyle = u < 0.4 ? '#ffe2a0' : '#ff8a3a'; g.lineWidth = 1.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(xp, yp); g.lineTo(x, y); g.stroke();
        g.globalAlpha = clamp(br * 0.35);
        g.drawImage(dot('#ff9a40', 0.2), x - 6, y - 6, 12, 12);
        void e;
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    // 烟：两股叠加，各用一张竖向可循环的烟缕贴图随烟上升（贴图按 v·t 卷动），按高度切成横条。
    // 底烟一直有：很淡，约 46 px/s 慢升；第1句第9字添了松枝，浓烟更热，约 160 px/s（约 1.1 米/秒）冲上来。
    // 每截烟的浓淡由它从门楣下出来的时刻 te = t − 高度 / v 决定（供烟量），再随烟龄 t − te 散淡。
    // 路径：从门洞上沿溢出 → 贴着门楣上升 → 在檐下平铺 → 绕过檐口前缘收拢翻上来 → 在屋顶前直直上升、渐宽渐淡。
    // 烟自身只有一种颜色（檐下被门光从下面照暖，出檐后冷灰），不随背景换色：在夜空前显亮，在雪顶前自然显暗
    const SM = { w: 160, h: 512 };
    const V0 = 46, V1 = 160;
    // kind：0 冷灰、1 暖灰（底烟）；2 冷灰、3 暖灰（浓烟，团块更大更满）
    // 贴图比一个循环周期多 16 行（重复开头几行），每条横条一次取完，不在横条中间分段
    const SM_TH = SM.h + 16;
    const smokeTex = (kind) => pixelTex('f1:smoke' + kind, 0, 0, SM.w, SM_TH, 1, (u, v0, o) => {
      const v = v0 % SM.h;
      const big = kind >= 2 ? 1.25 : 1, sd = kind >= 2 ? 70 : 60;
      const f = (vv) => {
        const warp = (fbm2(u / (40 * big), vv / (90 * big), sd + 1, 2) - 0.5) * 3;
        const n = fbm2(u / (26 * big) + warp, vv / (70 * big), sd + 2, 4);
        const m = fbm2(u / (12 * big) + warp * 1.6, vv / (34 * big), sd + 3, 3);
        return 0.65 * n + 0.35 * m;
      };
      const w = v / SM.h, n = f(v) * (1 - w) + f(v - SM.h) * w;          // 首尾相接
      const x = (u - SM.w / 2) / (SM.w / 2);
      const prof = Math.exp(-x * x * (kind >= 2 ? 2.2 : 2.6));
      const a = kind >= 2 ? clamp((n - 0.24) * 2.4) * prof : clamp((n - 0.3) * 2.6) * prof;
      const C3 = kind % 2 ? [176, 138, 104] : [128, 136, 154];
      o[0] = C3[0]; o[1] = C3[1]; o[2] = C3[2];
      o[3] = a;
    });
    const EAVE_LO = 289;                                                  // 檐口前缘下沿（屏幕 y）
    // 烟先画进一张与世界坐标 1:1 对齐的暂存画布（横条上下边都落在整像素上，相邻横条之间没有缝），再整张随镜头贴上
    const SB = { x: 420, y: -30, w: 580, h: 360 };
    let smBuf = null;
    function drawSmoke(g0, t, tSm, tGone, dur, L) {
      const endG = 1 - smooth((t - (dur - 0.6)) / 0.5);                  // 镜头末尾全部散尽
      if (endG < 0.003) return;
      const S = (XYT.sprites && XYT.sprites.S) || 1;
      const bw = Math.round(SB.w * S), bh = Math.round(SB.h * S);
      if (!smBuf) smBuf = document.createElement('canvas');
      if (smBuf.width !== bw || smBuf.height !== bh) { smBuf.width = bw; smBuf.height = bh; }
      let g = smBuf.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, bw, bh);
      g.setTransform(S, 0, 0, S, -SB.x * S, -SB.y * S);
      const texC = smokeTex(0), texW = smokeTex(1), texPC = smokeTex(2), texPW = smokeTex(3), sc = texC.width / SM.w;
      const top = -30, y0 = DOOR.y0 + 4, hE = y0 - EAVE_LO;
      let litA = 0;
      const strip = (tex, a, cx, wcol, y, sh, sv) => {
        g.globalAlpha = clamp(a);
        g.drawImage(tex, 0, (SM_TH - sv - sh) * sc, SM.w * sc, sh * sc, cx - wcol / 2, y - sh, wcol, sh);
      };
      // 某高度上的公共量：中线、摊薄系数、暖色比例、宽度的收拢项
      const G = { cx: 0, com: 0, wW: 0, e: 0, q: 0, k: 0 };
      const geom = (hgt, yc) => {
        const q = hgt - hE;
        G.q = q;
        G.com = endG * smooth((hgt + 2) / 10) * (q < 0 ? lerp(1, 0.7, smooth(hgt / hE)) : lerp(0.7, 1, smooth(q / 30)));
        if (q < 0) { G.k = smooth(hgt / hE); G.cx = 711; }
        else {
          G.e = Math.exp(-q / 12);
          G.cx = 712 + 9 * Math.sin(q / 64 - t * 0.7) * smooth(q / 70) + 4 * Math.sin(q / 23 + t * 1.3) * smooth(q / 40);
        }
        // 檐下（茅草断面以下）的烟被门光从下面照暖；到雪檐前已是冷灰
        G.wW = smooth((yc - 270) / 14);
      };
      const pair = (tc, tw, a, w, y, sh, sv) => {
        if (G.wW < 0.99) strip(tc, a * (1 - G.wW), G.cx, w, y, sh, sv);
        if (G.wW > 0.01) strip(tw, a * G.wW * 0.8, G.cx, w, y, sh, sv);
      };
      // 底烟：门宽一片 → 檐下摊宽 → 出檐收成一缕 → 渐宽；供烟量在第11字前后降到四分之一
      const svB = ((V0 * t) % SM.h + SM.h) % SM.h;
      for (let y = y0; y > top;) {
        const hgt = y0 - y, step = hgt - hE < 44 ? 4 : 8, yc = y - step / 2, hc = y0 - yc;
        geom(hc, yc);
        const te0 = t - hc / V0;
        const sup = 1 - 0.75 * smooth((te0 - tGone + 0.3) / 0.6);
        const a = 0.4 * sup * Math.exp(-hc / 300) * G.com;
        if (hc < 70) litA += a * (1 - hc / 70) * step / 8;
        if (a > 0.004) pair(texC, texW, a, G.q < 0 ? lerp(230, 320, G.k) : 96 + 224 * G.e + G.q * 0.42, y, step, (svB + hgt) % SM.h);
        y -= step;
      }
      // 浓烟：te1 = t − 高度 / V1；前沿与尾巴随烟龄变软（扩散），头部收窄成圆顶
      const svP = ((V1 * t + 230) % SM.h + SM.h) % SM.h;
      for (let y = y0; y > top; y -= 4) {
        const hgt = y0 - y, yc = y - 2, hc = y0 - yc;
        const age = hc / V1, te1 = t - age;
        const fA = smooth((te1 - tSm) / (0.26 + 0.35 * age) + 0.5);
        if (fA < 0.002) continue;
        const fB = 1 - smooth((te1 - tGone + 0.225) / (0.45 + 0.35 * age) + 0.5);
        if (fB < 0.002) continue;
        geom(hc, yc);
        const a = 0.9 * fA * fB * Math.exp(-age / 2.2) * G.com;
        if (hc < 70) litA += a * (1 - hc / 70) * 0.5;
        if (a < 0.004) continue;
        const w = G.q < 0 ? lerp(270, 390, G.k) : (136 + 254 * G.e + G.q * 0.55) * (0.45 + 0.55 * Math.sqrt(fA));
        pair(texPC, texPW, a, w, y, 4, (svP + hgt) % SM.h);
      }
      g.globalAlpha = 1;
      g = g0;
      g.drawImage(smBuf, SB.x, SB.y, SB.w, SB.h);
      // 门楣下与檐下的烟被门里的火光从下面照暖
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = clamp(litA * 0.026 * L);
      g.drawImage(dot('#d88a48', 0.3), DOOR.x0 - 10, DOOR.y0 - 70, DOOR.x1 - DOOR.x0 + 20, 110);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    // 雪：三层（远、中、近），无风，近乎垂直地落；在画面里循环，从上沿外进入、下沿外离开
    function drawSnow(g, c, layer, t) {
      const P = [
        { n: 110, sz: [0.9, 1.6], v: [40, 60], a: 0.6, col: '#c8d2e0' },
        { n: 110, sz: [1.6, 2.8], v: [80, 110], a: 0.75, col: '#e2e8f1' },
        { n: 18, sz: [4, 7], v: [150, 200], a: 0.45, col: '#eef2f7' },
      ][layer];
      const sp = dot(P.col, 0.5), wsp = dot('#ffcf90', 0.5);
      const span = H + 60;
      for (let i = 0; i < P.n; i++) {
        const sd = layer * 1000 + i;
        const v = lerp(P.v[0], P.v[1], h2(sd, 1));
        const y = ((h2(sd, 2) * span + v * (t + 10)) % span) - 30;
        const x = h2(sd, 3) * (W + 80) - 40 + 6 * Math.sin((t + 10) * (0.6 + 0.5 * h2(sd, 4)) + sd);
        const r = lerp(P.sz[0], P.sz[1], h2(sd, 5));
        let a = P.a * (0.6 + 0.4 * h2(sd, 6));
        if (layer < 2 && x < 370) { a *= 1 - pineOcc(x, y); if (a < 0.01) continue; }   // 被近处大松挡住
        a *= 1 - 0.45 * smooth((350 - x) / 40);   // 歌词区里淡一些（渐变，雪片左右摆动时不跳）
        // 中景的雪落到地面（墙脚一带）就化进雪里；远处的雪落进远林
        if (layer === 1) a *= 1 - smooth((y - (BASE - 10)) / 30);
        if (layer === 0) {
          a *= 1 - smooth((y - 500) / 60);
          // 草庐轮廓（屋脊上沿与左侧斜脊）后面：雪片中心越过轮廓线时在一个直径内淡掉
          if (x > 428 - r) {
            const ly = x >= 548 ? RIDGE - 14 : RIDGE - 14 + (548 - x) * (EAVE + 4 - RIDGE + 14) / 120;
            a *= 1 - smooth((y - ly + r) / (2 * r)) * smooth((x - 428 + r) / (2 * r));
          }
        }
        if (a < 0.01) continue;
        g.globalAlpha = a;
        g.drawImage(sp, x - r, y - r, r * 2, r * 2);
        // 门光照到的雪片带一点暖色
        if (layer > 0) {
          const dx = (x - 711) / 260, dy = (y - 560) / 220;
          const wl = Math.exp(-(dx * dx + dy * dy)) * (0.4 + 0.6 * smooth((y - DOOR.y0 + 60) / 40)) - 0.04;
          if (wl > 0.01) { g.globalAlpha = a * wl * 0.83; g.drawImage(wsp, x - r, y - r, r * 2, r * 2); }
        }
      }
      g.globalAlpha = 1;
    }
  })();

  // ============================================================
  // f3_pines：雪后松林，午后低斜阳横出长长的蓝色树影；一行脚印蜿蜒到远处的白发人；贴地风吹雪填平近处的脚印
  // ============================================================
  (function () {
    const HOR = 345, F = 1000, HC = 1.53;                     // 人高 1.7 米、在 z=34 米处高 50 像素
    const P = (x, z) => [640 + F * x / z, HOR + F * HC / z];
    const MAN = { x: 5.44, z: 34, h: 50 };
    const SUNDIR = [0.866, 0.5];                               // 太阳的水平方向（右侧、略在景深方向）
    const SHD = [-SUNDIR[0], -SUNDIR[1]];                      // 影子方向
    const TANE = Math.tan(12 * Math.PI / 180);                 // 太阳高度 12°
    const CAM = [770, 400];
    // 树：世界坐标 x、z（米）、胸径 d（米）
    const TREES = [
      [-2.0, 3.5, 0.42], [2.5, 4.6, 0.38],
      [-3.5, 8.5, 0.34], [3.6, 10, 0.36], [-1.6, 15, 0.3], [4.8, 18, 0.32], [-3.6, 20, 0.32], [7.5, 24, 0.34],
      [1.0, 26, 0.3], [9.4, 30, 0.3], [3.0, 40, 0.3], [9.8, 45, 0.3], [-6.5, 34, 0.32], [-1.5, 38, 0.3],
    ];
    (function () {
      const r = A.rng(8301);
      for (let i = 0; i < 26; i++) {
        const z = 46 + r() * 90, x = (r() - 0.5) * z * 1.5;
        const sx = 640 + F * x / z;
        if (Math.abs(sx - 800) < 26) continue;
        TREES.push([x, z, 0.26 + r() * 0.12]);
      }
      TREES.sort((a, b) => b[1] - a[1]);
    })();
    // 脚印路径（世界坐标），从近处到人脚下
    const PATH = [[-1.0, 3.8], [-0.2, 7], [1.0, 11], [0.3, 15], [1.6, 19], [2.8, 23], [4.2, 28.5], [5.44, 34]];
    const PRINTS = (() => {
      // Catmull-Rom 取样，按弧长每 0.62 米一步，左右脚交替
      const pts = [];
      for (let i = 0; i < PATH.length - 1; i++) {
        const p0 = PATH[Math.max(0, i - 1)], p1 = PATH[i], p2 = PATH[i + 1], p3 = PATH[Math.min(PATH.length - 1, i + 2)];
        for (let k = 0; k < 40; k++) {
          const u = k / 40, u2 = u * u, u3 = u2 * u;
          const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
          pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
      pts.push(PATH[PATH.length - 1]);
      const out = [];
      let acc = 0, side = 1;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], L = Math.hypot(dx, dz);
        acc += L;
        while (acc >= 0.62) {
          acc -= 0.62;
          const tx = dx / L, tz = dz / L;
          const x = pts[i][0] - tx * acc + side * 0.1 * tz, z = pts[i][1] - tz * acc - side * 0.1 * tx;
          if (z < MAN.z - 0.5) out.push({ x, z, tx, tz, side });
          side = -side;
        }
      }
      return out;
    })();

    // ---------- 背景：天光、林深处的雾、远树冠 ----------
    const bgLayer = () => K.cache('f3:bg', W, H, 0.5, (g) => {
      // 天光：右侧（太阳一侧）金白，左侧偏冷
      let gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, '#d3dde6'); gr.addColorStop(0.55, '#ebe7dc'); gr.addColorStop(1, '#fbe9c8');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      gr = g.createRadialGradient(1500, 120, 0, 1500, 120, 900);
      gr.addColorStop(0, 'rgba(255,230,180,0.75)'); gr.addColorStop(0.5, 'rgba(255,226,176,0.25)'); gr.addColorStop(1, 'rgba(255,226,176,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // 林深处：层层淡去的树干（雾里的竖影），越远越淡
      for (const [zz, a0, n] of [[260, 0.13, 40], [170, 0.2, 30]]) {
        blurInto(g, W, H, zz > 200 ? 2.5 : 1.5, (b) => {
          const r = A.rng(77 + zz);
          for (let i = 0; i < n; i++) {
            const z = zz * (0.8 + 0.4 * r()), x = (r() - 0.5) * z * 1.6, [sx, sy] = P(x, z), w = Math.max(1.2, F * 0.34 / z);
            b.fillStyle = `rgba(118,136,156,${a0 * (0.7 + 0.6 * r())})`;
            b.fillRect(sx - w / 2, 120, w, sy - 118);
          }
        });
      }
      // 树冠下沿一带略暗的雾（远处树冠的影子连成一体）
      gr = g.createLinearGradient(0, 110, 0, 300);
      gr.addColorStop(0, 'rgba(120,136,148,0.32)'); gr.addColorStop(1, 'rgba(120,136,148,0)');
      g.fillStyle = gr; g.fillRect(0, 110, W, 190);
      // 地平线附近的雾带（右侧带暖）
      gr = g.createLinearGradient(0, HOR - 80, 0, HOR + 30);
      gr.addColorStop(0, 'rgba(236,236,232,0)'); gr.addColorStop(0.6, 'rgba(240,238,232,0.8)'); gr.addColorStop(1, 'rgba(242,238,230,0.4)');
      g.fillStyle = gr; g.fillRect(0, HOR - 80, W, 110);
    });
    // ---------- 雪地（受光暖白，起伏处背光偏蓝）----------
    const groundLayer = () => K.cache('f3:ground', W, H - HOR + 10, 1, (g) => {
      g.translate(0, -(HOR - 6));
      let gr = g.createLinearGradient(0, HOR, 0, H);
      gr.addColorStop(0, '#dfe5ea'); gr.addColorStop(0.12, '#ecebe6'); gr.addColorStop(0.5, '#f7efdf'); gr.addColorStop(1, '#f9efdc');
      g.fillStyle = gr; g.fillRect(0, HOR - 6, W, H - HOR + 10);
      // 雪面起伏：每个缓丘右侧受光、左侧一抹蓝
      blurInto(g, W, H, 4, (b) => {
        const r = A.rng(311);
        for (let i = 0; i < 70; i++) {
          const z = 4 + Math.pow(r(), 1.5) * 60, x = (r() - 0.5) * z * 1.5, [sx, sy] = P(x, z);
          const w = F * (1.2 + 2 * r()) / z, hh = Math.max(1.5, F * HC * 0.5 / (z * z) * (1 + r()));
          b.fillStyle = 'rgba(143,166,191,0.22)';
          b.beginPath(); b.ellipse(sx - w * 0.25, sy + hh * 0.2, w * 0.7, hh, 0, 0, TAU); b.fill();
          b.fillStyle = 'rgba(255,248,236,0.35)';
          b.beginPath(); b.ellipse(sx + w * 0.2, sy - hh * 0.2, w * 0.6, hh * 0.8, 0, 0, TAU); b.fill();
        }
      });
      // 树根四周的雪窝
      for (const [x, z, d] of TREES) {
        const [sx, sy] = P(x, z), w = F * d / z;
        if (sy > H + 40) continue;
        const gr2 = g.createRadialGradient(sx - w * 0.4, sy, 0, sx - w * 0.4, sy, w * 1.6);
        gr2.addColorStop(0, 'rgba(110,134,160,0.4)'); gr2.addColorStop(1, 'rgba(110,134,160,0)');
        g.save(); g.translate(sx, sy); g.scale(1, 0.18 + 2 / Math.max(4, z)); g.translate(-sx, -sy);
        g.fillStyle = gr2; g.fillRect(sx - w * 2.2, sy - w * 1.6, w * 4.4, w * 3.2); g.restore();
      }
    });
    // ---------- 树影（太阳不动，影子整镜不变）----------
    // 树干的影：沿影子方向的一条带，近根处清楚、越远越虚；投在雪上偏蓝
    const shadowLayer = () => K.cache('f3:shadow', W, H - HOR + 10, 1, (g) => {
      g.translate(0, -(HOR - 6));
      const band = (b, x, z, d, s0, s1, wk) => {
        const px = -SHD[1], pz = SHD[0];             // 垂直于影子方向
        const pts = [];
        const zmin = 0.9;
        const clipS = (sx) => { const zz = z + SHD[1] * sx; return zz < zmin ? (z - zmin) / -SHD[1] : sx; };
        const e = clipS(s1);
        if (e <= s0) return;
        const hw0 = d * 0.5 * wk, hw1 = d * 0.5 * wk * 1.6;
        const q = (sx, hw) => P(x + SHD[0] * sx + px * hw, z + SHD[1] * sx + pz * hw);
        pts.push(q(s0, hw0), q(e, hw1), q(e, -hw1), q(s0, -hw0));
        b.beginPath(); pts.forEach((p, i) => (i ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1]))); b.closePath(); b.fill();
      };
      blurInto(g, W, H, 1.6, (b) => {
        b.fillStyle = 'rgba(78,104,140,0.55)';
        for (const [x, z, d] of TREES) band(b, x, z, d, 0, 8 / TANE, 1);
        // 人的影子：细长一条
        b.fillStyle = 'rgba(78,104,140,0.45)';
        band(b, MAN.x, MAN.z, 0.42, 0.1, 1.7 / TANE, 1);
      });
      // 画外右侧树冠投来的大片斑驳影子
      blurInto(g, W, H, 9, (b) => {
        const r = A.rng(4242);
        b.fillStyle = 'rgba(90,116,150,0.22)';
        for (let i = 0; i < 9; i++) {
          const x0 = 6 + r() * 18, z0 = 6 + r() * 30;
          for (let k = 0; k < 6; k++) {
            const sx = 30 + k * 7 + r() * 5, x = x0 + SHD[0] * sx, z = z0 + SHD[1] * sx;
            if (z < 1.5) break;
            const [px, py] = P(x, z), w = F * (2 + 2 * r()) / z, hh = Math.max(1.5, F * HC * 1.5 / (z * z));
            b.beginPath(); b.ellipse(px, py, w, hh, -0.08, 0, TAU); b.fill();
          }
        }
      });
    });
    // ---------- 树干（逆光：朝镜头一面在阴里，右缘一道暖色轮廓光）----------
    // 松树皮：竖长的鳞片，片间是深色纵沟（圆柱上越靠两边越密）；迎风的右侧贴着断续的雪；根部埋在一个软边的小雪丘里
    // 雪面底色（与 groundLayer 的竖向渐变一致）
    const GSTOP = [[0, '#dfe5ea'], [0.12, '#ecebe6'], [0.5, '#f7efdf'], [1, '#f9efdc']];
    function groundCol(y) {
      const q = clamp((y - HOR) / (H - HOR));
      for (let k = 1; k < GSTOP.length; k++) if (q <= GSTOP[k][0]) return mix(GSTOP[k - 1][1], GSTOP[k][1], (q - GSTOP[k - 1][0]) / (GSTOP[k][0] - GSTOP[k - 1][0]));
      return GSTOP[GSTOP.length - 1][1];
    }
    function drawTrunk(g, x, z, d) {
      const [sx, sy] = P(x, z), w = Math.max(1.5, F * d / z);
      const haze = clamp((z - 8) / 110);
      const top = -20, base = Math.min(sy + 2, H + 20);
      const col = mix(mix('#4b3b36', '#38404c', 0.35), '#c8d2dc', haze * 0.9);
      const rim = mix('#f6cf96', '#f1e6d4', haze);
      const r = A.rng(Math.round(x * 100 + z * 7));
      // 上细下粗，根部略张开
      const hwAt = (yy) => w * (0.42 + 0.08 * (yy - top) / (base - top)) * (1 + 0.16 * Math.pow(clamp((yy - (base - w)) / w), 2));
      const ys = [];
      for (let k = 0; k <= 6; k++) ys.push(top + (base - w - top) * k / 6);
      ys.push(base - w * 0.6, base - w * 0.3, base);
      const outline = () => {
        g.beginPath();
        ys.forEach((yy, i) => (i ? g.lineTo(sx - hwAt(yy), yy) : g.moveTo(sx - hwAt(yy), yy)));
        for (let i = ys.length - 1; i >= 0; i--) g.lineTo(sx + hwAt(ys[i]), ys[i]);
        g.closePath();
      };
      // 竖向色调：下部灰暗，上部略暖
      const gv = g.createLinearGradient(0, top, 0, base);
      gv.addColorStop(0, mix(col, '#6a5040', 0.22 * (1 - haze))); gv.addColorStop(0.6, col); gv.addColorStop(1, mix(col, '#2c2a2e', 0.28 * (1 - haze)));
      g.fillStyle = gv; outline(); g.fill();
      if (w > 3) {
        g.save(); outline(); g.clip();
        const nf = Math.max(3, Math.round(w / 4));
        // 鳞片：纵沟之间略亮的竖长块
        g.fillStyle = rgba('#8a7262', 0.09 * (1 - haze));
        for (let k = 0; k < nf * 2; k++) {
          const u = Math.sin((r() - 0.5) * Math.PI * 0.8) * 0.4, y0 = top + r() * (base - top), len = w * (0.8 + 1.4 * r());
          g.fillRect(sx + u * w - w * 0.05, y0, w * 0.1, len);
        }
        // 纵沟
        g.strokeStyle = rgba('#1c181a', 0.3 * (1 - haze)); g.lineWidth = Math.max(0.6, w * 0.026); g.lineCap = 'round';
        for (let k = 0; k < nf * 3; k++) {
          const u = Math.sin((r() - 0.5) * Math.PI * 0.92) * 0.46;
          const y0 = top + r() * (base - top), len = w * (1.2 + 2.6 * r());
          g.beginPath(); g.moveTo(sx + u * w, y0);
          g.quadraticCurveTo(sx + (u + (r() - 0.5) * 0.06) * w, y0 + len * 0.5, sx + (u + (r() - 0.5) * 0.05) * w, y0 + len); g.stroke();
        }
        // 侧光：左侧暗，右缘亮
        const gr = g.createLinearGradient(sx - w * 0.55, 0, sx + w * 0.55, 0);
        gr.addColorStop(0, 'rgba(30,36,48,0.38)'); gr.addColorStop(0.55, 'rgba(30,36,48,0)'); gr.addColorStop(0.82, rgba(rim, 0)); gr.addColorStop(0.94, rgba(rim, 0.75)); gr.addColorStop(1, rgba(rim, 0.95));
        g.fillStyle = gr; g.fillRect(sx - w, top, w * 2, base - top);
        g.restore();
        // 迎风面（右）贴着的雪：从根部往上一段断续的雪痕，越高越薄
        if (z < 42) {
          const hS = (0.7 + 0.9 * r()) * F / z;
          g.fillStyle = rgba(mix('#fbf3e6', '#eef0f2', haze), 0.7 * (1 - haze * 0.7));
          let yy = base - w * 0.12;
          while (yy > base - hS) {
            const q = (base - yy) / hS;
            const len = Math.min(46, w * (0.2 + 0.6 * r())) * (1 - 0.5 * q), th2 = Math.max(0.45, w * (0.012 + 0.022 * r()) * (1 - 0.6 * q));
            g.beginPath(); g.ellipse(sx + hwAt(yy) - th2 * 0.9, yy - len / 2, th2, len / 2, 0, 0, TAU); g.fill();
            yy -= len + Math.min(60, w * (0.15 + 0.7 * r()));
          }
        }
        // 几根枯枝桩
        g.strokeStyle = col; g.lineCap = 'round';
        for (let k = 0; k < 2; k++) {
          const yy = top + (0.1 + 0.45 * r()) * (Math.min(base, HOR + 40) - top), sd = r() < 0.5 ? -1 : 1, L = w * (0.35 + 0.35 * r());
          g.lineWidth = Math.max(0.7, w * 0.05);
          g.beginPath(); g.moveTo(sx + sd * w * 0.4, yy); g.quadraticCurveTo(sx + sd * (w * 0.4 + L * 0.6), yy + L * 0.1, sx + sd * (w * 0.4 + L), yy + L * 0.35); g.stroke();
        }
      } else {
        g.fillStyle = rgba(rim, 0.6); g.fillRect(sx + w * 0.2, top, Math.max(0.6, w * 0.3), base - top);
      }
      // 根部的雪丘：颜色取那一深度的雪面色、略亮，软边、无轮廓；左半落在树自己的影里偏蓝。远处细树干不画
      if (sy < H + 10 && w >= 7) {
        const mw = w * 1.2, mh = Math.max(1.2, w * 0.2), gc = groundCol(sy);
        g.save(); g.translate(sx, sy); g.scale(1, mh / mw);
        let gm = g.createRadialGradient(w * 0.1, 0, 0, w * 0.1, 0, mw);
        gm.addColorStop(0, rgba(gc, 0.92)); gm.addColorStop(0.5, rgba(gc, 0.7)); gm.addColorStop(1, rgba(gc, 0));
        g.fillStyle = gm; g.fillRect(-mw * 1.2, -mw, mw * 2.4, mw * 2);
        gm = g.createRadialGradient(-w * 0.55, 0, 0, -w * 0.55, 0, mw * 0.8);
        gm.addColorStop(0, 'rgba(120,144,172,0.35)'); gm.addColorStop(1, 'rgba(120,144,172,0)');
        g.fillStyle = gm; g.fillRect(-mw * 1.4, -mw, mw * 2, mw * 2);
        g.restore();
      }
    }
    // 中景树干（z ≥ 9，在树冠后面；z=8.5 那棵在树冠前，画在底图里树冠之后）
    const trunksLayer = () => K.cache('f3:trunks', W, H, 1, (g) => {
      for (const [x, z, d] of TREES) if (z >= 9) drawTrunk(g, x, z, d);
    });
    // 近景树干（z < 8，在树冠和近处吹雪带之间）：每棵一张只包住它的窄缓存
    const NEAR = TREES.filter((t) => t[1] < 8).map(([x, z, d]) => {
      const [sx] = P(x, z), w = F * d / z;
      const x0 = Math.max(-40, Math.floor(sx - w * 1.25)), x1 = Math.min(W + 40, Math.ceil(sx + w * 1.25));
      return { x, z, d, x0, w: x1 - x0 };
    });
    const nearTrunk = (n) => K.cache('f3:near' + n.z, n.w, H, 1, (g) => { g.translate(-n.x0, 0); drawTrunk(g, n.x, n.z, n.d); });
    const blitNear = (g, n) => g.drawImage(nearTrunk(n), n.x0, 0, n.w, H);
    // ---------- 树冠（顶部一带）：逐像素的松针团——横向成层的团块，团块上缘压雪；越往下越稀、越远越淡 ----------
    const CN = { w: W, h: 300 };
    const canopyD = (u, v) => {
      const cov = 1 - smooth((v - 40 - 70 * fbm2(u / 260, 0.5, 91, 2)) / 170);
      const n = fbm2(u / 80, v / 26, 92, 4), m = fbm2(u / 26, v / 12, 93, 3);
      return smooth((0.62 * n + 0.38 * m + cov * 0.58 - 0.86) / 0.06);
    };
    const canopyLayer = () => pixelTex('f3:canopy', 0, 0, CN.w, CN.h, 0.5, (u, v, o) => {
      const d = canopyD(u, v);
      if (d < 0.01) return;
      const up = canopyD(u - 2, v - 5), sub = fbm2(u / 22, v / 14, 93, 3), subUp = fbm2((u - 1) / 22, (v - 3) / 14, 93, 3);
      const far = smooth((v - 70) / 200);
      let col = mixA(hexArr('#1a2224'), hexArr('#7c8b94'), far);
      // 顶上一带（歌词区）雪很暗很少，y 150 以下受光的雪才亮起来
      const snowK = clamp((d - up) * 1.6) + 0.5 * clamp((sub - subUp) * 10) * d;
      const sun = smooth((u - 500) / 700);
      const snowCol = mixA(mixA(hexArr('#aab6bf'), hexArr('#eef1f2'), smooth((v - 120) / 60)), hexArr('#f4dcb2'), sun * 0.5 * smooth((v - 120) / 60));
      col = mixA(col, snowCol, clamp(snowK) * lerp(0.2, 1, smooth((v - 150) / 40)));
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; o[3] = d;
    }, 1);
    // 贴地吹雪的流纹（1024 宽、可横向平铺）：三条蜿蜒的雪粉带，带内是被风拉长的细丝，时断时续
    const DT = { w: 1024, h: 64 };
    const driftTex = () => pixelTex('f3:drift', 0, 0, DT.w, DT.h, 0.5, (u, v, o) => {
      const ph = TAU * u / DT.w, wq = u / DT.w;
      const sl = (f) => f(u) * (1 - wq) + f(u - DT.w) * wq;        // 首尾相接
      let a = 0, lo = 0;
      for (const [v0, A1, m, p0, sg, inten, sd] of [[29, 7, 2, 0.3, 4.4, 0.8, 41], [41, 6, 3, 1.9, 5.4, 1, 47], [51, 4, 1, 4.1, 4.2, 0.75, 53]]) {
        const vc = v0 + A1 * Math.sin(m * ph + p0) + 1.5 * Math.sin((m + 2) * ph + p0 * 2);
        const prof = Math.exp(-Math.pow((v - vc) / sg, 2));
        if (prof < 0.01) continue;
        const n = sl((uu) => fbm2(uu / 80, 0.5, sd, 3));
        const fine = sl((uu) => fbm2(uu / 14, v / 2.2, sd + 5, 2));
        const aa = inten * prof * clamp((n - 0.32) * 4) * (0.4 + 0.6 * clamp((fine - 0.33) * 3));
        a += aa; lo += aa * smooth((v - vc) / sg);
      }
      // 每条雪粉带的下沿背光、偏冷；上沿迎着右前方的低斜阳，暖白发亮
      const q = a > 0 ? clamp(lo / a) : 0;
      o[0] = lerp(255, 196, q); o[1] = lerp(246, 208, q); o[2] = lerp(228, 226, q); o[3] = clamp(a);
    });
    // 雪流在雪面上的影（同一张流纹，染成蓝）
    const driftShadow = () => K.cache('f3:driftsh', DT.w, DT.h, 0.5, (g) => {
      g.drawImage(driftTex(), 0, 0, DT.w, DT.h);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = 'rgba(84,110,148,0.85)'; g.fillRect(0, 0, DT.w, DT.h);
    });
    // 吹雪的深度带（越近越低、越大、越快）
    const BANDS = [];
    // 带的深度避开紧挨在它后面的树根（带的影子落在地上，不能盖到更远的树干根部）
    [4.2, 6.4, 10.6, 16.4, 22.0, 32.4, 41.0].forEach((z, i) => {
      const y = P(0, z)[1], k = 8 / z;
      const th = 64 * k * 0.6, tw = DT.w * k * 1.4;
      BANDS.push({ i, z, y, k, th, tw, sh: th * 1.5, y0: y - th, nearer: TREES.some((t) => t[1] >= 8 && t[1] < z) });
    });
    // 每条带预先平铺成一条长条（影子在下方偏左，随雪粉一起走）
    const driftStrip = (b) => K.cache('f3:drS' + b.i, W + b.tw + 8, b.sh, 0.5, (g) => {
      const len = W + b.tw + 8, sh = driftShadow(), tx = driftTex();
      const p1 = g.createPattern(sh, 'repeat-x');
      p1.setTransform(new DOMMatrix([b.tw / sh.width, 0, 0, b.th / sh.height, -6 * b.k, 0.45 * b.th]));
      g.globalAlpha = 1; g.fillStyle = p1; g.fillRect(0, 0.45 * b.th, len, b.th);
      const p2 = g.createPattern(tx, 'repeat-x');
      p2.setTransform(new DOMMatrix([b.tw / tx.width, 0, 0, b.th / tx.height, 0, 0]));
      g.globalAlpha = 1; g.fillStyle = p2; g.fillRect(0, 0, len, b.th);
    });
    // 比这条带近的中景树干，在带所在的那一横条里重画一遍（叠上同样的光柱），带就落在它们后面
    const trunkStrip = (b) => K.cache('f3:trk' + b.i, W, b.sh + 4, 1, (g) => {
      g.translate(0, -(b.y0 - 2));
      for (const [x, z, d] of TREES) if (z >= 9 && z < b.z) drawTrunk(g, x, z, d);
      const m = document.createElement('canvas'); m.width = g.canvas.width; m.height = g.canvas.height;
      m.getContext('2d').drawImage(g.canvas, 0, 0);
      drawRays(g, 0, 0);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0); g.restore();
      for (const [x, z, d] of TREES) if (z >= 8 && z < 9 && z < b.z) drawTrunk(g, x, z, d);
    });
    XYT.registerShot('f3_pines', {
      name: '雪林足迹', zone: 'top', night: false, text: '#f6f8fa', shadow: 'rgba(24,30,40,0.88)', accent: '#f2d8a8', bloom: 0.22,
      draw(g, c) {
        const t = c.lt, dur = c.dur;
        const tW = CT(c, 8, 3.962);                                 // 第1句第9字起风
        const be = c.be ? c.be(0.4) : 0;
        const gust = smooth((t - tW + 0.15) / 0.6);
        const z = 1 + 0.04 * easeInOut((t + 0.8) / (dur + 0.8));
        g.save();
        g.translate(CAM[0], CAM[1]); g.scale(z, z); g.translate(-CAM[0], -CAM[1]);
        // 静态底图（一张缓存）
        g.drawImage(baseLayer(), 0, 0, W, H);
        // 近处的脚印：风起后一个个被填平（远处的脚印画在底图里）
        drawPrints(g, t, tW);
        drawGlints(g, c, t, be);
        // 贴地吹雪与人：由远到近。比人远的带先画，然后是人，再画更近的带；每条带画完把比它近的中景树干重画在上面
        const D = rampDist(t - tW + 0.4, 0.2, 0.6, 0, 7);            // 世界里雪粉走过的米数
        const drift = t > tW - 0.4;
        for (let i = 6; i >= 2; i--) {
          if (drift) drawBand(g, BANDS[i], t, D, gust);
          if (BANDS[i].z > MAN.z && BANDS[i - 1].z <= MAN.z) drawMan(g, c, gust);
        }
        // 近处：雪粒、最近的两条吹雪带与两棵近景树干按深度交错
        if (drift) { drawGrains(g, t, tW, BANDS[1].z, 9); drawBand(g, BANDS[1], t, D, gust); drawGrains(g, t, tW, 4.6, BANDS[1].z); }
        blitNear(g, NEAR[0]);
        if (drift) drawBand(g, BANDS[0], t, D, gust);
        blitNear(g, NEAR[1]);
        g.restore();
      },
    });
    // 人：远处静立，白发与衣摆向左；脚下接触阴影
    function drawMan(g, c, gust) {
      const [mx, my] = P(MAN.x, MAN.z);
      // 他自己的长影：沿影子方向约 8 米（1.7 米 / tan12°），贴地极细，越远越淡
      const LS = 1.7 / TANE, [ex, ey] = P(MAN.x + SHD[0] * LS, MAN.z + SHD[1] * LS);
      const sg = g.createLinearGradient(mx, my, ex, ey);
      sg.addColorStop(0, 'rgba(70,92,124,0.38)'); sg.addColorStop(1, 'rgba(70,92,124,0.1)');
      g.strokeStyle = sg; g.lineWidth = 1; g.lineCap = 'round';
      g.beginPath(); g.moveTo(mx - 2, my + 0.3); g.lineTo(ex, ey); g.stroke();
      g.fillStyle = 'rgba(70,92,124,0.5)';
      g.beginPath(); g.ellipse(mx - 2, my + 0.5, 9, 1.6, 0, 0, TAU); g.fill();
      sil(g, 'old', 'standBack', mx, my, MAN.h, c.t, { wind: 0.3 + 0.2 * gust, windDir: -1, body: '#2a2f38', rim: '#f6d6a4', rimSide: 1 });
    }
    // 静态底图：天光、林深、雪地、树影、远处不会被填平的脚印、中景树干、光柱、树冠、z=8.5 的近树干
    const baseLayer = () => K.cache('f3:base', W, H, 1, (g) => {
      g.drawImage(bgLayer(), 0, 0, W, H);
      g.drawImage(groundLayer(), 0, HOR - 6, W, H - HOR + 10);
      g.drawImage(shadowLayer(), 0, HOR - 6, W, H - HOR + 10);
      for (let i = NPR; i < PRINTS.length; i++) printShape(g, PRINTS[i]);
      g.drawImage(trunksLayer(), 0, 0, W, H);
      drawRays(g, 0, 0);
      g.drawImage(canopyLayer(), 0, 0, CN.w, CN.h);
      for (const [x, z, d] of TREES) if (z >= 8 && z < 9) drawTrunk(g, x, z, d);
    });
    // 每个脚印是否落在某棵树的影子里（太阳不动，算一次）
    PRINTS.forEach((pr) => {
      pr.shade = 0;
      for (const [x, z, d] of TREES.concat([[MAN.x, MAN.z, 0.42]])) {
        const rx = pr.x - x, rz = pr.z - z;
        const sAl = rx * SHD[0] + rz * SHD[1], lat = rx * -SHD[1] + rz * SHD[0];
        const e = 8 / TANE;
        if (sAl > 0 && sAl < e && Math.abs(lat) < d * 0.5 * (1 + 0.6 * sAl / e) + 0.05) pr.shade = 1;
      }
    });
    // 光柱：从画外右上方的太阳方向（约 (2372, -80)）辐射下来
    const SUNP = [2372, -80];
    function drawRays(g, t, be) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const R = [[0.18, 60, 0.1], [0.3, 90, 0.08], [0.44, 50, 0.09], [0.58, 110, 0.06], [0.72, 70, 0.08], [0.86, 90, 0.05]];
      for (const [q, w, a] of R) {
        // 光柱经过画面中线 x=640 处的 y
        const yc = lerp(60, 640, q);
        const ang = Math.atan2(yc - SUNP[1], 640 - SUNP[0]);
        const len = 2600;
        g.save();
        g.translate(SUNP[0], SUNP[1]); g.rotate(ang);
        const gr = g.createLinearGradient(0, -w, 0, w);
        gr.addColorStop(0, 'rgba(255,228,180,0)'); gr.addColorStop(0.5, `rgba(255,228,180,${a * (1 + 0.1 * be)})`); gr.addColorStop(1, 'rgba(255,228,180,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(600, -w * 0.5); g.lineTo(len + 400, -w); g.lineTo(len + 400, w); g.lineTo(600, w * 0.5); g.closePath(); g.fill();
        g.restore();
      }
      g.restore();
    }
    // 脚印：世界里约 0.28 × 0.12 米、前宽后窄的凹坑，按所在位置的透视（雅可比）投影到屏幕。
    // 低日从右来：凹坑大半在阴里（蓝），向阳一侧的内壁最暗、边缘清楚；背阳一侧的内壁朝着太阳，是一道亮边；向阳的外沿雪唇受光
    function footPath(g, du, dv, s) {
      g.moveTo(s + du, dv);
      for (let k = 1; k <= 24; k++) {
        const th = TAU * k / 24, c = Math.cos(th);
        g.lineTo(c * s + du, Math.sin(th) * (0.8 + 0.2 * c) * s + dv);
      }
      g.closePath();
    }
    const PL = 0.14, PW = 0.06;                                   // 半长、半宽（米）
    PRINTS.forEach((pr, i) => {
      const [sx, sy] = P(pr.x, pr.z);
      const iz = 1 / pr.z, jx = F * iz, jxz = -F * pr.x * iz * iz, jyz = -F * HC * iz * iz;
      const nx = pr.tz, nz = -pr.tx;
      Object.assign(pr, {
        i, sx, sy, ax: (jx * pr.tx + jxz * pr.tz) * PL, ay: jyz * pr.tz * PL, bx: (jx * nx + jxz * nz) * PW, by: jyz * nz * PW,
        su: (SUNDIR[0] * pr.tx + SUNDIR[1] * pr.tz) / PL, sv: (SUNDIR[0] * nx + SUNDIR[1] * nz) / PW,
        A0: 1 - 0.35 * clamp((pr.z - 6) / 26),
      });
    });
    function printShape(g, pr) {
      const { ax, ay, bx, by, sx, sy, su, sv, A0 } = pr;
      if (Math.abs(ay) + Math.abs(by) < 0.9) {
        g.globalAlpha = A0 * (pr.shade ? 0.5 : 0.65); g.fillStyle = '#7f98b6';
        g.beginPath(); g.ellipse(sx, sy, Math.max(0.7, Math.abs(ax) + Math.abs(bx)), 0.7, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
        return;
      }
      g.save();
      g.transform(ax, ay, bx, by, sx, sy);
      if (!pr.shade) {
        g.globalAlpha = A0 * 0.16; g.fillStyle = '#6e88aa'; g.beginPath(); footPath(g, -0.06 * su, -0.06 * sv, 1.12); g.fill();
        g.globalAlpha = A0 * 0.5; g.fillStyle = '#fffaf0'; g.beginPath(); footPath(g, 0.025 * su, 0.025 * sv, 1.2); g.fill();
      }
      g.beginPath(); footPath(g, 0, 0, 1); g.clip();
      if (!pr.shade) { g.globalAlpha = A0 * 0.95; g.fillStyle = '#fff6e8'; g.fillRect(-2, -2, 4, 4); }
      g.globalAlpha = A0 * (pr.shade ? 0.6 : 0.85); g.fillStyle = pr.shade ? '#7a93b2' : '#7f9cbf';
      g.beginPath(); footPath(g, pr.shade ? 0 : 0.03 * su, pr.shade ? 0 : 0.03 * sv, 1); g.fill();
      // 向阳那面内壁：坑与往背阳方向挪一点的坑的差集
      g.globalAlpha = A0 * (pr.shade ? 0.35 : 0.8); g.fillStyle = '#58739a';
      g.beginPath(); footPath(g, 0, 0, 1); footPath(g, -0.012 * su, -0.012 * sv, 1); g.fill('evenodd');
      g.restore();
      g.globalAlpha = 1;
    }
    // 近处 14 个会被填平的脚印：各自一张小缓存（只是透明度随时间变）
    const NPR = 14;
    const printSpr = (pr) => {
      const ex = (Math.abs(pr.ax) + Math.abs(pr.bx)) * 1.35 + 3, ey = (Math.abs(pr.ay) + Math.abs(pr.by)) * 1.35 + 3;
      pr.box = [pr.sx - ex, pr.sy - ey, ex * 2, ey * 2];
      return K.cache('f3:pr' + pr.i, ex * 2, ey * 2, 1, (g) => { g.translate(ex - pr.sx, ey - pr.sy); printShape(g, pr); });
    };
    function drawPrints(g, t, tW) {
      for (let i = 0; i < NPR; i++) {
        const pr = PRINTS[i];
        if (pr.sy > H + 30) continue;
        // 由近到远，每个 0.5 秒填平
        const keep = 1 - smooth((t - (tW + 0.12 + i * 0.16)) / 0.5);
        if (keep < 0.01) continue;
        const spr = printSpr(pr);
        g.globalAlpha = keep;
        g.drawImage(spr, pr.box[0], pr.box[1], pr.box[2], pr.box[3]);
      }
      g.globalAlpha = 1;
    }
    // 贴地吹雪的一条深度带：长条（半分辨率，贴图本身就是半分辨率生成的）拷进小画布，乘上沿 x 慢慢移动、聚散的浓淡（雪粉团），再贴回画面
    const bufs = [];
    function drawBand(g, b, t, D, gust) {
      const a = gust * clamp(1.2 - b.z / 40);
      if (a < 0.01) return;
      const strip = driftStrip(b), k = strip.width / strip.lw;
      const off = ((D * F / b.z) % b.tw + b.tw) % b.tw;
      const bw = Math.round(W * k), bh = strip.height;
      let buf = bufs[b.i];
      if (!buf) buf = bufs[b.i] = document.createElement('canvas');
      if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
      const bg = buf.getContext('2d');
      bg.setTransform(1, 0, 0, 1, 0, 0);
      bg.globalCompositeOperation = 'copy';
      bg.drawImage(strip, off * k, 0, bw, bh, 0, 0, bw, bh);
      bg.globalCompositeOperation = 'destination-in';
      const gr = bg.createLinearGradient(0, 0, bw, 0);
      const v1 = 60 + 0.12 * 7 * F / b.z, L1 = W / 2.6, L2 = W / 1.4;
      for (let s = 0; s <= 16; s++) {
        const x = s / 16 * W;
        const n = 0.65 * noise1((x + t * v1) / L1, 300 + b.i) + 0.35 * noise1((x - t * v1 * 0.4) / L2, 320 + b.i);
        gr.addColorStop(s / 16, `rgba(0,0,0,${smooth((n - 0.3) / 0.36).toFixed(3)})`);
      }
      bg.fillStyle = gr; bg.fillRect(0, 0, bw, bh);
      g.globalAlpha = a;
      g.drawImage(buf, 0, 0, bw, bh, 0, b.y0, W, b.sh);
      g.globalAlpha = 1;
      if (b.nearer) { const ts = trunkStrip(b); g.drawImage(ts, 0, b.y0 - 2, W, ts.lh); }
    }
    // 雪粒：从画右进入，掠过近处（只在 zA..zB 米之间，按深度与近景树干交错画）
    function drawGrains(g, t, tW, zA, zB) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#fff6e4'; g.lineCap = 'round';
      for (let bk = 0; bk < 3; bk++) {
        g.globalAlpha = 0.26 + 0.12 * bk;
        g.lineWidth = 0.7 + 0.45 * bk;
        g.beginPath();
        for (let i = 0; i < 70; i++) {
          const z = 4.7 + Math.pow(h2(i, 32), 1.2) * 3.7, k = 8 / z;
          if (z < zA || z >= zB) continue;
          if (Math.min(2, Math.floor((k - 0.9) * 3.6)) !== bk) continue;
          const act = tW - 0.1 + h2(i, 31) * 0.6;
          if (t < act) continue;
          const v = 900 * k * (0.8 + 0.4 * h2(i, 33)), Lp = W + 200;
          const run = (t - act) * v, lap = Math.floor(run / Lp);
          const x = W + 60 - (run - lap * Lp);
          const [, gy0] = P(0, z);
          const y = gy0 - (4 + 14 * h2(i + lap * 17, 34)) * k - 3 * Math.sin(t * 6 + i) * k;
          const len = (8 + 10 * h2(i, 35)) * k;
          g.moveTo(x, y); g.lineTo(x + len, y + len * 0.05);
        }
        g.stroke();
      }
      g.restore();
    }
    // 雪面闪光：受光处零星的冰晶亮点，平滑明灭；拍点上略亮。被更近的树干挡住的点不画（位置固定，算一次）
    const GLINTS = [];
    for (let i = 0; i < 70; i++) {
      const z = 4.5 + Math.pow(h2(i, 1), 1.3) * 40, x = (h2(i, 2) - 0.5) * z * 1.4, [sx, sy] = P(x, z), r = 1.4 + 7 / z;
      if (sy > H) continue;
      let hid = false;
      for (const [tx, tz, td] of TREES) {
        if (tz >= z) continue;
        const [qx, qy] = P(tx, tz), w = F * td / tz;
        if (sy < qy + r && Math.abs(sx - qx) < w * 0.65 + r) hid = true;
      }
      if (!hid) GLINTS.push({ i, sx, sy, r });
    }
    function drawGlints(g, c, t, be) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const spr = dot('#fff4dc', 0.25);
      for (const q of GLINTS) {
        const ph = t * (0.8 + 1.4 * h2(q.i, 3)) + h2(q.i, 4) * TAU;
        const tw = Math.pow(Math.max(0, Math.sin(ph)), 8);
        const a = tw * (0.5 + 0.4 * be * h2(q.i, 5));
        if (a < 0.02) continue;
        g.globalAlpha = clamp(a);
        g.drawImage(spr, q.sx - q.r, q.sy - q.r, q.r * 2, q.r * 2);
      }
      g.restore();
    }
  })();
})();
