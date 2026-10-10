/* 第三版镜头组 fg2：a2_wallsun, a3_tide, a4_maplepond */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeInOut, h2, rgba, mix, noise1, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;

  // 第 off 句第 k 字的镜头内时间（秒）；没有歌词时用分段表里的时间
  const charLt = (c, k, off, fb) => {
    const v = c.charT ? c.charT(k, off) : null;
    return v == null ? fb[k] : v - (c.t - c.lt);
  };
  const be = (c, d) => (c.be ? c.be(d) : 0);
  const de = (c, d) => (c.de ? c.de(d) : 0);
  const fbm = (x, seed, oct) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += a * (noise1(x * f, seed + i * 17) - 0.5); n += a; a *= 0.5; f *= 2.1; }
    return (s / n) * 2;
  };
  // 柔光贴图（按颜色缓存），alpha 乘以调用方的 globalAlpha
  function glowSpr(col) {
    return K.cache('fg2glow' + col, 128, 128, 1, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.22, rgba(col, 0.6)); gr.addColorStop(0.5, rgba(col, 0.2));
      gr.addColorStop(0.78, rgba(col, 0.05)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }
  function glowAt(g, x, y, rx, ry, col, a) {
    if (!(a > 0.002)) return;
    const o = g.globalAlpha;
    g.globalAlpha = o * Math.min(1, a);
    g.drawImage(glowSpr(col), x - rx, y - ry, rx * 2, ry * 2);
    g.globalAlpha = o;
  }
  // 在缓存里画模糊层（ctx.filter 只在建缓存时用）
  function blurInto(g, w, h, blur, fn, alpha, op) {
    const t = document.createElement('canvas');
    const m = g.getTransform(), sc = m.a;
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

  // ============================================================
  // a2_wallsun：落日压在马头墙脊上，墙下旧门前石阶坐着白发人
  // ============================================================
  (function () {
    const FB1 = [0.251, 0.591, 1.031, 1.451, 1.871, 2.231];
    const FB2 = [2.791, 3.111, 3.511, 3.891, 4.291, 4.851, 5.211, 5.631];
    const RIDGE = 382, CAP = 18;
    // 右侧山墙三叠马头：[x0, x1, 顶]
    const STEPS = [[872, 990, 292], [990, 1100, 188], [1100, 1340, 82]];
    const BASE = 709, GROUND = 715, T1 = 667, T2 = 691;
    const DOOR = { x0: 300, x1: 420, top: 461 };
    const SUN = { x: 560, y: 384, r: 80 };
    const MAN = { x: 452, y: T1, h: 172 };
    const WX0 = -40, WY0 = 30, WW = 1380, WH = 790;
    const PAL = { sun: '#f9e6b8', gold: '#f6c27a', orange: '#e48a3c', red: '#b8483a', wall: '#5b4a63', ink: '#2a2530' };

    // 天空：上暗紫红，下近墙脊处金黄；横向拉长的日晕
    function paintSky(g) {
      const gr = g.createLinearGradient(0, 0, 0, 420);
      gr.addColorStop(0, '#5f4560'); gr.addColorStop(0.2, '#874b5a'); gr.addColorStop(0.45, '#c0604a');
      gr.addColorStop(0.7, '#e48c48'); gr.addColorStop(0.88, '#f3b468'); gr.addColorStop(1, '#f8d090');
      g.fillStyle = gr; g.fillRect(-40, 0, 1400, 420);
      // 日晕：太阳周围横向的暖光
      g.save();
      g.translate(SUN.x + 40, SUN.y); g.scale(2.4, 1);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 340);
      rg.addColorStop(0, 'rgba(255,236,190,0.85)'); rg.addColorStop(0.28, 'rgba(250,200,130,0.42)');
      rg.addColorStop(0.62, 'rgba(232,140,80,0.12)'); rg.addColorStop(1, 'rgba(232,140,80,0)');
      g.fillStyle = rg; g.fillRect(-600, -420, 1200, 840);
      g.restore();
    }
    // 晚霞：细长的层云，底面被落日照亮，上缘偏紫（单独缓存，极慢向左飘）
    function paintClouds(g) {
      const r = rng(23);
      const bands = [[300, 170, 380, 8], [690, 142, 300, 6], [150, 236, 280, 7], [600, 252, 360, 5], [470, 110, 260, 4], [900, 200, 180, 5], [820, 284, 200, 4]];
      blurInto(g, 1400, 330, 2.2, (cg) => {
        cg.translate(40, 0);
        for (const [x, y, w, h] of bands) {
          const d = clamp(Math.abs(x - SUN.x) / 620);
          for (let k = 0; k < 9; k++) {
            const u = (k / 8 - 0.5);
            const ox = u * w * 0.8 + (r() - 0.5) * 30, oy = (r() - 0.5) * h * 0.9 + u * u * h * 1.2;
            const ww = w * (0.18 + r() * 0.3), hh = h * (0.45 + r() * 0.5);
            cg.fillStyle = rgba(mix('#d98a6e', '#86506a', d), 0.5);
            cg.beginPath(); cg.ellipse(x + ox, y + oy - hh * 0.2, ww / 2, hh / 2, 0, 0, TAU); cg.fill();
            cg.fillStyle = rgba(mix('#ffe2a8', '#f0a06e', d), 0.6);
            cg.beginPath(); cg.ellipse(x + ox, y + oy + hh * 0.22, ww * 0.44, hh * 0.2, 0, 0, TAU); cg.fill();
          }
        }
      });
    }
    // 墙后远景：远处一道雾化的马头墙与几团树冠
    function paintFar(g) {
      blurInto(g, 1400, 440, 1.2, (fg) => {
        fg.translate(40, 0);
        const far = rgba('#b4706a', 0.5);
        fg.fillStyle = far;
        fg.beginPath();
        fg.moveTo(-40, RIDGE + 6); fg.lineTo(-40, 352); fg.lineTo(64, 352); fg.lineTo(64, 340); fg.lineTo(150, 340); fg.lineTo(150, 358); fg.lineTo(270, 358); fg.lineTo(270, RIDGE + 6);
        fg.closePath(); fg.fill();
        fg.fillStyle = rgba('#8a5262', 0.5);
        fg.fillRect(-40, 349, 108, 4); fg.fillRect(60, 337, 94, 4); fg.fillRect(146, 355, 128, 4);
        // 马头翘角
        fg.beginPath(); fg.moveTo(60, 341); fg.quadraticCurveTo(54, 336, 50, 331); fg.lineTo(66, 337); fg.fill();
        fg.beginPath(); fg.moveTo(146, 359); fg.quadraticCurveTo(140, 354, 136, 349); fg.lineTo(152, 355); fg.fill();
        // 远树：不规则的树冠轮廓
        const tree = (cx, by, w, h, seed, col) => {
          fg.fillStyle = col;
          fg.beginPath();
          const n = 40;
          for (let i = 0; i <= n; i++) {
            const u = i / n, x = cx - w / 2 + u * w;
            const env = Math.pow(Math.sin(Math.PI * u), 0.7);
            const y = by - h * env * (0.78 + 0.22 * noise1(u * 9, seed)) - 4 * (noise1(u * 23, seed + 3) - 0.5) * env;
            i ? fg.lineTo(x, y) : fg.moveTo(x, y);
          }
          fg.lineTo(cx + w / 2, by + 6); fg.lineTo(cx - w / 2, by + 6); fg.closePath(); fg.fill();
        };
        tree(760, RIDGE + 2, 150, 34, 4, rgba('#a3626a', 0.45));
        tree(700, RIDGE + 2, 70, 20, 9, rgba('#a3626a', 0.4));
        tree(830, RIDGE + 2, 90, 26, 13, rgba('#955a66', 0.5));
        tree(330, RIDGE + 2, 90, 18, 17, rgba('#a3626a', 0.38));
      });
    }
    const capTop = (x) => (x < STEPS[0][0] ? RIDGE : x < STEPS[1][0] ? STEPS[0][2] : x < STEPS[2][0] ? STEPS[1][2] : STEPS[2][2]);
    // 墙帽：脊、瓦面、瓦当滴水；leftHead 为马头翘角
    function capBand(g, x0, x1, top, leftHead) {
      const ink = '#272130';
      const sh = g.createLinearGradient(0, top + CAP, 0, top + CAP + 16);
      sh.addColorStop(0, 'rgba(16,10,22,0.5)'); sh.addColorStop(1, 'rgba(16,10,22,0)');
      g.fillStyle = sh; g.fillRect(x0, top + CAP, x1 - x0, 16);
      g.fillStyle = '#383040'; g.fillRect(x0 - 6, top + 4, x1 - x0 + 12, 9);
      g.fillStyle = 'rgba(28,22,34,0.8)';
      for (let x = x0 - 4; x < x1 + 6; x += 7) g.fillRect(x, top + 4, 2.2, 9);
      g.fillStyle = 'rgba(120,104,124,0.28)';
      for (let x = x0 - 1; x < x1 + 6; x += 7) g.fillRect(x, top + 5, 1.2, 7);
      g.fillStyle = ink; g.fillRect(x0 - 8, top, x1 - x0 + 16, 4.5);
      g.fillStyle = '#2d2634';
      g.fillRect(x0 - 7, top + 12, x1 - x0 + 14, 3);
      for (let x = x0 - 3; x < x1 + 6; x += 7) { g.beginPath(); g.arc(x + 1, top + 15, 2.8, 0, Math.PI); g.fill(); }
      if (leftHead) {
        g.fillStyle = ink;
        g.beginPath();
        g.moveTo(x0 + 22, top + 4);
        g.lineTo(x0 + 22, top - 5);
        g.quadraticCurveTo(x0 + 4, top - 6, x0 - 6, top - 13);
        g.quadraticCurveTo(x0 - 13, top - 16, x0 - 16, top - 12);
        g.quadraticCurveTo(x0 - 12, top - 2, x0 - 9, top + 6);
        g.lineTo(x0 - 9, top + 16);
        g.lineTo(x0 + 2, top + 16);
        g.closePath(); g.fill();
      }
    }
    // 金色轮廓光：沿墙帽顶边，离太阳越近越亮
    function rimLine(g, x0, x1, y, w, a0) {
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      for (let k = 0; k <= 10; k++) {
        const x = x0 + ((x1 - x0) * k) / 10;
        const a = a0 * (0.25 + 0.9 * Math.exp(-Math.abs(x - SUN.x) / 260));
        gr.addColorStop(k / 10, `rgba(255,214,150,${Math.min(1, a).toFixed(3)})`);
      }
      g.fillStyle = gr; g.fillRect(x0, y - w * 0.5, x1 - x0, w);
    }
    function wallShape(g) {
      g.beginPath();
      g.moveTo(-40, BASE); g.lineTo(-40, RIDGE + 10); g.lineTo(STEPS[0][0], RIDGE + 10);
      g.lineTo(STEPS[0][0], STEPS[0][2] + 10); g.lineTo(STEPS[1][0], STEPS[0][2] + 10);
      g.lineTo(STEPS[1][0], STEPS[1][2] + 10); g.lineTo(STEPS[2][0], STEPS[1][2] + 10);
      g.lineTo(STEPS[2][0], STEPS[2][2] + 10); g.lineTo(1340, STEPS[2][2] + 10); g.lineTo(1340, BASE);
      g.closePath();
    }
    function paintWall(g) {
      g.translate(-WX0, -WY0);
      // 粉墙在背光里：灰紫，上部受天光略亮，近地面渐暗
      const wg = g.createLinearGradient(0, 80, 0, BASE);
      wg.addColorStop(0, '#564b60'); wg.addColorStop(0.45, '#4a4056'); wg.addColorStop(0.8, '#3c3448'); wg.addColorStop(1, '#2f283a');
      wallShape(g); g.fillStyle = wg; g.fill();
      g.save(); wallShape(g); g.clip();
      // 大块斑驳：低对比的冷暖水渍
      const r = rng(57);
      blurInto(g, WW, WH, 18, (bg) => {
        bg.translate(-WX0, -WY0);
        for (let i = 0; i < 40; i++) {
          const x = -20 + r() * 1360, y = 100 + r() * 600, rx = 40 + r() * 110, ry = 20 + r() * 60;
          bg.fillStyle = r() < 0.55 ? 'rgba(26,18,34,0.13)' : 'rgba(150,132,160,0.07)';
          bg.beginPath(); bg.ellipse(x, y, rx, ry, 0, 0, TAU); bg.fill();
        }
      });
      // 帽下雨痕：细长竖向水渍
      for (let i = 0; i < 200; i++) {
        const x = -30 + r() * 1370;
        const top = capTop(x) + CAP;
        const len = 20 + r() * 150 * (0.4 + r());
        const lg = g.createLinearGradient(0, top, 0, top + len);
        const a = 0.04 + r() * 0.08;
        lg.addColorStop(0, `rgba(24,18,32,${a})`); lg.addColorStop(1, 'rgba(24,18,32,0)');
        g.fillStyle = lg; g.fillRect(x, top, 1.5 + r() * 6, len);
      }
      // 墙根返潮：近地面更深的潮痕
      blurInto(g, WW, WH, 6, (bg) => {
        bg.translate(-WX0, -WY0);
        bg.fillStyle = 'rgba(30,24,36,0.35)';
        bg.beginPath(); bg.moveTo(-40, BASE);
        for (let x = -40; x <= 1340; x += 10) bg.lineTo(x, BASE - 34 - 18 * noise1(x / 70, 8) - 8 * noise1(x / 17, 9));
        bg.lineTo(1340, BASE); bg.closePath(); bg.fill();
      });
      g.restore();
      // 山墙与院墙交接处的竖缝（墙角）
      g.fillStyle = 'rgba(22,16,28,0.4)'; g.fillRect(STEPS[0][0] - 2, STEPS[0][2] + CAP, 3, BASE - STEPS[0][2] - CAP);
      g.fillStyle = 'rgba(140,124,150,0.12)'; g.fillRect(STEPS[0][0] + 1, STEPS[0][2] + CAP, 2, BASE - STEPS[0][2] - CAP);
      // 勒脚石
      g.fillStyle = '#373040'; g.fillRect(-40, BASE - 30, 1380, 30);
      g.strokeStyle = 'rgba(18,12,24,0.55)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-40, BASE - 29.5); g.lineTo(1340, BASE - 29.5); g.moveTo(-40, BASE - 14.5); g.lineTo(1340, BASE - 14.5);
      for (let x = -30, k = 0; x < 1340; x += 52 + (k % 3) * 9, k++) { g.moveTo(x, BASE - 29); g.lineTo(x, BASE - 15); g.moveTo(x + 26, BASE - 14); g.lineTo(x + 26, BASE); }
      g.stroke();
      g.fillStyle = 'rgba(120,108,130,0.16)'; g.fillRect(-40, BASE - 30, 1380, 1.4);
      // 墙帽
      capBand(g, -40, STEPS[0][0], RIDGE, false);
      for (let i = 0; i < 3; i++) capBand(g, STEPS[i][0], STEPS[i][1] + (i === 2 ? 0 : 8), STEPS[i][2], true);
      // 轮廓光：墙脊与马头顶边；山墙各叠朝太阳一侧的竖边
      rimLine(g, -40, STEPS[0][0] + 8, RIDGE + 0.6, 1.6, 0.95);
      for (const [x0, x1, top] of STEPS) {
        rimLine(g, x0 - 8, x1 + 8, top + 0.6, 1.3, 0.75);
        g.strokeStyle = 'rgba(255,214,150,0.65)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(x0 + 22, top - 5); g.quadraticCurveTo(x0 + 4, top - 6, x0 - 6, top - 13); g.quadraticCurveTo(x0 - 13, top - 16, x0 - 16, top - 12); g.stroke();
        const vg = g.createLinearGradient(0, top + CAP, 0, top + CAP + 60);
        vg.addColorStop(0, 'rgba(255,200,140,0.32)'); vg.addColorStop(1, 'rgba(255,200,140,0)');
        g.fillStyle = vg; g.fillRect(x0, top + CAP, 1.4, 60);
      }
      // 巷子青石板地
      const lg = g.createLinearGradient(0, BASE, 0, 820);
      lg.addColorStop(0, '#2b2531'); lg.addColorStop(1, '#1f1a25');
      g.fillStyle = lg; g.fillRect(-40, BASE, 1380, 820 - BASE);
      g.fillStyle = 'rgba(96,84,106,0.16)'; g.fillRect(-40, BASE, 1380, 1.2);
      g.strokeStyle = 'rgba(12,8,16,0.55)'; g.lineWidth = 1;
      g.beginPath();
      const rows = [BASE, 730, 750, 776, 808];
      const rs = rng(5);
      for (let k = 1; k < rows.length; k++) { g.moveTo(-40, rows[k] + 0.5); g.lineTo(1340, rows[k] + 0.5); }
      for (let k = 0; k < rows.length - 1; k++) {
        const sp = 60 + k * 22;
        for (let x = -30 + rs() * sp; x < 1340; x += sp * (0.8 + rs() * 0.5)) { const lean = (x - 640) * 0.04 * (k + 1) / 4; g.moveTo(x, rows[k] + 1); g.lineTo(x + lean, rows[k + 1]); }
      }
      g.stroke();
      g.fillStyle = 'rgba(110,96,120,0.07)';
      for (let k = 1; k < rows.length; k++) g.fillRect(-40, rows[k] + 1.5, 1380, 1);
      paintDoor(g);
      paintSteps(g);
      // 墙根小草（微微向左倒，顺风）
      const rg = rng(91);
      for (const [cx, n] of [[60, 9], [210, 6], [580, 7], [720, 5], [960, 8], [1240, 6]]) {
        for (let i = 0; i < n; i++) {
          const x = cx + (rg() - 0.5) * 34, hh = 6 + rg() * 12, lean = -2 - rg() * 4;
          g.strokeStyle = rgba(mix('#262b24', '#45453a', rg()), 0.85); g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x, BASE + 1); g.quadraticCurveTo(x + lean * 0.3, BASE - hh * 0.6, x + lean, BASE - hh); g.stroke();
        }
      }
    }
    function paintDoor(g) {
      const { x0, x1, top } = DOOR;
      // 门洞阴影与石门框
      g.fillStyle = 'rgba(18,12,24,0.35)'; g.fillRect(x0 - 4, top - 2, x1 - x0 + 8, T1 - top + 2);
      const fg = g.createLinearGradient(0, top, 0, T1);
      fg.addColorStop(0, '#665c6e'); fg.addColorStop(1, '#544b5d');
      g.fillStyle = fg; g.fillRect(x0, top, x1 - x0, T1 - top);
      g.fillStyle = 'rgba(30,22,38,0.35)';
      g.fillRect(x0, top, 2, T1 - top); g.fillRect(x1 - 2, top, 2, T1 - top);
      g.fillStyle = 'rgba(160,146,170,0.18)'; g.fillRect(x0 + 2, top, x1 - x0 - 4, 1.5);
      // 门扇（凹进门框，上沿有一条阴影）
      const lx0 = x0 + 12, lx1 = x1 - 12, ly0 = top + 14;
      const dg = g.createLinearGradient(0, ly0, 0, T1);
      dg.addColorStop(0, '#3c2b2a'); dg.addColorStop(1, '#2a1f1f');
      g.fillStyle = dg; g.fillRect(lx0, ly0, lx1 - lx0, T1 - ly0);
      g.fillStyle = 'rgba(10,6,8,0.5)'; g.fillRect(lx0, ly0, lx1 - lx0, 4);
      g.fillStyle = 'rgba(18,10,10,0.55)';
      for (let x = lx0 + 12; x < lx1 - 4; x += 12) g.fillRect(x, ly0, 1, T1 - ly0);
      g.fillStyle = 'rgba(14,8,8,0.8)'; g.fillRect((lx0 + lx1) / 2 - 1, ly0, 2, T1 - ly0);
      // 木纹微光
      g.fillStyle = 'rgba(120,86,70,0.08)';
      for (let x = lx0 + 5; x < lx1; x += 12) g.fillRect(x, ly0 + 6, 1, T1 - ly0 - 12);
      // 褪色的旧红纸（无字）
      g.fillStyle = 'rgba(146,60,50,0.2)';
      g.fillRect(lx0 + 9, ly0 + 24, 28, 60); g.fillRect(lx1 - 37, ly0 + 24, 28, 60);
      g.fillStyle = 'rgba(30,20,20,0.22)'; g.fillRect(lx0 + 9, ly0 + 64, 13, 20);
      // 门环
      const ry = ly0 + 98;
      g.strokeStyle = '#1a1214'; g.lineWidth = 1.8;
      for (const x of [(lx0 + lx1) / 2 - 8, (lx0 + lx1) / 2 + 8]) { g.beginPath(); g.arc(x, ry + 6, 5, 0, TAU); g.stroke(); g.fillStyle = '#1a1214'; g.fillRect(x - 2, ry - 2, 4, 4); }
      // 门罩：小瓦檐与两只托木
      g.fillStyle = 'rgba(16,10,22,0.45)'; g.fillRect(x0 - 12, top - 2, x1 - x0 + 24, 9);
      g.fillStyle = '#2a2330';
      g.fillRect(x0 - 2, top - 10, 9, 13); g.fillRect(x1 - 7, top - 10, 9, 13);
      const ex0 = x0 - 20, ex1 = x1 + 20, et = top - 28;
      g.fillStyle = '#383040'; g.fillRect(ex0, et + 4, ex1 - ex0, 9);
      g.fillStyle = 'rgba(28,22,34,0.8)';
      for (let x = ex0 + 2; x < ex1; x += 6) g.fillRect(x, et + 4, 2, 9);
      g.fillStyle = '#272130';
      g.beginPath();
      g.moveTo(ex0 - 9, et - 5); g.quadraticCurveTo(ex0 + 6, et + 1, ex0 + 20, et); g.lineTo(ex1 - 20, et);
      g.quadraticCurveTo(ex1 - 6, et + 1, ex1 + 9, et - 5); g.lineTo(ex1 + 4, et + 4); g.lineTo(ex0 - 4, et + 4); g.closePath(); g.fill();
      g.fillStyle = '#2d2634'; g.fillRect(ex0 - 2, et + 12, ex1 - ex0 + 4, 3);
      for (let x = ex0; x < ex1 + 2; x += 6) { g.beginPath(); g.arc(x + 1, et + 15, 2.4, 0, Math.PI); g.fill(); }
      const sh = g.createLinearGradient(0, et + 17, 0, et + 30);
      sh.addColorStop(0, 'rgba(16,10,22,0.4)'); sh.addColorStop(1, 'rgba(16,10,22,0)');
      g.fillStyle = sh; g.fillRect(ex0, et + 17, ex1 - ex0, 13);
    }
    const STEP_X = [[242, 478], [230, 478]];
    function paintSteps(g) {
      const step = (x0, x1, y0, y1, seed) => {
        const sg = g.createLinearGradient(0, y0, 0, y1);
        sg.addColorStop(0, '#524a5b'); sg.addColorStop(1, '#40384a');
        g.fillStyle = sg; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.fillStyle = '#6a6274'; g.fillRect(x0, y0, x1 - x0, 3);
        g.fillStyle = 'rgba(150,140,160,0.25)'; g.fillRect(x0 + 2, y0, x1 - x0 - 4, 1);
        g.fillStyle = 'rgba(18,12,24,0.45)'; g.fillRect(x0, y1 - 2, x1 - x0, 2);
        const r = rng(seed);
        g.strokeStyle = 'rgba(22,16,28,0.5)'; g.lineWidth = 1;
        g.beginPath();
        for (let x = x0 + 60 + r() * 30; x < x1 - 30; x += 80 + r() * 50) { g.moveTo(x, y0 + 3); g.lineTo(x + (r() - 0.5) * 3, y1 - 1); }
        g.stroke();
        g.strokeStyle = 'rgba(22,16,28,0.3)';
        g.beginPath(); const cx = x0 + 30 + r() * (x1 - x0 - 60); g.moveTo(cx, y0 + 4); g.lineTo(cx + 6, y0 + 10); g.lineTo(cx + 4, y0 + 16); g.stroke();
        // 磨损的棱角
        g.fillStyle = 'rgba(18,12,24,0.35)'; g.fillRect(x0, y0, 2, y1 - y0); g.fillRect(x1 - 2, y0, 2, y1 - y0);
        g.fillStyle = 'rgba(60,52,70,0.6)'; g.beginPath(); g.arc(x0 + 1, y0 + 1, 2.5, 0, TAU); g.arc(x1 - 1, y0 + 1, 2.5, 0, TAU); g.fill();
        // 右端侧面：镜头在台阶右侧，能看到一窄条背光的端面
        g.fillStyle = '#2f2837';
        g.beginPath(); g.moveTo(x1, y0); g.lineTo(x1 + 4, y0 - 2.5); g.lineTo(x1 + 4, y1 - 2.5); g.lineTo(x1, y1); g.closePath(); g.fill();
      };
      g.fillStyle = 'rgba(16,10,22,0.4)'; g.fillRect(STEP_X[0][0] - 2, T1 - 5, STEP_X[0][1] - STEP_X[0][0] + 6, 5);
      step(STEP_X[0][0], STEP_X[0][1], T1, T2, 3);
      step(STEP_X[1][0], STEP_X[1][1], T2, GROUND, 4);
      g.fillStyle = 'rgba(16,10,22,0.45)'; g.fillRect(STEP_X[1][0] - 6, GROUND, STEP_X[1][1] - STEP_X[1][0] + 10, 3);
      // 苔点
      g.fillStyle = 'rgba(66,76,56,0.35)';
      for (const [x, y] of [[STEP_X[0][0] + 4, T2 - 3], [STEP_X[1][0] + 5, GROUND - 4], [STEP_X[1][1] - 6, GROUND - 3], [STEP_X[0][1] - 5, T2 - 4]]) { g.beginPath(); g.ellipse(x, y, 7, 2.5, 0, 0, TAU); g.fill(); }
    }

    // 柿子枝：从左上画外伸入，逆光，枝条下缘带金边
    const BR_ORIGIN = [-30, 52];
    const BRANCHES = [
      { pts: [[-30, 46], [50, 60], [140, 84], [230, 104], [318, 126], [402, 158]], w0: 15, w1: 3 },
      { pts: [[140, 84], [182, 58], [232, 40], [286, 30]], w0: 6, w1: 1.6 },
      { pts: [[230, 104], [252, 140], [272, 172], [292, 196]], w0: 5, w1: 1.5 },
      { pts: [[50, 60], [76, 98], [96, 130], [108, 150]], w0: 6, w1: 1.5 },
      { pts: [[318, 126], [356, 112], [396, 106], [432, 104]], w0: 4.5, w1: 1.3 },
      { pts: [[182, 58], [196, 30], [206, 12]], w0: 3, w1: 1.2 },
      { pts: [[96, 130], [126, 140], [150, 160]], w0: 2.6, w1: 1.1 },
    ];
    // 柿子：[挂点 x, y, 半径, 柄长]
    const FRUITS = [[108, 150, 14, 7], [150, 160, 12, 6], [214, 100, 15, 8], [292, 196, 14, 7], [362, 140, 13, 6], [402, 158, 12, 6], [286, 30, 11, 6], [432, 104, 11, 5]];
    const LEAVES = [[70, 76, 0.9, 14], [168, 70, -0.6, 12], [258, 112, 1.3, 13], [340, 120, -0.3, 11], [120, 136, 2.2, 10], [244, 36, -1.1, 11], [380, 106, 0.5, 10], [30, 56, 1.8, 12]];
    function tube(g, pts, w0, w1) {
      // 由折线生成两侧轮廓的锥形枝条
      const L = [], R = [];
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        let dx = q[0] - o[0], dy = q[1] - o[1];
        const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const w = lerp(w0, w1, i / (n - 1)) / 2;
        L.push([p[0] - dy * w, p[1] + dx * w]); R.push([p[0] + dy * w, p[1] - dx * w]);
      }
      g.beginPath();
      g.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < n; i++) { const a = L[i - 1], b = L[i]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
      g.lineTo(L[n - 1][0], L[n - 1][1]);
      g.lineTo(R[n - 1][0], R[n - 1][1]);
      for (let i = n - 2; i >= 0; i--) { const a = R[i + 1], b = R[i]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
      g.lineTo(R[0][0], R[0][1]);
      g.closePath();
    }
    function leafPath(g, x, y, ang, len) {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(len * 0.3, -len * 0.32, len * 0.8, -len * 0.26, len, 0);
      g.bezierCurveTo(len * 0.8, len * 0.26, len * 0.3, len * 0.32, 0, 0);
      g.restore();
    }
    function paintBranch(g) {
      g.translate(40, 20);
      const all = (fn) => { for (const b of BRANCHES) { tube(g, b.pts, b.w0, b.w1); fn(); } };
      // 轮廓光：先画向光偏移的金色，再画深色本体
      g.save(); g.translate(1.4, 1.6); g.fillStyle = 'rgba(255,196,120,0.9)'; all(() => g.fill()); g.restore();
      g.fillStyle = '#2a1f26'; all(() => g.fill());
      // 树皮暗纹
      g.strokeStyle = 'rgba(70,50,56,0.5)'; g.lineWidth = 1;
      const b0 = BRANCHES[0].pts;
      g.beginPath(); for (let i = 0; i < b0.length; i++) i ? g.lineTo(b0[i][0], b0[i][1] - 2) : g.moveTo(b0[i][0], b0[i][1] - 2); g.stroke();
      // 残叶
      for (const [x, y, a, l] of LEAVES) {
        g.save(); g.translate(1.2, 1.2); g.fillStyle = 'rgba(255,170,100,0.85)'; leafPath(g, x, y, a, l); g.fill(); g.restore();
        g.fillStyle = '#3a2224'; leafPath(g, x, y, a, l); g.fill();
        g.fillStyle = 'rgba(190,80,50,0.35)'; leafPath(g, x + 1, y + 1, a, l * 0.8); g.fill();
      }
    }
    function drawFruit(g, x, y, r, ang, glowK) {
      g.save(); g.translate(x, y); g.rotate(ang);
      const cy = r * 0.92;
      // 果身：逆光透亮，中心橙、边缘深红，向光（右下）一侧亮边
      const fg = g.createRadialGradient(r * 0.25, cy + r * 0.2, r * 0.1, 0, cy, r * 1.05);
      fg.addColorStop(0, mix('#ffb45a', '#ffd38a', glowK)); fg.addColorStop(0.55, '#e8792e'); fg.addColorStop(1, '#a53a2c');
      g.fillStyle = fg;
      g.beginPath(); g.ellipse(0, cy, r, r * 0.86, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,224,160,0.85)'; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(0, cy, r - 0.6, r * 0.86 - 0.6, 0, -0.2, 1.5); g.stroke();
      // 果蒂
      g.fillStyle = '#2a1f26';
      g.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + (k - 1.5) * 0.62;
        g.lineTo(Math.cos(a) * r * 0.62, cy - r * 0.62 + Math.sin(a) * r * 0.2 + r * 0.12);
        g.lineTo(Math.cos(a + 0.31) * r * 0.2, cy - r * 0.8);
      }
      g.closePath(); g.fill();
      g.fillRect(-1, -1, 2, cy - r * 0.7);
      g.restore();
    }

    // 落日的光芒：几道很淡的放射光束（缓存），只在天空里，被墙挡住下半
    function paintRays(g) {
      g.translate(40, 0);
      const r = rng(13);
      const L = 560;
      for (let i = 0; i < 11; i++) {
        const a = -Math.PI * (0.1 + 0.8 * (i + 0.5 * r()) / 11), w = 0.035 + 0.05 * r();
        const gr = g.createRadialGradient(SUN.x, SUN.y, SUN.r * 0.8, SUN.x, SUN.y, L * (0.7 + 0.4 * r()));
        const a0 = 0.11 + 0.08 * r();
        gr.addColorStop(0, `rgba(255,232,180,${a0.toFixed(3)})`); gr.addColorStop(0.4, `rgba(255,214,150,${(a0 * 0.45).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,214,150,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(SUN.x, SUN.y);
        g.arc(SUN.x, SUN.y, L * 1.2, a - w, a + w); g.closePath(); g.fill();
      }
    }

    // 墙脊枯草：逆光里的几簇细草，顺风（向左）轻摆，叶缘带金光
    const TUFTS = [[300, 9, 15, 1], [352, 6, 11, 2], [606, 11, 19, 3], [634, 6, 12, 4], [714, 9, 16, 5], [782, 7, 13, 6], [168, 8, 13, 7], [470, 5, 10, 8]];
    function drawTufts(g, t) {
      const y0 = RIDGE + 1.5;
      for (const [cx, n, hh, seed] of TUFTS) {
        const near = Math.exp(-Math.abs(cx - SUN.x) / 140);
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < n; i++) {
            const k = seed * 31 + i;
            const x = cx + (h2(k, 1) - 0.5) * 12, len = hh * (0.5 + 0.6 * h2(k, 2));
            // 扇形散开，整体顺风向左偏；梢部弯得多、根部直
            const fan = (i / Math.max(1, n - 1) - 0.5) * 0.9 + (h2(k, 4) - 0.5) * 0.2;
            const sw = 0.05 * Math.sin(TAU * t * (0.5 + 0.35 * h2(k, 5)) + k) + 0.025 * Math.sin(TAU * t * 1.05 + k * 2.3);
            const a = fan - 0.22 + sw;
            const mx = x + Math.sin(a * 0.45) * len * 0.5, my = y0 - Math.cos(a * 0.45) * len * 0.5;
            const tx = mx + Math.sin(a * 1.25) * len * 0.5, ty = my - Math.cos(a * 1.25) * len * 0.5;
            if (pass === 0) { g.strokeStyle = rgba('#ffd9a0', 0.3 + 0.55 * near); g.lineWidth = 2.1; }
            else { g.strokeStyle = '#2a2230'; g.lineWidth = 1.1; }
            g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(mx, my, tx, ty); g.stroke();
            // 少数草穗：梢头一粒细长的穗，逆光发亮
            if (h2(k, 6) < 0.35) {
              const pa = a * 1.4;
              g.save(); g.translate(tx, ty); g.rotate(pa);
              g.fillStyle = pass === 0 ? rgba('#ffe0aa', 0.45 + 0.5 * near) : 'rgba(60,44,50,0.9)';
              g.beginPath(); g.ellipse(0, -3, pass === 0 ? 2.2 : 1.3, pass === 0 ? 4.6 : 3.6, 0, 0, TAU); g.fill();
              g.restore();
            }
          }
        }
      }
    }

    XYT.registerShot('a2_wallsun', {
      name: '\u5915\u9633\u5899\u5934', zone: 'right', night: false, text: '#f8e7c4', shadow: 'rgba(36,22,38,0.88)', accent: '#f4a64e', bloom: 0.3,
      draw(g, c) {
        const t = c.lt;
        const tGua = charLt(c, 0, 1, FB2), tDe = charLt(c, 6, 1, FB2);
        // 镜头：起幅先下移 8px（脚不贴画框下缘），第4句第1字起再缓缓下移 48px（峰值约 30px/s），并 1.00→1.03 缓推，第7字停住
        const e = smooth((t - tGua) / Math.max(0.5, tDe - tGua));
        const dy = 8 + 48 * e, z = 1 + 0.03 * e;
        g.save();
        g.translate(640, 360); g.scale(z, z); g.translate(-640, -360 - dy);
        // 天空、光芒、墙后远景（静止，一张缓存）；晚霞极慢向左飘
        const base = K.cache('a2base', 1400, 440, 1, (bg) => {
          bg.save(); paintSky(bg); bg.restore();
          bg.save(); blurInto(bg, 1400, 420, 6, paintRays, 1, 'screen'); bg.restore();
          bg.save(); paintFar(bg); bg.restore();
        });
        g.drawImage(base, -40, 0, 1400, 440);
        g.drawImage(K.cache('a2cloud', 1400, 330, 1, paintClouds), -40 - 3 * (t + 1), 0, 1400, 330);
        // 太阳：整镜下沉 8px，强拍微亮
        const sunY = SUN.y + 8 * clamp((t + 0.7) / (c.dur + 0.7));
        const pulse = 1 + 0.08 * de(c, 0.7);
        glowAt(g, SUN.x, sunY, 300, 210, '#ffc480', 0.42 * pulse);
        glowAt(g, SUN.x, sunY, 150, 130, '#ffd49a', 0.5 * pulse);
        // 橙红日轮：中心亮黄、外缘橙红
        const dg = g.createRadialGradient(SUN.x - 14, sunY - 18, 4, SUN.x, sunY, SUN.r);
        dg.addColorStop(0, '#fff1d0'); dg.addColorStop(0.6, '#ffc47a'); dg.addColorStop(1, '#f0904a');
        g.fillStyle = dg; g.beginPath(); g.arc(SUN.x, sunY, SUN.r, 0, TAU); g.fill();
        glowAt(g, SUN.x, sunY - 10, 110, 96, '#fff4dc', 0.18 * (pulse - 1) / 0.08 + 0.04);
        // 墙、门、台阶、地面
        const wall = K.cache('a2wall', WW, WH, 1, paintWall);
        g.drawImage(wall, WX0, WY0, WW, WH);
        drawTufts(g, t);
        // 墙脊上溢出的日光（随太阳亮度）
        glowAt(g, SUN.x, RIDGE + 2, 170, 26, '#ffe2a8', 0.5 * pulse);
        // 人：接触阴影 + 剪影
        g.fillStyle = 'rgba(14,10,18,0.5)';
        g.beginPath(); g.ellipse(MAN.x - 2, T1 + 1, 28, 3.5, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(MAN.x + 45, BASE + 1.5, 15, 2.2, 0, 0, TAU); g.fill();
        XYT.sil.draw(g, 'old', 'sitSide', MAN.x, MAN.y, MAN.h, t + 2, {
          facing: 1, wind: 0.2, windDir: -1, body: '#211b26', rim: '#b98c70', rimSide: 1, rimWidth: 1.2,
        });
        g.restore();
        // 前景：柿子枝（在镜头前方更近，视差略大）
        g.save();
        const pz = 1 + 0.04 * e;
        g.translate(640, 360); g.scale(pz, pz); g.translate(-640, -360 - dy * 1.15);
        const sway = 0.006 * Math.sin(TAU * t / 4.3) + 0.003 * Math.sin(TAU * t / 2.1 + 1) - 0.004;
        g.translate(BR_ORIGIN[0], BR_ORIGIN[1]); g.rotate(sway); g.translate(-BR_ORIGIN[0], -BR_ORIGIN[1]);
        const br = K.cache('a2branch', 520, 300, 1, paintBranch);
        g.drawImage(br, -40, -20, 520, 300);
        for (let i = 0; i < FRUITS.length; i++) {
          const [x, y, r, st] = FRUITS[i];
          const ang = 0.06 + 0.05 * Math.sin(TAU * t / (2.4 + 0.3 * h2(i, 3)) + i * 1.7);
          drawFruit(g, x, y + st * 0.2, r, ang, 0.3 + 0.2 * de(c, 0.7));
        }
        g.restore();
      },
    });
  })();
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
    return { c, g };
  }

  // ============================================================
  // a3_tide：月夜海滩并肩的背影，一道浪涌来，人影淡去，退浪带走微光
  // ============================================================
  (function () {
    const FB1 = [0.333, 0.733, 1.173, 1.453, 2.073, 2.233, 2.733];
    const FB2 = [3.713, 4.013, 4.453, 4.883, 5.313, 5.613, 6.133];
    const HZ = 330, SHORE = 520;
    const MOON = { x: 1040, y: 250, r: 38 };
    const PAIR = { x: 520, y: 600, h: 220 };
    const MX = MOON.x;
    // 透视：海面上深度 u（0 远 1 近岸）对应的屏幕 y
    const seaY = (u) => HZ + (SHORE - HZ) * Math.pow(u, 1.8);

    function paintSky(g) {
      g.translate(40, 0);
      const gr = g.createLinearGradient(0, 0, 0, HZ + 4);
      gr.addColorStop(0, '#08111f'); gr.addColorStop(0.35, '#0e1a2d'); gr.addColorStop(0.75, '#1d3350'); gr.addColorStop(1, '#2f4d6c');
      g.fillStyle = gr; g.fillRect(-40, 0, 1400, HZ + 4);
      // 月晕
      const rg = g.createRadialGradient(MOON.x, MOON.y, MOON.r, MOON.x, MOON.y, 420);
      rg.addColorStop(0, 'rgba(214,222,226,0.42)'); rg.addColorStop(0.2, 'rgba(150,176,200,0.2)');
      rg.addColorStop(0.55, 'rgba(90,124,160,0.07)'); rg.addColorStop(1, 'rgba(90,124,160,0)');
      g.fillStyle = rg; g.fillRect(-40, 0, 1400, HZ + 4);
      // 星：避开歌词区与月旁
      const r = rng(77);
      for (let i = 0; i < 70; i++) {
        const x = r() * 1280, y = 10 + r() * 270, b = r();
        if (x > 330 && x < 950 && y < 160) continue;
        if (Math.hypot(x - MOON.x, y - MOON.y) < 190) continue;
        const a = (0.12 + 0.4 * b * b) * clamp((HZ - 20 - y) / 120);
        g.fillStyle = `rgba(220,230,240,${a.toFixed(3)})`;
        g.beginPath(); g.arc(x, y, 0.6 + b * 0.8, 0, TAU); g.fill();
      }
      // 地平线薄雾
      const hg = g.createLinearGradient(0, HZ - 40, 0, HZ + 4);
      hg.addColorStop(0, 'rgba(70,100,130,0)'); hg.addColorStop(1, 'rgba(90,120,150,0.35)');
      g.fillStyle = hg; g.fillRect(-40, HZ - 40, 1400, 44);
    }
    function paintClouds(g) {
      g.translate(40, 0);
      const r = rng(19);
      blurInto(g, 1400, 360, 2.5, (cg) => {
        cg.translate(40, 0);
        for (const [x, y, w, h] of [[880, 292, 300, 7], [1190, 276, 240, 6], [700, 312, 220, 5], [1000, 314, 260, 4]]) {
          for (let k = 0; k < 8; k++) {
            const u = k / 7 - 0.5, ox = u * w * 0.8 + (r() - 0.5) * 24, oy = (r() - 0.5) * h + u * u * h;
            const ww = w * (0.2 + r() * 0.25), hh = h * (0.5 + r() * 0.5);
            cg.fillStyle = 'rgba(30,46,70,0.55)';
            cg.beginPath(); cg.ellipse(x + ox, y + oy, ww / 2, hh / 2, 0, 0, TAU); cg.fill();
            const near = Math.exp(-Math.abs(x + ox - MOON.x) / 200);
            cg.fillStyle = `rgba(200,214,226,${(0.12 + 0.4 * near).toFixed(3)})`;
            cg.beginPath(); cg.ellipse(x + ox, y + oy - hh * 0.25, ww * 0.42, hh * 0.18, 0, 0, TAU); cg.fill();
          }
        }
      });
    }
    function paintFar(g) {
      g.translate(40, 0);
      // 左侧远岬：江口外的低山
      const prof = (x) => {
        const u = (x + 40) / 560;
        return HZ - 46 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.05))), 1.4) * (0.85 + 0.15 * noise1(x / 60, 3)) - 3 * noise1(x / 14, 5) * (u < 1 ? 1 : 0);
      };
      g.fillStyle = '#111e31';
      g.beginPath(); g.moveTo(-40, HZ + 2);
      for (let x = -40; x <= 520; x += 4) g.lineTo(x, Math.min(HZ, prof(x)));
      g.lineTo(520, HZ + 2); g.closePath(); g.fill();
      // 月光在山脊右坡的极淡轮廓
      g.strokeStyle = 'rgba(150,176,200,0.18)'; g.lineWidth = 1;
      g.beginPath();
      for (let x = 160; x <= 500; x += 4) { const y = Math.min(HZ, prof(x)); x === 160 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
      // 右侧更远的一抹岸
      g.fillStyle = 'rgba(24,40,62,0.8)';
      g.beginPath(); g.moveTo(1170, HZ + 1);
      for (let x = 1170; x <= 1330; x += 5) g.lineTo(x, HZ - 9 * Math.sin(Math.PI * clamp((x - 1170) / 220)) - 2 * noise1(x / 12, 8));
      g.lineTo(1330, HZ + 1); g.closePath(); g.fill();
      // 山脚雾
      const mg = g.createLinearGradient(0, HZ - 26, 0, HZ + 2);
      mg.addColorStop(0, 'rgba(60,90,120,0)'); mg.addColorStop(1, 'rgba(70,100,130,0.5)');
      g.fillStyle = mg; g.fillRect(-40, HZ - 26, 600, 28);
    }
    function paintSea(g) {
      g.translate(40, -HZ);
      const sg = g.createLinearGradient(0, HZ, 0, SHORE + 10);
      sg.addColorStop(0, '#2a4562'); sg.addColorStop(0.12, '#1f3651'); sg.addColorStop(0.5, '#172a42'); sg.addColorStop(0.84, '#142640'); sg.addColorStop(1, '#1a3048');
      g.fillStyle = sg; g.fillRect(-40, HZ, 1400, SHORE + 10 - HZ);
      // 月光柱下方海面整体略亮
      g.save(); g.translate(MX, HZ); g.scale(1, 2.4);
      const mg = g.createRadialGradient(0, 0, 0, 0, 0, 160);
      mg.addColorStop(0, 'rgba(180,196,206,0.32)'); mg.addColorStop(0.4, 'rgba(120,150,176,0.14)'); mg.addColorStop(1, 'rgba(120,150,176,0)');
      g.fillStyle = mg; g.fillRect(-300, 0, 600, 200);
      g.restore();
    }
    function paintBeach(g) {
      g.translate(40, -SHORE);
      // 湿沙近水处映天光，往下渐干、偏暖灰
      const bg = g.createLinearGradient(0, SHORE, 0, 760);
      bg.addColorStop(0, '#1a3048'); bg.addColorStop(0.06, '#203650'); bg.addColorStop(0.2, '#22364d'); bg.addColorStop(0.4, '#1f2c3f'); bg.addColorStop(0.62, '#1f2737');
      bg.addColorStop(1, '#1b1f2b');
      g.fillStyle = bg; g.fillRect(-40, SHORE, 1400, 760 - SHORE);
      // 湿沙里的月影：与月亮同一竖列的长条反光
      g.save(); g.translate(MX, SHORE); g.scale(1, 3.2);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 80);
      rg.addColorStop(0, 'rgba(226,226,214,0.4)'); rg.addColorStop(0.35, 'rgba(180,196,206,0.18)'); rg.addColorStop(1, 'rgba(150,170,190,0)');
      g.fillStyle = rg; g.fillRect(-120, 0, 240, 80);
      g.restore();
      // 沙纹：极淡的横向细纹
      const r = rng(41);
      for (let i = 0; i < 90; i++) {
        const y = 600 + Math.pow(r(), 0.7) * 160, x = r() * 1320 - 20, w = 30 + r() * 90 * (y - 560) / 160;
        g.strokeStyle = `rgba(${r() < 0.5 ? '12,16,24' : '90,104,124'},${(0.08 + r() * 0.08).toFixed(3)})`;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 1.5, x + w, y); g.stroke();
      }
      // 散落的小卵石
      for (let i = 0; i < 18; i++) {
        const x = r() * 1300 - 10, y = 640 + r() * 110, s = 1.2 + r() * 2.6 * (y - 600) / 120;
        if (x > 980 && x < 1100) continue;
        g.fillStyle = 'rgba(10,14,22,0.7)'; g.beginPath(); g.ellipse(x, y, s * 1.4, s * 0.8, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(160,180,200,0.25)'; g.beginPath(); g.ellipse(x + s * 0.5, y - s * 0.3, s * 0.6, s * 0.3, 0, 0, TAU); g.fill();
      }
    }
    // 静态底图：天空、远岬、海、沙滩合成一张（每帧只贴一次）
    function paintBack(g) {
      g.save(); paintSky(g); g.restore();
      g.save(); paintFar(g); g.restore();
      g.save(); g.translate(0, HZ); paintSea(g); g.restore();
      g.save(); g.translate(0, SHORE); paintBeach(g); g.restore();
    }
    // 左下前景礁石：右上缘受月光
    function rockPath(g) {
      g.beginPath();
      g.moveTo(-40, 760); g.lineTo(-40, 640);
      g.bezierCurveTo(-10, 628, 20, 610, 52, 612);
      g.bezierCurveTo(84, 606, 110, 624, 128, 640);
      g.bezierCurveTo(150, 650, 168, 670, 178, 694);
      g.bezierCurveTo(190, 712, 196, 740, 200, 760);
      g.closePath();
    }
    function paintRock(g) {
      g.translate(40, -560);
      // 接触处的湿影
      g.fillStyle = 'rgba(6,10,16,0.5)';
      g.beginPath(); g.ellipse(120, 742, 120, 12, 0, 0, TAU); g.fill();
      g.save(); g.translate(2.2, -1.6); rockPath(g); g.fillStyle = 'rgba(176,196,214,0.75)'; g.fill(); g.restore();
      rockPath(g); g.fillStyle = '#0b111b'; g.fill();
      g.save(); rockPath(g); g.clip();
      g.strokeStyle = 'rgba(70,90,112,0.25)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(40, 640); g.quadraticCurveTo(80, 660, 96, 700); g.moveTo(110, 650); g.quadraticCurveTo(140, 680, 150, 730); g.stroke();
      const lg = g.createLinearGradient(60, 600, 180, 700);
      lg.addColorStop(0, 'rgba(120,146,170,0.0)'); lg.addColorStop(1, 'rgba(120,146,170,0.12)');
      g.fillStyle = lg; g.fillRect(-40, 600, 260, 160);
      g.restore();
    }

    // 浪：每次拍岸的冲流前沿 y（相对岸线的推进量）
    function swashFront(t, w) {
      const u = t - w.t0;
      if (u < 0) return 0;
      if (u < w.up) { const k = u / w.up; return w.A * (1 - (1 - k) * (1 - k)); }
      const v = u - w.up;
      if (v < w.hold) return w.A + w.creep * (v / Math.max(0.01, w.hold));
      const q = (v - w.hold) / w.down;
      if (q >= 1) return 0;
      return (w.A + w.creep) * (1 - q * q * (3 - 2 * q));
    }
    function wavesFor(c) {
      const out = [];
      const start = c.t - c.lt;
      const grid = c.grid, bi = c.b ? c.b.i : 0;
      const tBig = charLt(c, 0, 1, FB2);
      if (grid && grid.time) {
        for (let i = bi - 24; i <= bi + 24; i++) {
          if (i < 0 || (grid.n && i >= grid.n) || (i & 1)) continue;
          const tb = grid.time(i) - start;
          if (tb < -3.2 || tb > tBig - 1.3) continue;
          out.push({ t0: tb, A: 26 + 12 * h2(i, 7), up: 0.9, hold: 0.12, creep: 2, down: 1.3, foam: 0.6, seed: i % 97, big: false });
        }
      } else {
        for (const tb of [-1.6, 0.06, 1.72]) out.push({ t0: tb, A: 30, up: 0.9, hold: 0.12, creep: 2, down: 1.3, foam: 0.6, seed: Math.round(tb * 10) + 50, big: false });
      }
      const tFlow = charLt(c, 6, 1, FB2);
      out.push({ t0: tBig, A: 122, up: 1.25, hold: Math.max(0.2, tFlow - tBig - 1.25), creep: 4, down: 1.5, foam: 1, seed: 3, big: true });
      return out;
    }
    // 冲流前沿的横向起伏
    const peel = (x, w) => (w.big ? 0.24 : 0.42) * ((noise1(x / 380 + w.seed * 1.7, w.seed + 4) - 0.5) * 2 + 0.35 * (noise1(x / 120 + w.seed, w.seed + 5) - 0.5));
    const frontY = (base, x, w, t) => base + (w.big ? 9 : 5) * (noise1(x / 90 + w.seed * 3.1, w.seed) - 0.5) * 2 + 2.5 * (noise1(x / 27 + t * 0.3, w.seed + 9) - 0.5) * 2;

    function drawSwash(g, t, w, dx) {
      const u = t - w.t0;
      if (u < -0.4 || u > w.up + w.hold + w.down + 0.4) return;
      const step = 16;
      const xs = [], fy = [], ka = [];
      let any = false;
      for (let x = -60; x <= 1340; x += step) {
        // 浪沿岸线先后到达（卷浪），各处前沿时间略有先后
        const tl = t + peel(x, w);
        const adv = swashFront(tl, w);
        xs.push(x); fy.push(frontY(SHORE + adv, x, w, t));
        const uu = tl - w.t0;
        const k = uu < 0 ? 0 : uu < w.up ? 1 : uu < w.up + w.hold ? lerp(1, 0.55, clamp((uu - w.up) / Math.max(0.3, w.hold))) : 0.55 * (1 - clamp((uu - w.up - w.hold) / w.down));
        ka.push(adv > 0.3 ? k * clamp(adv / 4) : 0);
        if (adv > 0.3) any = true;
      }
      if (!any) return;
      const recede = u > w.up + w.hold;
      const a0 = (w.big ? 0.4 : 0.28) * (recede ? 0.85 : 1);
      // 水膜：近岸厚、前沿薄，映出天光
      g.beginPath(); g.moveTo(xs[0], SHORE - 2);
      for (let i = 0; i < xs.length; i++) g.lineTo(xs[i], Math.max(SHORE - 2, fy[i]));
      g.lineTo(xs[xs.length - 1], SHORE - 2); g.closePath();
      const yb = SHORE + swashFront(t, w);
      const sg = g.createLinearGradient(0, SHORE - 2, 0, Math.max(SHORE + 16, yb + 12));
      const fz = clamp(14 / Math.max(14, yb + 14 - SHORE));
      sg.addColorStop(0, `rgba(110,142,174,0)`); sg.addColorStop(fz, `rgba(110,142,174,${a0})`); sg.addColorStop(1, `rgba(150,176,200,${a0 * 0.45})`);
      g.fillStyle = sg; g.fill();
      // 大浪退去后露出的湿沙像镜子：一层淡淡的天光与月影，慢慢消退
      if (w.big && recede) {
        const back = u - w.up - w.hold;
        const ga = 0.22 * smooth(back / 0.3) * (1 - smooth((back - 1.2) / 2.5));
        if (ga > 0.005) {
          const reach = SHORE + w.A + w.creep;
          g.beginPath(); g.moveTo(xs[0], reach + 6);
          for (let i = 0; i < xs.length; i++) g.lineTo(xs[i], Math.max(SHORE, fy[i]));
          g.lineTo(xs[xs.length - 1], reach + 6); g.closePath();
          const gg = g.createLinearGradient(0, SHORE, 0, reach + 6);
          gg.addColorStop(0, `rgba(120,150,180,${ga})`); gg.addColorStop(1, `rgba(120,150,180,${ga * 0.3})`);
          g.fillStyle = gg; g.fill();
          glowAt(g, MX, (SHORE + reach) / 2 + 10, 50, (reach - SHORE) * 0.7, '#e6e4d6', ga * 1.4);
        }
      }
      // 泡沫边：前进时白而密，停住后变薄，退时散成细线（分段画，浓淡随位置变化；按浓淡分档合并绘制）
      const NB = 14;
      const lines = new Array(NB).fill(null), dots = new Array(NB).fill(null);
      for (let i = 0; i < xs.length - 1; i++) {
        const fa = w.foam * (ka[i] + ka[i + 1]) * 0.5 * (0.55 + 0.45 * noise1(xs[i] / 70 + w.seed, w.seed + 6));
        if (fa < 0.02 || fy[i] <= SHORE) continue;
        const bk = Math.min(NB - 1, Math.round(fa * (NB - 1)));
        const L = lines[bk] || (lines[bk] = []), D = dots[bk] || (dots[bk] = []);
        L.push(xs[i], fy[i], xs[i + 1], fy[i + 1]);
        for (let j = 0; j < (w.big ? 3 : 2); j++) {
          const sd = (i * 7 + j * 3 + w.seed * 11);
          const fx = xs[i] + h2(sd, 1) * step, back = 2 + h2(sd, 2) * (w.big ? 18 : 9);
          const yy = lerp(fy[i], fy[i + 1], (fx - xs[i]) / step) - back;
          if (yy < SHORE) continue;
          D.push(fx, yy, 3 + h2(sd, 3) * 7, 0.9 + h2(sd, 4) * 0.9);
        }
      }
      g.lineCap = 'butt'; g.lineWidth = w.big ? 3 : 2;
      for (let bk = 1; bk < NB; bk++) {
        const fa = bk / (NB - 1), L = lines[bk], D = dots[bk];
        if (L) {
          g.strokeStyle = `rgba(214,226,236,${(0.8 * fa).toFixed(3)})`;
          g.beginPath(); for (let k = 0; k < L.length; k += 4) { g.moveTo(L[k], L[k + 1]); g.lineTo(L[k + 2], L[k + 3]); } g.stroke();
        }
        if (D && D.length) {
          g.fillStyle = `rgba(200,214,228,${(0.45 * fa).toFixed(3)})`;
          g.beginPath(); for (let k = 0; k < D.length; k += 4) { g.moveTo(D[k] + D[k + 2], D[k + 1]); g.ellipse(D[k], D[k + 1], D[k + 2], D[k + 3], 0, 0, TAU); } g.fill();
        }
      }
    }
    // 远处涌来的浪峰：深色浪面 + 被月光照亮的峰线，近岸时卷起白沫
    function drawBreaker(g, t, w) {
      const lead = w.big ? 1.9 : 1.3;
      const u0 = (t - (w.t0 - lead)) / lead;
      if (u0 < -0.5 || u0 > 1.6) return;
      const amp = w.big ? 7 : 3.5;
      const NB = 12;
      const face = [], crest = [], foam = [], froth = [];
      // 沿岸各段的进度不同（卷浪），亮度也分段变化；按浓淡分档合并绘制
      const seg = 24;
      for (let x = -60; x < 1340; x += seg) {
        const u = u0 + peel(x + seg / 2, w) / lead;
        if (u < 0 || u > 1.08) continue;
        const k = clamp(u);
        const yA = lerp(w.big ? 405 : 462, SHORE - 3, Math.pow(k, 1.4));
        const vis = smooth(u / 0.3) * (1 - smooth((u - 0.98) / 0.1)) * smooth((noise1((x + 0.5 * seg) / 150 + w.seed * 2.3, w.seed + 1) - 0.2) / 0.6);
        if (vis < 0.03) continue;
        const yy0 = yA + amp * (0.4 + k) * (noise1(x / 110 + w.seed, w.seed + 2) - 0.5) * 2;
        const yy1 = yA + amp * (0.4 + k) * (noise1((x + seg) / 110 + w.seed, w.seed + 2) - 0.5) * 2;
        const th = amp * (0.4 + k) * 1.4 + 2;
        const white = smooth((k - 0.55) / 0.4);
        const b1 = Math.round(vis * (NB - 1));
        (face[b1] || (face[b1] = [])).push(x, yy0, yy1, th);
        (crest[b1] || (crest[b1] = [])).push(x, yy0, yy1);
        if (white > 0.05) {
          const b2 = Math.round(vis * white * (NB - 1));
          (foam[b2] || (foam[b2] = [])).push(x, yy0, yy1);
          const F = froth[b2] || (froth[b2] = []);
          for (let j = 0; j < 3; j++) {
            const q = Math.round(x) * 3 + j + w.seed * 17;
            const fx = x + h2(q, 1) * seg;
            F.push(fx, lerp(yy0, yy1, (fx - x) / seg) - 1 - h2(q, 2) * 4 * white, 2 + h2(q, 3) * 6, 0.7 + h2(q, 4) * 0.8);
          }
        }
      }
      const sc = w.big ? 1 : 0.8;
      for (let bk = 1; bk < NB; bk++) {
        const v = bk / (NB - 1);
        let A = face[bk];
        if (A) {
          g.fillStyle = `rgba(8,16,28,${(0.32 * v).toFixed(3)})`;
          g.beginPath(); for (let i = 0; i < A.length; i += 4) { const x = A[i]; g.moveTo(x, A[i + 1]); g.lineTo(x + seg, A[i + 2]); g.lineTo(x + seg, A[i + 2] + A[i + 3]); g.lineTo(x, A[i + 1] + A[i + 3]); g.closePath(); } g.fill();
        }
        A = crest[bk];
        if (A) {
          // 大浪的峰线迎着月光更亮一些
          g.strokeStyle = w.big ? `rgba(160,188,214,${(0.5 * v).toFixed(3)})` : `rgba(120,150,180,${(0.32 * v * sc).toFixed(3)})`; g.lineWidth = w.big ? 2.2 : 1.4;
          g.beginPath(); for (let i = 0; i < A.length; i += 3) { g.moveTo(A[i], A[i + 1] - 0.5); g.lineTo(A[i] + seg, A[i + 2] - 0.5); } g.stroke();
        }
        A = foam[bk];
        if (A) {
          g.strokeStyle = `rgba(222,232,240,${(0.6 * v * sc).toFixed(3)})`; g.lineWidth = w.big ? 2.6 : 1.8;
          g.beginPath(); for (let i = 0; i < A.length; i += 3) { g.moveTo(A[i], A[i + 1] - 0.5); g.lineTo(A[i] + seg, A[i + 2] - 0.5); } g.stroke();
        }
        A = froth[bk];
        if (A) {
          g.fillStyle = `rgba(206,220,232,${(0.4 * v).toFixed(3)})`;
          g.beginPath(); for (let i = 0; i < A.length; i += 4) { g.moveTo(A[i] + A[i + 2], A[i + 1]); g.ellipse(A[i], A[i + 1], A[i + 2], A[i + 3], 0, 0, TAU); } g.fill();
        }
      }
    }
    // 远海的涌：一排排断续的细亮线，慢慢向岸推进
    function drawSwells(g, t) {
      const N = 16;
      for (let r = 0; r < N; r++) {
        const ph = (r / N + t * 0.045) % 1;
        const y = seaY(0.08 + ph * 0.86);
        const fade = smooth(ph / 0.15) * (1 - smooth((ph - 0.8) / 0.18));
        if (fade <= 0.01) continue;
        // 这一排浪只在回到远处（淡出为 0）时才换花样；每段按序号取随机，不随位置跳变
        const rowSeed = Math.floor(r / N + t * 0.045) * N + r;
        g.fillStyle = `rgba(130,160,190,${(0.12 * fade * (0.5 + ph)).toFixed(3)})`;
        g.beginPath();
        // 段落以消失点 x=640 为中心随透视放大
        const sc = 0.45 + ph, P = 80, off = P * h2(rowSeed, 3);
        const j0 = Math.floor((-700 / sc - off) / P) - 1, j1 = Math.ceil((700 / sc - off) / P) + 1;
        for (let j = j0; j <= j1; j++) {
          const q = rowSeed * 131 + j;
          const len = (10 + 60 * Math.pow(h2(q, 5), 2)) * sc;
          const x = 640 + (off + j * P + (h2(q, 6) - 0.5) * 30) * sc;
          if (x + len < -60 || x > 1340) continue;
          const yy = y + 2.5 * (h2(q, 7) - 0.5) * (0.3 + ph);
          g.moveTo(x + len, yy); g.ellipse(x + len / 2, yy, len / 2, 0.45 + ph * 0.7, 0, 0, TAU);
        }
        g.fill();
      }
    }
    // 月光路：月亮正下方一条闪烁的碎光带（越近越宽）
    const GLINTS = [];
    for (let i = 0; i < 170; i++) GLINTS.push({ u: Math.pow(h2(i, 11), 0.8), s: h2(i, 12) * 2 - 1, f: 0.6 + 1.6 * h2(i, 13), p: h2(i, 14), l: h2(i, 15) });
    function drawMoonPath(g, t, boost) {
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (const q of GLINTS) {
        const y = seaY(0.02 + q.u * 0.97);
        const half = 8 + (y - HZ) * 0.5;
        const spread = q.s * half * (0.6 + 0.4 * Math.abs(q.s));
        const fl = Math.sin(TAU * (q.f * t + q.p));
        const a = Math.max(0, fl) * Math.max(0, fl) * (1 - Math.abs(q.s) * 0.7) * (0.55 + 0.45 * (1 - q.u)) * boost;
        if (a < 0.02) continue;
        const len = (3 + 14 * q.l) * (0.3 + q.u);
        g.fillStyle = `rgba(242,232,206,${Math.min(1, 0.8 * a).toFixed(3)})`;
        g.fillRect(MX + spread - len / 2, y - 0.6, len, 0.8 + q.u * 1.2);
      }
      g.globalCompositeOperation = op;
    }
    // 倒影：人影上下翻转画进临时画布，再按横条加波纹贴到湿沙上
    function drawPairReflection(g, t, alpha, glow, wet) {
      const RW = 250, RH = 160, ox = PAIR.x - 145, oy = PAIR.y;
      const s = scratch('a3refl', RW, RH);
      s.g.translate(-ox, -oy);
      s.g.translate(0, 2 * PAIR.y); s.g.scale(1, -1);
      XYT.sil.draw(s.g, 'pair', 'standBack', PAIR.x, PAIR.y, PAIR.h, t, { wind: 0.4, windDir: 1, body: '#0a111c', accent: '#0e1622', alpha: 1 });
      s.g.setTransform(1, 0, 0, 1, 0, 0);
      s.g.globalCompositeOperation = 'destination-in';
      const S = SS();
      const fg = s.g.createLinearGradient(0, 0, 0, RH * S);
      fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(0.5, 'rgba(0,0,0,0.4)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      s.g.fillStyle = fg; s.g.fillRect(0, 0, RW * S, RH * S);
      const o = g.globalAlpha;
      g.globalAlpha = o * alpha * (0.22 + 0.2 * wet);
      const band = 3;
      for (let y = 0; y < RH; y += band) {
        const k = y / RH;
        const dx = (1 + 3 * k) * Math.sin(y * 0.21 + t * 2.3) + (0.6 + 1.5 * k) * Math.sin(y * 0.07 - t * 1.3);
        g.drawImage(s.c, 0, y * S, RW * S, band * S, ox + dx, oy + y, RW, band);
      }
      g.globalAlpha = o;
    }
    // 人影淡去时升起的光点（≤30），退浪时随水流回海里
    function drawMotes(g, t, tFade, tFlow) {
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 28; i++) {
        const ts = tFade + 0.05 + 1.0 * h2(i, 21);
        const age = t - ts;
        if (age < 0) continue;
        const life = 1.8 + 1.2 * h2(i, 22);
        // 出生点：两人剪影的范围内
        const bx = PAIR.x - 70 + 125 * h2(i, 23), by = PAIR.y - 200 * Math.pow(h2(i, 24), 0.8) - 6;
        const water = i % 3 === 0; // 三分之一落在水膜上，随退浪回海
        let x, y, a, r;
        if (!water) {
          const rise = 14 + 16 * h2(i, 25);
          x = bx + 9 * age + 4 * Math.sin(age * 2.1 + i);
          y = by - rise * age - 4 * age * age;
          a = smooth(age / 0.4) * (1 - smooth((age - life * 0.55) / (life * 0.45)));
          r = 1.8 + 1.6 * h2(i, 26);
          // 退浪时：被带向海面（画面上方、远处），变小变淡
          const back = Math.max(0, t - tFlow);
          if (back > 0) {
            y -= 40 * back * back + 20 * back;
            x += (MX - x) * 0.12 * back;
            a *= 1 - smooth(back / 0.75);
            r *= 1 - 0.45 * clamp(back / 0.75);
          }
        } else {
          // 水面上的微光：在脚边铺开，退浪时向海面（画面上方）移动、变小
          const fx = PAIR.x - 80 + 160 * h2(i, 27), fy = PAIR.y - 6 + 22 * h2(i, 28);
          const back = Math.max(0, t - tFlow);
          const q = clamp(back / 1.5), pull = (fy - SHORE) * 0.9 * q * q * (3 - 2 * q);
          x = fx + 6 * Math.sin(age * 1.3 + i) + 4 * back;
          y = fy - pull;
          a = smooth(age / 0.5) * (1 - smooth((back - 0.3) / 0.6)) * (y > SHORE ? 1 : 0);
          r = (1.2 + 1.2 * h2(i, 29)) * (1 - 0.4 * clamp(back / 0.9));
        }
        if (a <= 0.01) continue;
        glowAt(g, x, y, r * 7, r * 7, '#f2d9a6', 0.5 * a);
        g.fillStyle = `rgba(255,246,226,${(0.85 * a).toFixed(3)})`;
        g.beginPath(); g.arc(x, y, r * 0.6, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = op;
    }

    XYT.registerShot('a3_tide', {
      name: '\u4f0a\u4eba\u6f6e\u58f0', zone: 'top', night: true, text: '#eef2f4', shadow: 'rgba(6,10,20,0.9)', accent: '#e7a6b8', bloom: 0.32,
      draw(g, c) {
        const t = c.lt;
        const tBig = charLt(c, 0, 1, FB2), tSheng = charLt(c, 3, 1, FB2), tFlow = charLt(c, 6, 1, FB2);
        // 镜头：整镜 1.00→1.03；第6句随浪右移 40px
        const z = 1 + 0.03 * smooth((t + 0.9) / (c.dur + 0.9));
        const dx = 40 * smooth((t - tBig) / 2.5);
        g.save();
        g.translate(640, 400); g.scale(z, z); g.translate(-640 - dx, -400);
        // 天空（静）、远岬、云（极慢向右）
        g.drawImage(K.cache('a3back', 1400, 760, 1, paintBack), -40, 0, 1400, 760);
        // 月亮
        const pulse = 1 + 0.1 * be(c, 0.5);
        glowAt(g, MOON.x, MOON.y, 120, 120, '#e8eef2', 0.3 * pulse);
        const mg = g.createRadialGradient(MOON.x - 10, MOON.y - 12, 3, MOON.x, MOON.y, MOON.r);
        mg.addColorStop(0, '#fffdf4'); mg.addColorStop(0.75, '#f4ecd6'); mg.addColorStop(1, '#e6dcc0');
        g.fillStyle = mg; g.beginPath(); g.arc(MOON.x, MOON.y, MOON.r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(160,150,120,0.13)';
        for (const [ax, ay, ar] of [[-12, -8, 9], [8, 4, 7], [-4, 12, 6], [14, -12, 5], [-16, 8, 4]]) { g.beginPath(); g.arc(MOON.x + ax, MOON.y + ay, ar, 0, TAU); g.fill(); }
        g.drawImage(K.cache('a3cloud', 1400, 360, 1, paintClouds), -40 + 2.2 * (t + 1), 0, 1400, 360);
        // 海
        drawSwells(g, t);
        drawMoonPath(g, t, 1 + 0.12 * be(c, 0.4));
        const waves = wavesFor(c);
        g.save(); g.beginPath(); g.rect(-100, HZ, 1500, SHORE - HZ); g.clip();
        for (const w of waves) drawBreaker(g, t, w);
        g.restore();
        for (const w of waves) drawSwash(g, t, w, dx);
        // 人：淡出（形状不变）+ 柔光增强
        const fade = smooth((t - tSheng) / 1.2);
        const alpha = 1 - fade, glow = 0.3 + 0.5 * fade;
        const big = waves[waves.length - 1];
        const wet = clamp((swashFront(t, big) - (PAIR.y - SHORE) + 6) / 12);
        if (alpha > 0.002) {
          drawPairReflection(g, t, alpha, glow, wet);
          g.fillStyle = `rgba(6,10,18,${(0.45 * alpha).toFixed(3)})`;
          g.beginPath(); g.ellipse(PAIR.x - 10, PAIR.y + 2, 70, 5, 0, 0, TAU); g.fill();
          XYT.sil.draw(g, 'pair', 'standBack', PAIR.x, PAIR.y, PAIR.h, t, { wind: 0.4, windDir: 1, rim: '#dfe8f0', rimSide: 1, rimWidth: 1.4, glow, alpha });
          // 浪漫过脚面时的细泡
          if (wet > 0.01) {
            g.strokeStyle = `rgba(214,226,236,${(0.5 * wet * alpha).toFixed(3)})`; g.lineWidth = 1.2;
            for (const [fx, fw] of [[PAIR.x - 52, 16], [PAIR.x + 24, 12]]) { g.beginPath(); g.ellipse(fx, PAIR.y + 1, fw, 2.4, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); }
          }
        }
        drawMotes(g, t, tSheng, tFlow);
        g.restore();
        // 前景礁石（离镜头更近，平移略多）
        g.save();
        g.translate(640, 400); g.scale(z * 1.01, z * 1.01); g.translate(-640 - dx * 1.25, -400);
        g.drawImage(K.cache('a3rock', 280, 200, 1, paintRock), -40, 560, 280, 200);
        g.restore();
      },
    });
  })();
  // ============================================================
  // a4_maplepond：黄昏静池如镜，红叶逐一落水，涟漪摇碎倒影
  // ============================================================
  (function () {
    const FB1 = [0.243, 0.563, 1.023, 1.863, 2.303];
    const FB2 = [2.783, 3.003, 3.503, 4.023, 4.483, 4.763, 5.123, 5.583];
    const WL = 432;                      // 对岸水线：倒影轴
    const SUN = { x: 1000, y: 400, r: 24 };
    const FIG = { x: 560, y: WL, h: 70 };
    const MIR = 330;                     // 倒影高度（432 → 762）
    // 落叶：触水字序（第8句）、飘落时长、枝头位置、触水位置
    const LEAVES = [
      { k: 0, D: 2.3, x0: 846, y0: 300, xl: 872, yl: 566, s: 11.5, seed: 1 },
      { k: 2, D: 2.2, x0: 934, y0: 322, xl: 962, yl: 604, s: 11.5, seed: 2 },
      { k: 4, D: 2.2, x0: 792, y0: 306, xl: 818, yl: 628, s: 12, seed: 3 },
      { k: 6, D: 2.1, x0: 1012, y0: 312, xl: 1040, yl: 548, s: 11, seed: 4 },
      { k: 7, D: 1.95, x0: 884, y0: 334, xl: 906, yl: 654, s: 12, seed: 5 },
    ];
    // 水面椭圆的透视压缩：视平线约在 y=400，焦距约 1110px（低机位）
    const ratioAt = (y) => Math.max(0.04, (y - 400) / 1110);

    // 叶形轮廓（单位大小，叶柄在 (0, 0.5)）
    const LEAF = (() => {
      const p = new Path2D();
      const lobes = [[0, -1, 0.42], [0.78, -0.42, 0.34], [-0.78, -0.42, 0.34], [0.5, 0.32, 0.22], [-0.5, 0.32, 0.22]];
      const pts = [];
      const ang = [-90, -38, 18, 162, 218].map((a) => (a * Math.PI) / 180);
      // 五裂：每裂一个尖、两侧各一小齿
      const tips = [[0, -0.5], [0.48, -0.2], [0.36, 0.2], [-0.36, 0.2], [-0.48, -0.2]];
      const order = [0, 1, 2, 3, 4];
      p.moveTo(0, 0.12);
      const seq = [[0.1, 0.12], [0.36, 0.2], [0.2, 0.02], [0.48, -0.2], [0.18, -0.12], [0.22, -0.32], [0.08, -0.22], [0, -0.52], [-0.08, -0.22], [-0.22, -0.32], [-0.18, -0.12], [-0.48, -0.2], [-0.2, 0.02], [-0.36, 0.2], [-0.1, 0.12]];
      for (const [x, y] of seq) p.lineTo(x * 1.9, y * 1.9);
      p.closePath();
      void lobes; void pts; void ang; void tips; void order;
      return p;
    })();
    const LEAF3 = (() => {
      const p = new Path2D();
      const seq = [[0.08, 0.14], [0.42, 0.06], [0.2, -0.06], [0.3, -0.3], [0.08, -0.2], [0, -0.56], [-0.08, -0.2], [-0.3, -0.3], [-0.2, -0.06], [-0.42, 0.06], [-0.08, 0.14]];
      p.moveTo(0, 0.14);
      for (const [x, y] of seq) p.lineTo(x * 1.9, y * 1.9);
      p.closePath();
      return p;
    })();
    const STEM = (() => { const p = new Path2D(); p.moveTo(0, 0.2); p.lineTo(0.03, 0.62); return p; })();

    function paintUp(g) {
      g.translate(40, 0);
      // 天空：上淡灰金，近地平线明亮，右侧落日光晕
      const sg = g.createLinearGradient(0, 0, 0, WL);
      sg.addColorStop(0, '#d8b98a'); sg.addColorStop(0.45, '#eccb94'); sg.addColorStop(0.85, '#f6d9a2'); sg.addColorStop(1, '#f8e2b0');
      g.fillStyle = sg; g.fillRect(-40, 0, 1400, WL + 8);
      g.save(); g.translate(SUN.x, SUN.y); g.scale(1.9, 1);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 420);
      rg.addColorStop(0, 'rgba(255,240,200,0.95)'); rg.addColorStop(0.12, 'rgba(250,206,130,0.62)'); rg.addColorStop(0.4, 'rgba(240,170,96,0.26)'); rg.addColorStop(1, 'rgba(240,170,96,0)');
      g.fillStyle = rg; g.fillRect(-500, -420, 1000, 860);
      g.restore();
      // 远山三层：越远越淡、越偏冷；左侧几乎溶进雾里（歌词区）
      const ridge = (seed, base, amp, peaks, x0, x1) => {
        const pts = [];
        for (let x = x0; x <= x1; x += 4) {
          let y = base;
          for (const [px, ph, pw] of peaks) { const d = (x - px) / pw; y = Math.min(y, base - ph * Math.exp(-d * d * 2.2) * (0.9 + 0.1 * noise1(x / 40, seed))); }
          y += amp * fbm(x / 90, seed, 3);
          pts.push([x, y]);
        }
        return pts;
      };
      const fillRidge = (pts, col, alpha, fade) => {
        g.beginPath(); g.moveTo(pts[0][0], WL + 8);
        for (const [x, y] of pts) g.lineTo(x, y);
        g.lineTo(pts[pts.length - 1][0], WL + 8); g.closePath();
        if (fade) {
          const lg = g.createLinearGradient(-40, 0, 1320, 0);
          lg.addColorStop(0, rgba(col, alpha * 0.25)); lg.addColorStop(0.28, rgba(col, alpha * 0.45)); lg.addColorStop(0.5, rgba(col, alpha)); lg.addColorStop(1, rgba(col, alpha));
          g.fillStyle = lg;
        } else g.fillStyle = rgba(col, alpha);
        g.fill();
      };
      const sunDisc = () => {
        // 太阳（下缘被远山遮住）
        const dg = g.createRadialGradient(SUN.x - 5, SUN.y - 6, 2, SUN.x, SUN.y, SUN.r);
        dg.addColorStop(0, '#fffaf0'); dg.addColorStop(0.8, '#fff2d0'); dg.addColorStop(1, '#ffe6aa');
        g.fillStyle = dg; g.beginPath(); g.arc(SUN.x, SUN.y, SUN.r, 0, TAU); g.fill();
      };
      sunDisc();
      fillRidge(ridge(11, 412, 5, [[180, 120, 160], [470, 150, 190], [760, 110, 150], [1250, 150, 160], [1360, 120, 120]], -40, 1320), '#b9b8a6', 0.55, true);
      // 山间雾
      let mg = g.createLinearGradient(0, 300, 0, WL);
      mg.addColorStop(0, 'rgba(246,220,170,0)'); mg.addColorStop(1, 'rgba(246,220,170,0.72)');
      g.fillStyle = mg; g.fillRect(-40, 300, 1400, WL - 300);
      fillRidge(ridge(23, 420, 3, [[330, 70, 140], [640, 96, 170], [860, 56, 110], [1180, 70, 120], [1300, 90, 140]], -40, 1320), '#8e9488', 0.62, true);
      mg = g.createLinearGradient(0, 360, 0, WL);
      mg.addColorStop(0, 'rgba(246,220,170,0)'); mg.addColorStop(1, 'rgba(246,220,170,0.58)');
      g.fillStyle = mg; g.fillRect(-40, 360, 1400, WL - 360);
      // 对岸：低矮的树丛与草岸，人站的地方是一小片空地
      const bank = [];
      for (let x = -40; x <= 1320; x += 3) {
        let y = WL - 6 - 4 * fbm(x / 50, 31, 3);
        const tree = Math.max(0, fbm(x / 70, 37, 3) + 0.25) * 34 + Math.max(0, noise1(x / 19, 41) - 0.5) * 16;
        const clear = Math.exp(-Math.pow((x - 566) / 34, 2));
        y -= tree * (1 - clear);
        bank.push([x, y]);
      }
      g.beginPath(); g.moveTo(-40, WL + 1);
      for (const [x, y] of bank) g.lineTo(x, y);
      g.lineTo(1320, WL + 1); g.closePath();
      const bl = g.createLinearGradient(-40, 0, 1320, 0);
      bl.addColorStop(0, 'rgba(120,112,92,0.28)'); bl.addColorStop(0.22, 'rgba(96,84,66,0.55)'); bl.addColorStop(0.42, 'rgba(70,58,46,0.92)'); bl.addColorStop(1, 'rgba(62,48,38,0.95)');
      g.fillStyle = bl; g.fill();
      // 树丛受光：朝落日一侧（右）的边缘有暖色细光
      g.strokeStyle = 'rgba(255,214,150,0.35)'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < bank.length; i++) { const [x, y] = bank[i], [px, py] = bank[i - 1]; if (x > 420 && y > py + 0.6) { g.moveTo(px, py); g.lineTo(x, y); } }
      g.stroke();
      // 水边一线亮
      g.fillStyle = 'rgba(255,236,190,0.35)'; g.fillRect(-40, WL - 1, 1400, 1.2);
    }
    // 倒影底图：上方世界以水线为轴翻转、压暗、偏冷、略模糊
    function paintMirror(g) {
      const up = K.cache('a4up', 1400, WL + 8, 1, paintUp);
      blurInto(g, 1400, MIR, 1.3, (mg) => {
        // 源图第 WL - y 行 → 倒影第 y 行
        mg.save(); mg.translate(0, WL); mg.scale(1, -1);
        mg.drawImage(up, 0, 0, up.width, up.height * WL / (WL + 8), 0, 0, 1400, WL);
        mg.restore();
      });
      // 比实物暗约三成、略偏冷
      g.globalCompositeOperation = 'multiply';
      const dk = g.createLinearGradient(0, 0, 0, MIR);
      dk.addColorStop(0, '#c6c4bc'); dk.addColorStop(0.5, '#b0b0aa'); dk.addColorStop(1, '#9c9e9e');
      g.fillStyle = dk; g.fillRect(0, 0, 1400, MIR);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(110,130,140,0.10)'; g.fillRect(0, 0, 1400, MIR);
      // 静水上几道淡淡的留白横纹（风过处的细鳞反出天光），近水线处又细又密
      const r = rng(57);
      for (let i = 0; i < 26; i++) {
        const u = Math.pow(r(), 1.5), y = 6 + u * (MIR - 30);
        const len = 120 + 520 * r() * (0.4 + u), x = r() * 1400;
        const th = 0.5 + u * 2.6, al = 0.05 + 0.07 * r();
        const lg = g.createLinearGradient(x - len / 2, 0, x + len / 2, 0);
        lg.addColorStop(0, 'rgba(238,236,226,0)'); lg.addColorStop(0.5, `rgba(238,236,226,${al.toFixed(3)})`); lg.addColorStop(1, 'rgba(238,236,226,0)');
        g.fillStyle = lg;
        g.beginPath(); g.ellipse(x, y, len / 2, th, 0, 0, TAU); g.fill();
      }
    }
    // 近岸红枫（逆光）、树干与岸石
    // 树冠团块：[cx, cy, rx, ry]（画面外的部分被画框裁掉）
    const CANOPY = [[1200, 30, 190, 120], [1030, 70, 150, 92], [900, 168, 118, 70], [1090, 196, 140, 76], [1270, 200, 110, 100], [820, 246, 76, 44], [980, 252, 96, 48], [1170, 286, 96, 50], [760, 284, 46, 28], [870, 296, 54, 22], [1040, 300, 60, 22], [950, 292, 40, 18]];
    const inCanopy = (x, y) => { let m = 0; for (const [cx, cy, rx, ry] of CANOPY) { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); m = Math.max(m, 1 - d); } return m; };
    function trunkPath(g) {
      g.beginPath();
      g.moveTo(1340, 760);
      g.bezierCurveTo(1312, 660, 1280, 560, 1240, 470);
      g.bezierCurveTo(1212, 410, 1190, 360, 1172, 316);
      g.bezierCurveTo(1160, 288, 1146, 262, 1134, 236);
      g.lineTo(1112, 246);
      g.bezierCurveTo(1122, 280, 1130, 312, 1136, 346);
      g.bezierCurveTo(1150, 404, 1168, 474, 1186, 544);
      g.bezierCurveTo(1202, 614, 1212, 690, 1216, 760);
      g.closePath();
    }
    // 枝：二次曲线段 [起点, 控制点, 末点, 起粗, 末粗]
    const LIMBS = [
      [[1170, 360], [1070, 296], [960, 290], 15, 5],
      [[960, 290], [900, 284], [846, 286], 5, 1.4],
      [[1146, 300], [1100, 200], [1010, 128], 12, 4],
      [[1010, 128], [970, 100], [930, 96], 4, 1.4],
      [[1180, 380], [1230, 300], [1300, 250], 11, 4],
      [[1150, 290], [1150, 170], [1190, 40], 11, 4],
    ];
    function limbs(g, col, off) {
      g.strokeStyle = col; g.lineCap = 'round';
      for (const [a, c, b, w0, w1] of LIMBS) {
        const n = 8;
        for (let i = 0; i < n; i++) {
          const q0 = i / n, q1 = (i + 1) / n;
          const P = (q) => [(1 - q) * (1 - q) * a[0] + 2 * q * (1 - q) * c[0] + q * q * b[0], (1 - q) * (1 - q) * a[1] + 2 * q * (1 - q) * c[1] + q * q * b[1]];
          const p0 = P(q0), p1 = P(q1);
          g.lineWidth = lerp(w0, w1, (q0 + q1) / 2);
          g.beginPath(); g.moveTo(p0[0] + off[0], p0[1] + off[1]); g.lineTo(p1[0] + off[0], p1[1] + off[1]); g.stroke();
        }
      }
    }
    // 叶色：背层深红，前层橙红；离太阳近、靠近冠缘的叶透光发亮
    function leafCol(layer, x, y, edge, r) {
      const sunD = Math.hypot(x - SUN.x, (y - SUN.y) * 1.2);
      const lit = clamp(1 - sunD / 560) * (0.35 + 0.65 * clamp(1 - edge * 2.2));
      const base = layer === 0 ? mix('#5a1810', '#7e2416', r) : layer === 1 ? mix('#8a2618', '#b83a1c', r) : mix('#c03e1e', '#dc5a28', r);
      return mix(base, layer === 0 ? '#b2441e' : layer === 1 ? '#e8742c' : '#f8a84c', clamp(lit * (layer === 0 ? 0.7 : layer === 1 ? 1.0 : 1.3)));
    }
    function stampLeaves(g, layer, seed, density) {
      const r = rng(seed);
      for (const [cx, cy, rx, ry] of CANOPY) {
        const cnt = Math.round(density * (rx * ry) / 1000);
        for (let i = 0; i < cnt; i++) {
          const a = r() * TAU, d = Math.pow(r(), layer === 2 ? 0.8 : 0.5);
          const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
          const edge = inCanopy(x, y);
          if (layer === 2 && edge > 0.45 && r() < 0.6) continue;    // 前层多在冠缘，冠心留给深色
          const s = (layer === 0 ? 7 : layer === 1 ? 6 : 5.5) + r() * (layer === 2 ? 5 : 5);
          const col = leafCol(layer, x, y, edge, r());
          g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 2.6 + 0.4); g.scale(s, s * (0.7 + r() * 0.4));
          g.fillStyle = col; g.fill(r() < 0.3 ? LEAF3 : LEAF);
          g.restore();
        }
      }
    }
    function bankPath(g) {
      g.beginPath();
      g.moveTo(1330, 560); g.lineTo(1290, 566); g.bezierCurveTo(1250, 572, 1216, 586, 1192, 604);
      g.bezierCurveTo(1160, 628, 1136, 660, 1122, 700); g.lineTo(1110, 760); g.lineTo(1330, 760); g.closePath();
    }
    // 水边几块扁平的石头：顶面受光
    const STONES = [[1150, 676, 46, 14], [1206, 618, 40, 12], [1112, 730, 54, 16], [1262, 588, 36, 10]];
    function stone(g, x, y, w, h) {
      g.beginPath();
      g.moveTo(x - w, y + h * 0.6); g.quadraticCurveTo(x - w * 0.9, y - h * 0.6, x - w * 0.3, y - h * 0.9);
      g.quadraticCurveTo(x + w * 0.4, y - h * 1.1, x + w * 0.9, y - h * 0.3); g.quadraticCurveTo(x + w * 1.05, y + h * 0.3, x + w * 0.8, y + h * 0.7);
      g.closePath();
    }
    function paintTree(g) {
      g.translate(-700, 20);
      // 岸边水面上的暗影（岸石倒影）
      blurInto(g, 620, 780, 5, (bg) => {
        bg.translate(-700, 20);
        bg.save(); bg.translate(0, 8); bankPath(bg); bg.fillStyle = 'rgba(40,24,20,0.45)'; bg.fill(); bg.restore();
      });
      // 后层叶（不铺柔边底色：逆光枫冠的叶隙里透出天光，体积全靠叶片本身）
      stampLeaves(g, 0, 71, 24);
      // 树干（左侧受落日轮廓光）与枝
      g.save(); g.translate(-2.6, 0); trunkPath(g); g.fillStyle = 'rgba(255,180,104,0.75)'; g.fill(); g.restore();
      trunkPath(g); g.fillStyle = '#24150e'; g.fill();
      g.save(); trunkPath(g); g.clip();
      g.strokeStyle = 'rgba(86,60,46,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const x = 1140 + i * 9; g.beginPath(); g.moveTo(x + 76, 760); g.bezierCurveTo(x + 46, 600, x + 14, 440, x - 30, 260); g.stroke(); }
      g.restore();
      limbs(g, 'rgba(255,180,104,0.6)', [-1.3, 0.8]);
      limbs(g, '#24150e', [0, 0]);
      // 中层、前层叶
      stampLeaves(g, 1, 83, 12);
      stampLeaves(g, 2, 97, 4.5);
      // 近岸石与草
      g.save(); g.translate(-2, -1.6); bankPath(g); g.fillStyle = 'rgba(255,190,120,0.5)'; g.fill(); g.restore();
      bankPath(g); g.fillStyle = '#2a1b16'; g.fill();
      // 岸坡的受光边与几处石棱
      g.save(); bankPath(g); g.clip();
      const sg2 = g.createLinearGradient(1100, 560, 1300, 760);
      sg2.addColorStop(0, 'rgba(120,80,56,0.35)'); sg2.addColorStop(1, 'rgba(20,12,10,0)');
      g.fillStyle = sg2; g.fillRect(1100, 550, 240, 220);
      g.strokeStyle = 'rgba(230,170,110,0.28)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(1150, 668); g.quadraticCurveTo(1175, 660, 1200, 664); g.moveTo(1210, 616); g.quadraticCurveTo(1236, 606, 1262, 610); g.moveTo(1128, 726); g.quadraticCurveTo(1150, 716, 1180, 720); g.stroke();
      g.restore();
      const rg = rng(7);
      for (let i = 0; i < 46; i++) {
        const x = 1110 + rg() * 220;
        const y0 = x < 1192 ? 604 + (1192 - x) * 1.25 : 604 - (x - 1192) * 0.32;
        const yy = y0 + 4 + rg() * 26, hh = 8 + rg() * 18, lean = 2 + rg() * 5;
        g.strokeStyle = rgba(mix('#2a2016', '#5e4c2e', rg()), 0.9); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + lean * 0.3, yy - hh * 0.6, x + lean, yy - hh); g.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const x = 1180 + rg() * 140, y = 640 + rg() * 100;
        g.save(); g.translate(x, y); g.rotate(rg() * TAU); g.scale(8, 4); g.fillStyle = mix('#8e2a1e', '#c4401f', rg()); g.fill(LEAF); g.restore();
      }
    }
    // 单片叶子：位置 x, y，转角 a，fx 翻面（-1..1），fl 平躺在水面时的竖向压缩（1 = 竖直）
    function drawLeaf(g, x, y, s, a, fx, fl, lit, alpha) {
      g.save(); g.translate(x, y); if (fl !== 1) g.scale(1, fl); g.rotate(a); g.scale(s * (0.18 + 0.82 * Math.abs(fx)), s);
      const front = fx >= 0;
      g.globalAlpha *= alpha;
      g.fillStyle = front ? mix('#c63f1f', '#f39a48', lit) : mix('#8e2a1e', '#c4552a', lit * 0.6);
      g.fill(LEAF);
      g.strokeStyle = front ? 'rgba(120,30,16,0.6)' : 'rgba(90,24,14,0.6)'; g.lineWidth = 0.06; g.stroke(STEM);
      g.restore();
    }
    // 枝头挂叶：叶柄末端系于细枝端点 (x0, y0)，叶身垂在下方、顺风（向右）略偏，绕柄端轻摆
    const swayAt = (L, t) => 0.12 * Math.sin(TAU * t * (0.5 + 0.1 * L.seed) + L.seed) + 0.05 * Math.sin(TAU * t * 1.3 + L.seed * 2);
    const hangAt = (L, t) => Math.PI - (0.2 + 0.05 * L.seed) + swayAt(L, t);
    const hangCenter = (L, a) => {
      // 叶心 = 柄端 − R(a)·(0.03, 0.62)·s
      const ca = Math.cos(a), sa = Math.sin(a), px = 0.03 * L.s, py = 0.62 * L.s;
      return [L.x0 - (px * ca - py * sa), L.y0 - (px * sa + py * ca)];
    };
    // 落叶轨迹：返回枝头 / 空中 / 水面三种状态
    function leafState(L, t, T) {
      const td = T - L.D, u = t - td;
      if (u <= 0) { const a = hangAt(L, t), [x, y] = hangCenter(L, a); return { st: 0, x, y, a, fx: 1, fl: 1 }; }
      // 脱落瞬间的位置与角度即下落起点（同一个锚点，不跳）
      const a0 = hangAt(L, td), [xA, yA] = hangCenter(L, a0);
      if (u < L.D) {
        // 有终速的下落：τ=0.28 s 内加速到终速；左右摆荡（振幅从 0 长起）；顺风右漂
        const tau = 0.28, drop = L.yl - yA;
        const f = (v) => v - tau * (1 - Math.exp(-v / tau));
        const k = f(u) / f(L.D);
        const w = TAU / (1.25 + 0.12 * L.seed), ph = L.seed * 1.3;
        const amp = (12 + 3 * L.seed) * smooth(u / 0.6) * (1 - 0.6 * smooth((u - L.D + 0.4) / 0.4));
        const swing = amp * (Math.sin(w * u + ph) - Math.sin(ph) * (1 - smooth(u / 0.6)));
        const drift = (L.xl - xA) * k;
        const x = xA + drift + swing * (1 - smooth((u - L.D + 0.25) / 0.25));
        const y = yA + drop * k + 3 * Math.cos(w * u + ph) * smooth(u / 0.6) * (1 - smooth((u - L.D + 0.3) / 0.3));
        const a = a0 + 0.55 * Math.cos(w * u + ph) * smooth(u / 0.6) + 0.6 * u;
        // 翻面从正面开始（cos 0 = 1），与挂枝时一致
        const fx = Math.cos(u * TAU * (0.38 + 0.05 * L.seed));
        const land = smooth((u - L.D + 0.3) / 0.3);
        return { st: 1, x, y, a, fx: lerp(fx, 1, land), fl: lerp(1, FLAT * ratioAt(L.yl), land), land };
      }
      // 浮在水面：慢慢顺风漂、随涟漪微微起伏
      const v = u - L.D;
      const aL = a0 + 0.55 * Math.cos(TAU / (1.25 + 0.12 * L.seed) * L.D + L.seed * 1.3) + 0.6 * L.D;
      return { st: 2, x: L.xl + 4 * v, y: L.yl + 0.8 * Math.sin(v * 5) * Math.exp(-v / 1.2), a: aL + 0.05 * v, fx: 1, fl: FLAT * ratioAt(L.yl), v };
    }
    const FLAT = 1.15;   // 浮叶略有翘边，比水面椭圆稍圆一点
    // 涟漪：环向外扩散、衰减（3 s）
    function drawRipple(g, x, y, age) {
      if (age < 0 || age > 3.2) return;
      const ra = ratioAt(y);
      for (let k = 0; k < 3; k++) {
        const a = age - k * 0.22;
        if (a <= 0) continue;
        const R = 6 + 36 * a;
        const al = Math.exp(-a / 1.1) * (1 - smooth((age - 2.4) / 0.8)) * (1 - k * 0.25);
        if (al < 0.01) continue;
        g.lineWidth = 1.4;
        g.strokeStyle = `rgba(255,236,196,${(0.55 * al).toFixed(3)})`;
        g.beginPath(); g.ellipse(x, y - 0.6, R, R * ra, 0, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(60,36,30,${(0.35 * al).toFixed(3)})`;
        g.beginPath(); g.ellipse(x, y + 0.8, R * 0.97, R * ra * 0.97, 0, 0, TAU); g.stroke();
      }
    }

    XYT.registerShot('a4_maplepond', {
      name: '\u56de\u9996\u67ab\u843d', zone: 'left', night: false, text: '#3a2620', shadow: 'rgba(250,240,214,0.9)', accent: '#b23a1e', bloom: 0.26,
      draw(g, c) {
        const t = c.lt;
        // 镜头：第7句极缓左移 25px，同时 1.00→1.03
        const e = smooth((t + 0.4) / 3.1);
        const cx = 25 * e, z = 1 + 0.03 * e;
        g.save();
        g.translate(640, 380); g.scale(z, z); g.translate(-640 + cx, -380);
        const up = K.cache('a4up', 1400, WL + 8, 1, paintUp);
        g.drawImage(up, 0, 0, up.width, up.height * WL / (WL + 8), -40, 0, 1400, WL);
        // 落日强拍微亮
        glowAt(g, SUN.x, SUN.y, 90, 70, '#fff0c8', 0.12 * de(c, 0.6));
        // 对岸的白发人（侧影，望向右岸红枫）
        g.fillStyle = 'rgba(40,28,22,0.35)'; g.beginPath(); g.ellipse(FIG.x + 2, WL, 9, 1.2, 0, 0, TAU); g.fill();
        XYT.sil.draw(g, 'old', 'standSide', FIG.x, FIG.y, FIG.h, t + 3, { facing: 1, wind: 0.15, windDir: 1, rim: '#ffd9a0', rimSide: 1, body: '#2a201c' });

        // —— 水面 ——
        const mir = K.cache('a4mirror', 1400, MIR, 1, paintMirror);
        const S = mir.width / 1400;
        const tBreeze = 1 - smooth((t - 1.2) / 1.6);
        const wob = 0.35 + 1.6 * tBreeze;
        // 涟漪与落叶状态
        const Ts = LEAVES.map((L) => charLt(c, L.k, 1, FB2));
        const rip = [];
        LEAVES.forEach((L, i) => { const age = t - Ts[i]; if (age > -0.05 && age < 3.2) rip.push({ x: L.xl, y: L.yl, age: Math.max(0, age) }); });
        const band = 3;
        for (let y = 0; y < MIR; y += band) {
          const k = y / MIR;
          let dx = wob * (0.6 + 1.6 * k) * Math.sin(y * 0.19 + t * 1.7) + wob * 0.5 * Math.sin(y * 0.053 - t * 1.1);
          g.drawImage(mir, 0, y * S, mir.width, band * S, -40 + dx, WL + y, 1400, band + 0.5);
        }
        // 人的倒影
        {
          const s = scratch('a4fig', 40, 80);
          s.g.translate(-FIG.x + 20, -FIG.y + 78);
          XYT.sil.draw(s.g, 'old', 'standSide', FIG.x, FIG.y, FIG.h, t + 3, { facing: 1, wind: 0.15, windDir: 1, body: '#2a1e1c' });
          const SS2 = SS();
          const o = g.globalAlpha; g.globalAlpha = o * 0.45;
          for (let y = 0; y < 78; y += 2) {
            const dx = wob * (0.6) * Math.sin(y * 0.19 + t * 1.7) + wob * 0.5 * Math.sin(y * 0.053 - t * 1.1);
            // 源图第 (77 - y) 行翻到水线下 y 处
            g.drawImage(s.c, 0, (76 - y) * SS2, 40 * SS2, 2 * SS2, FIG.x - 20 + dx, WL + y, 40, 2);
          }
          g.globalAlpha = o;
        }
        // 涟漪范围内倒影横条错位（摇碎倒影）
        for (const R of rip) {
          const rad = 6 + 36 * R.age, ra = ratioAt(R.y), env = Math.exp(-R.age / 1.2) * (1 - smooth((R.age - 2.4) / 0.8));
          if (env < 0.02) continue;
          g.save();
          g.beginPath(); g.ellipse(R.x, R.y, rad + 4, (rad + 4) * ra, 0, 0, TAU); g.clip();
          const y0 = Math.max(0, Math.floor((R.y - (rad + 4) * ra - WL) / 2) * 2), y1 = Math.min(MIR, R.y + (rad + 4) * ra - WL);
          for (let y = y0; y < y1; y += 2) {
            const dd = Math.abs(WL + y - R.y) / ra;
            const dx = 5 * env * Math.sin((dd - 36 * R.age) * 0.32) + wob * Math.sin(y * 0.19 + t * 1.7);
            g.drawImage(mir, 0, y * S, mir.width, 2 * S, -40 + dx, WL + y, 1400, 2.5);
          }
          g.restore();
        }
        // 近处水面略暗（看进水里）
        const dg = g.createLinearGradient(0, WL, 0, WL + MIR);
        dg.addColorStop(0, 'rgba(34,40,48,0)'); dg.addColorStop(1, 'rgba(30,36,44,0.28)');
        g.fillStyle = dg; g.fillRect(-60, WL, 1420, MIR);
        // 水面金光带（落日倒影）
        {
          const op = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter';
          glowAt(g, SUN.x, WL + 50, 46, 120, '#f3c27c', 0.32 + 0.06 * be(c, 0.5));
          const boost = (0.5 + 0.5 * tBreeze) * (1 + 0.15 * be(c, 0.4));
          for (let i = 0; i < 46; i++) {
            const u = Math.pow(h2(i, 51), 0.9), y = WL + 6 + u * 270;
            const half = 10 + u * 40, xx = SUN.x + (h2(i, 52) * 2 - 1) * half;
            const fl = Math.sin(TAU * (t * (0.5 + 1.2 * h2(i, 53)) + h2(i, 54)));
            const a = Math.max(0, fl) * Math.max(0, fl) * boost * (1 - u * 0.6);
            if (a < 0.03) continue;
            const len = 4 + 12 * h2(i, 55) * (0.4 + u);
            g.fillStyle = `rgba(255,224,160,${(0.5 * a).toFixed(3)})`;
            g.beginPath(); g.ellipse(xx, y, len / 2, 0.5 + u * 0.6, 0, 0, TAU); g.fill();
          }
          g.globalCompositeOperation = op;
        }
        // 第7句：微风吹出的细纹（淡淡的横纹向右扫过，随后平复）
        // 每条纹从画框左外侧进、右外侧出（回绕点 x≈1320，屏上 ≥1320），不在画内出现或消失
        if (tBreeze > 0.01) {
          g.fillStyle = `rgba(255,240,214,${(0.12 * tBreeze).toFixed(3)})`;
          g.beginPath();
          for (let i = 0; i < 60; i++) {
            const y = WL + 20 + h2(i, 61) * 260, x = ((h2(i, 62) * 1500 + t * 30) % 1500) - 180;
            const len = 20 + 50 * h2(i, 63) * (0.4 + (y - WL) / 260);
            g.moveTo(x + len, y); g.ellipse(x + len / 2, y, len / 2, 0.5 + (y - WL) / 400, 0, 0, TAU);
          }
          g.fill();
        }
        for (const R of rip) drawRipple(g, R.x, R.y, R.age);
        // 浮叶（先画，落在水面上）
        const states = LEAVES.map((L, i) => leafState(L, t, Ts[i]));
        // 浸湿变暗：从触水时空中的受光值 0.4 s 内缓到 0.25（触水点 = (xl, yl)，与空中最后一帧同位）
        const litAir = (x, y) => clamp(1 - Math.hypot(x - SUN.x, y - SUN.y) / 500) * 0.9;
        LEAVES.forEach((L, i) => {
          const st = states[i]; if (st.st !== 2) return;
          drawLeaf(g, st.x, st.y, L.s, st.a, 1, st.fl, lerp(litAir(L.xl, L.yl), 0.25, smooth(st.v / 0.4)), 1);
        });
        // 空中落叶的倒影（以正下方水面点的水线为轴：位置 2·yl − y，转角 π − a）
        LEAVES.forEach((L, i) => {
          const st = states[i]; if (st.st !== 1) return;
          const yr = 2 * L.yl - st.y;
          if (yr > 760) return;
          drawLeaf(g, st.x, yr, L.s, Math.PI - st.a, st.fx, st.fl, 0.1, 0.35);
        });
        // 近岸红枫
        const tree = K.cache('a4tree', 620, 780, 1, paintTree);
        g.drawImage(tree, 700, -20, 620, 780);
        // 细枝属于树：叶子落了枝还在
        // 由冠内伸出、带一折的硬枝：根粗梢细，不是垂线
        g.strokeStyle = '#3a1e14'; g.lineCap = 'round';
        g.lineWidth = 1.7; g.beginPath();
        for (const L of LEAVES) { g.moveTo(L.x0 - 8, L.y0 - 20); g.lineTo(L.x0 - 4, L.y0 - 9); }
        g.stroke();
        g.lineWidth = 1.1; g.beginPath();
        for (const L of LEAVES) { g.moveTo(L.x0 - 4, L.y0 - 9); g.lineTo(L.x0, L.y0); }
        g.stroke();
        g.lineCap = 'butt';
        // 枝头与空中的落叶
        LEAVES.forEach((L, i) => {
          const st = states[i]; if (st.st === 2) return;
          drawLeaf(g, st.x, st.y, L.s, st.a, st.fx, st.fl, litAir(st.x, st.y), 1);
        });
        g.restore();
      },
    });
  })();
})();
