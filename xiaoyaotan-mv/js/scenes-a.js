/* 逍遥叹 · 音乐动画 —— 场景（一）：云山 孤舟 月夜 醉月 蝶梦 诗卷 剑气 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const A = XYT.art;
  const { W, H, TAU, clamp, lerp, easeOut, easeInOut, h2, rgba } = A;
  const SC = (XYT.scenes = XYT.scenes || {});
  const sp = () => XYT.sprites;

  function stars(g, c, n, maxY, seed, col) {
    for (let i = 0; i < n; i++) {
      const x = h2(i, seed) * W, y = h2(i, seed + 1) * maxY;
      let a = 0.35 + 0.35 * Math.sin(c.t * (0.8 + h2(i, seed + 2) * 2) + i);
      if (A.hash(i * 31 + c.b.i * 977 + seed) < 0.14) a += 0.6 * c.be(0.3);
      g.fillStyle = rgba(col || '#fff6e0', clamp(a, 0, 1));
      const r = 0.6 + h2(i, seed + 3) * 1.3;
      g.fillRect(x - r / 2, y - r / 2, r, r);
    }
  }
  function fireflies(g, c, n, box, col) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = box[0] + (A.noise1(c.t * 0.15 + i * 3.1, 5) * 1.3 - 0.15) * (box[2] - box[0]);
      const y = box[1] + (A.noise1(c.t * 0.12 + i * 7.7, 6) * 1.3 - 0.15) * (box[3] - box[1]);
      let a = 0.25 + 0.35 * Math.sin(c.t * 2 + i * 1.7);
      if (A.hash(i * 17 + c.b.i * 131) < 0.3) a += 0.6 * c.be(0.35);
      A.glow(g, x, y, 10, col || '#d8f08a', clamp(a, 0, 1));
    }
    g.globalCompositeOperation = 'source-over';
  }
  XYT.sceneUtil = { stars, fireflies };

  // ---------- 云山 ----------
  SC.mist = {
    night: false, text: '#1c1a17', shadow: 'rgba(246,240,226,0.95)', accent: '#b3261e',
    draw(g, c) {
      const lt = c.lt, v = c.variant % 2;
      A.fillV(g, 0, H, v ? [[0, '#e6d9c2'], [0.55, '#f2e8d4'], [1, '#e2d6bf']] : [[0, '#e7e0ce'], [0.55, '#f4efe2'], [1, '#e6dfcc']]);
      const sx = v ? 300 : 960;
      A.glow(g, sx, 168, 170, '#ec9a6a', 0.22 + 0.12 * c.rms);
      g.fillStyle = rgba('#c4432b', 0.85);
      g.beginPath(); g.arc(sx, 168, 46 * (1 + 0.035 * c.be(0.3)), 0, TAU); g.fill();
      A.drawMountain(g, sp().mtn.far[0], '#64717d', 0.55, lt * 6 + 200, 480);
      A.drawFog(g, '#f4efe2', 0.85, -lt * 10, 450, 200);
      A.drawMountain(g, sp().mtn.mid[0], '#3d4853', 0.8, lt * 13 + 600, 575);
      A.drawFog(g, '#f4efe2', 0.65 + 0.2 * c.be(0.5), -lt * 16 + 300, 555, 220);
      A.drawMountain(g, sp().mtn.near[1], '#20262b', 0.88, lt * 24 + 900, 770);
      const nb = 5 + Math.round(4 * c.inten);
      for (let k = 0; k < nb; k++) {
        const bx = W + 60 - ((lt * (34 + k * 2) + k * 47) % (W + 200));
        const by = 250 + Math.sin(k * 2.1) * 40 + Math.sin(lt * 0.7 + k) * 8 + k * 6;
        A.bird(g, bx, by, 1 + 0.15 * (k % 3), c.b.x * TAU * 2 + k * 0.7, rgba('#1c1f23', 0.8));
      }
      // 崖与松
      g.fillStyle = A.vgrad(g, 470, H, [[0, '#15181c'], [1, '#2b3036']]);
      g.beginPath();
      g.moveTo(960, H + 10); g.quadraticCurveTo(985, 575, 1035, 522); g.lineTo(1125, 506);
      g.quadraticCurveTo(1205, 478, 1300, 486); g.lineTo(1300, H + 10); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(240,232,214,0.12)'; g.lineWidth = 1.4;
      for (let k = 0; k < 9; k++) { const x = 1010 + k * 30; g.beginPath(); g.moveTo(x, 540 + (k % 3) * 8); g.quadraticCurveTo(x - 12, 600, x - 6, 690); g.stroke(); }
      const sway = Math.sin(c.t * 0.9) * 0.02 + 0.02 * c.be(0.4);
      g.save(); g.translate(1200, 490); g.rotate(sway);
      g.strokeStyle = '#17191c'; g.lineCap = 'round'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-20, -60, -80, -110); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(-40, -70); g.quadraticCurveTo(-10, -100, 30, -112); g.stroke();
      g.fillStyle = '#1b2421';
      for (const [px, py, s] of [[-84, -114, 1], [-50, -90, 0.8], [26, -114, 0.9], [-110, -100, 0.7], [-6, -126, 0.7]]) {
        g.beginPath(); g.ellipse(px, py, 46 * s, 12 * s, -0.08, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(px + 8, py - 9 * s, 30 * s, 8 * s, -0.08, 0, TAU); g.fill();
      }
      g.restore();
      A.hero(g, 1085, 512, 0.72, c.t, { facing: -1, wind: 0.3 + 0.35 * c.inten });
      A.drawFog(g, '#efe8d8', 0.45, -lt * 30, 700, 160);
    },
  };

  // ---------- 孤舟 ----------
  SC.boat = {
    night: false, text: '#1c1a17', shadow: 'rgba(246,238,220,0.95)', accent: '#b3261e',
    draw(g, c) {
      const lt = c.lt, t = c.t, hz = 430;
      A.fillV(g, 0, hz, [[0, '#dccbaa'], [1, '#f1e4c8']]);
      A.glow(g, 640, 336, 220, '#f0a070', 0.3 + 0.1 * c.rms);
      g.fillStyle = rgba('#c64a2e', 0.85);
      g.beginPath(); g.arc(640, 336, 54 * (1 + 0.03 * c.be(0.3)), 0, TAU); g.fill();
      A.drawMountain(g, sp().mtn.far[1], '#8b8a82', 0.6, lt * 4 + 100, hz + 4, 0.7);
      A.drawMountain(g, sp().mtn.mid[1], '#5b5d58', 0.5, lt * 7 + 400, hz + 8, 0.45);
      A.fillV(g, hz, H, [[0, '#e3d4b5'], [1, '#c8b998']]);
      g.save(); g.translate(0, hz * 2 + 8); g.scale(1, -1);
      A.drawMountain(g, sp().mtn.far[1], '#8b8a82', 0.16, lt * 4 + 100, hz + 4, 0.7);
      g.restore();
      for (let i = 0; i < 22; i++) {
        const y = hz + 6 + i * 8.5, w = (58 - i * 2.2) * (1 + 0.25 * Math.sin(t * 2.2 + i * 1.9));
        const x = 640 + Math.sin(t * 1.6 + i) * 6;
        g.fillStyle = rgba('#c64a2e', 0.5 * (1 - i / 22) * (0.85 + 0.3 * c.be(0.5)));
        g.fillRect(x - w / 2, y, w, 2.2);
      }
      g.strokeStyle = 'rgba(255,250,235,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const y = hz + 20 + h2(i, 4) * 260, x = ((h2(i, 5) * W + lt * 8) % (W + 200)) - 100, w = 40 + h2(i, 6) * 120;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
      }
      const bx = 330 + Math.min(lt, 40) * 12, by = 528 + Math.sin(t * 1.5) * 2;
      const oarAt = (tt) => 0.95 - 0.38 * Math.cos(c.grid.info(tt).ph * TAU);
      for (let k = 0; k < 4; k++) {
        const tb = c.grid.time(c.b.i - k), age = t - tb;
        if (age < 0 || age > 2.6) continue;
        const rx = bx - 60 - 120 * Math.cos(0.95) - age * 8, ry = by + 12;
        const r = 10 + age * 46;
        g.strokeStyle = rgba('#fff8e6', 0.5 * (1 - age / 2.6) * c.grid.strength(c.b.i - k));
        g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(rx, ry, r, r * 0.22, 0, 0, TAU); g.stroke();
      }
      g.strokeStyle = 'rgba(255,248,230,0.4)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(bx - 120, by - 2); g.quadraticCurveTo(bx - 260, by + 6, bx - 420, by + 22); g.stroke();
      g.beginPath(); g.moveTo(bx - 110, by + 4); g.quadraticCurveTo(bx - 250, by + 18, bx - 400, by + 40); g.stroke();
      A.boat(g, bx, by, 0.9, '#1d1c1b');
      A.hero(g, bx - 70, by - 8, 0.5, t, { facing: -1, pose: 'row', oar: oarAt(t), wind: 0.25 });
      for (let k = 0; k < 3; k++) A.bird(g, 860 + k * 40 + lt * 6, 210 + k * 12, 0.9, c.b.x * TAU + k, 'rgba(40,36,30,0.75)');
      g.strokeStyle = '#26231f'; g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const x0 = -10 + i * 9 + h2(i, 8) * 8, hgt = 110 + h2(i, 9) * 110;
        const sw = Math.sin(t * 1.2 + i * 0.5) * 10 + 8 * c.be(0.5);
        g.lineWidth = 1.4 + h2(i, 10);
        g.beginPath(); g.moveTo(x0, H + 4); g.quadraticCurveTo(x0 + sw * 0.3, H - hgt * 0.5, x0 + sw, H - hgt); g.stroke();
        if (i % 3 === 0) { g.fillStyle = '#3b332a'; g.beginPath(); g.ellipse(x0 + sw, H - hgt - 8, 3, 10, sw * 0.02, 0, TAU); g.fill(); }
      }
    },
  };

  // ---------- 月夜 ----------
  SC.moon = {
    night: true, text: '#f4e8c8', shadow: 'rgba(8,12,30,0.9)', accent: '#e6b85c',
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 470;
      A.fillV(g, 0, hz, [[0, '#0b1430'], [0.6, '#1b2c55'], [1, '#2f426f']]);
      stars(g, c, 80, hz - 60, 3);
      A.moonDisc(g, 780, 200, 78, '#f3e3b6', 1, 0.3 + 0.18 * c.be(0.45) + 0.1 * c.rms);
      A.drawMountain(g, sp().mtn.far[0], '#22355f', 0.95, lt * 3 + 500, hz + 4, 0.8);
      A.drawMountain(g, sp().mtn.mid[1], '#152348', 0.95, lt * 5 + 200, hz + 8, 0.5);
      A.fillV(g, hz, H, [[0, '#1d2d57'], [1, '#090f24']]);
      for (let i = 0; i < 26; i++) {
        const y = hz + 6 + i * 8.6, w = (44 - i * 0.9) * (1 + 0.3 * Math.sin(t * 2.3 + i * 1.7));
        const x = 780 + Math.sin(t * 1.7 + i) * 6;
        g.fillStyle = rgba('#f6e7bd', 0.55 * (1 - i / 26) * (0.8 + 0.4 * c.be(0.5)));
        g.fillRect(x - w / 2, y, w, 2);
      }
      g.fillStyle = '#070b1a';
      g.beginPath(); g.moveTo(-10, hz + 12); g.quadraticCurveTo(200, hz - 6, 420, hz + 14); g.lineTo(440, hz + 26); g.lineTo(-10, hz + 30); g.closePath(); g.fill();
      A.pavilion(g, 160, hz + 14, 0.62, '#070b1a', 0.7 + 0.3 * Math.sin(t * 9));
      A.maiden(g, 330, hz + 16, 0.62, t, { facing: 1, wind: 0.35 + 0.3 * c.inten, color: '#090d1c' });
      // 荷叶与花
      g.fillStyle = '#0d2529';
      for (const [x, y, rx] of [[930, 640, 70], [1060, 690, 90], [1200, 610, 60], [850, 700, 60], [1240, 700, 80]]) {
        g.beginPath(); g.ellipse(x, y, rx, rx * 0.28, 0, 0.15, TAU - 0.15); g.lineTo(x, y); g.closePath(); g.fill();
      }
      const segB = c.grid.pos(c.seg.start);
      const open = clamp(c.b.x - segB, 0, 9);
      const fx = 1010, fy = 632;
      g.fillStyle = '#0f3b31'; g.fillRect(fx - 1.5, fy, 3, 40);
      for (let k = 0; k < 8; k++) {
        const o = easeOut(open - k);
        if (o <= 0) continue;
        const ang = -Math.PI / 2 + (k - 3.5) * 0.32 * (0.6 + 0.4 * o);
        g.save(); g.translate(fx, fy); g.rotate(ang + Math.PI / 2);
        const gr = g.createLinearGradient(0, 0, 0, -38);
        gr.addColorStop(0, '#f7d6dc'); gr.addColorStop(1, '#e27a92');
        g.fillStyle = gr; g.globalAlpha = 0.95 * o;
        g.beginPath(); g.ellipse(0, -20 * o, 8, 20 * o, 0, 0, TAU); g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
      if (open > 1) A.glow(g, fx, fy - 18, 50, '#ffd7e0', 0.25 + 0.2 * c.be(0.4));
      const age = c.b.sinceDown;
      if (age < 2) {
        g.strokeStyle = rgba('#f6e7bd', 0.4 * (1 - age / 2)); g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(fx, fy + 30, 20 + age * 120, (20 + age * 120) * 0.2, 0, 0, TAU); g.stroke();
      }
      fireflies(g, c, 22, [380, 300, 1250, 650]);
    },
  };

  // ---------- 醉月 ----------
  SC.wine = {
    night: true, text: '#f6e6c6', shadow: 'rgba(14,10,26,0.9)', accent: '#e0a95a',
    draw(g, c) {
      const t = c.t;
      A.fillV(g, 0, H, [[0, '#110e25'], [0.7, '#2a2142'], [1, '#3e2b45']]);
      stars(g, c, 50, 420, 9);
      A.moonDisc(g, 560, 168, 70, '#f6e3b8', 1, 0.32 + 0.15 * c.be(0.45));
      A.drawMountain(g, sp().mtn.far[1], '#2b2341', 0.95, c.lt * 3, 575, 0.8);
      const sw = Math.sin(t * 0.7) * 0.02 + 0.025 * c.be(0.4);
      g.save(); g.translate(1300, -30); g.scale(-1, 1); g.rotate(sw);
      g.drawImage(sp().plum, 0, 0, 560, 368);
      g.restore();
      for (let i = 0; i < 16; i++) {
        const x = 760 + ((h2(i, 2) * 520 + Math.sin(t * 0.6 + i) * 40 - c.lt * 10) % 560);
        const y = ((h2(i, 3) * 700 + t * (22 + h2(i, 4) * 18)) % 720);
        g.fillStyle = 'rgba(248,236,236,0.8)';
        g.beginPath(); g.ellipse(x, y, 3.2, 2, t + i, 0, TAU); g.fill();
      }
      g.fillStyle = A.vgrad(g, 596, H, [[0, '#231b26'], [1, '#0f0b12']]);
      g.fillRect(-20, 596, W + 40, H);
      g.fillStyle = 'rgba(255,230,190,0.14)'; g.fillRect(-20, 596, W + 40, 2);
      // 酒坛
      const jx = 1010, jy = 600;
      g.fillStyle = '#2c1b15';
      g.beginPath(); g.moveTo(jx - 52, jy); g.quadraticCurveTo(jx - 90, jy - 70, jx - 50, jy - 130); g.lineTo(jx + 50, jy - 130); g.quadraticCurveTo(jx + 90, jy - 70, jx + 52, jy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,220,170,0.08)'; g.beginPath(); g.ellipse(jx - 30, jy - 80, 10, 36, 0.2, 0, TAU); g.fill();
      g.fillStyle = '#6b4632'; g.beginPath(); g.ellipse(jx, jy - 136, 56, 16, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(jx - 56, jy - 136); g.quadraticCurveTo(jx, jy - 176, jx + 56, jy - 136); g.fill();
      g.strokeStyle = '#b3261e'; g.lineWidth = 3; g.beginPath(); g.moveTo(jx - 52, jy - 128); g.quadraticCurveTo(jx, jy - 120, jx + 52, jy - 128); g.stroke();
      g.fillStyle = '#e8d9b8'; g.fillRect(jx - 22, jy - 104, 44, 56);
      g.fillStyle = '#1c140f'; g.font = `38px ${XYT.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('酒', jx, jy - 76);
      // 酒碗与落滴
      const cx = 780, top = 556;
      g.fillStyle = '#d9cbb0';
      g.beginPath(); g.moveTo(cx - 74, top); g.quadraticCurveTo(cx - 64, top + 46, cx - 22, top + 44); g.lineTo(cx + 22, top + 44); g.quadraticCurveTo(cx + 64, top + 46, cx + 74, top); g.closePath(); g.fill();
      g.fillStyle = '#b8a27c'; g.fillRect(cx - 24, top + 42, 48, 6);
      g.fillStyle = '#3a1c12'; g.beginPath(); g.ellipse(cx, top, 70, 13, 0, 0, TAU); g.fill();
      A.glow(g, cx + 14, top - 1, 26, '#fff0c8', 0.55 + 0.25 * c.be(0.4));
      const age = c.b.since;
      for (let k = 0; k < 2; k++) {
        const a2 = age - k * 0.12;
        if (a2 < 0 || a2 > 0.9) continue;
        g.strokeStyle = rgba('#f6dfae', 0.6 * (1 - a2 / 0.9)); g.lineWidth = 1.3;
        const r = 6 + a2 * 70;
        g.beginPath(); g.ellipse(cx, top, Math.min(66, r), Math.min(12, r * 0.19), 0, 0, TAU); g.stroke();
      }
      const tn = c.grid.time(c.b.i + 1), fall = Math.min(0.34, c.b.period * 0.5);
      if (t > tn - fall) {
        const q = (t - (tn - fall)) / fall;
        const y = lerp(300, top, q * q);
        g.fillStyle = '#f0c27a';
        g.beginPath(); g.arc(cx, y, 4, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(cx - 4, y); g.lineTo(cx, y - 11); g.lineTo(cx + 4, y); g.fill();
      }
    },
  };

  // ---------- 蝶梦 ----------
  SC.dream = {
    night: true, text: '#f1ecff', shadow: 'rgba(20,10,50,0.9)', accent: '#9fe3ff',
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const gr = g.createRadialGradient(640, 380, 40, 640, 380, 820);
      gr.addColorStop(0, '#3d2f72'); gr.addColorStop(0.5, '#1f1847'); gr.addColorStop(1, '#0c0a22');
      g.fillStyle = gr; g.fillRect(-40, -40, W + 80, H + 80);
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 5; k++) {
        const a = lt * 0.05 + k * 1.3;
        A.glow(g, 640 + Math.cos(a) * 380, 360 + Math.sin(a * 1.3) * 200, 260, k % 2 ? '#7c5fd6' : '#3fa9cf', 0.18);
      }
      g.globalCompositeOperation = 'source-over';
      stars(g, c, 110, H, 21, '#e9e4ff');
      for (let k = 0; k < 6; k++) {
        const x = ((h2(k, 30) * W + lt * (8 + k * 3)) % (W + 300)) - 150, y = 120 + h2(k, 31) * 480;
        A.xiangyun(g, x, y, 1 + h2(k, 32) * 0.8, '#d8bd7a', 0.28, 0);
      }
      A.glow(g, 640, 470, 240, '#9cc8ff', 0.25 + 0.15 * c.rms);
      const breath = 0.18 + 0.12 * Math.sin(t * 1.2) + 0.1 * c.be(0.5);
      A.maiden(g, 640, 600, 1.15, t, { facing: 1, wind: 0.6, color: `rgba(205,215,255,${breath})`, scarf: `rgba(170,235,255,${breath + 0.2})`, pin: 'rgba(255,230,160,0.6)' });
      const n = 10 + Math.round(6 * c.inten);
      for (let k = 0; k < n; k++) {
        const th = lt * 0.35 * (1 + (k % 4) * 0.08) + (k * TAU) / n;
        const rx = 250 + 70 * Math.sin(lt * 0.3 + k), ry = 150 + 50 * Math.cos(lt * 0.4 + k * 2);
        const x = 640 + Math.cos(th) * rx, y = 400 + Math.sin(th) * ry - 30 * Math.sin(lt * 0.8 + k);
        const col = k % 3 === 0 ? '#ffd98a' : '#9fe7ff';
        g.globalCompositeOperation = 'lighter';
        A.glow(g, x, y, 26, col, 0.45);
        g.globalCompositeOperation = 'source-over';
        A.butterfly(g, x, y, 1 + (k % 3) * 0.2, c.b.x * TAU * 2 + k * 0.6, col, Math.sin(th) * 0.4);
      }
      const sd = c.b.sinceDown, dd = Math.max(0.6, c.b.period);
      if (sd < dd) {
        const u = sd / dd;
        g.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 24; j++) {
          const a = (j * TAU) / 24 + c.b.bar;
          const r = easeOut(u) * (180 + 80 * h2(j, c.b.bar));
          A.glow(g, 640 + Math.cos(a) * r, 430 + Math.sin(a) * r * 0.7, 8, '#cfefff', (1 - u) * 0.9);
        }
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = rgba('#cfe6ff', 0.35 * (1 - u)); g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(640, 430, 60 + u * 420, (60 + u * 420) * 0.6, 0, 0, TAU); g.stroke();
      }
    },
  };

  // ---------- 诗卷 ----------
  SC.poem = {
    night: false, text: '#f3e7cf', shadow: 'rgba(20,14,10,0.9)', accent: '#e0a95a',
    draw(g, c) {
      const t = c.t;
      A.fillV(g, 0, H, [[0, '#2b231d'], [1, '#17120f']]);
      g.globalAlpha = 0.08;
      g.fillStyle = g.createPattern(sp().paper, 'repeat');
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      const bar = c.grid.barDur(c.seg.start + 0.01);
      const u = easeInOut(c.lt / (bar * 0.6));
      const wpx = 70 + u * 940, x0 = 640 - wpx / 2, y0 = 118, hh = 444;
      g.fillStyle = '#b6a27a'; g.fillRect(x0, y0, wpx, hh);
      g.fillStyle = '#efe5cf'; g.fillRect(x0, y0 + 16, wpx, hh - 32);
      g.save();
      g.beginPath(); g.rect(x0, y0 + 16, wpx, hh - 32); g.clip();
      g.globalAlpha = 0.35; g.globalCompositeOperation = 'multiply';
      g.fillStyle = g.createPattern(sp().paper, 'repeat'); g.fillRect(x0, y0, wpx, hh);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const openB = c.grid.pos(c.seg.start) + 2;
      const prog = c.b.x - openB;
      const ch = c.seg.char || '叹';
      g.font = `300px ${XYT.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const m = g.getTransform();
      g.save();
      g.translate(640, 340); g.rotate(-0.55);
      g.beginPath();
      const nb = 8, bw = 72;
      let front = null;
      for (let k = 0; k < nb; k++) {
        const pr = easeOut((prog - k * 0.5) / 0.5);
        if (pr <= 0) continue;
        const bx = -290 + k * bw;
        g.rect(bx, -320, bw + 1, 640 * pr);
        front = [bx + bw / 2, -320 + 640 * pr];
      }
      g.setTransform(m);
      g.clip();
      g.shadowColor = 'rgba(30,20,12,0.35)'; g.shadowBlur = 16;
      g.fillStyle = '#17110c';
      g.fillText(ch, 640, 344);
      g.shadowBlur = 0;
      g.restore();
      if (front && prog < nb * 0.5 + 0.5) {
        const a = -0.55, fx = 640 + front[0] * Math.cos(a) - front[1] * Math.sin(a), fy = 340 + front[0] * Math.sin(a) + front[1] * Math.cos(a);
        g.save(); g.translate(fx, fy); g.rotate(-0.5);
        g.fillStyle = '#5b3a22'; g.fillRect(-4, -150, 8, 120);
        g.fillStyle = '#d8c39a'; g.fillRect(-5, -34, 10, 8);
        g.fillStyle = '#120c08'; g.beginPath(); g.moveTo(-6, -26); g.quadraticCurveTo(-8, -6, 0, 6); g.quadraticCurveTo(8, -6, 6, -26); g.closePath(); g.fill();
        g.restore();
      }
      const insc = c.seg.inscription || '逍遥叹';
      g.font = `24px ${XYT.FONT}`; g.fillStyle = 'rgba(30,22,16,0.72)';
      Array.from(insc).slice(0, 12).forEach((cc, k) => {
        const a = clamp((prog - 1 - k * 0.25) / 0.5);
        g.globalAlpha = a; g.fillText(cc, x0 + Math.min(150, wpx * 0.16), 170 + k * 28);
      });
      g.globalAlpha = 1;
      for (let k = 0; k < 6; k++) {
        const bi = c.b.i - k;
        if (bi < openB) continue;
        const age = t - c.grid.time(bi);
        const a = clamp(age / 0.15) * 0.75;
        const px = 640 + (h2(bi, 1) - 0.5) * 760, py = 190 + h2(bi, 2) * 320;
        g.fillStyle = `rgba(20,14,10,${a})`;
        g.beginPath(); g.arc(px, py, 2 + h2(bi, 3) * 6, 0, TAU); g.fill();
        g.beginPath(); g.arc(px + 9, py + 5, 1.5, 0, TAU); g.fill();
      }
      const sealB = openB + nb * 0.5 + 1;
      const sa = c.b.x - sealB;
      if (sa > 0) {
        const k = easeOut(sa / 0.5), sc = 1 + 0.4 * (1 - k);
        g.save(); g.translate(812, 470); g.scale(sc, sc);
        A.seal(g, 0, 0, 56, '逍遥', k);
        g.restore();
      }
      g.restore();
      for (const sx of [x0 - 10, x0 + wpx - 4]) {
        g.fillStyle = '#3b2416'; g.fillRect(sx, y0 - 14, 14, hh + 28);
        g.fillStyle = '#7a5434'; g.fillRect(sx + 2, y0 - 20, 10, 8); g.fillRect(sx + 2, y0 + hh + 12, 10, 8);
        g.fillStyle = 'rgba(255,230,190,0.15)'; g.fillRect(sx + 3, y0 - 14, 3, hh + 28);
      }
    },
  };

  // ---------- 剑气 ----------
  SC.sword = {
    night: true, text: '#eef4ff', shadow: 'rgba(5,8,14,0.95)', accent: '#8fe0ff', shake: true,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      A.fillV(g, 0, H, [[0, '#0b0f17'], [0.6, '#1b2331'], [1, '#2b3442']]);
      for (let k = 0; k < 6; k++) {
        const cl = XYT.sprites.tint(sp().clouds[k % 3], '#3b4556');
        const spd = 40 + k * 22, x = ((k * 360 - lt * spd) % (W + 600) + W + 600) % (W + 600) - 400;
        g.globalAlpha = 0.55; g.drawImage(cl, x, 40 + (k % 3) * 70, 620, 250); g.globalAlpha = 1;
      }
      const sd = c.b.sinceDown, strong = c.b.str > 0.6 && c.b.bar % 2 === 0;
      if (strong && sd < 0.5) {
        const a = Math.exp(-sd / 0.1);
        g.fillStyle = `rgba(200,220,255,${0.18 * a * c.inten})`; g.fillRect(0, 0, W, H);
        const r = A.rng(c.b.bar * 7 + 3);
        let x = 700 + r() * 500, y = 0;
        g.strokeStyle = `rgba(220,235,255,${0.8 * a})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y);
        while (y < 470) { x += (r() - 0.5) * 60; y += 20 + r() * 30; g.lineTo(x, y); }
        g.stroke();
      }
      A.drawMountain(g, sp().mtn.far[1], '#262f3d', 1, lt * 6 + 300, 560, 0.85);
      A.drawMountain(g, sp().mtn.mid[0], '#121822', 1, lt * 12 + 700, 650, 0.8);
      g.fillStyle = '#080b10';
      g.beginPath(); g.moveTo(250, H + 10); g.quadraticCurveTo(300, 640, 380, 616); g.lineTo(500, 610); g.quadraticCurveTo(560, 630, 600, H + 10); g.closePath(); g.fill();
      const swing = -1.5 + 1.05 * Math.exp(-c.b.since / 0.11);
      A.hero(g, 440, 614, 0.9, t, { facing: 1, pose: 'hold', wind: 0.9, swordAngle: swing, color: '#05070b', belt: 'rgba(140,200,255,0.25)' });
      const tipX = 440 + 0.9 * (30 + Math.cos(swing) * 96), tipY = 614 + 0.9 * (-144 + Math.sin(swing) * 96);
      g.globalCompositeOperation = 'lighter';
      A.glow(g, tipX, tipY, 20 + 30 * c.be(0.2), '#9fe8ff', 0.8);
      for (let k = 0; k < 3; k++) {
        const bi = c.b.i - k, age = t - c.grid.time(bi), dur = 1.3 * c.b.period;
        if (age < 0 || age > dur) continue;
        const u = age / dur, s = c.grid.strength(bi);
        const x = 540 + easeOut(u) * 820, y = 470 - u * 140 + (h2(bi, 3) - 0.5) * 120;
        const R = (60 + 90 * u) * (0.7 + 0.5 * s), al = Math.pow(1 - u, 1.2) * (0.6 + 0.4 * s);
        const rot = (h2(bi, 4) - 0.5) * 0.6;
        g.save(); g.translate(x, y); g.rotate(rot);
        const grd = g.createLinearGradient(-R, 0, R * 0.3, 0);
        grd.addColorStop(0, 'rgba(120,220,255,0)'); grd.addColorStop(1, `rgba(220,248,255,${al})`);
        g.fillStyle = grd;
        g.beginPath(); g.arc(0, 0, R, -1.15, 1.15); g.arc(-R * 0.38, 0, R * 0.88, 1.05, -1.05, true); g.closePath(); g.fill();
        g.restore();
        A.glow(g, x, y, R * 0.9, '#6fd4ff', al * 0.35);
      }
      if (sd < 0.6 && c.inten > 0.6) {
        const u = sd / 0.6, y = 380 + h2(c.b.bar, 9) * 120;
        const len = easeOut(sd / 0.12);
        g.strokeStyle = `rgba(230,250,255,${(1 - u) * 0.9})`; g.lineWidth = 3 * (1 - u) + 1;
        g.beginPath(); g.moveTo(-20, y + 40); g.lineTo(-20 + (W + 40) * len, y - 40); g.stroke();
        A.glow(g, W * len * 0.9, y - 30, 80, '#bff0ff', (1 - u) * 0.5);
      }
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgba(190,210,230,0.18)'; g.lineWidth = 1;
      for (let i = 0; i < 70; i++) {
        const x = ((h2(i, 1) * (W + 300) - t * 500) % (W + 300) + W + 300) % (W + 300) - 150;
        const y = ((h2(i, 2) * H + t * 260) % H);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 26, y + 10); g.stroke();
      }
    },
  };
})();
