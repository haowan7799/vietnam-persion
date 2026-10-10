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
  // 柔光贴图（按颜色缓存），alpha 与调用方的 globalAlpha 相乘
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
  // a2_wallsun 夕阳墙头：夕阳压在马头墙脊上，墙下旧门前石阶坐着白发人
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
      // 晚霞：细长的层云，底面被落日照亮，上缘偏紫
      const r = rng(23);
      const bands = [[300, 170, 380, 8], [690, 142, 300, 6], [150, 236, 280, 7], [600, 252, 360, 5], [470, 110, 260, 4], [900, 200, 180, 5], [820, 284, 200, 4]];
      blurInto(g, 1400, 420, 2.2, (cg) => {
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
      // 墙根返潮：近地面一片更深的潮痕
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
      paintDoor(g);
      paintSteps(g);
      // 墙根小草（微微向左倒，顺风）
      const rg = rng(91);
      for (const [cx, n] of [[60, 9], [228, 6], [580, 7], [720, 5], [960, 8], [1240, 6]]) {
        for (let i = 0; i < n; i++) {
          const x = cx + (rg() - 0.5) * 34, hh = 6 + rg() * 12, lean = -2 - rg() * 4;
          g.strokeStyle = rgba(mix('#262b24', '#45453a', rg()), 0.85); g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x, BASE + 1); g.quadraticCurveTo(x + lean * 0.3, BASE - hh * 0.6, x + lean, BASE - hh); g.stroke();
        }
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
    const STEP_X = [[252, 552], [236, 568]];
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
      };
      g.fillStyle = 'rgba(16,10,22,0.4)'; g.fillRect(STEP_X[0][0] - 10, T1 - 5, STEP_X[0][1] - STEP_X[0][0] + 20, 5);
      step(STEP_X[0][0], STEP_X[0][1], T1, T2, 3);
      step(STEP_X[1][0], STEP_X[1][1], T2, GROUND, 4);
      g.fillStyle = 'rgba(16,10,22,0.45)'; g.fillRect(STEP_X[1][0] - 6, GROUND, STEP_X[1][1] - STEP_X[1][0] + 12, 3);
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

    // 墙头枯草：逆光里的几簇细草，顺风（向左）轻摆，叶缘带金光
    const TUFTS = [[300, 7, 14, 1], [356, 5, 10, 2], [604, 8, 18, 3], [626, 4, 11, 4], [712, 6, 15, 5], [780, 5, 12, 6], [168, 6, 12, 7]];
    function drawTufts(g, t) {
      for (const [cx, n, hh, seed] of TUFTS) {
        for (let i = 0; i < n; i++) {
          const k = seed * 31 + i;
          const x = cx + (h2(k, 1) - 0.5) * 16, len = hh * (0.55 + 0.6 * h2(k, 2));
          const lean = -0.25 - 0.35 * h2(k, 3) + (h2(k, 4) - 0.5) * 0.5;
          const sw = 0.06 * Math.sin(TAU * t * (0.45 + 0.4 * h2(k, 5)) + k) + 0.03 * Math.sin(TAU * t * 1.1 + k * 2.3) - 0.05;
          const a = lean + sw;
          const tx = x + Math.sin(a) * len, ty = RIDGE + 1 - Math.cos(a) * len;
          const mx = x + Math.sin(a * 0.4) * len * 0.55, my = RIDGE + 1 - Math.cos(a * 0.4) * len * 0.55;
          const near = Math.exp(-Math.abs(x - SUN.x) / 120);
          g.strokeStyle = rgba('#ffd9a0', 0.35 + 0.5 * near); g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(x, RIDGE + 2); g.quadraticCurveTo(mx, my, tx, ty); g.stroke();
          g.strokeStyle = '#2a2230'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x, RIDGE + 2); g.quadraticCurveTo(mx, my, tx, ty); g.stroke();
        }
      }
    }

    XYT.registerShot('a2_wallsun', {
      name: '夕阳墙头', zone: 'right', night: false, text: '#f8e7c4', shadow: 'rgba(36,22,38,0.88)', accent: '#f4a64e', bloom: 0.3,
      draw(g, c) {
        const t = c.lt;
        const tGua = charLt(c, 0, 1, FB2), tDe = charLt(c, 6, 1, FB2);
        // 镜头：第4句「挂」起缓缓下移 60px，并 1.00→1.04 缓推，「得」停住
        const e = smooth((t - tGua) / Math.max(0.5, tDe - tGua));
        const dy = 60 * e, z = 1 + 0.04 * e;
        g.save();
        g.translate(640, 360); g.scale(z, z); g.translate(-640, -360 - dy);
        // 天空与晚霞（云极慢向左飘）
        const sky = K.cache('a2sky', 1400, 420, 1, paintSky);
        g.drawImage(sky, -40 - 3 * (t + 1), 0, 1400, 420);
        // 太阳：整镜下沉 8px，强拍微亮
        const sunY = SUN.y + 8 * clamp((t + 0.7) / (c.dur + 0.7));
        const pulse = 1 + 0.08 * de(c, 0.7);
        glowAt(g, SUN.x, sunY, 300, 210, '#ffd9a0', 0.42 * pulse);
        glowAt(g, SUN.x, sunY, 150, 130, '#fff1cf', 0.55 * pulse);
        const dg = g.createRadialGradient(SUN.x - 14, sunY - 18, 4, SUN.x, sunY, SUN.r);
        dg.addColorStop(0, '#fffaf0'); dg.addColorStop(0.7, '#ffe9bf'); dg.addColorStop(1, '#fbd28e');
        g.fillStyle = dg; g.beginPath(); g.arc(SUN.x, sunY, SUN.r, 0, TAU); g.fill();
        glowAt(g, SUN.x, sunY - 10, 110, 96, '#ffffff', 0.18 * (pulse - 1) / 0.08 + 0.08);
        // 墙后远景
        const far = K.cache('a2far', 1400, 440, 1, paintFar);
        g.drawImage(far, -40, 0, 1400, 440);
        // 墙、门、台阶、地面
        const wall = K.cache('a2wall', WW, WH, 1, paintWall);
        g.drawImage(wall, WX0, WY0, WW, WH);
        drawTufts(g, t);
        // 墙脊上溢出的日光（随太阳亮度）
        glowAt(g, SUN.x, RIDGE + 2, 170, 26, '#ffe2a8', 0.5 * pulse);
        // 人：接触阴影 + 剪影
        g.fillStyle = 'rgba(14,10,18,0.5)';
        g.beginPath(); g.ellipse(MAN.x + 6, T1 + 1, 34, 3.5, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(MAN.x + 52, GROUND + 0.5, 22, 3, 0, 0, TAU); g.fill();
        XYT.sil.draw(g, 'old', 'sitSide', MAN.x, MAN.y, MAN.h, t + 2, {
          facing: 1, wind: 0.2, windDir: -1, body: '#211b26', rim: '#b98c70', rimSide: 1, rimWidth: 1.2,
        });
        g.restore();
        // 前景：柿子枝（在镜头前方更近，视差略大）
        g.save();
        const pz = 1 + 0.05 * e;
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
})();
