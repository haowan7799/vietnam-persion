/* 第三版镜头组 fg7：e4_redsand（红尘风沙）、f1_snowhut（雪庐笑饮）、f3_pines（雪林足迹）。不含歌词。 */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, h2, hash, rgba, mix, noise1, noise2 } = A;
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
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
  // 建缓存时：先画到临时画布，再带模糊合成进缓存（ctx.filter 只在这里用）
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
  // 柔光圆点贴图
  const dot = (col, core) => K.cache(`fg7dot:${col}:${core}`, 64, 64, 1, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(core, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  // 平滑的阶跃积分：速度从 v0 在 [a, a+d] 内平滑升到 v1 时走过的距离
  const rampDist = (t, a, d, v0, v1) => {
    let r;
    if (t <= a) r = 0;
    else if (t >= a + d) r = d * 0.5 + (t - a - d);
    else { const u = (t - a) / d; r = d * (u * u * u - u * u * u * u / 2); }
    return v0 * t + (v1 - v0) * r;
  };
  const sil = (g, who, pose, x, y, h, t, o) => XYT.sil.draw(g, who, pose, x, y, h, t, o);

  // ============================================================
  // e4_redsand 红尘风沙：黄昏荒原，红色沙墙滚滚逼近，行路人顶风而立，终被吞没
  // ============================================================
  (function () {
    const HOR = 470;                       // 地平线
    const F = 1000, HC = 1.105;            // 透视：焦距（像素）、机位高（米）；人在 z≈8.5 米处高 200 像素
    const SUN = [880, 300], SUNR = 26;
    const FIG = { x: 380, y: 600, h: 200 };
    const WALL_BASE = 484;                 // 远处沙墙的墙脚
    // 远墙前沿（屏幕 x）：越近越快
    const wallX = (t, tW) => { const d = tW - t; return 430 + 62 * d - 2.2 * d * d; };
    // 近处尘幕前沿：比远墙快（视差），「我」字时恰到人物
    const veilX = (t, tW) => { const d = tW - t; return d > 0 ? FIG.x + 92 * d + 3 * d * d : FIG.x - 150 * (-d) - 60 * d * d; };
    const gy = (z) => HOR + F * HC / z;    // 地面深度 z 处的屏幕 y
    const gz = (y) => F * HC / (y - HOR);

    // ---------- 天空 ----------
    const skyLayer = () => K.cache('e4:sky', W, HOR + 40, 0.5, (g) => {
      let gr = g.createLinearGradient(0, 0, 0, HOR + 40);
      gr.addColorStop(0, '#26100c'); gr.addColorStop(0.28, '#45180f'); gr.addColorStop(0.6, '#7e2e1c');
      gr.addColorStop(0.86, '#b44a28'); gr.addColorStop(1, '#c8603a');
      g.fillStyle = gr; g.fillRect(0, 0, W, HOR + 40);
      // 太阳一侧的天光
      gr = g.createRadialGradient(SUN[0], SUN[1], 0, SUN[0], SUN[1], 760);
      gr.addColorStop(0, 'rgba(233,138,74,0.55)'); gr.addColorStop(0.35, 'rgba(194,83,46,0.28)'); gr.addColorStop(1, 'rgba(194,83,46,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, HOR + 40);
      // 高空悬尘：几道很淡的横向尘带
      blurInto(g, W, HOR + 40, 14, (b) => {
        const r = A.rng(4401);
        for (let i = 0; i < 9; i++) {
          const y = 60 + r() * 330, w = 300 + r() * 700, x = r() * W - 200;
          b.fillStyle = rgba(i % 3 ? '#9a3a22' : '#d07040', 0.08 + r() * 0.08);
          b.beginPath(); b.ellipse(x + w / 2, y, w / 2, 6 + r() * 14, 0, 0, TAU); b.fill();
        }
      });
    });
    // ---------- 远处台地（地平线上的低矮方山）----------
    const farLayer = () => K.cache('e4:far', W, 140, 1, (g) => {
      const base = 100; // 缓存内地平线
      blurInto(g, W, 140, 1.2, (b) => {
        // 最远一层：极淡
        const ridge = (seed, hMax, col, flat) => {
          b.fillStyle = col; b.beginPath(); b.moveTo(0, base + 2);
          for (let x = 0; x <= W; x += 4) {
            const n = noise1(x / 180, seed), m = noise1(x / 46, seed + 1);
            // 方山：噪声过阈值就成平顶，边缘是陡坡
            const mesa = smooth((n - 0.52) / 0.08) * (flat + 0.15 * m);
            const hh = hMax * (0.12 + 0.18 * m + mesa);
            b.lineTo(x, base - hh);
          }
          b.lineTo(W, base + 2); b.closePath(); b.fill();
        };
        ridge(51, 38, '#a04a2e', 0.8);
        ridge(77, 24, '#7e3420', 0.9);
        ridge(93, 12, '#5e2618', 0.6);
      });
    });
    // ---------- 地面（龟裂的土地，透视）----------
    const groundLayer = () => K.cache('e4:ground', W, H - HOR + 4, 1, (g) => {
      const oy = HOR - 2;
      g.translate(0, -oy);
      let gr = g.createLinearGradient(0, HOR, 0, H);
      gr.addColorStop(0, '#8a3a24'); gr.addColorStop(0.07, '#6a2a1a'); gr.addColorStop(0.25, '#4a1d13');
      gr.addColorStop(0.6, '#2e140d'); gr.addColorStop(1, '#1c0d09');
      g.fillStyle = gr; g.fillRect(0, HOR - 2, W, H - HOR + 6);
      // 太阳方向的地面反光：远处偏亮
      gr = g.createRadialGradient(SUN[0], HOR, 0, SUN[0], HOR, 700);
      gr.addColorStop(0, 'rgba(210,100,56,0.35)'); gr.addColorStop(1, 'rgba(210,100,56,0)');
      g.fillStyle = gr; g.fillRect(0, HOR - 2, W, H - HOR + 6);
      // 龟裂：在地面上铺一张抖动的网格，投影到屏幕，裂缝沿格边
      const r = A.rng(7307);
      const cell = 1.15, nx = 70, nz = 120;
      const P = [];
      for (let j = 0; j <= nz; j++) {
        const row = [];
        for (let i = 0; i <= nx; i++) {
          const z = 4.2 + j * cell * (1 + j * 0.035), x = (i - nx / 2) * cell * (1 + j * 0.035);
          const jx = (r() - 0.5) * cell * 0.7 * (1 + j * 0.035), jz = (r() - 0.5) * cell * 0.6 * (1 + j * 0.035);
          const zz = z + jz, xx = x + jx;
          row.push([640 + F * xx / zz, gy(zz), zz]);
        }
        P.push(row);
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const p = P[j][i], q = P[j][i + 1], s = P[j + 1][i];
          const z = p[2];
          if (p[1] < HOR + 1) continue;
          const wgt = clamp(5.5 / z, 0.15, 1.4), a = clamp(1.1 - z / 70, 0, 1);
          if (a <= 0.02) continue;
          // 板块顶面：明暗随机（同色系）
          if (j < nz && i < nx) {
            const t = P[j + 1][i + 1];
            const v = r();
            g.fillStyle = v < 0.5 ? `rgba(20,8,5,${0.12 * a})` : `rgba(160,72,40,${0.08 * a})`;
            g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.lineTo(t[0], t[1]); g.lineTo(s[0], s[1]); g.closePath(); g.fill();
          }
          // 裂缝：暗线，迎光一侧（远侧边）一道细亮边
          const seg = (u, w) => {
            const mx = (u[0] + w[0]) / 2 + (r() - 0.5) * 6 * wgt, my = (u[1] + w[1]) / 2 + (r() - 0.5) * 2 * wgt;
            g.strokeStyle = `rgba(14,6,4,${0.75 * a})`; g.lineWidth = 1.8 * wgt + 0.3;
            g.beginPath(); g.moveTo(u[0], u[1]); g.quadraticCurveTo(mx, my, w[0], w[1]); g.stroke();
            g.strokeStyle = `rgba(214,120,72,${0.22 * a})`; g.lineWidth = 0.8 * wgt + 0.2;
            g.beginPath(); g.moveTo(u[0], u[1] - 1.4 * wgt); g.quadraticCurveTo(mx, my - 1.4 * wgt, w[0], w[1] - 1.4 * wgt); g.stroke();
          };
          seg(p, q); seg(p, s);
        }
      }
      // 零星的枯草丛（被风压向左）
      for (let k = 0; k < 26; k++) {
        const z = 9 + Math.pow(r(), 1.6) * 60, x = (r() - 0.5) * z * 1.3;
        const sx = 640 + F * x / z, sy = gy(z), sc = 6 / z;
        if (Math.abs(sx - FIG.x) < 60 && Math.abs(sy - FIG.y) < 40) continue;
        g.strokeStyle = '#1e0d08'; g.lineWidth = Math.max(0.6, 2.4 * sc);
        for (let b = 0; b < 7; b++) {
          const ang = -Math.PI / 2 - 0.25 - (b / 6) * 0.9, L = (18 + r() * 16) * sc * 6;
          g.beginPath(); g.moveTo(sx, sy);
          g.quadraticCurveTo(sx + Math.cos(ang) * L * 0.5, sy + Math.sin(ang) * L * 0.6, sx + Math.cos(ang - 0.35) * L, sy + Math.sin(ang - 0.2) * L * 0.75);
          g.stroke();
        }
      }
    });

    // ---------- 沙墙 ----------
    // 一团菜花状的尘团：先用亮色填满，再把同形向下（背光侧）错开一截用暗色补上——只留迎光（上缘）一道亮边
    function lobes(b, x, y, r, seed, body, rim, off) {
      const rr = A.rng(seed);
      const C = [];
      const n = 5 + Math.floor(rr() * 4);
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI + (rr() - 0.5) * 0.3;
        const d = r * (0.45 + rr() * 0.2);
        C.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, r * (0.42 + rr() * 0.3)]);
      }
      C.push([x, y, r * 0.75]);
      const path = (dx, dy) => { b.beginPath(); for (const [cx, cy, cr] of C) { b.moveTo(cx + dx + cr, cy + dy); b.arc(cx + dx, cy + dy, cr, 0, TAU); } };
      b.fillStyle = rim; path(0, 0); b.fill();
      b.save(); path(0, 0); b.clip();
      b.fillStyle = body; path(off * 0.35, off); b.fill();
      b.restore();
    }
    // 墙体：本地坐标原点在前沿墙脚，向右延伸，顶部约在 -330
    const WB = { x0: -160, y0: -440, w: 1700, h: 500 };
    const topAt = (u) => -318 - 26 * Math.sin(u / 150 + 0.7) - 18 * Math.sin(u / 61 + 2.1);
    const edgeAt = (v) => { const q = clamp(-v / 330); return -48 * Math.pow(Math.sin(Math.PI * Math.min(1, q * 1.15)), 0.7) + 40 * q * q; };
    const wallBody = () => K.cache('e4:wall', WB.w, WB.h, 0.5, (g) => {
      g.translate(-WB.x0, -WB.y0);
      blurInto(g, WB.w, WB.h, 3, (b) => {
        b.translate(-WB.x0, -WB.y0);
        // 底色团块
        b.fillStyle = '#5a2216';
        b.beginPath(); b.moveTo(edgeAt(0), 20);
        for (let v = 0; v >= -330; v -= 10) b.lineTo(edgeAt(v) + 10, v);
        for (let u = 0; u <= WB.w; u += 20) b.lineTo(u, topAt(u) + 30);
        b.lineTo(WB.w + WB.x0, 20); b.closePath(); b.fill();
        const r = A.rng(901);
        // 由后往前：顶部一排大尘团（逆光，上缘亮）
        for (let u = 1500; u >= 20; u -= 46 + r() * 30) {
          const near = clamp(1 - Math.abs(u - (SUN[0] - 650)) / 600);
          lobes(b, u + (r() - 0.5) * 20, topAt(u) + 34 + r() * 12, 52 + r() * 46, 100 + u | 0, mix('#6a2818', '#8a3420', near), mix('#b24c2a', '#f0a060', near * 0.85), 10 + r() * 6);
        }
        // 前沿一列（向左鼓出，上缘亮）
        for (let v = -300; v <= -10; v += 28 + r() * 16) {
          const q = clamp(-v / 330);
          lobes(b, edgeAt(v) + 34 + r() * 10, v + 10, 40 + r() * 30 + q * 20, 300 + v | 0, mix('#4a1c12', '#6e2a1a', q), mix('#8a3a22', '#c45e34', q), 8 + r() * 5);
        }
        // 墙内中段：较暗的翻涌
        for (let k = 0; k < 70; k++) {
          const u = 60 + r() * 1400, v = -40 - r() * 230;
          if (v < topAt(u) + 60) continue;
          const q = clamp(-v / 330);
          lobes(b, u, v, 36 + r() * 40, 600 + k, mix('#3e170f', '#5e2416', q), mix('#5a2216', '#8c3a22', q), 9);
        }
        // 墙脚：贴地的浓尘，最暗
        const gr = b.createLinearGradient(0, -120, 0, 20);
        gr.addColorStop(0, 'rgba(46,18,12,0)'); gr.addColorStop(0.7, 'rgba(46,18,12,0.85)'); gr.addColorStop(1, 'rgba(40,16,10,1)');
        b.fillStyle = gr; b.fillRect(-60, -120, WB.w, 140);
      });
      // 密度：底部实、上部薄（太阳从顶部的薄尘里透出来）
      g.globalCompositeOperation = 'destination-in';
      const gr = g.createLinearGradient(0, -400, 0, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.66)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.86)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = gr; g.fillRect(WB.x0, WB.y0, WB.w, WB.h);
      // 前沿最外缘再软一点
      const g2 = g.createLinearGradient(-110, 0, 40, 0);
      g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = g2; g.fillRect(WB.x0, WB.y0, WB.w, WB.h);
    });
    // 翻卷的尘团（三种外形）
    const puff = (k) => K.cache('e4:puff' + k, 200, 170, 0.5, (g) => {
      blurInto(g, 200, 170, 2.5, (b) => { lobes(b, 100, 105, 62, 50 + k * 17, '#5c2316', '#b5502c', 9); });
    });

    // ---------- 近处尘幕（与人物同一深度及更近，在人物前面）----------
    const VEIL = { w: 1500, h: 560, top: 190 };
    const veilTex = (k) => K.cache('e4:veil' + k, VEIL.w, VEIL.h, 0.5, (g) => {
      blurInto(g, VEIL.w, VEIL.h, 7, (b) => {
        const r = A.rng(1200 + k * 31);
        // 被风拉长的尘团：越往下越浓
        for (let i = 0; i < 260; i++) {
          const u = 40 + Math.pow(r(), 0.8) * (VEIL.w - 40), v = 40 + Math.pow(r(), 0.7) * (VEIL.h - 40);
          const q = v / VEIL.h;
          const lead = smooth((u - 30) / 260);
          const top = 70 + 60 * noise1(u / 140, k + 3);
          if (v < top) continue;
          const a = (0.05 + 0.12 * q) * lead;
          b.fillStyle = rgba(q < 0.35 ? '#a8482a' : q < 0.6 ? '#7a2e1e' : '#4a1c12', a);
          b.beginPath(); b.ellipse(u, v, 50 + r() * 120, 10 + r() * 26 + q * 20, (r() - 0.5) * 0.08, 0, TAU); b.fill();
        }
        // 顶缘逆光亮边
        for (let i = 0; i < 40; i++) {
          const u = 30 + r() * (VEIL.w - 30), top = 70 + 60 * noise1(u / 140, k + 3);
          b.fillStyle = rgba('#e07a44', 0.06 * smooth((u - 30) / 200));
          b.beginPath(); b.ellipse(u, top + 18, 60 + r() * 80, 9 + r() * 8, 0, 0, TAU); b.fill();
        }
        // 贴地最浓
        const gr = b.createLinearGradient(0, VEIL.h * 0.55, 0, VEIL.h);
        gr.addColorStop(0, 'rgba(52,20,13,0)'); gr.addColorStop(1, 'rgba(52,20,13,0.7)');
        b.fillStyle = gr; b.fillRect(0, VEIL.h * 0.55, VEIL.w, VEIL.h);
      });
      // 前沿软边
      g.globalCompositeOperation = 'destination-in';
      const gr = g.createLinearGradient(0, 0, 320, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = gr; g.fillRect(0, 0, VEIL.w, VEIL.h);
    });
    // 贴地沙流：可横向平铺的细纹
    const flowTex = () => K.cache('e4:flow', 512, 48, 1, (g) => {
      const r = A.rng(77);
      blurInto(g, 512, 48, 0.8, (b) => {
        for (let i = 0; i < 46; i++) {
          const y = 6 + r() * 36, x = r() * 512, L = 40 + r() * 160, a = 0.15 + r() * 0.3;
          b.strokeStyle = rgba(r() < 0.5 ? '#d08a5a' : '#b0603a', a); b.lineWidth = 0.6 + r() * 1.4; b.lineCap = 'round';
          for (const ox of [-512, 0, 512]) {
            b.beginPath(); b.moveTo(x + ox, y);
            b.bezierCurveTo(x + ox + L * 0.3, y - 3 * r(), x + ox + L * 0.6, y + 3 * r(), x + ox + L, y + (r() - 0.5) * 3);
            b.stroke();
          }
        }
      });
    });
    // 横向流动的尘雾（平铺）
    const hazeTex = () => K.cache('e4:haze', 1024, 360, 0.5, (g) => {
      blurInto(g, 1024, 360, 10, (b) => {
        const r = A.rng(3131);
        for (let i = 0; i < 120; i++) {
          const x = r() * 1024, y = r() * 360, w = 80 + r() * 260, hh = 8 + r() * 26;
          b.fillStyle = rgba(r() < 0.4 ? '#b04c2a' : '#6a2818', 0.12 + r() * 0.18);
          for (const ox of [-1024, 0, 1024]) { b.beginPath(); b.ellipse(x + ox, y, w, hh, 0, 0, TAU); b.fill(); }
        }
      });
    });
    // 人物的模糊剪影（被尘吞没后叠在尘上）
    const figBlur = () => K.cache('e4:figblur', 240, 260, 0.5, (g) => {
      blurInto(g, 240, 260, 5, (b) => { XYT.sil.draw(b, 'traveler', 'leanSide', 110, 230, FIG.h, 0, { facing: 1, wind: 1, windDir: -1, body: '#1a0c08' }); });
    });
    const sunSpr = () => K.cache('e4:sun', 120, 120, 1, (g) => {
      blurInto(g, 120, 120, 1.6, (b) => {
        const gr = b.createRadialGradient(60, 60, 0, 60, 60, SUNR);
        gr.addColorStop(0, '#ffd8a0'); gr.addColorStop(0.75, '#f6a868'); gr.addColorStop(1, '#e8804a');
        b.fillStyle = gr; b.beginPath(); b.arc(60, 60, SUNR, 0, TAU); b.fill();
      });
    });

    XYT.registerShot('e4_redsand', {
      name: '红尘风沙', zone: 'bottom', night: false, text: '#f6d2a2', shadow: 'rgba(26,12,8,0.92)', accent: '#ff9a52', bloom: 0.22,
      draw(g, c) {
        const t = c.lt, dur = c.dur;
        const tG = CT(c, 7, 3.083), tW = CT(c, 11, 4.763);
        const gust = smooth((t - tG + 0.15) / 0.6);              // 阵风到
        const eng = smooth((t - tW + 0.2) / 1.5);                  // 吞没
        const be = c.be ? c.be(0.32) : 0;
        const appr = easeInOut((t + 0.7) / (dur + 0.7));          // 沙墙逼近 0..1
        // 天空
        g.drawImage(skyLayer(), 0, 0, W, HOR + 40);
        // 太阳：随沙墙逼近变暗变模糊
        const sunA = 1 - 0.45 * appr;
        g.globalAlpha = 0.5 * sunA; g.globalCompositeOperation = 'lighter';
        g.drawImage(dot('#e98a4a', 0.25), SUN[0] - 170, SUN[1] - 170, 340, 340);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = sunA;
        g.drawImage(sunSpr(), SUN[0] - 60, SUN[1] - 60, 120, 120);
        g.globalAlpha = 1;
        // 远处台地
        g.drawImage(farLayer(), 0, HOR - 100, W, 140);
        // 远墙：以墙脚前沿为锚点放大 1.0→1.3
        const wx = wallX(t, tW), ws = 1 + 0.3 * appr;
        const wb = wallBody();
        g.save();
        g.translate(wx, WALL_BASE); g.scale(ws, ws);
        g.drawImage(wb, WB.x0, WB.y0, WB.w, WB.h);
        // 前沿翻卷：尘团沿前沿从墙脚升到墙顶，再向后卷入墙体
        for (let k = 0; k < 13; k++) {
          const T = 5.2 + 1.2 * h2(k, 5), a = ((t + 40) / T + k / 13) % 1;
          const v = -18 - a * 300, u = edgeAt(v) + 30 + 90 * smooth((a - 0.7) / 0.3) + 10 * Math.sin(t * 0.7 + k);
          const sc = 0.55 + 0.6 * a;
          const al = smooth(a / 0.15) * (1 - smooth((a - 0.8) / 0.2)) * 0.9;
          if (al < 0.01) continue;
          g.globalAlpha = al;
          g.drawImage(puff(k % 3), u - 100 * sc, v - 105 * sc, 200 * sc, 170 * sc);
        }
        g.globalAlpha = 1;
        g.restore();
        // 太阳在墙里的前向散射光晕
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = (0.32 + 0.05 * be) * (1 - 0.35 * appr);
        g.drawImage(dot('#d0603a', 0.2), SUN[0] - 230, SUN[1] - 230, 460, 460);
        g.globalAlpha = 0.5 * (1 - 0.5 * appr);
        g.drawImage(sunSpr(), SUN[0] - 60, SUN[1] - 60, 120, 120);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        // 地面
        g.drawImage(groundLayer(), 0, HOR - 2, W, H - HOR + 4);
        // 墙的阴影由远及近盖过地面
        const shY = lerp(HOR + 10, H + 120, smooth((t + 0.5) / (tW + 0.8)));
        let gr = g.createLinearGradient(0, shY - 90, 0, shY + 40);
        gr.addColorStop(0, 'rgba(22,8,5,0.5)'); gr.addColorStop(1, 'rgba(22,8,5,0)');
        g.fillStyle = gr; g.fillRect(0, HOR, W, Math.max(0, shY + 40 - HOR));
        // 贴地沙流：分几条深度带，越近越快越大；阵风后加速
        const ft = flowTex();
        const D = rampDist(t + 1, tG + 1 - 0.2, 0.7, 2.2, 6.5);  // 世界里走过的米数
        for (let i = 0; i < 9; i++) {
          const z = 6 + i * i * 1.6 + i * 2, y = gy(z), k = 8.5 / z;
          const sh = 48 * k * 0.9, a = (0.2 + 0.35 * gust) * clamp(1.2 - z / 90) * (y > 610 ? 0.45 : 1);
          if (y > H + sh) continue;
          const off = ((D * F / z) % (512 * k) + 512 * k) % (512 * k);
          g.globalAlpha = a;
          for (let x = -off; x < W; x += 512 * k) g.drawImage(ft, x, y - sh * 0.8, 512 * k + 1, sh);
        }
        g.globalAlpha = 1;
        // 人物：接触阴影 + 一道很淡的长影（太阳在尘后，影子软而淡）
        const shA = 0.22 * (1 - smooth((t - 0.5) / 3));
        if (shA > 0.01) {
          g.save(); g.translate(FIG.x, FIG.y); g.transform(1, 0, -2.6, 0.38, 0, 0);
          g.globalAlpha = shA; g.drawImage(dot('#120604', 0.4), -30, -150, 60, 150); g.restore();
          g.globalAlpha = 1;
        }
        g.fillStyle = 'rgba(14,6,4,0.55)';
        g.beginPath(); g.ellipse(FIG.x + 4, FIG.y + 1, 46, 6, 0, 0, TAU); g.fill();
        const rimA = 1 - 0.6 * eng;
        sil(g, 'traveler', 'leanSide', FIG.x, FIG.y, FIG.h, c.t, {
          facing: 1, wind: 1, windDir: -1, body: '#22120d', rim: rgba('#f2904e', rimA), rimSide: 1,
        });
        // 近处尘幕：在人物前面，从右向左推进
        const vx = veilX(t, tW);
        const vt = veilTex(0), vt2 = veilTex(1);
        if (vx < W + 40) {
          g.globalAlpha = 0.9;
          g.drawImage(vt, vx - 60, VEIL.top, VEIL.w, VEIL.h);
          g.globalAlpha = 0.6;
          g.drawImage(vt2, vx + 160 - (t + 1) * 34, VEIL.top + 30, VEIL.w, VEIL.h);
          g.globalAlpha = 1;
        }
        // 阵风之后：浮尘横飞
        const hz = hazeTex();
        const hA = 0.12 + 0.25 * gust + 0.4 * eng;
        const hoff = ((rampDist(t + 1, tG + 1 - 0.2, 0.7, 60, 260)) % 1024 + 1024) % 1024;
        g.globalAlpha = hA;
        for (let x = -hoff; x < W; x += 1024) g.drawImage(hz, x, 300, 1024, 360);
        const hoff2 = ((rampDist(t + 1, tG + 1 - 0.2, 0.7, 120, 520)) % 1024 + 1024) % 1024;
        g.globalAlpha = hA * 0.8;
        for (let x = -hoff2; x < W; x += 1024) g.drawImage(hz, x, 420, 1024, 300);
        g.globalAlpha = 1;
        // 沙粒：阵风起后从画右进入，掠过前景
        const nS = 90;
        g.strokeStyle = '#e8a070'; g.lineCap = 'round';
        for (let i = 0; i < nS; i++) {
          const act = tG - 0.1 + h2(i, 11) * 0.7;
          if (t < act) continue;
          const v = 900 + 700 * h2(i, 12), L = W + 300;
          const run = (t - act) * v;
          const x = W + 60 - (run % L);
          const y = 330 + h2(i, 13) * 390 + Math.sin(t * 3 + i) * 6 + (Math.floor(run / L) * 97 % 60);
          const len = 10 + 26 * h2(i, 14);
          g.globalAlpha = (0.25 + 0.35 * h2(i, 15)) * (0.7 + 0.3 * be) * (y > 610 ? 0.5 : 1) * (1 - 0.5 * eng);
          g.lineWidth = 0.8 + 1.2 * h2(i, 16);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y - len * 0.04); g.stroke();
        }
        g.globalAlpha = 1;
        // 吞没：整幅红尘，只剩暗红日轮和模糊人影
        if (eng > 0.001) {
          gr = g.createLinearGradient(0, 0, 0, H);
          gr.addColorStop(0, '#4a1a10'); gr.addColorStop(0.45, '#7a2c1a'); gr.addColorStop(0.75, '#5a2014'); gr.addColorStop(1, '#2c120c');
          g.globalAlpha = 0.82 * eng; g.fillStyle = gr; g.fillRect(0, 0, W, H);
          g.globalAlpha = 0.35 * eng;
          for (let x = -hoff2; x < W; x += 1024) g.drawImage(hz, x, 120, 1024, 600);
          // 日轮：尘里看得见的暗红圆盘
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.2 * eng; g.drawImage(dot('#c0482a', 0.2), SUN[0] - 160, SUN[1] - 160, 320, 320);
          g.globalAlpha = 0.42 * eng; g.drawImage(sunSpr(), SUN[0] - 60, SUN[1] - 60, 120, 120);
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 0.5 * eng; g.drawImage(figBlur(), FIG.x - 110, FIG.y - 230, 240, 260);
          g.globalAlpha = 1;
        }
      },
    });
  })();
})();
