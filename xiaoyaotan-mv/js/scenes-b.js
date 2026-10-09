/* 逍遥叹 · 音乐动画 —— 场景（二）：御剑 红尘 烟雨 情丝 往事 逍遥 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const A = XYT.art;
  const { W, H, TAU, clamp, lerp, easeOut, h2, rgba } = A;
  const SC = (XYT.scenes = XYT.scenes || {});
  const { stars, fireflies } = XYT.sceneUtil;
  const sp = () => XYT.sprites;

  // 节拍阵风：每拍给一次推力，随时间衰减（无状态，可任意跳转）
  function gust(c, amp, tau, base) {
    const g = c.grid, i = c.b.i;
    let s = 0;
    for (let k = 0; k < 6; k++) s += Math.exp(-Math.max(0, c.t - g.time(i - k)) / tau);
    return base * c.t + amp * (i + 1 - s);
  }

  function cloudRow(g, c, y, speed, scale, tintLit, alpha, seed) {
    const cl = sp().clouds;
    const span = 330 * scale, total = W + span * 2;
    for (let k = 0; k < 7; k++) {
      const x = ((((k * span - c.lt * speed + h2(k, seed) * 80) % total) + total) % total) - span;
      const img = XYT.sprites.tint(cl[(k + seed) % 3], tintLit);
      g.globalAlpha = alpha;
      g.drawImage(img, x, y - 90 * scale + h2(k, seed + 1) * 30, 420 * scale, 170 * scale);
    }
    g.globalAlpha = 1;
  }

  // ---------- 御剑 ----------
  SC.flight = {
    night: false, text: '#fffaf0', shadow: 'rgba(70,40,50,0.75)', accent: '#ffe08a',
    draw(g, c) {
      const t = c.t, lt = c.lt;
      A.fillV(g, 0, H, [[0, '#23446e'], [0.45, '#7b7aa1'], [0.7, '#e29f7a'], [1, '#f6d4a1']]);
      A.glow(g, 980, 470, 320, '#ffd9a0', 0.55 + 0.15 * c.rms);
      g.fillStyle = '#fff1cc'; g.beginPath(); g.arc(980, 470, 52, 0, TAU); g.fill();
      A.drawMountain(g, sp().mtn.far[1], '#5b6b93', 0.55, lt * 18, 530, 0.9);
      cloudRow(g, c, 500, 60, 1.0, '#e8c3b8', 0.7, 1);
      cloudRow(g, c, 560, 140, 1.4, '#f7dccf', 0.75, 2);
      const pos = (tt) => [470 + Math.sin(tt * 0.6) * 34, 360 + Math.sin(tt * 1.3) * 14];
      g.globalCompositeOperation = 'lighter';
      for (let k = 24; k >= 1; k--) {
        const [px, py] = pos(t - k * 0.035);
        A.glow(g, px - 10 - k * 13, py + 6, 16 - k * 0.4, '#bfe9ff', 0.35 * (1 - k / 25));
      }
      g.globalCompositeOperation = 'source-over';
      const [hx, hy] = pos(t);
      g.strokeStyle = '#dff6ff'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(hx - 66, hy + 6); g.lineTo(hx + 64, hy + 3); g.stroke();
      g.strokeStyle = '#2a2230'; g.lineWidth = 5; g.beginPath(); g.moveTo(hx - 66, hy + 6); g.lineTo(hx - 48, hy + 5.5); g.stroke();
      A.hero(g, hx, hy, 0.62, t, { facing: 1, wind: 1, lean: -0.1, color: '#1d1724', sword: false });
      const sd = c.b.sinceDown;
      if (sd < 0.5) {
        const s = Math.exp(-sd / 0.18), fx = hx + 64, fy = hy + 3;
        g.globalCompositeOperation = 'lighter';
        A.glow(g, fx, fy, 40 * s + 10, '#ffffff', 0.9 * s);
        g.fillStyle = `rgba(255,255,255,${0.9 * s})`;
        g.beginPath(); g.moveTo(fx - 60 * s, fy); g.lineTo(fx, fy - 2); g.lineTo(fx + 60 * s, fy); g.lineTo(fx, fy + 2); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(fx, fy - 30 * s); g.lineTo(fx + 2, fy); g.lineTo(fx, fy + 30 * s); g.lineTo(fx - 2, fy); g.closePath(); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      if (c.inten > 0.8) for (let k = 0; k < 3; k++) {
        const x = 760 + k * 90 + Math.sin(t * 0.7 + k) * 20, y = 220 + k * 34 + Math.sin(t + k) * 8;
        A.crane(g, x, y, 0.6, c.b.x * TAU + k, { color: '#2a2230' });
      }
      cloudRow(g, c, 680, 300, 2.0, '#fff1e6', 0.8, 3);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.2;
      const k2 = 0.25 + 0.5 * c.be(0.3);
      for (let i = 0; i < 36; i++) {
        const sp2 = 700 + h2(i, 2) * 700;
        const x = ((h2(i, 1) * (W + 300) - lt * sp2) % (W + 300) + W + 300) % (W + 300) - 150;
        const y = h2(i, 3) * H, len = 50 + h2(i, 4) * 120;
        g.globalAlpha = k2 * (0.4 + 0.6 * h2(i, 5));
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
      }
      g.globalAlpha = 1;
    },
  };

  // ---------- 红尘 ----------
  SC.petals = {
    night: false, text: '#2a1a1c', shadow: 'rgba(250,238,234,0.95)', accent: '#c2304a',
    draw(g, c) {
      const t = c.t, lt = c.lt;
      A.fillV(g, 0, H, [[0, '#f2dfd8'], [0.6, '#f7ece5'], [1, '#ead5cb']]);
      A.glow(g, 900, 200, 260, '#ffffff', 0.4);
      A.drawMountain(g, sp().mtn.far[0], '#b39aa0', 0.45, lt * 5 + 700, 520, 0.9);
      A.drawFog(g, '#f7ece5', 0.8, -lt * 9, 500, 200);
      A.drawMountain(g, sp().mtn.mid[1], '#8c6f76', 0.35, lt * 9 + 100, 600, 0.6);
      A.fillV(g, 585, H, [[0, '#e9d6cf'], [1, '#dcc4bb']]);
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
      for (let i = 0; i < 10; i++) { const y = 600 + i * 12, x = ((h2(i, 7) * W + lt * 10) % W); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 80 + h2(i, 8) * 100, y); g.stroke(); }
      // 石拱桥与二人
      const bc = 820;
      g.fillStyle = 'rgba(52,38,40,0.9)';
      g.beginPath();
      g.moveTo(bc - 260, 600); g.quadraticCurveTo(bc, 470, bc + 260, 600); g.lineTo(bc + 260, 612);
      g.lineTo(bc + 130, 612); g.quadraticCurveTo(bc, 520, bc - 130, 612); g.lineTo(bc - 260, 612); g.closePath(); g.fill();
      g.fillStyle = 'rgba(52,38,40,0.22)';
      g.beginPath(); g.moveTo(bc - 130, 614); g.quadraticCurveTo(bc, 700, bc + 130, 614); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(52,38,40,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bc - 200, 560); g.quadraticCurveTo(bc, 452, bc + 200, 560); g.stroke();
      A.hero(g, bc - 34, 535, 0.48, t, { facing: 1, wind: 0.35, color: '#2b1f22' });
      A.maiden(g, bc + 30, 535, 0.46, t, { facing: -1, wind: 0.35, color: '#2b1f22', scarf: 'rgba(214,92,112,0.9)' });
      const sw = Math.sin(t * 0.8) * 0.018 + 0.03 * c.be(0.35);
      g.save(); g.translate(-40, -40); g.rotate(sw); g.drawImage(sp().branch, 0, 0, 700, 460); g.restore();
      const gx = gust(c, 26, 0.3, 14);
      const n = 60 + Math.round(50 * c.inten);
      for (let i = 0; i < n; i++) {
        const depth = 0.5 + h2(i, 3);
        const x = ((((h2(i, 1) * (W + 200) + gx * depth + Math.sin(t * (0.8 + h2(i, 4)) + i) * 30) % (W + 200)) + W + 200) % (W + 200)) - 100;
        const y = ((h2(i, 2) * (H + 80) + t * (30 + 40 * depth)) % (H + 80)) - 40;
        const spin = t * (1.5 + h2(i, 5) * 2) + i;
        g.save(); g.translate(x, y); g.rotate(spin * 0.6); g.scale(Math.cos(spin) * depth, depth);
        g.fillStyle = i % 4 ? '#f0a9b5' : '#e57f93';
        g.beginPath(); g.ellipse(0, 0, 6, 3.6, 0, 0, TAU); g.fill();
        g.restore();
      }
    },
  };

  // ---------- 烟雨 ----------
  SC.rain = {
    night: false, text: '#16191b', shadow: 'rgba(220,226,226,0.95)', accent: '#b8332a',
    draw(g, c) {
      const t = c.t, lt = c.lt, gy = 640;
      A.fillV(g, 0, H, [[0, '#8d979c'], [0.55, '#bcc2c0'], [1, '#a3aaa9']]);
      A.drawMountain(g, sp().mtn.far[0], '#7a858b', 0.5, lt * 3 + 900, 430, 0.8);
      A.drawFog(g, '#c9cecd', 0.7, -lt * 8, 420, 200);
      A.roofs(g, 470, '#6d777c', 3, 0.55);
      A.drawFog(g, '#c3c9c8', 0.55, -lt * 12 + 400, 500, 180);
      A.roofs(g, 545, '#3b4246', 8, 0.88);
      A.fillV(g, 560, H, [[0, '#6a7275'], [1, '#41484a']]);
      g.save();
      g.beginPath(); g.rect(0, gy, W, H - gy); g.clip();
      g.translate(0, gy * 2); g.scale(1, -1); g.globalAlpha = 0.22;
      A.maiden(g, 830, gy, 0.75, t, { facing: -1, wind: 0.25, color: '#20262a', scarf: 'rgba(220,220,220,0.5)' });
      A.umbrella(g, 838, gy - 120, 0.9, '#b8332a', -0.12);
      g.restore();
      g.globalAlpha = 1;
      A.maiden(g, 830, gy, 0.75, t, { facing: -1, wind: 0.25, color: '#1d2226', scarf: 'rgba(228,230,230,0.75)' });
      A.umbrella(g, 838, gy - 120, 0.9, '#b8332a', -0.12 + Math.sin(t * 0.9) * 0.02);
      for (let k = 0; k < 9; k++) {
        const bi = c.b.i - Math.floor(k / 3), age = t - c.grid.time(bi);
        if (age < 0 || age > 1.6) continue;
        const x = 80 + h2(bi * 3 + k, 11) * 1120, y = gy + 10 + h2(bi * 3 + k, 12) * 70, r = 6 + age * 40;
        g.strokeStyle = `rgba(230,236,236,${0.5 * (1 - age / 1.6)})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y, r, r * 0.25, 0, 0, TAU); g.stroke();
      }
      const n = Math.round((140 + 120 * c.inten) * (0.65 + 0.35 * c.de(0.8)));
      g.strokeStyle = 'rgba(235,240,242,0.42)'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = ((h2(i, 1) * (W + 200) + t * 90) % (W + 200)) - 100;
        const y = ((h2(i, 2) * (H + 60) + t * (720 + h2(i, 3) * 320)) % (H + 60)) - 30;
        const len = 16 + h2(i, 4) * 16;
        g.moveTo(x, y); g.lineTo(x + len * 0.18, y + len);
      }
      g.stroke();
    },
  };

  // ---------- 情丝 ----------
  SC.love = {
    night: true, text: '#fff4e6', shadow: 'rgba(30,12,30,0.95)', accent: '#ffc98e',
    draw(g, c) {
      const t = c.t, lt = c.lt;
      A.fillV(g, 0, H, [[0, '#2b2041'], [0.5, '#875470'], [0.78, '#df9a85'], [1, '#f3c99b']]);
      A.glow(g, 640, 600, 380, '#ffd0a0', 0.5);
      stars(g, c, 30, 220, 41);
      A.drawMountain(g, sp().mtn.far[0], '#5a3c55', 0.7, lt * 4 + 300, 590, 0.8);
      g.fillStyle = '#211627';
      g.beginPath(); g.moveTo(-20, H + 10); g.quadraticCurveTo(80, 540, 250, 524); g.quadraticCurveTo(420, 530, 560, H + 10); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(720, H + 10); g.quadraticCurveTo(860, 530, 1030, 524); g.quadraticCurveTo(1200, 540, 1300, H + 10); g.closePath(); g.fill();
      for (let k = 0; k < 6; k++) {
        const age = (lt * 0.6 + k * 2.3) % 14;
        const x = 520 + h2(k, 5) * 240 + Math.sin(age * 0.6 + k) * 18, y = 640 - age * 38;
        A.lantern(g, x, y, 0.55 - age * 0.02, 0.6 + 0.4 * Math.sin(t * 8 + k), clamp(age / 1.5) * clamp((14 - age) / 2));
      }
      A.hero(g, 250, 526, 0.66, t, { facing: 1, wind: 0.45, color: '#130c16' });
      A.maiden(g, 1030, 526, 0.64, t, { facing: -1, wind: 0.45, color: '#130c16', scarf: 'rgba(255,170,170,0.85)' });
      const x0 = 250 + 18, y0 = 526 - 82, x1 = 1030 - 14, y1 = 526 - 78;
      const amp = 18 * c.be(0.45) * c.b.str + 3 * Math.sin(t * 2), mode = c.b.bar % 2 ? 3 : 2;
      const pt = (s) => [lerp(x0, x1, s), lerp(y0, y1, s) + 70 * 4 * s * (1 - s) + amp * Math.sin(Math.PI * mode * s) * Math.cos(t * 14)];
      const path = () => { g.beginPath(); for (let i = 0; i <= 60; i++) { const [x, y] = pt(i / 60); i ? g.lineTo(x, y) : g.moveTo(x, y); } };
      path(); g.strokeStyle = 'rgba(255,60,70,0.25)'; g.lineWidth = 8; g.stroke();
      path(); g.strokeStyle = '#e8383f'; g.lineWidth = 2; g.stroke();
      const sd = c.b.sinceDown, per = c.b.period;
      if (sd < per * 1.5) {
        let s = sd / (per * 1.5);
        if (c.b.bar % 2) s = 1 - s;
        const [px, py] = pt(s);
        g.globalCompositeOperation = 'lighter';
        A.glow(g, px, py, 34, '#ffb0b0', 0.9);
        g.globalCompositeOperation = 'source-over';
      }
      fireflies(g, c, 14, [300, 300, 980, 620], '#ffd3a0');
    },
  };

  // ---------- 往事 ----------
  SC.memory = {
    night: true, text: '#f7e7c9', shadow: 'rgba(10,8,22,0.9)', accent: '#ffb35c',
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 500;
      A.fillV(g, 0, hz, [[0, '#0c1125'], [0.7, '#29233f'], [1, '#4a3346']]);
      stars(g, c, 60, hz - 80, 51);
      A.drawMountain(g, sp().mtn.far[1], '#1c1b33', 0.95, lt * 3, hz + 4, 0.75);
      A.fillV(g, hz, H, [[0, '#2a2340'], [1, '#0b0e1d']]);
      g.fillStyle = '#07080f';
      g.beginPath(); g.moveTo(-10, 560); g.quadraticCurveTo(160, 540, 300, 590); g.quadraticCurveTo(340, 640, 360, H + 10); g.lineTo(-10, H + 10); g.closePath(); g.fill();
      A.hero(g, 190, 566, 0.5, t, { facing: 1, wind: 0.2, color: '#05060b' });
      const life = 15, segB = Math.floor(c.grid.pos(c.seg.start)) - 14;
      for (let k = c.b.i; k >= Math.max(segB, c.b.i - 40); k--) {
        const tb = c.grid.time(k), age = t - tb;
        if (age < 0 || age > life) continue;
        const x0 = 330 + h2(k, 5) * 900, sp2 = 26 + h2(k, 6) * 22;
        const y = 690 - age * sp2, x = x0 + Math.sin(age * 0.5 + k) * 22;
        if (y < -40) continue;
        const s = Math.max(0.35, 1.15 - age * 0.05);
        const ign = clamp(age / 0.35), fade = clamp((life - age) / 2);
        const fl = 0.6 + 0.4 * Math.sin(t * 9 + k);
        A.lantern(g, x, y, s, fl, ign * fade);
        if (y < hz) A.glow(g, x, hz + (hz - y) * 0.25 + 10, 26 * s, '#ffaa55', 0.18 * ign * fade);
        if (age < 0.6 && c.grid.isDown(k)) {
          g.strokeStyle = `rgba(255,210,150,${0.7 * (1 - age / 0.6)})`; g.lineWidth = 1.5;
          g.beginPath(); g.arc(x, y, 14 + age * 90, 0, TAU); g.stroke();
        }
      }
      g.strokeStyle = 'rgba(255,200,140,0.12)'; g.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const y = hz + 14 + i * 14, x = ((h2(i, 9) * W + lt * 6) % W); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60 + h2(i, 10) * 120, y); g.stroke(); }
    },
  };

  // ---------- 逍遥 ----------
  SC.freedom = {
    night: false, text: '#2a1c10', shadow: 'rgba(255,244,220,0.95)', accent: '#b3261e',
    draw(g, c) {
      const t = c.t, lt = c.lt;
      A.fillV(g, 0, H, [[0, '#e3ab5d'], [0.5, '#f4d69b'], [0.8, '#fae7c2'], [1, '#f1d9ac']]);
      const sx = 560, sy = 470;
      g.save(); g.translate(sx, sy); g.rotate(lt * 0.03);
      g.globalCompositeOperation = 'lighter';
      const ra = 0.045 + 0.07 * c.be(0.4) * c.b.str;
      for (let k = 0; k < 16; k++) {
        g.rotate(TAU / 16);
        g.fillStyle = `rgba(255,236,190,${ra})`;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(900, -50); g.lineTo(900, 50); g.closePath(); g.fill();
      }
      g.restore();
      A.glow(g, sx, sy, 300, '#fff1cf', 0.6);
      g.fillStyle = '#fff4dc'; g.beginPath(); g.arc(sx, sy, 70 * (1 + 0.03 * c.be(0.3)), 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      A.drawMountain(g, sp().mtn.far[0], '#b88f5f', 0.55, lt * 5 + 100, 530, 0.9);
      A.drawFog(g, '#fbe7c3', 0.8, -lt * 10, 515, 200);
      A.drawMountain(g, sp().mtn.mid[0], '#7a5a3e', 0.72, lt * 11 + 900, 620, 0.75);
      A.drawFog(g, '#f6dfb4', 0.55, -lt * 16 + 500, 610, 180);
      A.drawMountain(g, sp().mtn.near[0], '#3a291d', 0.95, lt * 22 + 400, 790, 0.9);
      g.fillStyle = '#2a1d14';
      g.beginPath(); g.moveTo(880, H + 10); g.quadraticCurveTo(960, 620, 1050, 552); g.lineTo(1110, 548); g.quadraticCurveTo(1190, 600, 1300, 640); g.lineTo(1300, H + 10); g.closePath(); g.fill();
      A.hero(g, 1080, 552, 0.72, t, { facing: -1, pose: 'open', wind: 0.75 + 0.2 * c.inten, color: '#1f150e' });
      const cx = ((lt * 70) % (W + 600)) - 300, cy = 190;
      const vee = [[0, 0], [-60, -30], [-60, 30], [-120, -60], [-120, 60], [-180, -90], [-180, 90]];
      vee.forEach(([dx, dy], k) => A.crane(g, cx + dx, cy + dy * 0.7 + Math.sin(t * 1.3 + k) * 4, 0.55, c.b.x * TAU + k * 0.35, { color: '#2a2018' }));
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) {
        const x = h2(i, 1) * W + Math.sin(t * 0.5 + i) * 20, y = ((h2(i, 2) * H - t * (12 + h2(i, 3) * 18)) % H + H) % H;
        A.glow(g, x, y, 4 + h2(i, 4) * 4, '#fff0b0', 0.35 + 0.35 * c.be(0.4));
      }
      g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 3; k++) A.xiangyun(g, 360 + k * 230 + Math.sin(lt * 0.3 + k) * 20, 360 + (k % 2) * 60, 1.2, '#d79f3e', 0.35, 0);
    },
  };
})();
