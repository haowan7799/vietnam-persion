/* 逍遥叹 · 音乐动画 —— 渲染核心：镜头、转场、天气、字效、歌词、片头片尾 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const A = XYT.art;
  const { W, H, TAU, clamp, lerp, easeOut, easeIn, easeInOut, smooth, h2, rgba } = A;
  const PUNCT = /[\s，。、！？,.!?；;：:“”"'‘’…—\-（）()《》·]/;

  function mkBuf() {
    const c = document.createElement('canvas');
    return { c, g: c.getContext('2d') };
  }

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.buf = mkBuf();
      this.S = 0;
      this.layouts = new Map();
    }
    setSize(pw) {
      const S = pw / W;
      if (S === this.S) return;
      this.S = S;
      this.cv.width = Math.round(W * S); this.cv.height = Math.round(H * S);
      this.buf.c.width = this.cv.width; this.buf.c.height = this.cv.height;
      XYT.sprites = new XYT.Sprites(S);
      this.patMain = this.g.createPattern(XYT.sprites.paper, 'repeat');
    }
    setData(an, tl) { this.an = an; this.tl = tl; this.layouts.clear(); }

    segIndex(t) {
      const s = this.tl.segments;
      let lo = 0, hi = s.length - 1, r = 0;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m].start <= t) { r = m; lo = m + 1; } else hi = m - 1; }
      return r;
    }
    ctx(seg, t, b) {
      const env = this.an.env, se = XYT.audio.sampleEnv;
      return {
        t, lt: t - seg.start, dur: seg.end - seg.start, p: clamp((t - seg.start) / Math.max(0.1, seg.end - seg.start)),
        seg, variant: seg.variant || 0, inten: seg.intensity ?? 0.6, seed: seg.seed || 0, b, grid: this.an.grid,
        be: (d) => Math.exp(-Math.max(0, b.since) / d) * (0.4 + 0.6 * b.str),
        de: (d) => Math.exp(-Math.max(0, b.sinceDown) / d),
        rms: se(env, 'rms', t), onset: se(env, 'onset', t), low: se(env, 'low', t), high: se(env, 'high', t),
      };
    }
    drunkAt(t) {
      for (const [a, z] of this.tl.drunk) if (t >= a && t < z + 1) return smooth((t - a) / 0.8) * (1 - smooth((t - z) / 1));
      return 0;
    }
    drawScene(g, seg, t, b) {
      const sc = XYT.scenes[seg.scene] || XYT.scenes.mist;
      const c = this.ctx(seg, t, b);
      const dir = seg.idx % 2 ? 1 : -1;
      let z = 1.02 + 0.05 * c.p + (0.012 * c.be(0.18) + 0.02 * c.de(0.28)) * (0.5 + c.inten);
      let rot = 0, dx = dir * 14 * (c.p - 0.5), dy = 0;
      const dk = this.drunkAt(t);
      if (dk > 0) { rot = 0.022 * Math.sin(t * 1.7) * dk; z += 0.04 * dk; dx += 10 * Math.sin(t * 1.1) * dk; }
      if (sc.shake) { const k = 7 * Math.exp(-b.sinceDown / 0.12) * c.inten; dx += k * Math.sin(t * 93); dy += k * Math.cos(t * 71); }
      g.save();
      g.translate(W / 2 + dx, H / 2 + dy); g.scale(z, z); g.rotate(rot); g.translate(-W / 2, -H / 2);
      sc.draw(g, c);
      g.restore();
      if (dk > 0.05) {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.22 * dk;
        g.drawImage(g.canvas, 14 * this.S * Math.sin(t * 1.3), 4 * this.S);
        g.restore();
      }
      return c;
    }

    // 转场：新场景画到缓冲，再用遮罩合成
    composite(g, type, p, seed, night) {
      const gb = this.buf.g;
      gb.save();
      gb.setTransform(this.S, 0, 0, this.S, 0, 0);
      gb.globalCompositeOperation = 'destination-in';
      if (type === 'ink') {
        gb.fillStyle = '#fff';
        gb.beginPath();
        for (let k = 0; k < 5; k++) {
          const x = 140 + h2(seed, k) * 1000, y = 120 + h2(seed, k + 9) * 480;
          A.inkBlob(gb, x, y, p * p * 950 * (0.55 + 0.45 * h2(seed, k + 3)) + 4, seed + k);
        }
        gb.fill();
      } else if (type === 'iris') {
        const r = easeInOut(p) * 820 + 1;
        const gr = gb.createRadialGradient(640, 360, r * 0.75, 640, 360, r);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        gb.fillStyle = gr; gb.fillRect(0, 0, W, H);
      } else if (type === 'slash') {
        const pos = lerp(-420, W + 420, easeInOut(p));
        gb.fillStyle = '#fff';
        gb.beginPath(); gb.moveTo(-100, -100); gb.lineTo(pos + 260, -100); gb.lineTo(pos - 260, H + 100); gb.lineTo(-100, H + 100); gb.closePath(); gb.fill();
      } else if (type === 'scroll') {
        const w = easeInOut(p) * W;
        gb.fillStyle = '#fff'; gb.fillRect(640 - w / 2, 0, w, H);
      } else {
        gb.globalCompositeOperation = 'source-over';
      }
      gb.restore();
      if (type === 'ink') {
        g.fillStyle = rgba(night ? '#06070b' : '#15120f', 0.55 * (1 - p));
        g.beginPath();
        for (let k = 0; k < 5; k++) {
          const x = 140 + h2(seed, k) * 1000, y = 120 + h2(seed, k + 9) * 480;
          A.inkBlob(g, x, y, p * p * 950 * (0.55 + 0.45 * h2(seed, k + 3)) + 24, seed + k);
        }
        g.fill();
      }
      if (type === 'fog') {
        g.fillStyle = rgba(night ? '#c8cde0' : '#f5efe2', 0.7 * Math.sin(Math.PI * p));
        g.fillRect(0, 0, W, H);
        g.globalAlpha = smooth(p);
      }
      g.drawImage(this.buf.c, 0, 0, W, H);
      g.globalAlpha = 1;
      if (type === 'slash') {
        const pos = lerp(-420, W + 420, easeInOut(p));
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = 'rgba(235,250,255,0.95)'; g.lineWidth = 4;
        g.shadowColor = '#bff0ff'; g.shadowBlur = 24;
        g.beginPath(); g.moveTo(pos + 260, -100); g.lineTo(pos - 260, H + 100); g.stroke();
        g.restore();
      }
      if (type === 'scroll' && p < 0.98) {
        const w = easeInOut(p) * W;
        for (const sx of [640 - w / 2 - 8, 640 + w / 2 - 6]) { g.fillStyle = '#3b2416'; g.fillRect(sx, 0, 14, H); g.fillStyle = 'rgba(255,230,190,0.2)'; g.fillRect(sx + 3, 0, 3, H); }
      }
    }

    // ---------- 主绘制 ----------
    frame(t) {
      const g = this.g, S = this.S, tl = this.tl, an = this.an;
      if (!tl || !an) return;
      g.setTransform(S, 0, 0, S, 0, 0);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
      const k = this.segIndex(t), seg = tl.segments[k], next = tl.segments[k + 1];
      const b = an.grid.info(t);
      let c = this.drawScene(g, seg, t, b);
      let curScene = seg;
      if (next && next.trans && t >= next.start - next.trans.dur) {
        const p = clamp((t - (next.start - next.trans.dur)) / next.trans.dur);
        const gb = this.buf.g;
        gb.setTransform(S, 0, 0, S, 0, 0);
        gb.globalAlpha = 1; gb.globalCompositeOperation = 'source-over';
        gb.clearRect(0, 0, W, H);
        this.drawScene(gb, next, t, b);
        const nightNext = (XYT.scenes[next.scene] || {}).night;
        this.composite(g, next.trans.type, p, next.seed, nightNext);
        if (p > 0.5) curScene = next;
      }
      const sc = XYT.scenes[curScene.scene] || XYT.scenes.mist;
      this.overlays(g, t, c, sc);
      this.wordFx(g, t, sc);
      this.title(g, t);
      this.lyrics(g, t);
      this.endCard(g, t);
      this.post(g, t, sc);
    }

    overlays(g, t, c, sc) {
      const sec = this.sectionAt(t);
      if (sec && sec.type === 'chorus') {
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const x = (h2(i, 61) * W + Math.sin(t * 0.2 + i) * 60), y = (h2(i, 62) * H + Math.cos(t * 0.17 + i) * 40);
          A.glow(g, x, y, 30 + h2(i, 63) * 50, sc.night ? '#ffd9a0' : '#fff6e0', 0.06 + 0.08 * c.be(0.35));
        }
        g.globalCompositeOperation = 'source-over';
        const age = t - sec.start;
        if (age >= 0 && age < 0.5) { g.fillStyle = `rgba(255,252,240,${0.28 * (1 - age / 0.5)})`; g.fillRect(0, 0, W, H); }
      }
      const ln = this.tl.lineAt(t);
      if (!ln || !ln.cls.overlays.length) return;
      const k = clamp((t - ln.t) / 0.6) * clamp((ln.end + 0.6 - t) / 0.6);
      if (ln.cls.overlays.includes('snow')) {
        g.fillStyle = `rgba(255,255,255,${0.8 * k})`;
        for (let i = 0; i < 130; i++) {
          const x = ((h2(i, 71) * (W + 100) + Math.sin(t * 0.8 + i) * 30 + t * 20) % (W + 100)) - 50;
          const y = ((h2(i, 72) * (H + 40) + t * (40 + h2(i, 73) * 50)) % (H + 40)) - 20;
          g.beginPath(); g.arc(x, y, 1 + h2(i, 74) * 2.4, 0, TAU); g.fill();
        }
      }
      if (ln.cls.overlays.includes('wind')) {
        const gx = t * 260 + 140 * (c.b.i - Math.exp(-c.b.since / 0.3));
        for (let i = 0; i < 26; i++) {
          const x = ((h2(i, 81) * (W + 200) + gx * (0.6 + h2(i, 82))) % (W + 200)) - 100;
          const y = h2(i, 83) * H + Math.sin(t * 2 + i) * 30;
          g.save(); g.translate(x, y); g.rotate(t * 3 + i); g.scale(Math.cos(t * 4 + i), 1);
          g.fillStyle = rgba(sc.night ? '#d8c9a0' : '#3a3026', 0.6 * k);
          g.beginPath(); g.ellipse(0, 0, 7, 3, 0, 0, TAU); g.fill();
          g.restore();
        }
      }
    }
    sectionAt(t) {
      for (const s of this.tl.sections) if (t >= s.start && t < s.end) return s;
      return null;
    }

    // ---------- 歌词排版 ----------
    layout(ln) {
      let L = this.layouts.get(ln);
      if (L) return L;
      const vis = [];
      ln.chars.forEach((ch, i) => { if (!PUNCT.test(ch)) vis.push(i); });
      const pos = new Array(ln.chars.length).fill(null);
      if (ln.zone === 'bottom') {
        const n = vis.length, size = Math.min(48, 1080 / Math.max(1, n + 1));
        const gaps = ln.chars.reduce((s, ch, i) => s + (i > 0 && /[\s，,、]/.test(ch) ? 1 : 0), 0);
        const total = (n + gaps * 0.6) * size * 1.08;
        let x = 640 - total / 2 + size * 0.54;
        ln.chars.forEach((ch, i) => {
          if (PUNCT.test(ch)) { if (/[\s，,、]/.test(ch)) x += size * 0.65; return; }
          pos[i] = { x, y: 650, size }; x += size * 1.08;
        });
      } else {
        const n = vis.length, two = n > 9;
        const size = two ? 46 : 52;
        let split = Math.ceil(n / 2);
        if (two) {
          const sp = ln.chars.findIndex((ch, i) => i > 2 && /[\s，,、]/.test(ch));
          if (sp > 0) split = vis.filter((i) => i < sp).length;
        }
        const baseX = ln.zone === 'right' ? 1150 : 132;
        const colX = (col) => (ln.zone === 'right' ? baseX - col * size * 1.3 : baseX + (two ? (1 - col) * size * 1.3 : 0));
        vis.forEach((i, k) => {
          const col = two && k >= split ? 1 : 0, row = col ? k - split : k;
          pos[i] = { x: colX(col), y: 120 + size / 2 + (col ? size * 0.7 : 0) + row * size * 1.12, size };
        });
      }
      L = { pos };
      this.layouts.set(ln, L);
      return L;
    }

    lyrics(g, t) {
      const tl = this.tl;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const ln of tl.lines) {
        if (t < ln.t - 0.2 || t > ln.out + 0.9) continue;
        const sc = XYT.scenes[ln.scene] || XYT.scenes.mist;
        const L = this.layout(ln);
        ln.chars.forEach((ch, i) => {
          const p = L.pos[i], tau = ln.reveal[i];
          if (!p || tau == null || t < tau) return;
          const q = clamp((t - tau) / 0.32), e = clamp((t - (ln.out - 0.1 + i * 0.025)) / 0.45);
          const a = easeOut(q) * (1 - e);
          if (a <= 0.01) return;
          const s = (1.32 - 0.32 * easeOut(q)) * p.size;
          g.font = `${s.toFixed(1)}px ${XYT.FONT}`;
          g.globalAlpha = a;
          g.shadowColor = sc.shadow; g.shadowBlur = 16;
          g.fillStyle = ln.cls.accents.has(i) ? sc.accent : sc.text;
          g.fillText(ch, p.x, p.y - 14 * e);
          g.shadowBlur = 0;
        });
      }
      g.globalAlpha = 1;
    }

    charPos(lineIdx, ci) {
      const ln = this.tl.lines[lineIdx];
      if (!ln) return [640, 360];
      const p = this.layout(ln).pos[ci];
      return p ? [p.x, p.y] : [640, 360];
    }

    wordFx(g, t, sc) {
      for (const ev of this.tl.fx) {
        const age = t - ev.t;
        if (age < 0) break;
        if (age > 2) continue;
        const [x, y] = this.charPos(ev.line, ev.ci);
        FX[ev.type] && FX[ev.type](g, age, x, y, sc, ev.t);
      }
    }

    title(g, t) {
      const T = this.tl.title;
      if (!T || t < T.start - 0.3 || t > T.end + 1.4) return;
      const first = XYT.scenes[this.tl.segments[0].scene] || XYT.scenes.mist;
      const out = clamp((t - T.end) / 1.2);
      const chars = ['逍', '遥', '叹'];
      g.textAlign = 'center'; g.textBaseline = 'middle';
      chars.forEach((ch, k) => {
        const tau = T.stamps[k], q = clamp((t - tau) / 0.28);
        if (q <= 0) return;
        const x = 640 + (k - 1) * 172 - 40, y = 318 - 34 * out * (1 + k * 0.3);
        const a = easeOut(q) * (1 - clamp(out * 1.3 - k * 0.15));
        if (q < 1 || t - tau < 0.8) {
          const sa = clamp(1 - (t - tau) / 0.8);
          g.fillStyle = rgba(first.night ? '#e9dcc0' : '#1a1612', 0.18 * sa);
          for (let d = 0; d < 9; d++) {
            const ang = h2(k, d) * TAU, r = 70 + easeOut((t - tau) / 0.4) * 60 * h2(k, d + 20);
            g.beginPath(); g.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, 2 + h2(k, d + 40) * 6, 0, TAU); g.fill();
          }
        }
        g.globalAlpha = a;
        g.font = `${(150 * (1.42 - 0.42 * easeOut(q))).toFixed(1)}px ${XYT.FONT}`;
        g.shadowColor = first.shadow; g.shadowBlur = 22;
        g.fillStyle = first.night ? '#f4e8cf' : '#191512';
        g.fillText(ch, x, y);
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      });
      const sq = clamp((t - T.seal) / 0.3);
      if (sq > 0) {
        const s = 1 + 0.5 * (1 - easeOut(sq));
        g.save(); g.translate(640 + 172 + 110 - 40, 300 - 30 * out); g.scale(s, s);
        A.seal(g, 0, 0, 62, '逍遥', easeOut(sq) * (1 - out));
        g.restore();
      }
      const uq = clamp((t - T.sub) / 0.8);
      if (uq > 0) {
        g.globalAlpha = easeOut(uq) * (1 - out);
        g.fillStyle = first.night ? '#efe2c6' : '#2a241e';
        g.font = `30px ${XYT.FONT}`;
        g.fillText('演唱 · 胡歌', 600, 438);
        g.font = `18px "Noto Serif SC", serif`;
        (T.credits || []).slice(0, 3).forEach((cr, i) => g.fillText(cr, 600, 478 + i * 26));
        g.globalAlpha = 1;
      }
    }

    endCard(g, t) {
      const E = this.tl.end;
      if (!E || t < E.start) return;
      const q = clamp((t - E.start) / 1.6);
      g.fillStyle = A.vgrad(g, 0, H, [[0, `rgba(8,8,12,${0.15 * q})`], [1, `rgba(8,8,12,${0.6 * q})`]]);
      g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = easeOut(q);
      g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 18;
      g.fillStyle = '#f4ead6';
      g.font = `96px ${XYT.FONT}`; g.fillText('逍遥叹', 640, 318);
      g.font = `34px ${XYT.FONT}`; g.fillText('— 终 —', 640, 418);
      g.shadowBlur = 0;
      g.globalAlpha = 0.8 * easeOut(clamp((t - E.start - 0.8) / 1.2));
      g.font = `18px "Noto Serif SC", serif`;
      g.fillText('演唱 胡歌 · 同人音乐动画 · 歌曲版权归原作者所有', 640, 470);
      g.globalAlpha = 1;
      const f = clamp((t - E.fade) / 1.5);
      if (f > 0) { g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(0, 0, W, H); }
    }

    post(g, t, sc) {
      g.globalAlpha = sc.night ? 0.8 : 0.45;
      g.drawImage(XYT.sprites.vignette, 0, 0, W, H);
      g.globalAlpha = sc.night ? 0.06 : 0.16;
      g.globalCompositeOperation = sc.night ? 'overlay' : 'multiply';
      g.fillStyle = this.patMain; g.fillRect(0, 0, W, H);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }
  XYT.Renderer = Renderer;

  // ---------- 字效 ----------
  const FX = {
    slash(g, a, x, y, sc) {
      if (a > 0.7) return;
      const len = easeOut(a / 0.18), al = 1 - a / 0.7;
      g.save(); g.globalCompositeOperation = sc.night ? 'lighter' : 'source-over';
      g.strokeStyle = sc.night ? `rgba(220,248,255,${al})` : `rgba(25,20,16,${al * 0.85})`;
      g.lineWidth = 3 * al + 1;
      g.beginPath(); g.moveTo(-20, y + 160); g.lineTo(-20 + (W + 40) * len, y + 160 - (W + 40) * len * 0.35); g.stroke();
      g.restore();
    },
    tear(g, a, x, y, sc) {
      const fall = 1.0;
      if (a < fall) {
        const yy = lerp(y + 34, H - 60, easeIn(a / fall));
        g.fillStyle = sc.night ? 'rgba(200,230,255,0.9)' : 'rgba(60,90,120,0.8)';
        g.beginPath(); g.arc(x, yy, 5, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(x - 5, yy); g.lineTo(x, yy - 14); g.lineTo(x + 5, yy); g.fill();
      } else {
        const u = (a - fall) / 1;
        g.strokeStyle = sc.night ? `rgba(200,230,255,${1 - u})` : `rgba(60,90,120,${0.8 * (1 - u)})`; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(x, H - 60, 10 + u * 90, (10 + u * 90) * 0.25, 0, 0, TAU); g.stroke();
      }
    },
    ring(g, a, x, y, sc) {
      for (let k = 0; k < 3; k++) {
        const u = (a - k * 0.2) / 1.4;
        if (u < 0 || u > 1) continue;
        g.strokeStyle = rgba(sc.night ? '#cfe6ff' : '#6b5a8f', 0.6 * (1 - u)); g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, 20 + easeOut(u) * 240, 0, TAU); g.stroke();
      }
    },
    petal(g, a, x, y) {
      if (a > 1.6) return;
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * TAU + h2(k, 3), sp = 120 + h2(k, 4) * 140;
        const px = x + Math.cos(ang) * sp * easeOut(a / 1.2), py = y + Math.sin(ang) * sp * easeOut(a / 1.2) + 60 * a * a;
        g.save(); g.translate(px, py); g.rotate(a * 4 + k); g.scale(Math.cos(a * 6 + k), 1);
        g.fillStyle = `rgba(236,140,160,${1 - a / 1.6})`;
        g.beginPath(); g.ellipse(0, 0, 6, 3.5, 0, 0, TAU); g.fill();
        g.restore();
      }
    },
    rain(g, a, x, y, sc) {
      if (a > 1.4) return;
      g.strokeStyle = rgba(sc.night ? '#d6e4f5' : '#56626a', 0.5 * (1 - a / 1.4)); g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < 90; i++) {
        const xx = ((h2(i, 91) * W + a * 60)), yy = ((h2(i, 92) * H + a * 900) % H);
        g.moveTo(xx, yy); g.lineTo(xx + 4, yy + 22);
      }
      g.stroke();
    },
    pulse(g, a, x, y) {
      if (a > 1) return;
      g.strokeStyle = `rgba(220,50,60,${0.8 * (1 - a)})`; g.lineWidth = 2.5 * (1 - a) + 0.5;
      g.beginPath(); g.arc(x, y, 26 + easeOut(a) * 120, 0, TAU); g.stroke();
      A.glow(g, x, y, 60, '#ff6070', 0.35 * (1 - a));
    },
    halo(g, a, x, y) {
      if (a > 1.8) return;
      const k = Math.sin(Math.PI * clamp(a / 1.8));
      g.save(); g.globalCompositeOperation = 'lighter';
      A.glow(g, x, y, 70 + 40 * k, '#ffe2a0', 0.45 * k);
      g.restore();
    },
    gust(g, a, x, y, sc) {
      if (a > 1.2) return;
      g.strokeStyle = rgba(sc.night ? '#e8eefc' : '#3a332b', 0.35 * (1 - a / 1.2)); g.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) {
        const yy = y - 120 + h2(i, 5) * 240, xx = -200 + (a / 1.2) * (W + 400) * (0.7 + 0.3 * h2(i, 6)), len = 80 + h2(i, 7) * 160;
        g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + len / 2, yy - 10, xx + len, yy); g.stroke();
      }
    },
    snow(g, a, x, y) {
      if (a > 2) return;
      g.fillStyle = `rgba(255,255,255,${0.9 * (1 - a / 2)})`;
      for (let k = 0; k < 40; k++) {
        const px = x + (h2(k, 1) - 0.5) * 300 + Math.sin(a * 2 + k) * 12, py = y + a * (60 + h2(k, 2) * 80) + (h2(k, 3) - 0.5) * 120;
        g.beginPath(); g.arc(px, py, 1.4 + h2(k, 4) * 2, 0, TAU); g.fill();
      }
    },
    sparkle(g, a, x, y) {
      if (a > 1.2) return;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * TAU, r = 30 + easeOut(a / 1) * (90 + 60 * h2(k, 8));
        const tw = Math.abs(Math.sin(a * 12 + k));
        A.glow(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r, 9, '#ffe9a8', (1 - a / 1.2) * tw);
      }
      g.restore();
    },
    splash(g, a, x, y, sc) {
      if (a > 1) return;
      g.fillStyle = rgba(sc.night ? '#e9b870' : '#1d1712', 0.7 * (1 - a));
      for (let k = 0; k < 14; k++) {
        const ang = h2(k, 11) * TAU, r = 30 + easeOut(a / 0.4) * (40 + 50 * h2(k, 12));
        g.beginPath(); g.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, 2 + 4 * h2(k, 13) * (1 - a), 0, TAU); g.fill();
      }
    },
    rise(g, a, x, y, sc) {
      if (a > 1) return;
      g.strokeStyle = rgba(sc.night ? '#e8f4ff' : '#2b2620', 0.6 * (1 - a)); g.lineWidth = 1.4;
      for (let k = 0; k < 10; k++) {
        const xx = x + (h2(k, 21) - 0.5) * 120, yy = y - easeOut(a) * (160 + 100 * h2(k, 22));
        g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 40); g.stroke();
      }
    },
    warm(g, a, x, y) {
      if (a > 1.6) return;
      g.save(); g.globalCompositeOperation = 'lighter';
      A.glow(g, x, y, 120, '#ffb060', 0.4 * Math.sin(Math.PI * clamp(a / 1.6)));
      g.restore();
    },
    rays(g, a) {
      if (a > 1.8) return;
      const k = Math.sin(Math.PI * clamp(a / 1.8));
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const x = 200 + i * 150;
        g.fillStyle = `rgba(255,240,200,${0.08 * k})`;
        g.beginPath(); g.moveTo(x - 20, -10); g.lineTo(x + 20, -10); g.lineTo(x + 140, H); g.lineTo(x + 40, H); g.closePath(); g.fill();
      }
      g.restore();
    },
    sigh(g, a, x, y, sc) {
      if (a > 1.8) return;
      const u = clamp(a / 1.8);
      A.drawFog(g, sc.night ? '#c9d0e6' : '#ffffff', 0.4 * Math.sin(Math.PI * u), -u * 200, y + 40, 160, 900);
    },
  };
  XYT.FX = FX;
})();
