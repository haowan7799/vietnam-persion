/* 第三版镜头组 fg8：f4_window（临窗望雪）、f5_inkstream（雪谷墨溪）、f7_sundial（白首如烛）。不含歌词。 */
(function () {
  'use strict';
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, rgba, mix } = A;
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;
  const fract = (x) => x - Math.floor(x);
  // 第 k 个字的时间（相对镜头起点）；没有歌词时用分镜表里的秒数
  const CT = (c, k, def, off) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? def : v - (c.t - c.lt);
  };
  // 在临时画布上画好，再带模糊画进缓存（滤镜只在建缓存时用；半径按设备像素）
  function blurInto(g, w, h, px, fn) {
    const s = SS();
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * s)); c.height = Math.max(1, Math.ceil(h * s));
    const q = c.getContext('2d'); q.scale(s, s); fn(q);
    g.save(); g.filter = `blur(${(px * s).toFixed(2)}px)`; g.drawImage(c, 0, 0, w, h); g.restore();
  }
  // 柔和圆点贴图
  function dot(key, col, core) {
    return K.cache('fg8dot_' + key, 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(core, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  // 设备像素对齐的离屏缓冲：把逻辑包围盒内的东西画进缓冲，再整像素贴回（不旋转的变换）
  const BUFS = {};
  function buf(name, w, h) {
    let b = BUFS[name];
    if (!b) { const c = document.createElement('canvas'); b = BUFS[name] = { c, g: c.getContext('2d') }; }
    if (b.c.width < w || b.c.height < h) { b.c.width = Math.max(b.c.width, w); b.c.height = Math.max(b.c.height, h); }
    b.g.setTransform(1, 0, 0, 1, 0, 0); b.g.globalAlpha = 1; b.g.globalCompositeOperation = 'source-over';
    b.g.clearRect(0, 0, b.c.width, b.c.height);
    return b;
  }
  function devBox(g, x0, y0, x1, y1) {
    const m = g.getTransform();
    const dx0 = Math.floor(m.a * x0 + m.e) - 2, dy0 = Math.floor(m.d * y0 + m.f) - 2;
    const dx1 = Math.ceil(m.a * x1 + m.e) + 2, dy1 = Math.ceil(m.d * y1 + m.f) + 2;
    return { m, x: dx0, y: dy0, w: dx1 - dx0, h: dy1 - dy0 };
  }
  const blitDev = (g, b, d) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(b.c, 0, 0, d.w, d.h, d.x, d.y, d.w, d.h); g.restore(); };

  // ======================= f4 临窗望雪 =======================
  (function () {
    const VPX = 660, YH = 352;                       // 灭点、视平线（站立眼高）
    const IX0 = 384, IX1 = 980, IY0 = 146, IY1 = 506; // 窗洞内墙面
    const OX0 = 403, OX1 = 962, OY0 = 160, OY1 = 495; // 窗洞外墙面（窗外景只在这里面可见）
    const TR = 226;                                  // 横披（上方固定格心）下沿
    const MUL = [582, 782];                          // 两根竖棂
    const FLOOR = 570;                               // 墙脚线
    const WL = 402;                                  // 对岸水线
    const MAN = { x: 470, y: 600, h: 300 };
    const SNOW = '#dfe8f2', WARM = '#f3c47a', AMBER = '#e9a24a';
    const DIR = [0.88, 0.475];                       // 雪帘推进方向（风向右、雪下落）

    // ---- 对岸小镇：房屋与灯（确定性生成）----
    const town = (() => {
      const r = A.rng(4407);
      const hill = (x) => 34 * Math.exp(-Math.pow((x - 640) / 170, 2)) + 12 * Math.exp(-Math.pow((x - 900) / 110, 2));
      const rows = [
        { base: (x) => 356 - hill(x), sc: 0.6, dim: 0.5 },
        { base: (x) => 378 - hill(x) * 0.3, sc: 0.8, dim: 0.75 },
        { base: () => 392, sc: 1.0, dim: 1.0 },
      ];
      const houses = [], lights = [];
      rows.forEach((row, ri) => {
        let x = 350 + r() * 30;
        while (x < 1010) {
          const w = (56 + r() * 56) * row.sc, hw = (24 + r() * 12) * row.sc, rh = (13 + r() * 6) * row.sc;
          const b = row.base(x + w / 2);
          houses.push({ x, w, b, hw, rh, ri, dim: row.dim, gable: r() < 0.45 });
          const nWin = r() < 0.2 ? 0 : 1 + (r() < 0.5 ? 1 : 0);
          for (let k = 0; k < nWin; k++) {
            const u = nWin === 1 ? 0.3 + 0.4 * r() : 0.22 + 0.5 * k + 0.08 * r();
            const ww = (5 + r() * 3) * row.sc, wh = (7 + r() * 3) * row.sc;
            lights.push({ x: x + w * u, y: b - hw * 0.52, w: ww, h: wh, col: r() < 0.7 ? WARM : AMBER, a: (0.7 + 0.3 * r()) * (0.55 + 0.45 * row.dim), ph: r() * 100, kind: 'win', ri });
          }
          if (ri > 0 && r() < 0.4) lights.push({ x: x + w * (0.15 + 0.7 * r()), y: b - hw + 5 * row.sc, w: 4.2 * row.sc, h: 5.2 * row.sc, col: '#ec7a42', a: 0.95, ph: r() * 100, kind: 'lan', ri });
          x += w + (r() < 0.3 ? 6 + r() * 16 : r() * 3);
        }
      });
      // 塔：在坡顶
      const pag = { x: 700, b: 356 - hill(700) + 4, h: 104, w: 24 };
      lights.push({ x: pag.x, y: pag.b - pag.h * 0.62, w: 3, h: 4, col: AMBER, a: 0.75, ph: 12.3, kind: 'win', ri: 0 });
      // 河堤上一串灯
      for (const lx of [430, 545, 655, 770, 880, 950]) lights.push({ x: lx, y: 388, w: 4, h: 5, col: '#ef9a50', a: 0.9, ph: lx * 0.37, kind: 'lan', ri: 2 });
      return { houses, lights, pag, hill };
    })();

    function drawHouse(g, hs) {
      const { x, w, b, hw, rh } = hs;
      const wallC = mix('#34333d', '#4a4751', hs.dim), roofC = mix('#1d212b', '#161920', hs.dim), snowC = mix('#7e8b9b', '#b9c6d5', hs.dim);
      g.fillStyle = wallC; g.fillRect(x + 1, b - hw, w - 2, hw);
      // 墙面下方略暗，檐下一道阴影
      let gr = g.createLinearGradient(0, b - hw, 0, b);
      gr.addColorStop(0, 'rgba(10,12,20,0.35)'); gr.addColorStop(0.25, 'rgba(10,12,20,0)'); gr.addColorStop(1, 'rgba(10,12,20,0.3)');
      g.fillStyle = gr; g.fillRect(x + 1, b - hw, w - 2, hw);
      // 门、柱（只是淡淡的竖线）
      g.fillStyle = 'rgba(12,14,22,0.35)';
      for (const f of [0.25, 0.5, 0.75]) g.fillRect(x + w * f, b - hw + 2, 1, hw - 2);
      const ox = 3 + w * 0.06, top = b - hw - rh;
      if (hs.gable) {
        // 马头墙：两端阶梯式山墙，中间坡顶
        g.fillStyle = roofC;
        g.beginPath(); g.moveTo(x - ox, b - hw + 1.5); g.lineTo(x + w * 0.5, top + 1.5); g.lineTo(x + w + ox, b - hw + 1.5); g.closePath(); g.fill();
        g.fillStyle = snowC;
        g.beginPath(); g.moveTo(x - ox + 2, b - hw - 0.8); g.lineTo(x + w * 0.5, top); g.lineTo(x + w + ox - 2, b - hw - 0.8);
        g.lineTo(x + w * 0.5, top + rh * 0.62); g.closePath(); g.fill();
        const st = Math.max(4, w * 0.12), sh = rh * 0.7;
        g.fillStyle = mix(wallC, '#5a5866', 0.4);
        g.fillRect(x - 1, b - hw - sh, st, sh + 1); g.fillRect(x + w - st + 1, b - hw - sh, st, sh + 1);
        g.fillStyle = roofC; g.fillRect(x - 2, b - hw - sh - 1.5, st + 2, 2); g.fillRect(x + w - st, b - hw - sh - 1.5, st + 2, 2);
        g.fillStyle = snowC; g.fillRect(x - 2, b - hw - sh - 3, st + 2, 1.8); g.fillRect(x + w - st, b - hw - sh - 3, st + 2, 1.8);
      } else {
        // 歇山式：屋檐两端微翘
        g.fillStyle = roofC;
        g.beginPath(); g.moveTo(x - ox - 2, b - hw - 2.5); g.quadraticCurveTo(x - ox * 0.5, b - hw + 1.5, x + w * 0.2, b - hw + 1);
        g.lineTo(x + w * 0.8, b - hw + 1); g.quadraticCurveTo(x + w + ox * 0.5, b - hw + 1.5, x + w + ox + 2, b - hw - 2.5);
        g.lineTo(x + w * 0.84, top); g.lineTo(x + w * 0.16, top); g.closePath(); g.fill();
        g.fillStyle = snowC;
        g.beginPath(); g.moveTo(x + w * 0.16, top - 1); g.lineTo(x + w * 0.84, top - 1); g.lineTo(x + w + ox * 0.7, b - hw - 2.4);
        g.lineTo(x + w * 0.8, top + rh * 0.55); g.lineTo(x + w * 0.2, top + rh * 0.55); g.lineTo(x - ox * 0.7, b - hw - 2.4); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(8,10,16,0.6)'; g.fillRect(x - ox * 0.6, b - hw, w + ox * 1.2, 1.6);
    }
    function drawPagoda(g, p) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const y0 = p.b - (i / n) * p.h, y1 = p.b - ((i + 1) / n) * p.h, ww = p.w * (1 - i * 0.08);
        g.fillStyle = '#2c2d36'; g.fillRect(p.x - ww * 0.4, y1 + 3, ww * 0.8, y0 - y1 - 3);
        g.fillStyle = '#191c24';
        g.beginPath(); g.moveTo(p.x - ww * 0.82, y1 + 4.4); g.quadraticCurveTo(p.x, y1 + 2.2, p.x + ww * 0.82, y1 + 4.4); g.lineTo(p.x + ww * 0.52, y1 + 1); g.lineTo(p.x - ww * 0.52, y1 + 1); g.closePath(); g.fill();
        g.fillStyle = '#8796a8'; g.beginPath(); g.moveTo(p.x - ww * 0.55, y1 + 1.4); g.quadraticCurveTo(p.x, y1 - 0.6, p.x + ww * 0.55, y1 + 1.4); g.lineTo(p.x + ww * 0.5, y1 + 2.2); g.lineTo(p.x - ww * 0.5, y1 + 2.2); g.closePath(); g.fill();
      }
      g.fillStyle = '#191c24'; g.fillRect(p.x - 1, p.b - p.h - 12, 2, 12);
    }

    // 窗外静景（不含灯）：天、远山、小镇、河堤、水面与倒影
    function paintOutside(g) {
      const X0 = 370, X1 = 1000;
      let gr = g.createLinearGradient(0, 130, 0, WL);
      gr.addColorStop(0, '#1c2231'); gr.addColorStop(0.4, '#2d3345'); gr.addColorStop(0.72, '#4a4a59'); gr.addColorStop(1, '#5f5864');
      g.fillStyle = gr; g.fillRect(X0, 130, X1 - X0, WL - 128);
      // 雪云底被镇上的灯映暖，靠右（灯多处）更明显
      g.save(); g.translate(720, 360); g.scale(1, 0.32);
      gr = g.createRadialGradient(0, 0, 0, 0, 0, 380);
      gr.addColorStop(0, 'rgba(150,120,100,0.28)'); gr.addColorStop(1, 'rgba(150,120,100,0)');
      g.fillStyle = gr; g.fillRect(-400, -400, 800, 800); g.restore();
      // 远山：雪夜里一道比天略暗的山脊，脊上薄雪
      g.beginPath(); g.moveTo(X0, WL);
      for (let x = X0; x <= X1; x += 4) g.lineTo(x, 292 - 26 * A.noise1(x / 150, 3) - 9 * A.noise1(x / 47, 4));
      g.lineTo(X1, WL); g.closePath();
      g.fillStyle = '#353b4b'; g.fill();
      g.save(); g.clip();
      gr = g.createLinearGradient(0, 262, 0, 350); gr.addColorStop(0, 'rgba(150,162,182,0.22)'); gr.addColorStop(0.3, 'rgba(70,74,90,0)'); gr.addColorStop(1, 'rgba(96,90,100,0.6)');
      g.fillStyle = gr; g.fillRect(X0, 250, X1 - X0, 110);
      g.restore();
      // 镇后的小山坡（积雪，被灯映着）
      g.beginPath(); g.moveTo(X0, WL);
      for (let x = X0; x <= X1; x += 4) g.lineTo(x, 362 - town.hill(x) * 1.15 - 3 * A.noise1(x / 30, 8));
      g.lineTo(X1, WL); g.closePath();
      gr = g.createLinearGradient(0, 320, 0, 380); gr.addColorStop(0, '#6c7383'); gr.addColorStop(1, '#4d4f5c');
      g.fillStyle = gr; g.fill();
      g.fillStyle = 'rgba(80,80,94,0.3)'; g.fillRect(X0, 250, X1 - X0, 130);
      for (const hs of town.houses) if (hs.ri === 0) drawHouse(g, hs);
      drawPagoda(g, town.pag);
      // 越远越淡：雪夜的空气压一层
      g.fillStyle = 'rgba(84,82,96,0.3)'; g.fillRect(X0, 240, X1 - X0, 140);
      for (const hs of town.houses) if (hs.ri === 1) drawHouse(g, hs);
      g.fillStyle = 'rgba(84,82,96,0.14)'; g.fillRect(X0, 300, X1 - X0, 92);
      for (const hs of town.houses) if (hs.ri === 2) drawHouse(g, hs);
      // 河堤：石岸，顶上一线雪
      g.fillStyle = '#23262f'; g.fillRect(X0, 392, X1 - X0, WL - 392);
      g.fillStyle = '#9aa9bb'; g.fillRect(X0, 391, X1 - X0, 2);
      for (let x = X0 + 8; x < X1; x += 23 + 9 * A.hash(x | 0)) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, 393, 1, WL - 393); }
      // 水面：远处映着天光，近处暗
      gr = g.createLinearGradient(0, WL, 0, 515);
      gr.addColorStop(0, '#3f404c'); gr.addColorStop(0.3, '#272a36'); gr.addColorStop(1, '#11141c');
      g.fillStyle = gr; g.fillRect(X0, WL, X1 - X0, 515 - WL);
    }
    // 倒影：以水线为轴翻转，暗 35%，逐行横向波纹，离岸越远越淡
    function paintReflection(g, src) {
      const s = SS(), X0 = 370, X1 = 1000, D = 95;
      for (let y = WL; y < WL + D; y += 1) {
        const k = (y - WL) / D;
        const sy = 2 * WL - y;
        const off = 1.4 * Math.sin(y * 0.9) + 1.2 * Math.sin(y * 0.37 + 1.3) * (0.5 + k);
        g.globalAlpha = 0.62 * (1 - k) * (1 - 0.5 * k);
        g.drawImage(src, (X0 - 370) * s, (sy - 130) * s, (X1 - X0) * s, s, X0 + off, y, X1 - X0, 1);
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(16,19,30,0.4)'; g.fillRect(X0, WL, X1 - X0, D + 20);
      // 水面细横纹
      for (let i = 0; i < 40; i++) {
        const y = WL + 3 + Math.pow(A.hash(i * 3 + 1), 1.3) * 100, x = X0 + A.hash(i * 3 + 2) * (X1 - X0), w = 10 + 34 * A.hash(i * 3 + 3) * (0.4 + (y - WL) / 100);
        g.fillStyle = `rgba(150,168,192,${0.05 + 0.05 * A.hash(i * 7)})`; g.fillRect(x, y, w, 1);
      }
    }
    const outside = () => K.cache('fg8_f4_out', 630, 385, 1, (g) => {
      g.translate(-370, -130);
      paintOutside(g);
      const tmp = document.createElement('canvas'), s = SS();
      tmp.width = Math.ceil(630 * s); tmp.height = Math.ceil(385 * s);
      const q = tmp.getContext('2d'); q.scale(s, s); q.translate(-370, -130); paintOutside(q);
      paintReflection(g, tmp);
    });
    const outsideBlur = () => K.cache('fg8_f4_outb', 630, 385, 1, (g) => {
      g.fillStyle = '#3a3c48'; g.fillRect(0, 0, 630, 385);
      blurInto(g, 630, 385, 7, (q) => q.drawImage(outside(), 0, 0, 630, 385));
    });
    // 密雪纹理（可平铺）：顺着落向的短斜线
    function snowTile(key, n, len, sz, a0, seed) {
      return K.cache('fg8_f4_tile' + key, 280, 240, 1, (g) => {
        const r = A.rng(seed), ang = Math.atan2(DIR[1] + 0.35, DIR[0] * 0.55);
        blurInto(g, 280, 240, 0.7, (q) => {
          q.lineCap = 'round';
          for (let i = 0; i < n; i++) {
            const x = r() * 280, y = r() * 240, l = len * (0.5 + r()), w = sz * (0.6 + 0.7 * r()), a = a0 * (0.4 + 0.6 * r());
            q.strokeStyle = `rgba(232,238,246,${a.toFixed(3)})`; q.lineWidth = w;
            for (const ox of [-280, 0, 280]) for (const oy of [-240, 0, 240]) {
              const cx = x + ox, cy = y + oy;
              if (cx < -20 || cx > 300 || cy < -20 || cy > 260) continue;
              q.beginPath(); q.moveTo(cx - Math.cos(ang) * l / 2, cy - Math.sin(ang) * l / 2); q.lineTo(cx + Math.cos(ang) * l / 2, cy + Math.sin(ang) * l / 2); q.stroke();
            }
          }
        });
      });
    }
    function tileFill(g, tile, ox, oy, x0, y0, x1, y1) {
      const tw = 280, th = 240;
      const sx = x0 - fract((x0 - ox) / tw) * tw, sy = y0 - fract((y0 - oy) / th) * th;
      for (let y = sy; y < y1; y += th) for (let x = sx; x < x1; x += tw) g.drawImage(tile, x, y, tw, th);
    }

    // 屋内静景（窗洞透明）：梁、柱、墙、窗框格心、两扇向内打开的窗扇、地板
    const room = () => K.cache('fg8_f4_room', 1280, 720, 1, (g) => {
      // 后墙
      let gr = g.createLinearGradient(0, 90, 0, FLOOR);
      gr.addColorStop(0, '#0f131c'); gr.addColorStop(1, '#141924');
      g.fillStyle = gr; g.fillRect(0, 0, 1280, FLOOR);
      // 墙上靠窗处的一点反光
      g.save(); g.translate(682, 330); g.scale(1, 0.72);
      gr = g.createRadialGradient(0, 0, 200, 0, 0, 560);
      gr.addColorStop(0, 'rgba(70,84,108,0.22)'); gr.addColorStop(1, 'rgba(70,84,108,0)');
      g.fillStyle = gr; g.fillRect(-700, -700, 1400, 1400); g.restore();
      // 窗下槛墙：木板与浅浅的框线
      g.fillStyle = '#121620'; g.fillRect(368, 522, 628, FLOOR - 522);
      g.strokeStyle = 'rgba(90,104,128,0.10)'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const a = IX0 + i * (IX1 - IX0) / 3 + 10, b = IX0 + (i + 1) * (IX1 - IX0) / 3 - 10; g.strokeRect(a, 530, b - a, FLOOR - 540); }
      // 窗框（木）
      g.fillStyle = '#17140f';
      g.fillRect(366, 128, 632, 18); g.fillRect(366, 128, 18, 396); g.fillRect(980, 128, 18, 396); g.fillRect(360, 506, 644, 18);
      g.fillStyle = 'rgba(120,130,150,0.12)'; g.fillRect(360, 506, 644, 1.5);
      // 挖出窗洞
      g.save(); g.globalCompositeOperation = 'destination-out';
      g.fillRect(OX0, OY0, OX1 - OX0, OY1 - OY0);
      g.restore();
      // 窗洞四面的墙厚：左右侧面、窗台面受窗外光，窗楣底面暗
      const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); };
      poly([[IX0, IY0], [OX0, OY0], [OX0, OY1], [IX0, IY1]], '#262d3b');
      poly([[IX1, IY0], [OX1, OY0], [OX1, OY1], [IX1, IY1]], '#1f2532');
      poly([[IX0, IY0], [IX1, IY0], [OX1, OY0], [OX0, OY0]], '#10141c');
      poly([[IX0, IY1], [IX1, IY1], [OX1, OY1], [OX0, OY1]], '#3a4354');
      // 窗台外沿的一线积雪（窗开着，雪落在外侧台面上）
      g.fillStyle = '#9fb0c4';
      g.beginPath(); g.moveTo(OX0, OY1 + 0.5); g.lineTo(OX1, OY1 + 0.5);
      for (let x = OX1; x >= OX0; x -= 6) g.lineTo(x, OY1 + 3.2 + 1.3 * A.noise1(x / 23, 7));
      g.closePath(); g.fill();
      // 横披格心（步步锦式）：横披下沿一根横枋
      g.fillStyle = '#120f0c';
      g.fillRect(IX0, TR - 4, IX1 - IX0, 9);
      const bar = (x0, y0, x1, y1, w) => { g.fillRect(Math.min(x0, x1) - (x0 === x1 ? w / 2 : 0), Math.min(y0, y1) - (y0 === y1 ? w / 2 : 0), Math.abs(x1 - x0) + (x0 === x1 ? w : 0), Math.abs(y1 - y0) + (y0 === y1 ? w : 0)); };
      const bays = [IX0, MUL[0], MUL[1], IX1];
      for (let i = 0; i < 3; i++) {
        const a = bays[i] + 6, b = bays[i + 1] - 6, t = IY0 + 2, d = TR - 4;
        const ix0 = a + 22, ix1 = b - 22, iy0 = t + 14, iy1 = d - 14;
        const w = 3;
        bar(ix0, iy0, ix1, iy0, w); bar(ix0, iy1, ix1, iy1, w); bar(ix0, iy0, ix0, iy1, w); bar(ix1, iy0, ix1, iy1, w);
        const jx0 = ix0 + 18, jx1 = ix1 - 18, jy0 = iy0 + 12, jy1 = iy1 - 12;
        bar(jx0, jy0, jx1, jy0, 2.4); bar(jx0, jy1, jx1, jy1, 2.4); bar(jx0, jy0, jx0, jy1, 2.4); bar(jx1, jy0, jx1, jy1, 2.4);
        for (const f of [0.25, 0.5, 0.75]) { const x = lerp(ix0, ix1, f); bar(x, t, x, iy0, 2.4); bar(x, iy1, x, d, 2.4); bar(lerp(jx0, jx1, f), iy0, lerp(jx0, jx1, f), jy0, 2); bar(lerp(jx0, jx1, f), jy1, lerp(jx0, jx1, f), iy1, 2); }
        const my = (iy0 + iy1) / 2;
        bar(a, my, ix0, my, 2.4); bar(ix1, my, b, my, 2.4); bar(ix0, my, jx0, my, 2); bar(jx1, my, ix1, my, 2);
      }
      // 两根竖棂
      for (const mx of MUL) { g.fillStyle = '#120f0c'; g.fillRect(mx - 5, IY0, 10, IY1 - IY0); g.fillStyle = 'rgba(110,124,148,0.10)'; g.fillRect(mx + 3.5, TR + 5, 1.5, IY1 - TR - 5); }
      // 向内开到 90° 的两扇窗扇（透视梯形，迎窗光的一面略亮，格心无纸）
      const leaf = (hx, side) => {
        const k = 1.198;
        const fx = VPX + (hx - VPX) * k, ty = YH + (TR + 4 - YH) * k, by = YH + (IY1 - YH) * k;
        const P = (u, v) => { // u: 0 铰链 → 1 自由边；v: 0 上 → 1 下
          const kk = 1 / lerp(1, 1 / k, u) ; // 透视插值
          const x = VPX + (hx - VPX) * kk, yt = YH + (TR + 4 - YH) * kk, yb = YH + (IY1 - YH) * kk;
          return [x, lerp(yt, yb, v)];
        };
        void fx; void ty; void by;
        const quad = (u0, u1, v0, v1) => { const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); };
        const wood = side < 0 ? '#2b2a2a' : '#1d1c1d';
        g.fillStyle = wood;
        const fu = 0.12, fv = 0.035;
        quad(0, 1, 0, fv); quad(0, 1, 1 - fv, 1); quad(0, fu, 0, 1); quad(1 - fu, 1, 0, 1);
        // 格心：竖棂与横棂
        for (let i = 1; i < 4; i++) { const u = lerp(fu, 1 - fu, i / 4); quad(u - 0.018, u + 0.018, fv, 1 - fv); }
        for (let j = 1; j < 9; j++) { const v = lerp(fv, 1 - fv, j / 9); quad(fu, 1 - fu, v - 0.005, v + 0.005); }
        // 腰板
        quad(fu, 1 - fu, 0.66, 0.72);
      };
      leaf(IX0, -1); leaf(IX1, 1);
      // 顶梁
      gr = g.createLinearGradient(0, 0, 0, 96);
      gr.addColorStop(0, '#0a0c12'); gr.addColorStop(0.85, '#121620'); gr.addColorStop(1, '#1d2330');
      g.fillStyle = gr; g.fillRect(0, 0, 1280, 96);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 96, 1280, 3);
      // 地板：木板缝向灭点汇聚
      gr = g.createLinearGradient(0, FLOOR, 0, 720);
      gr.addColorStop(0, '#151a24'); gr.addColorStop(0.3, '#0f131b'); gr.addColorStop(1, '#0a0d13');
      g.fillStyle = gr; g.fillRect(0, FLOOR, 1280, 150);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      for (let i = -16; i <= 16; i++) {
        const xw = VPX + i * 52; // 墙脚处的缝
        const k = (720 - YH) / (FLOOR - YH);
        g.beginPath(); g.moveTo(xw, FLOOR); g.lineTo(VPX + (xw - VPX) * k, 720); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, FLOOR - 1, 1280, 2);
      // 柱（离镜头更近，几乎全黑；靠窗一侧一线微光）
      const col = (x0, x1, lit) => {
        const gg = g.createLinearGradient(x0, 0, x1, 0);
        gg.addColorStop(0, '#07090d'); gg.addColorStop(0.5, '#0c0f15'); gg.addColorStop(1, '#07090d');
        g.fillStyle = gg; g.fillRect(x0, 0, x1 - x0, 720);
        g.fillStyle = 'rgba(96,110,136,0.16)'; g.fillRect(lit > 0 ? x1 - 2 : x0, 90, 2, 630);
      };
      col(0, 54, 1); col(1226, 1280, -1);
    });

    // 窗光照在屋里：窗洞四周、地板上的一片冷光（亮度随窗外变化）
    function roomLight(g, L) {
      g.save(); g.globalCompositeOperation = 'screen';
      g.globalAlpha = clamp(0.25 + 0.75 * L);
      g.save(); g.translate(682, 326); g.scale(1, 0.62);
      let gr = g.createRadialGradient(0, 0, 250, 0, 0, 520);
      gr.addColorStop(0, 'rgba(72,84,104,0.30)'); gr.addColorStop(1, 'rgba(72,84,104,0)');
      g.fillStyle = gr; g.fillRect(-640, -640, 1280, 1280); g.restore();
      // 地板上的冷光（只在墙脚到歌词区上沿之间）
      g.save(); g.translate(690, FLOOR + 6); g.scale(1, 0.085);
      gr = g.createRadialGradient(0, 0, 0, 0, 0, 470);
      gr.addColorStop(0, 'rgba(120,138,165,0.34)'); gr.addColorStop(0.6, 'rgba(100,116,140,0.14)'); gr.addColorStop(1, 'rgba(100,116,140,0)');
      g.fillStyle = gr; g.fillRect(-500, -600, 1000, 1200); g.restore();
      g.restore();
    }

    // 人物：背光剪影（白发也压暗），只在迎窗光的右侧描细亮边；窗台以下亮边渐隐
    function drawMan(g, t, L) {
      const S = XYT.sil;
      if (!S) return;
      const { x, y, h } = MAN;
      const bb = S.bounds('old', 'standBack', h, { wind: 0.06 });
      const d = devBox(g, x + bb.left - 4, y + bb.top - 4, x + bb.right + 4, y + bb.bottom + 2);
      const fb = buf('f4man', d.w, d.h), rb = buf('f4rim', d.w, d.h);
      fb.g.setTransform(d.m.a, d.m.b, d.m.c, d.m.d, d.m.e - d.x, d.m.f - d.y);
      S.draw(fb.g, 'old', 'standBack', x, y, h, t, { wind: 0.06, windDir: 1, rim: null, body: '#191c24' });
      // 亮边 = 剪影 − 剪影向左平移（设备像素）
      const rw = Math.max(1, Math.round(1.9 * d.m.a));
      const rg = rb.g;
      rg.drawImage(fb.c, 0, 0);
      rg.globalCompositeOperation = 'source-in';
      rg.fillStyle = mix('#cfd6df', '#f0d2a0', 0.35); rg.fillRect(0, 0, d.w, d.h);
      rg.globalCompositeOperation = 'destination-out';
      rg.drawImage(fb.c, -rw, 0);
      rg.globalCompositeOperation = 'destination-in';
      const sy = (yy) => d.m.d * yy + d.m.f - d.y;
      const gr = rg.createLinearGradient(0, sy(y + bb.top), 0, sy(y));
      const ka = clamp(0.55 + 0.45 * L);
      gr.addColorStop(0, `rgba(0,0,0,${ka})`); gr.addColorStop(0.6, `rgba(0,0,0,${ka * 0.9})`);
      gr.addColorStop(clamp((IY1 - (y + bb.top)) / (-bb.top)), `rgba(0,0,0,${ka * 0.45})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      rg.fillStyle = gr; rg.fillRect(0, 0, d.w, d.h);
      // 剪影整体压暗（逆光）
      fb.g.setTransform(1, 0, 0, 1, 0, 0);
      fb.g.globalCompositeOperation = 'source-atop';
      fb.g.fillStyle = 'rgba(12,14,22,0.62)'; fb.g.fillRect(0, 0, d.w, d.h);
      blitDev(g, fb, d); blitDev(g, rb, d);
    }

    XYT.registerShot('f4_window', {
      name: '临窗望雪', zone: 'bottom', night: true, text: '#f3ead8', shadow: 'rgba(6,8,14,0.85)', accent: '#f3c47a', bloom: 0.42,
      draw(g, c) {
        const lt = c.lt;
        const tHong = CT(c, 7, 3.092), tWo = CT(c, 11, 4.772), tTou = CT(c, 14, 6.012);
        // 雪量：起初稀疏 →「红」起渐密 →「我」雪帘
        const D = 0.32 + 0.38 * smooth(ramp(lt, tHong, tHong + 1.5)) + 0.3 * smooth(ramp(lt, tWo, tWo + 0.9));
        // 雪帘前沿：沿推进方向从窗左上扫到右下（1.2 s）
        const fp0 = DIR[0] * OX0 + DIR[1] * OY0, fp1 = DIR[0] * OX1 + DIR[1] * OY1 + 160;
        const front = lerp(fp0, fp1, easeInOut(ramp(lt, tWo, tWo + 1.25)));
        const whiten = smooth(ramp(lt, tWo + 0.55, tTou)) * 0.86 + 0.05 * smooth(ramp(lt, tTou, tTou + 0.6));
        const haze0 = 0.1 * smooth(ramp(lt, tHong, tHong + 1.5));
        const L = clamp(0.18 + haze0 + 0.85 * whiten + 0.15 * smooth(ramp(lt, tWo, tWo + 1.2)));
        const z = 1 + 0.03 * easeInOut(c.p);
        g.save();
        g.translate(560, 380); g.scale(z, z); g.translate(-560, -380);

        // ---- 窗外 ----
        g.save();
        g.beginPath(); g.rect(OX0, OY0, OX1 - OX0, OY1 - OY0); g.clip();
        g.drawImage(outside(), 370, 130, 630, 385);
        // 雪帘后的部分：模糊的远景 + 密雪 + 雪雾，用沿推进方向的渐变遮罩
        if (lt > tWo - 0.05) {
          const d = devBox(g, OX0, OY0, OX1, OY1);
          const ob = buf('f4veil', d.w, d.h), q = ob.g;
          q.setTransform(d.m.a, 0, 0, d.m.d, d.m.e - d.x, d.m.f - d.y);
          q.drawImage(outsideBlur(), 370, 130, 630, 385);
          q.fillStyle = rgba('#b9c4d2', 0.22); q.fillRect(OX0, OY0, OX1 - OX0, OY1 - OY0);
          const T = lt - tWo;
          tileFill(q, snowTile('m', 520, 7, 1.3, 0.55, 77), 60 * T, 95 * T, OX0, OY0, OX1, OY1);
          tileFill(q, snowTile('n', 160, 13, 2.4, 0.5, 78), 115 * T + 40, 170 * T + 30, OX0, OY0, OX1, OY1);
          q.globalCompositeOperation = 'destination-in';
          const gx = DIR[0], gy = DIR[1];
          const gr = q.createLinearGradient(gx * (front - 150), gy * (front - 150), gx * front, gy * front);
          gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          q.fillStyle = gr; q.fillRect(OX0 - 10, OY0 - 10, OX1 - OX0 + 20, OY1 - OY0 + 20);
          blitDev(g, ob, d);
        }
        // 灯：微微摇曳；雪帘过后化成光斑
        g.globalCompositeOperation = 'lighter';
        const beat = 0.06 * c.be(0.3);
        for (const lg of town.lights) {
          const pos = DIR[0] * lg.x + DIR[1] * lg.y;
          const bl = smooth(clamp((front - pos) / 150));
          const fl = 0.9 + 0.1 * A.noise1(lt * 2.3 + lg.ph, 5) + beat;
          const a = lg.a * fl * (1 - 0.35 * bl) * (1 - 0.8 * whiten);
          const spr = dot(lg.kind === 'lan' ? 'lan' : 'win', lg.col, 0.25);
          const r = lerp(3.2 + lg.w, 10 + lg.w * 2.2, bl) * (lg.ri === 2 ? 1 : 0.8);
          g.globalAlpha = clamp(a * (0.32 + 0.18 * bl));
          g.drawImage(spr, lg.x - r * 1.6, lg.y - r * 1.6, r * 3.2, r * 3.2);
          if (bl < 0.98) {
            g.globalAlpha = clamp(a * (1 - bl));
            g.fillStyle = lg.col;
            g.fillRect(lg.x - lg.w / 2, lg.y - lg.h / 2, lg.w, lg.h);
          }
          // 水中倒影：水线下对称处起，一串断续的横光，向下拉长
          const ry = 2 * WL - lg.y;
          const n = lg.ri === 2 ? 9 : 6;
          for (let k = 0; k < n; k++) {
            const yy = ry - 2 + k * (2.4 + k * 0.55);
            if (yy > OY1) break;
            const nn = A.noise1(lt * 1.6 + k * 1.7 + lg.ph, 9);
            const ww = (lg.w * 0.9 + 2.5 * nn) * (1 + k * 0.12);
            const xo = 2.2 * (A.noise1(lt * 1.1 + k * 0.9 + lg.ph, 11) - 0.5) * (1 + k * 0.2);
            g.globalAlpha = clamp(a * 0.55 * (1 - k / n) * (0.4 + 0.6 * nn) * (1 - 0.6 * bl));
            g.fillStyle = lg.col;
            g.fillRect(lg.x - ww / 2 + xo, yy, ww, 1.1);
          }
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        // 飘雪：远、中两层（近大远小，斜向右下）
        const flakes = (layer, n, seed, size, vy, vx, aMax) => {
          const spr = dot('snow', SNOW, 0.5);
          const X0 = OX0 - 30, Y0 = OY0 - 30, Wd = OX1 - OX0 + 60, Hd = OY1 - OY0 + 60;
          for (let i = 0; i < n; i++) {
            const hA = A.h2(i, seed), hB = A.h2(i, seed + 1), hC = A.h2(i, seed + 2), hD = A.h2(i, seed + 3);
            const th = 0.15 + 0.85 * hD;
            const a = smooth((D - th) / 0.12 + 0.5) * aMax * (0.6 + 0.4 * hC);
            if (a < 0.01) continue;
            const sp = 0.75 + 0.5 * hC;
            const x = X0 + fract(hA + (vx * sp * lt + 4 * Math.sin(lt * (0.8 + hB) + hA * 9)) / Wd) * Wd;
            const y = Y0 + fract(hB + (vy * sp * lt) / Hd) * Hd;
            const r = size * (0.7 + 0.6 * hA);
            g.globalAlpha = a;
            g.drawImage(spr, x - r, y - r, r * 2, r * 2);
          }
          g.globalAlpha = 1;
        };
        flakes(0, 150, 101, 1.3, 26, 16, 0.55);
        flakes(1, 90, 202, 2.3, 48, 30, 0.7);
        // 整窗雪雾：先是淡淡一层，「透」时只剩柔白的光
        if (haze0 + whiten > 0.001) {
          g.fillStyle = rgba(mix(SNOW, WARM, 0.22), clamp(haze0 + whiten));
          g.fillRect(OX0, OY0, OX1 - OX0, OY1 - OY0);
          // 柔光并不均匀：灯火原处略暖
          g.globalCompositeOperation = 'soft-light';
          g.globalAlpha = 0.5 * whiten;
          const gr = g.createLinearGradient(0, OY0, 0, OY1);
          gr.addColorStop(0, '#c9d4e2'); gr.addColorStop(0.55, '#f6e2bc'); gr.addColorStop(1, '#d9e1ea');
          g.fillStyle = gr; g.fillRect(OX0, OY0, OX1 - OX0, OY1 - OY0);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        }
        flakes(2, 30, 303, 3.6, 80, 50, 0.85 * (1 - 0.5 * whiten));
        g.restore();

        // ---- 屋内 ----
        g.drawImage(room(), 0, 0, 1280, 720);
        roomLight(g, L);
        // 人脚下：接触阴影 + 向镜头方向的一片淡影
        g.save();
        g.translate(MAN.x - 8, MAN.y + 2); g.scale(1, 0.16);
        let gr = g.createRadialGradient(0, 0, 0, 0, 0, 70);
        gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(-80, -80, 160, 160);
        g.restore();
        drawMan(g, lt, L);
        g.restore();
      },
    });
  })();
})();
