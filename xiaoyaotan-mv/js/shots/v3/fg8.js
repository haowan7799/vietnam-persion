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
    // 密雪纹理（可平铺）：圆润的雪片，顺落向略拉长（运动模糊）
    function snowTile(key, n, r0, r1, a0, seed) {
      return K.cache('fg8_f4_tile' + key, 280, 240, 1, (g) => {
        const r = A.rng(seed), ang = Math.atan2(DIR[1] + 0.6, DIR[0] * 0.5);
        const spr = dot('snowt', '#eef2f7', 0.45);
        for (let i = 0; i < n; i++) {
          const x = r() * 280, y = r() * 240, rr = r0 + (r1 - r0) * Math.pow(r(), 2.2), a = a0 * (0.35 + 0.65 * r());
          for (const ox of [-280, 0, 280]) for (const oy of [-240, 0, 240]) {
            const cx = x + ox, cy = y + oy;
            if (cx < -12 || cx > 292 || cy < -12 || cy > 252) continue;
            g.save(); g.globalAlpha = a; g.translate(cx, cy); g.rotate(ang); g.scale(1.45, 1);
            g.drawImage(spr, -rr * 1.4, -rr * 1.4, rr * 2.8, rr * 2.8); g.restore();
          }
        }
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
      g.fillStyle = '#000'; g.fillRect(OX0, OY0, OX1 - OX0, OY1 - OY0);
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
        const P = (u, v) => { // u: 0 铰链 → 1 自由边；v: 0 上 → 1 下
          const kk = 1 / lerp(1, 1 / k, u); // 透视插值
          const x = VPX + (hx - VPX) * kk, yt = YH + (TR + 4 - YH) * kk, yb = YH + (IY1 - YH) * kk;
          return [x, lerp(yt, yb, v)];
        };
        const quad = (u0, u1, v0, v1) => { const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); };
        const wood = side < 0 ? '#252427' : '#1b1b1e';
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
      // 右墙上一幅挂轴（抽象的山水淡墨，几乎隐在暗里）
      const sx = 1092, sy0 = 150, sw = 78, sh = 300;
      g.fillStyle = '#1a1c22'; g.fillRect(sx - 4, sy0 - 10, sw + 8, sh + 22);
      g.fillStyle = '#22252c'; g.fillRect(sx, sy0, sw, sh);
      // 画心：两三层淡墨远山，带模糊，像隔着暗处看不真切
      g.save(); g.beginPath(); g.rect(sx + 5, sy0 + 10, sw - 10, sh - 20); g.clip();
      blurInto(g, 1280, 720, 1.6, (q) => {
        const rr = A.rng(919);
        for (let i = 0; i < 3; i++) {
          const by = sy0 + 150 + i * 46;
          q.fillStyle = `rgba(14,16,21,${0.22 + 0.1 * i})`;
          q.beginPath(); q.moveTo(sx, by + 30);
          for (let x = sx; x <= sx + sw; x += 3) q.lineTo(x, by - 22 * Math.pow(A.noise1((x - sx) / (16 + i * 6) + i * 3.1, 31 + i), 1.6) - 6 * rr());
          q.lineTo(sx + sw, by + 30); q.closePath(); q.fill();
        }
      });
      g.restore();
      g.fillStyle = '#121318'; g.fillRect(sx - 8, sy0 + sh + 8, sw + 16, 6); g.fillRect(sx - 6, sy0 - 12, sw + 12, 5);
      g.strokeStyle = 'rgba(20,22,28,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx + 10, sy0 - 12); g.lineTo(sx + sw / 2, sy0 - 40); g.lineTo(sx + sw - 10, sy0 - 12); g.stroke();
      // 墙面纸纹（极淡）
      if (XYT.sprites && XYT.sprites.paper) {
        g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.18;
        g.fillStyle = g.createPattern(XYT.sprites.paper, 'repeat'); g.fillRect(0, 0, 1280, FLOOR); g.restore();
      }
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
      // 窗光的基础亮度
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.25 + 0.75 * RL0;
      g.drawImage(roomLightLayer(), 0, 0, 1280, 720); g.restore();
      // 柱（离镜头更近，几乎全黑；靠窗一侧一线微光）
      const col = (x0, x1, lit) => {
        const gg = g.createLinearGradient(x0, 0, x1, 0);
        gg.addColorStop(0, '#07090d'); gg.addColorStop(0.5, '#0c0f15'); gg.addColorStop(1, '#07090d');
        g.fillStyle = gg; g.fillRect(x0, 0, x1 - x0, 720);
        g.fillStyle = 'rgba(96,110,136,0.16)'; g.fillRect(lit > 0 ? x1 - 2 : x0, 90, 2, 630);
      };
      col(0, 54, 1); col(1226, 1280, -1);
    });

    // 窗光照在屋里：窗洞四周、地板上淡淡的冷光（缓存成一张光层，亮度随窗外变化）
    const roomLightLayer = () => K.cache('fg8_f4_rlight', 1280, 720, 0.5, (g) => {
      g.save(); g.translate(682, 326); g.scale(1, 0.62);
      let gr = g.createRadialGradient(0, 0, 250, 0, 0, 520);
      gr.addColorStop(0, 'rgba(72,84,104,0.30)'); gr.addColorStop(1, 'rgba(72,84,104,0)');
      g.fillStyle = gr; g.fillRect(-640, -640, 1280, 1280); g.restore();
      g.save(); g.translate(690, FLOOR + 6); g.scale(1, 0.085);
      gr = g.createRadialGradient(0, 0, 0, 0, 0, 470);
      gr.addColorStop(0, 'rgba(120,138,165,0.34)'); gr.addColorStop(0.6, 'rgba(100,116,140,0.14)'); gr.addColorStop(1, 'rgba(100,116,140,0)');
      g.fillStyle = gr; g.fillRect(-500, -600, 1000, 1200); g.restore();
    });
    // 基础亮度已烘进屋内静景；这里只叠加窗外变亮后多出来的那部分，只画窗四周
    const RL0 = 0.1;                                 // 低于全镜最小亮度，叠加层从头到尾一直在画（不会中途出现而让像素整体跳一级）
    function roomLight(g, L) {
      const a = 0.75 * (L - RL0);
      if (a <= 0) return;
      const cv = roomLightLayer(), k = cv.width / 1280;
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = clamp(a);
      g.drawImage(cv, 200 * k, 90 * k, 960 * k, 540 * k, 200, 90, 960, 540);
      g.restore();
    }

    // 人物：背光剪影（白发也压暗），只在迎窗光的右侧描细亮边；窗台以下亮边渐隐
    function drawMan(g, t, L, wh) {
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
      // 窗整个变白时：左缘也透出一线很淡的冷光（面光源从身后两侧绕过来）
      let lb = null;
      if (wh > 0.01) {
        lb = buf('f4rimL', d.w, d.h); const lg = lb.g;
        lg.drawImage(fb.c, 0, 0);
        lg.globalCompositeOperation = 'source-in'; lg.fillStyle = '#d6dde6'; lg.fillRect(0, 0, d.w, d.h);
        lg.globalCompositeOperation = 'destination-out'; lg.drawImage(fb.c, Math.max(1, Math.round(1.3 * d.m.a)), 0);
        lg.globalCompositeOperation = 'destination-in'; lg.fillStyle = gr; lg.fillRect(0, 0, d.w, d.h);
      }
      // 剪影整体压暗（逆光）
      fb.g.setTransform(1, 0, 0, 1, 0, 0);
      fb.g.globalCompositeOperation = 'source-atop';
      fb.g.fillStyle = 'rgba(12,14,22,0.62)'; fb.g.fillRect(0, 0, d.w, d.h);
      blitDev(g, fb, d); blitDev(g, rb, d);
      if (lb) { g.save(); g.globalAlpha = 0.4 * clamp(wh); blitDev(g, lb, d); g.restore(); }
    }

    // 雪雾柔光层：上冷下冷、中间（灯火所在的高度）偏暖
    const hazeLayer = () => K.cache('fg8_f4_haze', OX1 - OX0, OY1 - OY0, 0.5, (g) => {
      const w = OX1 - OX0, h = OY1 - OY0;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#c4cfdc'); gr.addColorStop(0.42, '#e9e3d6'); gr.addColorStop(0.62, '#f1e2c4'); gr.addColorStop(1, '#c9d2dc');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w * 0.55, h * 0.6); g.scale(1, 0.35);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
      rg.addColorStop(0, 'rgba(248,226,182,0.55)'); rg.addColorStop(1, 'rgba(248,226,182,0)');
      g.fillStyle = rg; g.fillRect(-w, -w, 2 * w, 2 * w); g.restore();
    });
    // 地板上的窗光池（墙前不远处最亮，沿透视向镜头渐淡，y≈650 前消失）减去人挡出的柔影；人不动，所以整张缓存
    // 影子方向：窗面很宽（人身后到他右后方），影子从脚下向镜头散开，偏左；面光源，影子淡而软
    const floorPool = () => K.cache('fg8_f4_pool', 960, 110, 0.5, (g) => {
      blurInto(g, 960, 110, 9, (q) => {
        q.translate(-200, -560);
        const per = (x, y) => VPX + (x - VPX) * (y - YH) / (FLOOR - YH);   // 墙脚 x 沿地面向镜头的透视线
        const gr = q.createLinearGradient(0, FLOOR, 0, 652);
        // 槛墙挡住墙脚：光池从墙前十几像素处才最亮
        gr.addColorStop(0, 'rgba(132,150,178,0.12)'); gr.addColorStop(0.2, 'rgba(132,150,178,0.58)'); gr.addColorStop(0.48, 'rgba(120,138,165,0.34)'); gr.addColorStop(1, 'rgba(120,138,165,0)');
        q.fillStyle = gr;
        q.beginPath(); q.moveTo(OX0 + 6, FLOOR); q.lineTo(OX1 - 6, FLOOR); q.lineTo(per(OX1 - 6, 652), 652); q.lineTo(per(OX0 + 6, 652), 652); q.closePath(); q.fill();
      });
      // 挖去人影（软边：先在临时画布上画好再模糊着挖）
      g.save(); g.globalCompositeOperation = 'destination-out';
      blurInto(g, 960, 110, 6, (q) => {
        q.translate(-200, -560);
        const sg = q.createLinearGradient(0, MAN.y - 4, 0, 648);
        sg.addColorStop(0, 'rgba(0,0,0,0.95)'); sg.addColorStop(0.45, 'rgba(0,0,0,0.6)'); sg.addColorStop(1, 'rgba(0,0,0,0.15)');
        q.fillStyle = sg;
        q.beginPath(); q.moveTo(MAN.x - 20, MAN.y - 4); q.lineTo(MAN.x + 18, MAN.y - 4);
        q.quadraticCurveTo(MAN.x + 4, 628, MAN.x - 26, 648); q.lineTo(MAN.x - 150, 642);
        q.quadraticCurveTo(MAN.x - 70, 616, MAN.x - 20, MAN.y - 4); q.closePath(); q.fill();
      });
      g.restore();
    });
    XYT.registerShot('f4_window', {
      name: '临窗望雪', zone: 'bottom', night: true, text: '#f3ead8', shadow: 'rgba(6,8,14,0.85)', accent: '#f3c47a', bloom: 0.42,
      draw(g, c) {
        const lt = c.lt;
        // 不透明底：渲染器帧间不清屏，窗洞抗锯齿的边上不能透出上一帧
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#10141f'; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
        const tDense = CT(c, 7, 3.092), tCurtain = CT(c, 11, 4.772), tWhite = CT(c, 14, 6.012);
        // 雪量：起初稀疏 → 第44句第8字起渐密 → 第44句第12字雪帘
        const D = 0.32 + 0.38 * smooth(ramp(lt, tDense, tDense + 1.5)) + 0.3 * smooth(ramp(lt, tCurtain, tCurtain + 0.9));
        // 雪帘前沿：沿推进方向从窗左上扫到右下（1.25 s）
        const fp0 = DIR[0] * OX0 + DIR[1] * OY0, fp1 = DIR[0] * OX1 + DIR[1] * OY1 + 160;
        const fk = ramp(lt, tCurtain, tCurtain + 1.25), front = lerp(fp0, fp1, smooth(fk));
        // 第44句第15字：只剩柔白的光（灯火还隐约暖着）
        const whiten = 0.7 * smooth(ramp(lt, tCurtain + 0.6, tWhite)) + 0.06 * smooth(ramp(lt, tWhite, tWhite + 0.6));
        const haze0 = 0.1 * smooth(ramp(lt, tDense, tDense + 1.5));
        const L = clamp(0.18 + haze0 + 0.95 * whiten + 0.15 * smooth(fk));
        const z = 1 + 0.03 * easeInOut(c.p);
        g.save();
        g.translate(560, 380); g.scale(z, z); g.translate(-560, -380);

        // ---- 窗外 ----
        // 静景先整张画（比窗洞大一圈，窗洞边上的半透明像素下面总有确定的内容），其余窗外层裁在放大 3 px 的窗洞里
        if (fk < 1) g.drawImage(outside(), 370, 130, 630, 385);
        g.save();
        g.beginPath(); g.rect(OX0 - 3, OY0 - 3, OX1 - OX0 + 6, OY1 - OY0 + 6); g.clip();
        // 雪帘后的部分：模糊的远景 + 密雪 + 雪雾；前沿扫过之前用沿推进方向的渐变遮罩
        const veil = (q) => {
          q.drawImage(outsideBlur(), 370, 130, 630, 385);
          q.fillStyle = rgba('#b9c4d2', 0.2); q.fillRect(OX0 - 3, OY0 - 3, OX1 - OX0 + 6, OY1 - OY0 + 6);
          const T = lt - tCurtain;
          tileFill(q, snowTile('m', 760, 0.9, 2.4, 0.75, 77), 34 * T, 52 * T, OX0 - 3, OY0 - 3, OX1 + 3, OY1 + 3);
        };
        // 雪帘层画在半分辨率的缓冲里（内容本来就是模糊的远景与密雪），前沿扫过之前用渐变遮罩；扫过之后整窗都是它
        if (lt > tCurtain - 0.05) {
          const d = devBox(g, OX0 - 3, OY0 - 3, OX1 + 3, OY1 + 3), hs = 0.5;
          const w2 = Math.ceil(d.w * hs), h2 = Math.ceil(d.h * hs);
          const ob = buf('f4veil', w2, h2), q = ob.g;
          q.setTransform(d.m.a * hs, 0, 0, d.m.d * hs, (d.m.e - d.x) * hs, (d.m.f - d.y) * hs);
          veil(q);
          if (fk < 1) {
            q.globalCompositeOperation = 'destination-in';
            const gx = DIR[0], gy = DIR[1];
            const gr = q.createLinearGradient(gx * (front - 150), gy * (front - 150), gx * front, gy * front);
            gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
            q.fillStyle = gr; q.fillRect(OX0 - 10, OY0 - 10, OX1 - OX0 + 20, OY1 - OY0 + 20);
          }
          g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true;
          g.drawImage(ob.c, 0, 0, w2, h2, d.x, d.y, w2 / hs, h2 / hs);
          g.restore();
        }
        // 灯：微微摇曳（随拍略亮）；雪帘过后化成光斑
        g.globalCompositeOperation = 'lighter';
        const beat = 0.06 * c.be(0.3);
        for (const lg of town.lights) {
          const pos = DIR[0] * lg.x + DIR[1] * lg.y;
          const bl = smooth(clamp((front - pos) / 150));
          const fl = 0.9 + 0.1 * A.noise1(lt * 2.3 + lg.ph, 5) + beat;
          const a = lg.a * fl * (1 - 0.3 * bl);
          const spr = dot(lg.kind === 'lan' ? 'lan' : 'win', lg.col, 0.25);
          // 靠窗边的灯：光晕收小收淡（否则被窗边切开，像窗外紧贴着一盏灯）
          const ef = smooth((lg.x - OX0) / 40) * smooth((OX1 - lg.x) / 40);
          const r = lerp(3.2 + lg.w, 12 + lg.w * 2.4, bl) * (lg.ri === 2 ? 1 : 0.8) * (0.5 + 0.5 * ef);
          g.globalAlpha = clamp(a * (0.25 + 0.12 * bl) * ef);
          g.drawImage(spr, lg.x - r * 1.6, lg.y - r * 1.6, r * 3.2, r * 3.2);
          if (bl > 0.98) continue;
          g.globalAlpha = clamp(a * (1 - bl));
          g.fillStyle = lg.col;
          g.fillRect(lg.x - lg.w / 2, lg.y - lg.h / 2, lg.w, lg.h);
          // 水中倒影：水线下对称处起，一串断续的横光，向下拉长
          const ry = 2 * WL - lg.y;
          const n = lg.ri === 2 ? 8 : 5;
          for (let k = 0; k < n; k++) {
            const yy = ry - 2 + k * (2.6 + k * 0.6);
            if (yy > OY1) break;
            const nn = A.noise1(lt * 1.6 + k * 1.7 + lg.ph, 9);
            const ww = (lg.w * 0.9 + 2.5 * nn) * (1 + k * 0.12);
            const xo = 2.2 * (A.noise1(lt * 1.1 + k * 0.9 + lg.ph, 11) - 0.5) * (1 + k * 0.2);
            g.globalAlpha = clamp(a * 0.55 * (1 - k / n) * (0.4 + 0.6 * nn) * (1 - bl));
            g.fillRect(lg.x - ww / 2 + xo, yy, ww, 1.1);
          }
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        // 飘雪：远、中两层（近大远小，斜向右下）；雪片在窗洞外一圈的范围里循环，进出都在画外
        const flakes = (n, seed, size, vy, vx, aMax, wipe) => {
          const spr = dot('snow', SNOW, 0.5);
          const X0 = OX0 - 30, Y0 = OY0 - 30, Wd = OX1 - OX0 + 60, Hd = OY1 - OY0 + 60;
          for (let i = 0; i < n; i++) {
            const hA = A.h2(i, seed), hB = A.h2(i, seed + 1), hC = A.h2(i, seed + 2), hD = A.h2(i, seed + 3);
            const th = 0.15 + 0.85 * hD;
            const a = smooth((D - th) / 0.12 + 0.5) * aMax * (0.6 + 0.4 * hC);
            if (a <= 0) continue;
            const sp = 0.75 + 0.5 * hC;
            const x = X0 + fract(hA + (vx * sp * lt + 4 * Math.sin(lt * (0.8 + hB) + hA * 9)) / Wd) * Wd;
            const y = Y0 + fract(hB + (vy * sp * lt) / Hd) * Hd;
            const r = size * (0.7 + 0.6 * hA);
            const w = wipe ? smooth((front - (DIR[0] * x + DIR[1] * y)) / 150) : 1;
            if (w <= 0) continue;
            g.globalAlpha = a * w;
            g.drawImage(spr, x - r, y - r, r * 2, r * 2);
          }
          g.globalAlpha = 1;
        };
        flakes(120, 101, 1.3, 26, 16, 0.55);
        flakes(80, 202, 2.3, 48, 30, 0.7);
        // 整窗雪雾：先是淡淡一层；第44句第15字时满窗柔白的光，中间灯火处偏暖
        const hz = clamp(haze0 + whiten);
        if (hz > 0) {
          g.globalAlpha = hz;
          g.drawImage(hazeLayer(), OX0, OY0, OX1 - OX0, OY1 - OY0);
          g.globalAlpha = 1;
        }
        flakes(30, 303, 3.6, 80, 50, 0.85 * (1 - 0.6 * whiten));
        // 雪帘里的近处大雪片：跟着前沿出现
        if (lt > tCurtain - 0.05) flakes(60, 404, 4.2, 96, 62, 0.8 * (1 - 0.5 * whiten), true);
        g.restore();

        // ---- 屋内 ----
        g.drawImage(room(), 0, 0, 1280, 720);
        roomLight(g, L);
        // 窗整个变亮时：地板上铺开柔和的冷光，人挡出一道向镜头、偏左（窗心在他右后方）的淡影
        if (whiten > 0.01) {
          g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = clamp(0.9 * whiten);
          g.drawImage(floorPool(), 200, 560, 960, 110);
          g.restore();
        }
        // 人脚下的接触阴影
        g.save();
        g.translate(MAN.x - 6, MAN.y + 2); g.scale(1, 0.16);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 70);
        gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(-80, -80, 160, 160);
        g.restore();
        drawMan(g, lt, L, whiten);
        g.restore();
      },
    });
  })();

  // ======================= f5 雪谷墨溪 =======================
  (function () {
    const YH = 150, VX = 560;                        // 地平线、溪流消失点
    const MAN = { x: 640, y: 470, h: 34 };
    const PAPER = '#eef0f2', FOG = '#dde1e5';
    // 透视：s = 近大远小系数（画面底边为 1），z = 1/s 为深度
    const sOf = (y) => (y - YH) / (720 - YH);
    // 溪在地面上的走向：中线横向偏移 u(z)（单位：画面底边的像素）、宽度 w(z)；深度一单位折合 ZP 个横向像素。
    // 弯的地面波长不变，透视下越远越扁、越密；溪向上游渐窄，到天边细如发丝
    const ZP = 1140;
    // 两个波长叠加、幅度随深度起伏，弯得不那么整齐
    const amp = (z) => 1 + 0.35 * Math.sin(z * 0.9 + 0.4);
    // 远处的弯收小、变得不规则（天边只剩一根轻轻起伏的细线）：第二个波长随深度淡出，主波相位带噪声（只在远处）
    const far = (z) => 1 / (1 + 0.26 * Math.pow(Math.max(0, z - 2), 2));
    const fade2 = (z) => smooth((3.0 - z) / 1.2);
    const phN = (z) => 0.9 * 2 * (A.noise1(z * 0.6, 47) - A.noise1(1.4, 47)) * smooth((z - 2.4) / 1.6);
    const zEff = (z) => (z < 3 ? z : 3 + (z - 3) * 0.55);   // 远处弯得更舒展（画意，不成锯齿）
    const uOf = (z) => (120 * amp(z) * Math.sin(TAU * (zEff(z) - 0.92) / 1.5 + phN(z)) + 34 * Math.sin(TAU * z / 0.83 + 2.1) * fade2(z)) * far(z) - 10;
    const duOf = (z) => (uOf(z + 0.002) - uOf(z - 0.002)) / 0.004;
    const wOf = (z) => 260 * (1 + 0.08 * Math.sin(z * 3.1 + 0.7)) / (1 + 0.22 * (z - 1));
    const proj = (X, z) => [VX + X / z, YH + 570 / z];
    const cx = (y) => { const z = 570 / (y - YH); return VX + uOf(z) / z; };
    const hw = (y) => { const z = 570 / (y - YH), d = duOf(z) / ZP; return 0.5 * wOf(z) / z * Math.sqrt(1 + d * d); };
    // 两岸：中线沿地面法向各偏半个宽度再投影（横着走的一段在画面上自然变薄）
    const BANKS = (() => {
      const L = [], R = [];
      for (let k = 0; k <= 420; k++) {
        const y = 156 + (775 - 156) * Math.pow(k / 420, 1.8), z = 570 / (y - YH);
        const X = uOf(z), d = duOf(z), len = Math.hypot(d, ZP), nx = -ZP / len, nz = d / len;
        // 最细的一层岸线起伏只在近处（远处收成干净的细笔，不成裂纹）
        const fine = 0.05 * smooth((2.5 - z) / 1.5);
        const wl = 0.5 * wOf(z) * (1 + 0.16 * (A.noise1(z * 9 + 3, 41) - 0.5) + 0.1 * (A.noise1(z * 34, 42) - 0.5) + fine * (A.noise1(z * 110, 45) - 0.5));
        const wr = 0.5 * wOf(z) * (1 + 0.16 * (A.noise1(z * 9 + 7, 43) - 0.5) + 0.1 * (A.noise1(z * 34, 44) - 0.5) + fine * (A.noise1(z * 110, 46) - 0.5));
        L.push(proj(X + nx * wl, z + nz * wl / ZP)); R.push(proj(X - nx * wr, z - nz * wr / ZP));
      }
      return { L, R };
    })();
    function streamPath(g) {
      const { L, R } = BANKS;
      g.beginPath();
      L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
      g.closePath();
    }
    const inStream = (x, y, pad) => Math.abs(x - cx(y)) < hw(y) + pad;
    // 积雪的松（水墨）：树干两侧一枝枝下垂的枝团（左右长短、高低不一，偶尔露出树干），
    // 枝团顶面留白即是雪（外缘一线淡灰），下沿是两种墨色的枝梢（齿状干笔）；顶上两层短枝对称收拢，一根细尖的梢，不压雪。
    // far：0 近 → 1 远（墨色变淡）
    function pine(g, x, y, h, seed, far) {
      const r = A.rng(seed);
      const inkD = mix('#1b1e22', '#a9b0b7', far * 0.85), inkL = mix('#4a5057', '#c0c6cc', far * 0.85);
      const snowT = mix('#f8f9fa', '#e8ebee', far), snowS = mix('#d0d6dd', '#d9dde2', far), edge = mix('#a7afb8', '#cdd2d7', far);
      if (h < 9) {
        g.fillStyle = inkL; g.beginPath(); g.moveTo(x, y - h); g.quadraticCurveTo(x + h * 0.3, y - h * 0.15, x, y); g.quadraticCurveTo(x - h * 0.3, y - h * 0.15, x, y - h); g.fill();
        return;
      }
      const lean = (r() - 0.5) * 0.05;
      const ax = (u) => x + lean * h * u;
      g.fillStyle = inkD;
      g.beginPath(); g.moveTo(x - h * 0.028, y + 0.5); g.lineTo(ax(0.92) - 0.4, y - h * 0.92); g.lineTo(ax(0.92) + 0.4, y - h * 0.92); g.lineTo(x + h * 0.028, y + 0.5); g.closePath(); g.fill();
      const n = Math.max(4, Math.min(11, Math.round(h / 11)));
      const du = 0.72 / (n - 1), th0 = h * du * 1.45;
      const clumps = [];
      for (let i = 0; i < n; i++) {
        const top = i >= n - 2;
        const u = 0.13 + du * i + (top ? 0 : (r() - 0.5) * du * 0.5);
        const W = h * (0.4 * Math.pow(1 - u, 0.85) + 0.035);
        for (const side of [-1, 1]) {
          if (!top && i > 0 && r() < 0.12) continue;          // 偶尔缺一枝，露出树干
          const len = W * (top ? 1 : 0.72 + 0.45 * r());
          const dy = top ? 0 : (r() - 0.5) * du * h * 0.45;
          clumps.push({ cx: ax(u), cy: y - h * u + dy, side, len, th: th0 * (top ? 0.8 : 0.85 + 0.3 * r()), sn: 0.2 + 0.1 * r(), ph: r() * 6.28, sd: r() });
        }
      }
      clumps.sort((a, b) => b.cy - a.cy);                      // 下面的先画，上面的枝团压在下面的雪上
      for (const cl of clumps) {
        const { cx, cy, side, len, th, sn, ph } = cl;
        const rr = A.rng(Math.floor(cl.sd * 1e6) + 7);
        const X = (t) => cx + side * len * t;
        const topY = (t) => cy - th * 0.45 * (1 - Math.pow(t, 1.6)) + th * 0.42 * t * t - th * 0.05 * Math.sin(t * 9 + ph) * t * (1 - t);
        const snowB = (t) => topY(t) + th * sn * (1.15 - 0.65 * t) + th * 0.06 * Math.sin(t * 11 + ph * 2);
        // 枝团的墨：先一层淡墨铺底（下沿高低不齐），再用许多向下、向外的短笔（针叶）压出深墨与毛糙的干笔下沿
        const lowY = (t) => snowB(t) + th * (0.26 + 0.3 * A.noise1(t * 5 + ph * 3, 91)) * (1 - 0.35 * t);
        g.fillStyle = rgba(inkL, 0.6);
        g.beginPath(); g.moveTo(cx - side * th * 0.1, topY(0) + th * 0.2);
        for (let k = 1; k <= 12; k++) { const t = k / 12; g.lineTo(X(t), snowB(t) - th * 0.12); }
        for (let k = 12; k >= 0; k--) { const t = k / 12; g.lineTo(X(t) - side * th * 0.06 * t, lowY(t)); }
        g.closePath(); g.fill();
        const ns = Math.max(6, Math.round(len * 1.4));
        g.lineCap = 'round';
        for (let j = 0; j < ns; j++) {
          const t = Math.pow(rr(), 0.85), x0 = X(t), y0 = snowB(t) - th * 0.05 + th * 0.15 * rr();
          const a = Math.PI / 2 - side * (0.25 + 0.55 * rr()) * (0.6 + 0.6 * t);
          const L = th * (0.22 + 0.42 * rr()) * (1 - 0.3 * t);
          const dark = clamp(1 - t * 0.9 + (rr() - 0.5) * 0.4);
          g.strokeStyle = rgba(mix(inkL, inkD, dark), 0.45 + 0.4 * rr());
          g.lineWidth = Math.max(0.45, th * (0.05 + 0.05 * rr()));
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); g.stroke();
        }
        // 雪：贴着枝团上沿留白，中间厚、梢头薄
        g.beginPath(); g.moveTo(cx - side * th * 0.12, topY(0));
        for (let k = 0; k <= 14; k++) { const t = k / 14; g.lineTo(X(t), topY(t)); }
        for (let k = 14; k >= 0; k--) { const t = k / 14; g.lineTo(X(t) - side * th * 0.05 * t, snowB(t)); }
        g.lineTo(cx - side * th * 0.12, snowB(0)); g.closePath();
        const sg = g.createLinearGradient(0, cy - th * 0.5, 0, cy + th * 0.45);
        sg.addColorStop(0, snowT); sg.addColorStop(0.55, snowT); sg.addColorStop(1, snowS);
        g.fillStyle = sg; g.fill();
        g.strokeStyle = rgba(edge, 0.7); g.lineWidth = Math.max(0.5, th * 0.045);
        g.beginPath();
        for (let k = 1; k <= 13; k++) { const t = k / 14; k === 1 ? g.moveTo(X(t), topY(t)) : g.lineTo(X(t), topY(t)); }
        g.stroke();
      }
      // 梢：一根细尖（墨），不压雪
      const tx = ax(0.95);
      g.fillStyle = inkD;
      g.beginPath(); g.moveTo(tx - h * 0.024, y - h * 0.84); g.quadraticCurveTo(tx - h * 0.006, y - h * 0.93, tx, y - h * 1.02);
      g.quadraticCurveTo(tx + h * 0.006, y - h * 0.93, tx + h * 0.024, y - h * 0.84); g.closePath(); g.fill();
    }
    // 松林：每簇若干棵，近大远小、远处偏淡（右侧歌词区不放）
    const CLUSTERS = [
      [40, 714, 3], [196, 592, 2],                   // 近景左：两簇
      [806, 470, 3], [326, 414, 2],                  // 中景：小人身后的岸上一簇，对岸一簇
      [292, 258, 4], [694, 234, 3], [505, 200, 3],   // 远景
    ];
    const scene = () => K.cache('fg8_f5_scene', 1280, 720, 1, (g) => {
      // 天：阴天的灰白
      let gr = g.createLinearGradient(0, 0, 0, YH + 4);
      gr.addColorStop(0, '#dfe2e6'); gr.addColorStop(1, '#ebedef');
      g.fillStyle = gr; g.fillRect(0, 0, 1280, YH + 4);
      // 远山：两层淡墨，顶上雪，越远越淡（右侧更淡）
      const ridge = (base, amp, f, seed, col, snowA) => {
        g.beginPath(); g.moveTo(0, YH + 6);
        const pts = [];
        for (let x = 0; x <= 1280; x += 4) {
          const y = base - amp * Math.pow(A.noise1(x / f, seed), 1.5) - amp * 0.3 * A.noise1(x / (f * 0.33), seed + 1);
          pts.push([x, y]); g.lineTo(x, y);
        }
        g.lineTo(1280, YH + 6); g.closePath();
        g.fillStyle = col; g.fill();
        g.save(); g.clip();
        for (let i = 0; i < 90; i++) {
          const p = pts[Math.floor(A.h2(i, seed) * pts.length)];
          g.strokeStyle = `rgba(250,251,252,${snowA * (0.5 + 0.5 * A.h2(i, seed + 2))})`; g.lineWidth = 1.2 + 2.2 * A.h2(i, seed + 3);
          g.beginPath(); g.moveTo(p[0], p[1] + 1); g.lineTo(p[0] + (A.h2(i, seed + 4) - 0.5) * 18, p[1] + 8 + 18 * A.h2(i, seed + 5)); g.stroke();
        }
        gr = g.createLinearGradient(0, base - amp, 0, YH + 6);
        gr.addColorStop(0, 'rgba(234,236,239,0)'); gr.addColorStop(1, 'rgba(234,236,239,0.9)');
        g.fillStyle = gr; g.fillRect(0, base - amp * 1.4, 1280, YH + 6 - base + amp * 1.4);
        gr = g.createLinearGradient(900, 0, 1280, 0);
        gr.addColorStop(0, 'rgba(234,236,239,0)'); gr.addColorStop(1, 'rgba(234,236,239,0.6)');
        g.fillStyle = gr; g.fillRect(900, 0, 380, YH + 6);
        g.restore();
      };
      ridge(140, 48, 170, 51, '#c9ced3', 0.55);
      ridge(150, 24, 90, 53, '#b7bdc4', 0.6);
      // 雪原：近白，远处偏灰（空气）
      gr = g.createLinearGradient(0, YH, 0, 720);
      gr.addColorStop(0, '#d9dde1'); gr.addColorStop(0.2, '#e7eaed'); gr.addColorStop(1, '#f2f4f5');
      g.fillStyle = gr; g.fillRect(0, YH + 2, 1280, 720 - YH);
      // 谷坡：左右两侧越往外越高，淡灰的坡面阴影宽而柔；远处两侧各一道积雪的小山梁（山脚一线淡墨）
      blurInto(g, 1280, 720, 14, (q) => {
        let gg = q.createLinearGradient(0, 0, 360, 0);
        gg.addColorStop(0, 'rgba(118,126,136,0.16)'); gg.addColorStop(1, 'rgba(118,126,136,0)');
        q.fillStyle = gg; q.fillRect(0, 170, 360, 560);
        gg = q.createLinearGradient(1000, 0, 760, 0);
        gg.addColorStop(0, 'rgba(118,126,136,0.12)'); gg.addColorStop(1, 'rgba(118,126,136,0)');
        q.fillStyle = gg; q.fillRect(760, 170, 240, 300);
        // 岸边的坡面（贴着岸的一道淡灰，像岸壁）
        for (const side of [BANKS.L, BANKS.R]) {
          q.beginPath(); side.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1])));
          q.strokeStyle = 'rgba(110,118,128,0.22)'; q.lineWidth = 12; q.stroke();
        }
      });
      const hillock = (x0, x1, yb, hgt, seed, dir) => {
        g.save();
        g.beginPath(); g.moveTo(x0, yb);
        const pts = [];
        for (let x = x0; x <= x1; x += 3) {
          const u = (x - x0) / (x1 - x0), y = yb - hgt * Math.pow(Math.sin(Math.PI * Math.pow(u, dir > 0 ? 0.7 : 1.4)), 1.2) * (0.85 + 0.3 * A.noise1(x / 40, seed));
          pts.push([x, y]); g.lineTo(x, y);
        }
        g.lineTo(x1, yb); g.closePath();
        g.fillStyle = '#eceef0'; g.fill();
        g.clip();
        // 背光坡：山脚和一侧一层淡墨
        const gr2 = g.createLinearGradient(0, yb - hgt, 0, yb);
        gr2.addColorStop(0, 'rgba(118,126,136,0)'); gr2.addColorStop(1, 'rgba(118,126,136,0.18)');
        g.fillStyle = gr2; g.fillRect(x0, yb - hgt, x1 - x0, hgt);
        g.restore();
        // 山梁顶上一线极淡的墨（模糊）
        blurInto(g, 1280, 720, 1.2, (q2) => {
          q2.strokeStyle = 'rgba(120,128,138,0.22)'; q2.lineWidth = 1.2;
          q2.beginPath(); pts.forEach((p, i) => (i ? q2.lineTo(p[0], p[1]) : q2.moveTo(p[0], p[1]))); q2.stroke();
        });
      };
      hillock(90, 520, 214, 26, 61, 1); hillock(640, 980, 205, 20, 62, -1);
      hillock(-40, 330, 262, 34, 63, 1); hillock(700, 1010, 256, 22, 64, -1);
      // 右侧歌词区：压一层平整的雪色，保证低反差
      gr = g.createLinearGradient(900, 0, 1100, 0);
      gr.addColorStop(0, 'rgba(240,242,244,0)'); gr.addColorStop(1, 'rgba(240,242,244,0.75)');
      g.fillStyle = gr; g.fillRect(900, YH + 2, 380, 720 - YH);
      // 溪：一笔浓墨，边上墨色更重；远处映着天光变淡；末端细如发丝
      const ink = document.createElement('canvas'), S = SS();
      ink.width = Math.ceil(1280 * S); ink.height = Math.ceil(720 * S);
      const q = ink.getContext('2d'); q.scale(S, S);
      streamPath(q);
      gr = q.createLinearGradient(0, YH, 0, 720);
      gr.addColorStop(0, '#c9ced3'); gr.addColorStop(0.08, '#90979e'); gr.addColorStop(0.2, '#545a60'); gr.addColorStop(0.45, '#2a2e33'); gr.addColorStop(1, '#1a1d21');
      q.fillStyle = gr; q.fill();
      q.save(); q.clip();
      // 水面映着阴天：偏一侧一道很淡的亮（模糊）
      blurInto(q, 1280, 720, 12, (w) => {
        w.beginPath();
        for (let y = 200; y < 770; y += 6) { const x = cx(y) - hw(y) * 0.3; y === 200 ? w.moveTo(x, y) : w.lineTo(x, y); }
        w.strokeStyle = 'rgba(150,158,168,0.14)'; w.lineWidth = 40; w.stroke();
      });
      // 墨里的笔丝：许多短而淡的顺流细纹（只在近、中段）
      const rr = A.rng(707);
      for (let i = 0; i < 260; i++) {
        const y0 = 260 + Math.pow(rr(), 0.8) * 510, v = (rr() - 0.5) * 1.7, len = (10 + 50 * rr()) * sOf(y0) + 4;
        q.beginPath();
        for (let k = 0; k <= 4; k++) { const y = y0 + (k / 4) * len, x = cx(y) + v * hw(y); k ? q.lineTo(x, y) : q.moveTo(x, y); }
        q.strokeStyle = `rgba(${rr() < 0.5 ? '120,128,138' : '8,9,11'},${(0.04 + 0.06 * rr()).toFixed(3)})`;
        q.lineWidth = 0.6 + 1.6 * rr() * sOf(y0); q.stroke();
      }
      q.restore();
      q.save(); q.lineJoin = 'round';
      // 墨边：近处浓、远处淡
      q.strokeStyle = (() => { const e = q.createLinearGradient(0, 180, 0, 420); e.addColorStop(0, 'rgba(10,12,15,0)'); e.addColorStop(1, 'rgba(10,12,15,0.5)'); return e; })();
      q.lineWidth = 2;
      for (const side of [BANKS.L, BANKS.R]) { q.beginPath(); side.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); q.stroke(); }
      q.restore();
      g.save(); g.filter = `blur(${(0.7 * S).toFixed(2)}px)`; g.drawImage(ink, 0, 0, 1280, 720); g.restore();
      // 岸边：几块贴着水边的石头（轮廓不规则），顶上一弯积雪，脚下一点接触阴影
      for (const [k, sideL, sd] of [[300, 1, 11], [356, 0, 12], [398, 1, 13], [268, 0, 14]]) {
        const side = sideL ? BANKS.L : BANKS.R;
        const [xb, yb] = side[k], s = sOf(yb), dir = sideL ? -1 : 1, rr = A.rng(606 + sd);
        const rw = (15 + 10 * rr()) * s, rh = rw * (0.5 + 0.12 * rr()), x0 = xb + dir * rw * 0.55, y0 = yb + rh * 0.1;
        // 雪地上的接触阴影
        g.fillStyle = 'rgba(96,104,114,0.22)'; g.beginPath(); g.ellipse(x0 + dir * rw * 0.1, y0 + rh * 0.2, rw * 1.15, rh * 0.32, 0, 0, TAU); g.fill();
        // 圆润的卵石轮廓：7 个点、半径轻微起伏，用二次曲线连成平滑闭合线；底边略平
        const P7 = [];
        for (let i = 0; i < 7; i++) {
          const a2 = (i / 7) * TAU + 0.3, q = 0.9 + 0.18 * A.noise1(i * 1.3 + sd * 2.1, 81);
          P7.push([x0 + Math.cos(a2) * rw * q, y0 + Math.min(Math.sin(a2) * rh * q, rh * 0.25)]);
        }
        const rock = () => {
          g.beginPath();
          const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          let m0 = mid(P7[6], P7[0]); g.moveTo(m0[0], m0[1]);
          for (let i = 0; i < 7; i++) { const a = P7[i], b = P7[(i + 1) % 7], m = mid(a, b); g.quadraticCurveTo(a[0], a[1], m[0], m[1]); }
          g.closePath();
        };
        rock();
        const sgr = g.createLinearGradient(0, y0 - rh, 0, y0 + rh * 0.25);
        sgr.addColorStop(0, '#3d434a'); sgr.addColorStop(0.6, '#2a2f35'); sgr.addColorStop(1, '#15181c');
        g.fillStyle = sgr; g.fill();
        // 积雪：盖住顶上一层，下沿微微起伏
        g.save(); rock(); g.clip();
        g.beginPath(); g.moveTo(x0 - rw * 1.3, y0 - rh * 1.4);
        g.lineTo(x0 + rw * 1.3, y0 - rh * 1.4);
        for (let i = 0; i <= 10; i++) { const u = 1 - i / 10, xx = x0 + (u * 2 - 1) * rw * 1.2; g.lineTo(xx, y0 - rh * 0.5 + rh * 0.1 * Math.sin(u * 7 + sd) + rh * 0.3 * (u * 2 - 1) * (u * 2 - 1)); }
        g.closePath();
        const cg = g.createLinearGradient(0, y0 - rh, 0, y0);
        cg.addColorStop(0, '#f6f7f8'); cg.addColorStop(1, '#d6dbe0');
        g.fillStyle = cg; g.fill();
        g.restore();
      }
      // 松林
      const trees = [];
      CLUSTERS.forEach(([x0, y0, n], ci) => {
        for (let k = 0; k < n; k++) {
          const y = y0 + (A.h2(ci, k) - 0.5) * 40 * sOf(y0) + (k % 2) * 10 * sOf(y0), s = sOf(y);
          const x = x0 + (A.h2(ci, k + 9) - 0.5) * 36 * s + (k - (n - 1) / 2) * 44 * s;
          if (inStream(x, y, 20 * s)) continue;
          if (Math.abs(x - MAN.x) < 50 && Math.abs(y - MAN.y) < 40) continue;
          trees.push([x, y, (112 + 76 * A.h2(ci, k + 20)) * s, ci * 31 + k]); // 松高约为人的 2–3 倍（3–5 米的松）
        }
      });
      trees.sort((a, b) => a[1] - b[1]);
      // 墨晕：每棵树后面一层很淡、很柔的灰，像墨在湿纸上微微洇开
      blurInto(g, 1280, 720, 7, (q2) => {
        for (const [x, y, h] of trees) {
          const s = sOf(y), far = clamp(1 - s * 1.6);
          q2.fillStyle = `rgba(70,76,84,${(0.09 * (1 - 0.7 * far)).toFixed(3)})`;
          q2.beginPath(); q2.moveTo(x, y - h * 0.95); q2.quadraticCurveTo(x + h * 0.42, y - h * 0.1, x + h * 0.3, y); q2.lineTo(x - h * 0.3, y); q2.quadraticCurveTo(x - h * 0.42, y - h * 0.1, x, y - h * 0.95); q2.fill();
        }
      });
      blurInto(g, 1280, 720, 0.5, (q2) => {
        for (const [x, y, h, sd] of trees) {
          const s = sOf(y), far = clamp(1 - s * 1.6);
          q2.save(); q2.translate(x, y + 1); q2.scale(1, 0.2);
          const cg = q2.createRadialGradient(0, 0, 0, 0, 0, h * 0.34);
          cg.addColorStop(0, 'rgba(100,108,118,0.26)'); cg.addColorStop(1, 'rgba(100,108,118,0)');
          q2.fillStyle = cg; q2.fillRect(-h * 0.34, -h * 0.34, h * 0.68, h * 0.68); q2.restore();
          pine(q2, x, y, h, sd, far);
        }
      });
      // 天边的雾：远处的溪与山越来越淡
      gr = g.createLinearGradient(0, YH - 20, 0, 250);
      gr.addColorStop(0, 'rgba(234,236,239,0.15)'); gr.addColorStop(0.25, 'rgba(234,236,239,0.55)'); gr.addColorStop(1, 'rgba(234,236,239,0)');
      g.fillStyle = gr; g.fillRect(0, YH - 20, 1280, 270 - YH);
    });
    // 雪片贴图：纯白实芯，边缘很快收掉（不描边、无灰圈）
    const flakeSpr = () => K.cache('fg8_f5_flake', 32, 32, 1, (g) => {
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    });
    // 密雪纹理（可上下平铺，竖直缓落）：不算粒子数；两种尺寸的贴图，长宽互不成整数比，避免看出格子
    const SNOW_T = { far: [300, 262, 600, 1.0, 1.6, 5101], mid: [346, 298, 250, 1.6, 2.4, 5102] };
    const snowTile = (key) => {
      const [tw, th, n, r0, r1, seed] = SNOW_T[key];
      return K.cache('fg8_f5_tile' + key, tw, th, 1, (g) => {
        const r = A.rng(seed), spr = flakeSpr();
        for (let i = 0; i < n; i++) {
          const x = r() * tw, y = r() * th, rr = r0 + (r1 - r0) * r(), a = 0.55 + 0.45 * r();
          for (const ox of [-tw, 0, tw]) for (const oy of [-th, 0, th]) {
            const px = x + ox, py = y + oy;
            if (px < -6 || px > tw + 6 || py < -6 || py > th + 6) continue;
            g.globalAlpha = a; g.drawImage(spr, px - rr * 1.5, py - rr * 1.5, rr * 3, rr * 3);
          }
        }
        g.globalAlpha = 1;
      });
    };
    // 平铺一层雪：oy 为竖直滚动量；x > 900 渐降到 capR 倍（歌词区雪片更淡）
    function snowSheet(g, key, ox, oy, a, capR) {
      if (a <= 0.004) return;
      const tile = snowTile(key), [tw, th] = SNOW_T[key];
      const sy = -40 - fract((-40 - oy) / th) * th, sx = -60 - fract((-60 - ox) / tw) * tw;
      const band = (x0, x1, k) => {
        g.save(); g.beginPath(); g.rect(x0, -40, x1 - x0, 800); g.clip(); g.globalAlpha = a * k;
        for (let y = sy; y < 760; y += th) for (let x = sx; x < x1; x += tw) if (x + tw > x0) g.drawImage(tile, x, y, tw, th);
        g.restore();
      };
      if (capR >= 1) {                                   // 不用压淡时整幅一次铺满（不裁切，省时）
        g.globalAlpha = a;
        for (let y = sy; y < 760; y += th) for (let x = sx; x < 1340; x += tw) g.drawImage(tile, x, y, tw, th);
        g.globalAlpha = 1;
        return;
      }
      band(-60, 900, 1);
      for (let i = 0; i < 3; i++) band(900 + i * 40, 940 + i * 40, lerp(1, capR, smooth((i + 0.5) / 3)));
      band(1020, 1340, capR);
    }

    XYT.registerShot('f5_inkstream', {
      name: '雪谷墨溪', zone: 'right', night: false, text: '#25282c', shadow: 'rgba(240,242,244,0.85)', accent: '#7d8790', bloom: 0.2,
      draw(g, c) {
        const lt = c.lt;
        const tSnow = CT(c, 4, 2.28), tFade = CT(c, 8, 4.0);
        const z = 1.06 - 0.06 * easeInOut(c.p);
        g.save();
        g.translate(600, 430); g.scale(z, z); g.translate(-600, -430);
        g.drawImage(scene(), 0, 0, 1280, 720);
        // 水面细流纹：顺流向镜头缓缓移动，只在近、中段可见
        g.save();
        g.lineCap = 'round';
        for (let i = 0; i < 70; i++) {
          const v = (A.h2(i, 501) - 0.5) * 1.3;
          const zz = 1 + fract(A.h2(i, 502) - lt * (0.014 + 0.01 * A.h2(i, 503)) / 5.2) * 5.2 - 0.15;
          if (zz <= 0.86) continue;
          const s = 1 / zz, y = YH + s * (720 - YH);
          if (y > 760) continue;
          const x = cx(y) + v * hw(y) * 0.72;
          const len = (14 + 22 * A.h2(i, 504)) * s, y2 = y - len * 0.8, x2 = cx(y2) + v * hw(y2) * 0.72;
          const life = smooth((zz - 0.86) / 0.4) * smooth((5.05 - zz) / 1.2);
          g.strokeStyle = `rgba(140,148,158,${(0.13 * life * (0.5 + 0.5 * A.h2(i, 505))).toFixed(3)})`;
          g.lineWidth = Math.max(0.6, 1.4 * s);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        }
        g.restore();
        // 岸边的小人：背影静立，脚下一点淡淡的接触阴影
        g.fillStyle = 'rgba(96,104,114,0.35)';
        g.beginPath(); g.ellipse(MAN.x, MAN.y + 0.5, 8, 1.8, 0, 0, TAU); g.fill();
        if (XYT.sil) XYT.sil.draw(g, 'old', 'standBack', MAN.x, MAN.y, MAN.h, lt, { wind: 0, rim: null });
        const kSnow = smooth(ramp(lt, tSnow, tSnow + 1)), kFade = smooth(ramp(lt, tFade, tFade + 1.2));
        // 密雪时天光变暗一点（雪片因此在纸色上看得出）
        const dim = kSnow * 0.5 + kFade * 0.5;
        if (dim > 0) {
          g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = dim;
          g.fillStyle = '#dde1e6'; g.fillRect(-60, -40, 1400, 800); g.restore();
        }
        // 雪纱：第45句第9字起远处先变淡，再看不见；只剩近处一段墨色与岸边的小人（雪都落在纱的前面）
        const gauze = 0.1 * kSnow + 0.1 * kFade;
        const yv = 150 + 40 * smooth(ramp(lt, tSnow, tSnow + 1.5)) + 200 * smooth(ramp(lt, tFade, tFade + 1.8));
        const gr = g.createLinearGradient(0, yv - 130, 0, yv + 70);
        const fogC = mix(PAPER, FOG, smooth(ramp(lt, tSnow, tFade + 1)));
        gr.addColorStop(0, rgba(fogC, 1)); gr.addColorStop(0.55, rgba(fogC, lerp(gauze, 1, 0.55)));
        gr.addColorStop(1, rgba(fogC, gauze));
        g.fillStyle = gr; g.fillRect(-60, -40, 1400, yv + 110);
        if (gauze > 0) {
          const g2 = g.createLinearGradient(0, yv + 70, 0, 760);
          g2.addColorStop(0, rgba(fogC, gauze)); g2.addColorStop(1, rgba(fogC, gauze * 0.25));
          g.fillStyle = g2; g.fillRect(-60, yv + 70, 1400, 760 - yv);
        }
        // 密雪纹理：第45句第5字起 1 秒淡入，第9字起再密一层（竖直缓落，无风）
        // （远层与第二层中雪本身不透明度 ≤ 0.6，只有第一层中雪在歌词区一侧压到 0.6）
        snowSheet(g, 'far', 0, 18 * lt, 0.5 * kSnow, 1);
        snowSheet(g, 'far', 151, 21 * lt + 117, 0.38 * kFade, 1);
        snowSheet(g, 'mid', 0, 34 * lt, 0.7 * kSnow, 0.6 / 0.7);
        snowSheet(g, 'mid', 173, 39 * lt + 141, 0.45 * kFade, 1);
        // 雪片（粒子）：稀雪一直在，密雪时逐片淡入；歌词区一侧不透明度 ≤ 0.6
        const spr = flakeSpr();
        const layer = (n, seed, size, vy, aMax, base) => {
          for (let i = 0; i < n; i++) {
            const hA = A.h2(i, seed), hB = A.h2(i, seed + 1), hC = A.h2(i, seed + 2), hD = A.h2(i, seed + 3);
            const fade = hD < base ? 1 : smooth((lt - (tSnow + 0.6 * hC)) / 0.4);
            if (fade <= 0.001) continue;
            const sp = 0.8 + 0.4 * hC;
            const x = -20 + fract(hA + 0.004 * Math.sin(lt * (0.6 + hB) + hA * 20)) * 1320;
            const y = -20 + fract(hB + vy * sp * lt / 780) * 780;
            const r = size * (0.7 + 0.6 * hA);
            g.globalAlpha = fade * aMax * lerp(1, Math.min(1, 0.6 / aMax), smooth((x - 900) / 110));
            g.drawImage(spr, x - r * 1.5, y - r * 1.5, r * 3, r * 3);
          }
          g.globalAlpha = 1;
        };
        layer(150, 701, 1.3, 22, 0.8, 0.08);
        layer(80, 702, 2.0, 40, 0.9, 0.1);
        layer(30, 703, 3.4, 70, 0.92, 0.12);
        g.restore();
      },
    });
  })();

  // ======================= f7 白首如烛 =======================
  (function () {
    // 透视：视平线 YH（被院墙挡住），焦距 F，镜头高 HC 米；镜头朝南，画面右 = 西
    const YH = 322.2, F = 2592, HC = 1.9;
    const proj = (X, Yh, Z) => [640 + F * X / Z, YH + F * (HC - Yh) / Z];
    const Z0 = 16, M0 = F / Z0;                       // 人与石凳所在深度、该处每米像素
    const MAN = { x: 620, y: 560, h: 275 };           // 坐面接触点
    const GY0 = YH + F * HC / Z0;                     // 人脚下地面（≈630）
    const ZW = 33.3, WALL_H = 1.8;                    // 院墙（眼高 1.9 米低于墙顶，墙外只见天）
    const ZT = 27.7, TREE = { x: 118, y: YH + F * HC / ZT }; // 老槐
    const BX = (630 - 640) / M0;                      // 石鼓凳中心
    const STOOL = { r: 0.2, bulge: 0.028, top: 0.43 };
    const stoolR = (hh) => STOOL.r + STOOL.bulge * Math.sin(Math.PI * clamp(hh / STOOL.top));
    // 凸包（影子多边形用）
    function hull(pts) {
      pts = pts.slice().sort((u, v) => u[0] - v[0] || u[1] - v[1]);
      const cr = (o, a2, b2) => (a2[0] - o[0]) * (b2[1] - o[1]) - (a2[1] - o[1]) * (b2[0] - o[0]);
      const lo = [], up = [];
      for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    }
    const SNOWC = '#f4f6f8';

    // 缩时：镜头时间 → 当日时刻（9:00 → 14:36 时云来，之后放慢到 16:50 左右）
    const hourAt = (lt) => (lt <= 3.74 ? 9.0 + 1.5 * lt : 14.61 + 0.75 * (lt - 3.74));
    // 冬至、北纬 30°：太阳高度与方位（方位从正北顺时针）
    function sunAt(H) {
      const lat = 30 * Math.PI / 180, dec = -23.44 * Math.PI / 180, w = (H - 12) * 15 * Math.PI / 180;
      const se = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(w);
      const el = Math.asin(clamp(se, -1, 1));
      let ca = (Math.sin(dec) - se * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat));
      let az = Math.acos(clamp(ca, -1, 1));
      if (w > 0) az = TAU - az;
      const te = Math.tan(Math.max(el, 0.06));
      // 每米高度的影子位移：sx 向画面右（西），sz 朝镜头（北）
      return { el, az, sx: Math.sin(az) / te, sz: -Math.cos(az) / te };
    }

    // ---------- 静态层 ----------
    // 墙外远处的枯树（很淡）
    const farTrees = () => K.cache('fg8_f7_far', 1280, 300, 1, (g) => {
      blurInto(g, 1280, 300, 1.2, (q) => {
        const r = A.rng(7701);
        q.strokeStyle = 'rgba(150,160,172,0.55)'; q.lineCap = 'round';
        const br = (x, y, a, l, w, d) => {
          const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
          q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.lineTo(x2, y2); q.stroke();
          if (d > 0) { br(x2, y2, a - 0.35 - r() * 0.4, l * 0.72, w * 0.66, d - 1); br(x2, y2, a + 0.3 + r() * 0.4, l * 0.7, w * 0.66, d - 1); }
        };
        for (const [x, h, n] of [[520, 34, 3], [610, 58, 4], [690, 30, 3], [800, 46, 4], [905, 64, 4], [1015, 38, 3], [1090, 52, 4], [1210, 44, 4], [1265, 30, 3]]) br(x + (r() - 0.5) * 20, 310, -Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.42, 2.6 * h / 50 + 0.8, n);
      });
    });
    // 院墙：粉墙朝北（整天背光），黛瓦压顶，瓦上积雪；墙脚石勒脚
    const wall = () => K.cache('fg8_f7_wall', 1280, 220, 1, (g) => {
      g.translate(0, -260);
      const yTop = proj(0, WALL_H, ZW)[1], yBase = proj(0, 0, ZW)[1], yCap = proj(0, 2.05, ZW - 0.15)[1];
      let gr = g.createLinearGradient(0, yTop, 0, yBase);
      gr.addColorStop(0, '#aab4c0'); gr.addColorStop(0.15, '#b9c2cd'); gr.addColorStop(1, '#c3cbd4');
      g.fillStyle = gr; g.fillRect(0, yTop, 1280, yBase - yTop);
      // 雨痕水渍（淡、竖向）
      blurInto(g, 1280, 720, 3, (q) => {
        const r = A.rng(7702);
        for (let i = 0; i < 40; i++) {
          const x = r() * 1280, l = 20 + r() * 70;
          q.fillStyle = `rgba(110,120,134,${0.05 + 0.08 * r()})`; q.fillRect(x, yTop + 2, 3 + r() * 10, l);
        }
      });
      // 勒脚
      const yPl = proj(0, 0.4, ZW)[1];
      g.fillStyle = '#8e97a2'; g.fillRect(0, yPl, 1280, yBase - yPl);
      g.fillStyle = 'rgba(70,78,90,0.25)'; for (let x = 0; x < 1280; x += 46) g.fillRect(x, yPl, 1, yBase - yPl);
      g.fillStyle = 'rgba(70,78,90,0.3)'; g.fillRect(0, yPl, 1280, 1);
      // 瓦檐：一排瓦当，檐下一道阴影
      g.fillStyle = 'rgba(60,66,76,0.35)'; g.fillRect(0, yTop, 1280, 6);
      g.fillStyle = '#3d424b'; g.fillRect(0, yCap, 1280, yTop - yCap + 1);
      g.fillStyle = '#4d535d';
      for (let x = 0; x < 1290; x += 13) { g.beginPath(); g.ellipse(x, yTop - 1, 5.4, 4, 0, 0, TAU); g.fill(); }
      g.fillStyle = '#2e333b'; for (let x = 6.5; x < 1290; x += 13) g.fillRect(x - 0.6, yCap + 2, 1.2, yTop - yCap - 4);
      // 瓦顶积雪：上沿起伏，下沿压出檐口
      g.fillStyle = SNOWC; capSnowPath(g); g.fill();
    });
    // 瓦顶积雪的轮廓（院墙与晴时暖光共用）
    const Y_CAP = proj(0, 2.05, ZW - 0.15)[1];
    function capSnowPath(g) {
      const yCap = Y_CAP;
      g.beginPath(); g.moveTo(0, yCap + 3);
      for (let x = 0; x <= 1280; x += 8) g.lineTo(x, yCap - 7 - 2.5 * A.noise1(x / 60, 9) - 1.2 * A.noise1(x / 14, 10));
      g.lineTo(1280, yCap + 3);
      for (let x = 1280; x >= 0; x -= 10) g.lineTo(x, yCap + 2.5 + 1.5 * A.noise1(x / 25, 11));
      g.closePath();
    }
    // 晴时暖光的遮罩：只有瓦顶积雪（y 280–330 一条）
    const capWarm = () => K.cache('fg8_f7_capwarm', 1280, 50, 1, (g) => { g.translate(0, -280); g.fillStyle = '#ffe2bc'; capSnowPath(g); g.fill(); });
    // 雪地：微微起伏，墙脚积雪略厚；几丛枯草
    const ground = () => K.cache('fg8_f7_ground', 1280, 260, 1, (g) => {
      g.translate(0, -462);
      let gr = g.createLinearGradient(0, 466, 0, 720);
      gr.addColorStop(0, '#e9edf1'); gr.addColorStop(1, '#f3f5f7');
      g.fillStyle = gr; g.fillRect(0, 462, 1280, 260);
      blurInto(g, 1280, 720, 7, (q) => {
        const r = A.rng(7703);
        for (let i = 0; i < 26; i++) {
          const y = 480 + r() * 240, k = (y - YH) / (720 - YH);
          q.fillStyle = `rgba(150,164,184,${0.06 + 0.08 * r()})`;
          q.beginPath(); q.ellipse(r() * 1280, y, (90 + 200 * r()) * k, (6 + 14 * r()) * k, 0, 0, TAU); q.fill();
        }
        // 墙脚雪堆的背光面
        q.fillStyle = 'rgba(140,154,174,0.22)'; q.fillRect(0, 468, 1280, 10);
      });
      // 墙脚雪堆上沿
      g.fillStyle = '#eef2f5';
      g.beginPath(); g.moveTo(0, 474);
      for (let x = 0; x <= 1280; x += 10) g.lineTo(x, 466 - 3 * A.noise1(x / 50, 12));
      g.lineTo(1280, 474); g.closePath(); g.fill();
      // 枯草
      g.strokeStyle = 'rgba(120,104,82,0.6)'; g.lineWidth = 1;
      const r = A.rng(7704);
      for (const [x0, y0, n] of [[880, 476, 9], [1160, 480, 7], [300, 474, 6], [1010, 690, 8]]) {
        for (let i = 0; i < n; i++) { const x = x0 + (r() - 0.5) * 20, l = 6 + r() * 12 * (y0 > 600 ? 1.8 : 1); g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + (r() - 0.5) * 6, y0 - l * 0.6, x + (r() - 0.5) * 10, y0 - l); g.stroke(); }
      }
    });
    // 旧脚印：清早他从院门（画左）踏雪来到石凳；落雪后渐被填平
    const prints = () => K.cache('fg8_f7_prints', 1280, 260, 1, (g) => {
      g.translate(0, -462);
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const u = i / 15, X = lerp(-7.5, -0.75, u), Z = lerp(13.6, 16.0, Math.pow(u, 0.8)) + 0.4 * Math.sin(u * 3);
        const side = i % 2 ? 1 : -1;
        pts.push(proj(X, 0, Z + side * 0.09));
      }
      for (const [x, y] of pts) {
        const k = (y - YH) / (GY0 - YH);
        g.fillStyle = 'rgba(126,142,166,0.55)';
        g.beginPath(); g.ellipse(x, y, 8 * k, 2.4 * k * k, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath(); g.ellipse(x + 1.5 * k, y + 1.2 * k * k, 7 * k, 1.2 * k * k, 0, 0, Math.PI); g.fill();
      }
    });

    // 远树、院墙、雪地合成一张静态贴图（y 200–720）
    const backdrop = () => K.cache('fg8_f7_back', 1280, 520, 1, (g) => {
      g.translate(0, -200);
      g.drawImage(farTrees(), 0, 0, 1280, 300);
      g.drawImage(wall(), 0, 260, 1280, 220);
      g.drawImage(ground(), 0, 462, 1280, 260);
    });

    // ---------- 老槐 ----------
    // 枝干用有粗细的平滑带子画（不是等宽线）：主干粗而虬曲，主枝向右上伸，侧枝交错，梢头蟹爪状细枝。
    // 屏幕坐标；x > 0 处不长到 y < 148；x > 150 处再截到 y ≥ 175（歌词区下沿留出空天）
    const BR = (() => {
      const r = A.rng(7706), list = [];
      let par = null, parU = 0;                           // 正在分枝的母枝与分枝点（只记录，不影响随机序列）
      const add = (pts, w0, w1, d) => { list.push({ pts, w0, w1, d, par, parU }); return list[list.length - 1]; };
      const lenOf = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
      const at = (pts, u) => {
        const L = lenOf(pts) * u; let acc = 0;
        for (let i = 1; i < pts.length; i++) {
          const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (acc + l >= L) { const k = (L - acc) / l; return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; }
          acc += l;
        }
        const n = pts.length - 1; return [pts[n][0], pts[n][1], Math.atan2(pts[n][1] - pts[n - 1][1], pts[n][0] - pts[n - 1][0])];
      };
      const sprout = (x, y, a, L, w0, d) => {
        const pts = [[x, y]];
        let cx2 = x, cy2 = y, ca = a;
        const n = d >= 3 ? 3 : 4;
        for (let j = 0; j < n; j++) {
          ca += (r() - 0.5) * (d >= 3 ? 0.9 : 0.45);
          if (d >= 3 && j === n - 1) ca += 0.35 * Math.sign(Math.cos(ca) || 1); // 梢头微微下勾
          cx2 += Math.cos(ca) * L / n; cy2 += Math.sin(ca) * L / n;
          if (cy2 < 148 && cx2 > 0) break;
          pts.push([cx2, cy2]);
        }
        if (pts.length < 2) return;
        const br = add(pts, w0, Math.max(0.35, w0 * 0.25), d);
        branchOut(br);
      };
      const branchOut = (br) => {
        if (br.d >= 3) return;
        const L = lenOf(br.pts), step = br.d === 0 ? 34 : br.d === 1 ? 20 : 11;
        let side = r() < 0.5 ? 1 : -1;
        for (let u = 0.22 + r() * 0.1; u < 0.95; u += (step / L) * (0.8 + 0.5 * r())) {
          const [x, y, a0] = at(br.pts, u);
          side = -side;
          let a = a0 + side * (0.42 + r() * 0.5);
          if (Math.sin(a) > 0.35) a = a0 - side * 0.3;            // 侧枝不往下长
          const w = lerp(br.w0, br.w1, u) * (0.42 + 0.18 * r());
          const len = (br.d === 0 ? 100 : br.d === 1 ? 56 : 26) * (0.6 + 0.6 * r()) * (1.15 - u * 0.4);
          const p0 = par, u0 = parU;
          par = br; parU = u;
          sprout(x, y, a, len, w, br.d + 1);
          par = p0; parU = u0;
        }
      };
      const T = TREE;
      const trunk = add([[T.x, T.y + 4], [T.x - 5, T.y - 50], [T.x - 17, T.y - 102], [T.x - 31, T.y - 152], [T.x - 40, T.y - 202], [T.x - 57, T.y - 252], [T.x - 82, T.y - 302], [T.x - 116, T.y - 352], [T.x - 152, T.y - 395]], 46, 16, 0);
      const limbs = [
        add([[T.x - 24, T.y - 118], [T.x + 20, T.y - 150], [T.x + 80, T.y - 180], [T.x + 152, T.y - 208], [T.x + 230, T.y - 232], [T.x + 300, T.y - 250], [T.x + 360, T.y - 262]], 19, 2, 1),
        add([[T.x - 42, T.y - 208], [T.x - 6, T.y - 242], [T.x + 40, T.y - 274], [T.x + 95, T.y - 300], [T.x + 145, T.y - 318]], 12, 1.6, 1),
        add([[T.x - 60, T.y - 262], [T.x - 92, T.y - 290], [T.x - 132, T.y - 306]], 10, 4, 1),
        add([[T.x - 10, T.y - 72], [T.x + 30, T.y - 84], [T.x + 72, T.y - 86], [T.x + 105, T.y - 80]], 7, 1.4, 2),
      ];
      branchOut(trunk);
      for (const l of limbs) branchOut(l);
      // 截梢：x > 150 处高过 y = 175 的部分截去（在交点处收尾）；长在截掉那段上的子枝一并去掉
      const LIM = 175;
      for (const br of list) {
        br.keep = 1;
        if (br.par && (br.par.cut || br.parU > br.par.keep + 1e-6)) { br.cut = true; br.keep = 0; continue; }
        const P = br.pts, L0 = lenOf(P);
        const zone = (x, y) => x > 150 && y < LIM;
        if (zone(P[0][0], P[0][1])) { br.cut = true; br.keep = 0; continue; }
        for (let i = 1; i < P.length; i++) {
          if (zone(P[i][0], P[i][1])) {
            let lo = 0, hi = 1;                              // 二分找出线段进入禁区的位置
            for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (zone(lerp(P[i - 1][0], P[i][0], m), lerp(P[i - 1][1], P[i][1], m))) hi = m; else lo = m; }
            const end = [lerp(P[i - 1][0], P[i][0], lo), lerp(P[i - 1][1], P[i][1], lo)];
            const kept = P.slice(0, i).concat([end]);
            const L1 = lenOf(kept);
            if (L1 < 6) { br.cut = true; br.keep = 0; break; }
            br.keep = L1 / L0;
            br.w1 = lerp(br.w0, br.w1, Math.pow(br.keep, 0.8));   // 截短后梢头照样收细
            br.w1 = Math.min(br.w1, Math.max(0.35, br.w0 * 0.3));
            br.pts = kept;
            break;
          }
        }
      }
      return list.filter((br) => !br.cut);
    })();
    // 沿折线画一条平滑、两端粗细不同的带子（off：沿法向的偏移，按半宽的比例；sideFn 选择法向的哪一侧）
    function ribbon(g, br, scaleW, off, sideFn, wFn) {
      const P = br.pts, n = P.length;
      const S = [];
      for (let i = 0; i < n - 1; i++) {
        const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
        for (let k = 0; k < 6; k++) {
          const t = k / 6, t2 = t * t, t3 = t2 * t;
          const f = (a0, a1, a2, a3) => 0.5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
          S.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
      S.push(P[n - 1]);
      const m = S.length, L = [], R = [];
      for (let i = 0; i < m; i++) {
        const a = S[Math.max(0, i - 1)], b = S[Math.min(m - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const u = i / (m - 1), bulge = br.d === 0 ? 1 + 0.12 * Math.sin(u * 17 + 1) * (1 - u) : 1;
        const hw = 0.5 * lerp(br.w0, br.w1, Math.pow(u, 0.8)) * bulge * scaleW * (wFn ? wFn(nx, ny) : 1);
        let sgn = 1;
        if (sideFn) sgn = sideFn(nx, ny) ? 1 : -1;
        const ox = S[i][0] + sgn * nx * off * hw / scaleW, oy = S[i][1] + sgn * ny * off * hw / scaleW;
        L.push([ox + nx * hw, oy + ny * hw]); R.push([ox - nx * hw, oy - ny * hw]);
      }
      g.beginPath();
      L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      for (let i = m - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
      g.closePath(); g.fill();
    }
    const TB = { x: -60, y: 90, w: 560, h: 430 };     // 老槐贴图的范围
    function paintBranches(g, mode) {
      for (const br of BR) {
        const a0 = Math.atan2(br.pts[br.pts.length - 1][1] - br.pts[0][1], br.pts[br.pts.length - 1][0] - br.pts[0][0]);
        const flat = Math.abs(Math.cos(a0));
        if (mode === 'mask') { if (br.w0 < 3) continue; g.fillStyle = '#000'; ribbon(g, br, 1, 0); }
        else if (mode === 'base') { g.fillStyle = br.d >= 3 ? 'rgba(50,47,46,0.9)' : '#302d2c'; ribbon(g, br, 1, 0); }
        else if (mode === 'litL' || mode === 'litR') {
          if (br.w0 < 5) continue;
          const sd = mode === 'litL' ? -1 : 1;
          g.fillStyle = 'rgba(178,160,136,0.42)';
          ribbon(g, br, 0.09, 0.9, (nx) => nx * sd > 0);
        } else if (mode === 'snow0' || mode === 'snow1') {
          if (br.w0 < 1.2) continue;
          g.fillStyle = SNOWC;
          // 雪只积在枝的上沿，越接近水平积得越厚（法向越朝上）
          ribbon(g, br, mode === 'snow1' ? 0.6 : 0.3, 0.78, (nx, ny) => ny < 0, (nx, ny) => clamp((Math.abs(ny) - 0.45) / 0.45));
        }
      }
      if (mode === 'base') {
        // 树皮：主干上几道深色竖纹
        g.save();
        g.strokeStyle = 'rgba(24,20,18,0.45)'; g.lineWidth = 1.4; g.lineCap = 'round';
        const T = TREE, r = A.rng(7707);
        for (let i = 0; i < 9; i++) {
          const x0 = T.x - 14 + i * 3.5 + (r() - 0.5) * 3, y0 = T.y - 6 - r() * 20, y1 = y0 - 60 - r() * 120;
          g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 - 8 - r() * 6, (y0 + y1) / 2, x0 - 16 - (T.y - y1) * 0.12, y1); g.stroke();
        }
        g.restore();
        // 根部隆起（树下的雪堆另画，盖在亮边之上）
        g.fillStyle = '#302d2c';
        g.beginPath(); g.moveTo(TREE.x - 44, TREE.y + 4); g.quadraticCurveTo(TREE.x - 22, TREE.y - 8, TREE.x - 24, TREE.y - 40); g.lineTo(TREE.x + 22, TREE.y - 40); g.quadraticCurveTo(TREE.x + 24, TREE.y - 6, TREE.x + 50, TREE.y + 5); g.closePath(); g.fill();
      }
    }
    const treeLayer = (mode) => K.cache('fg8_f7_tree_' + mode, TB.w, TB.h, 1, (g) => {
      blurInto(g, TB.w, TB.h, mode === 'base' ? 0.45 : 0.3, (q) => { q.translate(-TB.x, -TB.y); paintBranches(q, mode); });
      if (mode === 'litL' || mode === 'litR') {
        // 亮边只留在木头上：与枝干求交，再去掉枝上积雪的部分
        g.globalCompositeOperation = 'destination-in'; g.drawImage(treeLayer('base'), 0, 0, TB.w, TB.h);
        g.globalCompositeOperation = 'destination-out'; g.drawImage(treeLayer('snow0'), 0, 0, TB.w, TB.h);
        g.globalCompositeOperation = 'source-over';
      }
    });
    // 树下雪堆：贴着树根拱起的一小片积雪，轮廓不规则、边缘柔；顶面受光，朝镜头的一面（背光的北面）淡蓝灰
    const MD = { x: TREE.x - 80, y: TREE.y - 22, w: 170, h: 42 };
    function moundPath(g) {
      const cx0 = TREE.x + 2, base = TREE.y + 4;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40 * 2 - 1, wv = 62 + 6 * (A.noise1(i * 0.37, 71) - 0.5) * 2;
        const x = cx0 + u * wv, top = base - 11 * Math.pow(1 - u * u, 1.4) - 2.2 * (A.noise1(u * 4 + 2, 72) - 0.5) * (1 - u * u);
        i ? g.lineTo(x, top) : g.moveTo(x, top);
      }
      for (let i = 40; i >= 0; i--) {
        const u = i / 40 * 2 - 1, wv = 62 + 6 * (A.noise1(i * 0.37, 71) - 0.5) * 2;
        g.lineTo(cx0 + u * wv, base + 6.5 * Math.sqrt(Math.max(0, 1 - u * u)) + 1.2 * (A.noise1(u * 5, 73) - 0.5));
      }
      g.closePath();
    }
    const treeMound = () => K.cache('fg8_f7_mound', MD.w, MD.h, 1, (g) => {
      blurInto(g, MD.w, MD.h, 1.4, (q) => {
        q.translate(-MD.x, -MD.y);
        moundPath(q);
        const gr = q.createLinearGradient(0, TREE.y - 8, 0, TREE.y + 11);
        gr.addColorStop(0, '#f2f5f7'); gr.addColorStop(0.45, '#eef2f5'); gr.addColorStop(0.8, '#dde4ec'); gr.addColorStop(1, '#d6dee8');
        q.fillStyle = gr; q.fill();
        // 两端渐渐融进地面
        q.globalCompositeOperation = 'destination-in';
        const hg = q.createLinearGradient(TREE.x - 64, 0, TREE.x + 68, 0);
        hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.18, 'rgba(0,0,0,1)'); hg.addColorStop(0.82, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
        q.fillStyle = hg; q.fillRect(MD.x, MD.y, MD.w, MD.h);
      });
    });
    // 画雪堆：树干的影子也要落在雪堆上（把同一张影子层裁在雪堆形状里叠上去）
    function drawMound(g, sb, shK) {
      const d = devBox(g, MD.x, MD.y, MD.x + MD.w, MD.y + MD.h);
      const b = buf('f7mound', d.w, d.h), q = b.g;
      q.setTransform(d.m.a, d.m.b, d.m.c, d.m.d, d.m.e - d.x, d.m.f - d.y);
      q.drawImage(treeMound(), MD.x, MD.y, MD.w, MD.h);
      if (sb && shK > 0) {
        const k = SH.w / 1280;
        q.globalCompositeOperation = 'source-atop'; q.globalAlpha = clamp(shK); q.imageSmoothingEnabled = true;
        q.drawImage(sb.c, MD.x * k, MD.y * k, MD.w * k, MD.h * k, MD.x, MD.y, MD.w, MD.h);
      }
      blitDev(g, b, d);
    }
    // 雪堆也要和周围雪地一样受晴时暖光（乘法遮罩）
    const moundWarm = () => K.cache('fg8_f7_moundw', MD.w, MD.h, 1, (g) => {
      g.drawImage(treeMound(), 0, 0, MD.w, MD.h);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffe2bc'; g.fillRect(0, 0, MD.w, MD.h);
    });
    const treeBase = () => K.cache('fg8_f7_tree_b0', TB.w, TB.h, 1, (g) => { g.drawImage(treeLayer('base'), 0, 0, TB.w, TB.h); g.drawImage(treeLayer('snow0'), 0, 0, TB.w, TB.h); });
    // 影子用的遮罩（模糊：细枝的影子在远处糊成淡淡的影，粗干才清楚）
    const treeMask = () => K.cache('fg8_f7_tmask', TB.w, TB.h, 0.5, (g) => {
      blurInto(g, TB.w, TB.h, 2.5, (q) => { q.translate(-TB.x, -TB.y); paintBranches(q, 'mask'); });
    });
    const MB = { x: 500, y: 370, w: 200, h: 270 };    // 人影遮罩范围
    const manMask = () => K.cache('fg8_f7_mmask', MB.w, MB.h, 0.5, (g) => {
      blurInto(g, MB.w, MB.h, 1.5, (q) => {
        q.translate(-MB.x, -MB.y);
        if (XYT.sil) XYT.sil.draw(q, 'old', 'sitSide', MAN.x, MAN.y, MAN.h, 0, { facing: -1, wind: 0, rim: null, body: '#000', accent: '#000' });
        q.globalCompositeOperation = 'source-in'; q.fillStyle = '#000'; q.fillRect(MB.x, MB.y, MB.w, MB.h);
      });
    });

    // ---------- 影子投射：竖直平面上的剪影（深度 zp、地面线 yg）按太阳方向逐条投到地上 ----------
    function castMask(q, mask, box, zp, yg, sun, k) {
      const m = F / zp, cxm = box.x + box.w / 2;
      const sw = mask.width / box.w;
      const step = 4;
      for (let y0 = box.y; y0 < box.y + box.h; y0 += step) {
        const yc = y0 + step / 2, Y = (yg - yc) / m;
        if (Y < -0.05) continue;
        const Xc = (cxm - 640) / m;
        const Zc = zp - Y * sun.sz;
        if (Zc < 2) continue;
        const Xs = Xc + Y * sun.sx;
        const a = zp / Zc;
        const c = -(F / m) * (sun.sx * Zc + Xs * sun.sz) / (Zc * Zc);
        const d = -F * HC * sun.sz / (m * Zc * Zc);
        const xt = 640 + F * Xs / Zc, yt = YH + F * HC / Zc;
        const e = xt - a * cxm - c * yc, f = yt - d * yc;
        q.setTransform(k * a, 0, k * c, k * d, k * e, k * f);
        q.drawImage(mask, 0, (y0 - box.y) * sw, mask.width, (step + 1) * sw, box.x, y0, box.w, step + 1);
      }
    }
    const SH = { w: 320, h: 180 };                   // 影子缓冲（1/4 分辨率，放大后自然成柔和的半影）
    function shadeLayer(lt, sun, fm, clouds) {
      const b = buf('f7shade', SH.w, SH.h), q = b.g, k = SH.w / 1280;
      q.fillStyle = '#000';
      // 院墙的影子：墙脚一道
      const zt = ZW - 2.05 * sun.sz;
      if (zt > 3) { const yt = YH + F * HC / zt; q.setTransform(k, 0, 0, k, 0, 0); q.fillRect(0, 466, 1280, yt - 466); }
      castMask(q, treeMask(), TB, ZT, TREE.y, sun, k);
      castMask(q, manMask(), MB, Z0, GY0, sun, k);
      // 石鼓凳：底圆与顶圆投影的凸包
      q.setTransform(k, 0, 0, k, 0, 0);
      const ring = [];
      for (let i = 0; i < 20; i++) {
        const a2 = (i / 20) * TAU, cx2 = Math.cos(a2), cz = Math.sin(a2);
        ring.push(proj(BX + STOOL.r * cx2, 0, Z0 + STOOL.r * cz));
        ring.push(proj(BX + STOOL.r * cx2 + STOOL.top * sun.sx, 0, Z0 + STOOL.r * cz - STOOL.top * sun.sz));
        ring.push(proj(BX + stoolR(STOOL.top / 2) * cx2 + STOOL.top / 2 * sun.sx, 0, Z0 + stoolR(STOOL.top / 2) * cz - STOOL.top / 2 * sun.sz));
      }
      const hp = hull(ring);
      q.beginPath(); hp.forEach((p2, i) => (i ? q.lineTo(p2[0], p2[1]) : q.moveTo(p2[0], p2[1]))); q.closePath(); q.fill();
      // 云影：大片柔和的暗块从左向右掠过雪地（缩时）
      const blob = dot('f7cloud', '#000000', 0.35);
      for (const cl of clouds) {
        if (cl.a <= 0.01) continue;
        q.globalAlpha = cl.a;
        q.drawImage(blob, cl.x - cl.rx, cl.y - cl.ry, cl.rx * 2, cl.ry * 2);
        q.globalAlpha = 1;
      }
      // 只留地面以下（天空、墙面不受这些影子）
      q.setTransform(k, 0, 0, k, 0, 0);
      q.globalCompositeOperation = 'destination-out'; q.fillRect(0, 0, 1280, 465);
      // 换成影子的颜色
      q.globalCompositeOperation = 'source-in'; q.fillStyle = '#7d91b2'; q.fillRect(0, 0, 1280, 720);
      // 云层盖过的地方没有直射光：影子随云影前沿从左向右消失
      if (fm) { q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'destination-out'; q.drawImage(fm.c, 0, 0, 320, 180, 0, 0, 320, 180); }
      q.globalCompositeOperation = 'source-over';
      return b;
    }
    // 云影的位置（缩时：每片约 3 秒横穿画面）
    function cloudsAt(lt, sunK) {
      const out = [];
      for (let i = 0; i < 3; i++) {
        const t0 = -1.2 + i * 1.45, v = 520 + 80 * A.h2(i, 81);
        const x = -420 + (lt - t0) * v, y = 560 + 110 * (A.h2(i, 82) - 0.4);
        const k = (y - YH) / (GY0 - YH);
        out.push({ x, y, rx: (380 + 160 * A.h2(i, 83)) * k, ry: (60 + 20 * A.h2(i, 84)) * k * k, a: 0.5 * sunK });
      }
      return out;
    }
    const coverAt = (clouds, x, y) => { let c = 0; for (const cl of clouds) { const dx = (x - cl.x) / cl.rx, dy = (y - cl.y) / cl.ry, d = Math.sqrt(dx * dx + dy * dy); c = Math.max(c, cl.a * clamp((1 - d) / 0.65)); } return clamp(c); };

    // 云层前沿：从左向右推进。前沿在云底平面上是一条南北向的线，透视下朝画面中心的灭点收拢（近地平线处走得慢、边也窄），
    // 地面上的云影前沿同理；边缘随高度微微起伏（云团的轮廓）。fX 为画面顶/底边处前沿的位置
    const FW = 250, FX0 = -940, FX1 = 1930;
    const facY = (y) => 0.6 + 0.4 * (y < YH ? (YH - y) / YH : (y - YH) / (720 - YH));
    const edgeOff = (y) => 100 * (A.noise1(y / 110, 31) - 0.5) + 44 * (A.noise1(y / 37, 32) - 0.5);
    const edgeAt = (fX, y) => { const f = facY(y); return [640 + (fX - 640 + edgeOff(y)) * f, FW * f]; };
    // 柔边横向剖面（左实右虚，smoothstep），逐行拉伸使用
    const profSpr = () => K.cache('fg8_f7_prof', 64, 2, 1, (g) => {
      const gr = g.createLinearGradient(0, 0, 64, 0);
      for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, `rgba(0,0,0,${(1 - smooth(i / 8)).toFixed(3)})`);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 2);
    });
    // 层云的云团（两张贴图共用同一组位置）：越近地平线越扁
    const STRAT = (() => {
      const r = A.rng(7709), out = [];
      for (let i = 0; i < 70; i++) {
        const y = 40 + Math.pow(r(), 0.7) * 290, k = smooth((y - 120) / 170) * 0.85 + 0.15;
        const w = (150 + 260 * r()) * (1.2 - 0.4 * (y - 40) / 290), h = (34 - 22 * (y - 40) / 290) * (0.7 + 0.6 * r()), x = r() * 1280;
        out.push({ x, y, w, h, k });
      }
      return out;
    })();
    // 云团的疏密（云层前沿前面先到的一缕缕扁云）
    const densTex = () => K.cache('fg8_f7_dens', 1280, 340, 0.25, (g) => {
      blurInto(g, 1280, 340, 6, (q) => {
        q.fillStyle = 'rgba(0,0,0,0.85)';
        for (const b of STRAT) for (const ox of [-1280, 0, 1280]) {
          if (b.x + ox + b.w < -20 || b.x + ox - b.w > 1300) continue;
          q.beginPath(); q.ellipse(b.x + ox, b.y + b.h * 0.1, b.w * 0.95, b.h * 0.7, 0, 0, TAU); q.fill();
        }
      });
    });
    // 本帧的云层遮罩（1/4 分辨率，整幅）：前沿以左全遮；前沿前面一段只有一缕缕扁云（天上），越往前越淡
    function rowsProfile(q, fX, y1, ahead, wk) {
      const pr = profSpr();
      q.fillStyle = '#000';
      for (let y = 0; y < y1; y += 4) {
        const [c, w0] = edgeAt(fX, y + 2), f = facY(y + 2), w = w0 * wk, x0 = c + ahead * f - w / 2;
        if (x0 > -4) q.fillRect(0, y, Math.min(1290, x0 + 4), 4);       // 与柔边重叠几像素，接缝处不留亮线
        if (x0 < 1290 && x0 + w > -10) q.drawImage(pr, x0, y, w, 4);
      }
    }
    function frontMask(fX, tx) {
      const wb = buf('f7frontw', 320, 85);
      wb.g.setTransform(0.25, 0, 0, 0.25, 0, 0); rowsProfile(wb.g, fX, 340, 200, 1.8);
      const b = buf('f7front', 320, 180), q = b.g;
      q.setTransform(0.25, 0, 0, 0.25, 0, 0);
      q.drawImage(densTex(), tx - 1280, 0, 1280, 340); q.drawImage(densTex(), tx, 0, 1280, 340);
      q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'destination-in';
      q.drawImage(wb.c, 0, 0, 320, 85, 0, 0, 320, 85);
      q.globalCompositeOperation = 'source-over'; q.setTransform(0.25, 0, 0, 0.25, 0, 0);
      rowsProfile(q, fX, 720, 0, 1);
      return b;
    }

    // 层云贴图（可左右平铺）：底下偏暗、顶上偏亮的扁云团，越近地平线越扁、越分明；歌词区一带几乎平整
    const stratus = () => K.cache('fg8_f7_strat', 1280, 340, 0.25, (g) => {
      const vg = g.createLinearGradient(0, 0, 0, 320);
      vg.addColorStop(0, '#b6bdc6'); vg.addColorStop(0.5, '#cbd0d6'); vg.addColorStop(1, '#e2e5e8');   // 乘上阴天整体压暗之后约为 #a7b0bb → #cbd1d8
      g.fillStyle = vg; g.fillRect(0, 0, 1280, 340);
      blurInto(g, 1280, 340, 7, (q) => {
        for (const { x, y, w, h, k } of STRAT) {
          for (const ox of [-1280, 0, 1280]) {
            if (x + ox + w < -20 || x + ox - w > 1300) continue;
            q.fillStyle = `rgba(112,124,140,${(0.14 * k).toFixed(3)})`;       // 云底的暗
            q.beginPath(); q.ellipse(x + ox, y + h * 0.35, w, h * 0.55, 0, 0, TAU); q.fill();
            q.fillStyle = `rgba(236,239,242,${(0.3 * k).toFixed(3)})`;        // 云顶的亮
            q.beginPath(); q.ellipse(x + ox + w * 0.08, y - h * 0.2, w * 0.8, h * 0.45, 0, 0, TAU); q.fill();
          }
        }
      });
    });

    // 人：剪影 + 轮廓光（左、右、顶三向，按太阳方位连续变化；自己做，强弱可调）
    function drawMan(g, rim, snow) {
      const S = XYT.sil;
      if (!S) return;
      const { x, y, h } = MAN;
      const bb = S.bounds('old', 'sitSide', h, { facing: -1 });
      const d = devBox(g, x + bb.left - 4, y + bb.top - 6, x + bb.right + 4, y + bb.bottom + 2);
      const fb = buf('f7man', d.w, d.h);
      fb.g.setTransform(d.m.a, d.m.b, d.m.c, d.m.d, d.m.e - d.x, d.m.f - d.y);
      S.draw(fb.g, 'old', 'sitSide', x, y, h, 0, { facing: -1, wind: 0, rim: null, snow });
      blitDev(g, fb, d);
      const rw = Math.max(1, Math.round(2.2 * d.m.a));
      for (const [dx, dy, a] of [[-rw, 0, rim.l], [rw, 0, rim.r], [0, -rw, rim.t]]) {
        if (a <= 0) continue;
        const rb = buf('f7rim', d.w, d.h), q = rb.g;
        q.drawImage(fb.c, 0, 0);
        q.globalCompositeOperation = 'source-in'; q.fillStyle = rim.col; q.fillRect(0, 0, d.w, d.h);
        q.globalCompositeOperation = 'destination-out'; q.drawImage(fb.c, -dx, -dy);
        g.save(); g.globalAlpha = clamp(a); blitDev(g, rb, d); g.restore();
      }
    }

    // 石鼓凳：鼓腹微凸，上下两道箍、一圈鼓钉；朝镜头的一面背光，向阳一侧边缘亮；顶面受光
    function drawBench(g, sunK, warm, snowK, sinAz) {
      const [cx0, yTop] = proj(BX, STOOL.top, Z0), yBot = proj(BX, 0, Z0)[1];
      const ryTop = STOOL.r * F * (HC - STOOL.top) / (Z0 * Z0), ryBot = STOOL.r * F * HC / (Z0 * Z0);
      const xr = (hh) => stoolR(hh) * M0;
      const yAt = (hh) => lerp(yBot, yTop, hh / STOOL.top);
      const ryAt = (hh) => lerp(ryBot, ryTop, hh / STOOL.top);
      // 鼓身
      g.beginPath();
      const N = 14;
      for (let i = 0; i <= N; i++) { const hh = STOOL.top * (1 - i / N); g.lineTo(cx0 - xr(hh), yAt(hh)); }
      g.ellipse(cx0, yBot, xr(0), ryBot, 0, Math.PI, 0, true);
      for (let i = 0; i <= N; i++) { const hh = STOOL.top * (i / N); g.lineTo(cx0 + xr(hh), yAt(hh)); }
      g.ellipse(cx0, yTop, xr(STOOL.top), ryTop, 0, 0, Math.PI, false);
      g.closePath();
      const sd = sinAz > 0 ? -1 : 1, side = Math.abs(sinAz) * sunK;
      const gr = g.createLinearGradient(cx0 - xr(0.2), 0, cx0 + xr(0.2), 0);
      const lit = mix('#7a8088', mix('#b9b4aa', '#c8c4bc', 1 - warm), side);
      gr.addColorStop(0, sd < 0 ? lit : '#5f656d'); gr.addColorStop(0.18, sd < 0 ? '#6f757d' : '#646a72');
      gr.addColorStop(0.82, sd > 0 ? '#6f757d' : '#646a72'); gr.addColorStop(1, sd > 0 ? lit : '#5f656d');
      g.fillStyle = gr; g.fill();
      // 箍与鼓钉
      g.strokeStyle = 'rgba(40,46,56,0.35)'; g.lineWidth = 1.2;
      for (const hh of [0.07, 0.36]) {
        g.beginPath(); g.ellipse(cx0, yAt(hh), xr(hh), ryAt(hh), 0, 0.05, Math.PI - 0.05); g.stroke();
      }
      g.fillStyle = 'rgba(48,54,64,0.4)';
      for (let i = 1; i < 8; i++) { const a2 = (i / 8) * Math.PI, hh = 0.395; g.beginPath(); g.arc(cx0 + Math.cos(a2) * xr(hh) * 0.98, yAt(hh) + Math.sin(a2) * ryAt(hh), 1.3, 0, TAU); g.fill(); }
      // 顶面
      g.fillStyle = mix(mix('#9ea4ab', '#c9c4b8', warm), '#8e949b', 1 - sunK);
      g.beginPath(); g.ellipse(cx0, yTop, xr(STOOL.top), ryTop, 0, 0, TAU); g.fill();
      // 凳面积雪（与人身上的雪同步增厚）
      if (snowK > 0) {
        const th = 6 * snowK;
        g.globalAlpha = clamp(snowK * 3);
        g.fillStyle = '#dfe5ec';
        g.beginPath(); g.ellipse(cx0, yTop, xr(STOOL.top) * 0.97, ryTop * 0.95 + 0.6, 0, 0, Math.PI); g.lineTo(cx0 - xr(STOOL.top) * 0.97, yTop - th); g.ellipse(cx0, yTop - th, xr(STOOL.top) * 0.95, ryTop, 0, Math.PI, 0, true); g.closePath(); g.fill();
        g.fillStyle = SNOWC;
        g.beginPath(); g.ellipse(cx0, yTop - th, xr(STOOL.top) * 0.95, ryTop + 0.5, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
    }

    XYT.registerShot('f7_sundial', {
      name: '白首如烛', zone: 'top', night: false, text: '#2a2d33', shadow: 'rgba(244,246,248,0.85)', accent: '#c0703c', bloom: 0.22,
      draw(g, c) {
        const lt = c.lt;
        const tCloud = CT(c, 8, 3.74);
        const H = hourAt(lt - (tCloud - 3.74) * clamp(lt / 3.74));
        const sun = sunAt(H);
        // 第47句第9字：云层从左向右 0.8 秒盖满；云影前沿同时扫过墙与雪地，所到之处影子消失、光变漫射
        const deck = ramp(lt, tCloud, tCloud + 0.8);
        const fX = lerp(FX0, FX1, deck);                                        // 云的前沿匀速推进（从画外进、到画外出）
        const covAt = (x, y) => { const [c0, w] = edgeAt(fX, y); return smooth(clamp(0.5 + (c0 - x) / w)); };
        const tx = fract(Math.max(0, lt - tCloud) * 230 / 1280) * 1280;         // 云团自身缓缓向右移（缩时）
        const fm = deck > 0 && deck < 1 ? frontMask(fX, tx) : null;
        const lit = (x, y) => 1 - covAt(x, y);                                  // 某处还有直射光的程度
        const sunK = deck < 1 ? 1 : 0;                                          // 画面里还有没有直射光
        const sinAz = Math.sin(sun.az);
        // 光色：早晚偏暖，正午偏白
        const warm = clamp(1.25 - sun.el / 0.5) * 0.9;
        const clouds = cloudsAt(lt, 1);
        const snowK = smooth(ramp(lt, tCloud + 0.25, c.dur));                // 落雪与积雪
        // 横向的前沿渐变（暖光等淡的层用；与遮罩同一位置）
        const frontGrad = (col, y) => {
          const [c0, w] = edgeAt(fX, y), gr2 = g.createLinearGradient(c0 - w / 2, 0, c0 + w / 2, 0);
          for (let i = 0; i <= 8; i++) gr2.addColorStop(i / 8, rgba(col, smooth(i / 8)));
          return gr2;
        };

        // ---- 天（歌词区只有渐变）----
        const skyTop = mix('#a9bccf', '#b4c4d6', clamp(1 - Math.abs(H - 12) / 3));
        const skyLow = mix('#e8eef3', '#f2d9b2', warm);
        let gr = g.createLinearGradient(0, 0, 0, 320);
        gr.addColorStop(0, skyTop); gr.addColorStop(0.55, mix(skyTop, skyLow, 0.45)); gr.addColorStop(1, skyLow);
        g.fillStyle = gr; g.fillRect(0, 0, 1280, 340);
        // 太阳一侧的天更亮更暖（太阳不入画）
        const sxp = 640 - 1100 * sinAz, glowK = lit(clamp(sxp, 0, 1280), 290);
        if (glowK > 0) {
          g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.5 * glowK;
          g.translate(sxp, 300); g.scale(1, 0.45);
          const rg = g.createRadialGradient(0, 0, 0, 0, 0, 900);
          rg.addColorStop(0, rgba(mix('#fff2d8', '#ffcf8a', warm), 0.7)); rg.addColorStop(1, 'rgba(255,240,215,0)');
          g.fillStyle = rg; g.fillRect(-sxp, -300 / 0.45, 1280, 340 / 0.45); g.restore();
        }
        // 层云从左漫过来，盖满整片天；云团自身也在缓缓向右移（缩时）
        if (deck > 0) {
          const dk = buf('f7deck', 320, 85), q = dk.g;
          q.setTransform(0.25, 0, 0, 0.25, 0, 0);
          q.drawImage(stratus(), tx - 1280, 0, 1280, 340); q.drawImage(stratus(), tx, 0, 1280, 340);
          if (fm) { q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'destination-in'; q.drawImage(fm.c, 0, 0, 320, 85, 0, 0, 320, 85); }
          g.drawImage(dk.c, 0, 0, 320, 85, 0, 0, 1280, 340);
        }
        // ---- 远树、墙、地 ----
        g.drawImage(backdrop(), 0, 200, 1280, 520);
        // 晴时的暖光（只在受光的雪面与瓦顶雪上；云影扫过的地方没有）
        const wk = 0.55 * warm;
        if (wk > 0 && sunK > 0) {
          g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = wk;
          g.fillStyle = deck > 0 ? frontGrad('#ffe2bc', 600) : '#ffe2bc'; g.fillRect(0, 462, 1280, 260);
          if (deck <= 0) g.drawImage(capWarm(), 0, 280, 1280, 50);
          else {
            const d = devBox(g, 0, 280, 1280, 330), cb = buf('f7capw', d.w, d.h), q = cb.g;
            q.setTransform(d.m.a, d.m.b, d.m.c, d.m.d, d.m.e - d.x, d.m.f - d.y);
            q.drawImage(capWarm(), 0, 280, 1280, 50);
            q.globalCompositeOperation = 'destination-in'; q.fillStyle = frontGrad('#000000', 305); q.fillRect(0, 270, 1280, 70);
            blitDev(g, cb, d);
          }
          g.restore();
        }
        // 脚印：落雪后渐被填平
        const pf = 1 - smooth(ramp(lt, tCloud + 0.6, c.dur));
        if (pf > 0) { g.globalAlpha = pf; g.drawImage(prints(), 0, 462, 1280, 260); g.globalAlpha = 1; }
        // 影子：墙、树、人、凳与云影合成一层，再乘上去（不会叠出双重暗）；云层盖过的地方已经去掉
        let sb = null;
        if (sunK > 0 && sun.el > 0) {
          sb = shadeLayer(lt, sun, fm, clouds);
          g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.78;
          g.imageSmoothingEnabled = true;
          g.drawImage(sb.c, 0, 115, SH.w, SH.h - 115, 0, 460, 1280, 260);
          g.restore();
        }
        // 树下、凳下、脚下的接触阴影（漫射光也有）
        const cs = (x, y, rx, ry, a) => { g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(1, ry / rx); const r2 = g.createRadialGradient(0, 0, 0, 0, 0, rx); r2.addColorStop(0, 'rgba(96,110,134,0.6)'); r2.addColorStop(1, 'rgba(96,110,134,0)'); g.fillStyle = r2; g.fillRect(-rx, -rx, 2 * rx, 2 * rx); g.restore(); };
        cs(632, 634, 70, 12, 0.9); cs(540, 632, 34, 6, 0.8);

        // ---- 老槐 ----
        g.drawImage(treeBase(), TB.x, TB.y, TB.w, TB.h);
        const tK = lit(TREE.x, TREE.y);
        const kL = tK * clamp((sinAz - 0.1) / 0.4), kR = tK * clamp((-sinAz - 0.1) / 0.4);
        if (kL > 0) { g.globalAlpha = kL; g.drawImage(treeLayer('litL'), TB.x, TB.y, TB.w, TB.h); }
        if (kR > 0) { g.globalAlpha = kR; g.drawImage(treeLayer('litR'), TB.x, TB.y, TB.w, TB.h); }
        g.globalAlpha = 1;
        if (snowK > 0) { g.globalAlpha = snowK; g.drawImage(treeLayer('snow1'), TB.x, TB.y, TB.w, TB.h); g.globalAlpha = 1; }
        drawMound(g, sb, 0.78);
        if (wk * tK > 0) {
          g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = wk * tK;
          g.drawImage(moundWarm(), MD.x, MD.y, MD.w, MD.h); g.restore();
        }

        // ---- 石凳与人 ----
        const bK = lit(630, 630);
        drawBench(g, bK, warm, snowK, sinAz);
        const cov = 1 - coverAt(clouds, MAN.x, GY0);
        const rimCol = mix('#fff0d6', '#ffcf94', warm);
        const mK = lit(MAN.x, 600) * cov;
        const rim = {
          l: mK * clamp((sinAz - 0.12) / 0.35),
          r: mK * clamp((-sinAz - 0.12) / 0.35),
          t: mK * 0.8 * (1 - clamp((Math.abs(sinAz) - 0.04) / 0.3)),
          col: rimCol,
        };
        drawMan(g, rim, 0.8 * snowK);

        // ---- 阴天后整体偏冷偏暗：随云层前沿从左向右压过去（天、墙、地、树、人同一比例；盖满后与整幅压暗相同）----
        if (deck > 0) {
          g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.6;
          if (!fm) { g.fillStyle = '#dbe1e8'; g.fillRect(-10, -10, 1300, 740); }
          else {
            const ob = buf('f7ov', 320, 180), q = ob.g;
            q.drawImage(fm.c, 0, 0, 320, 180, 0, 0, 320, 180);
            q.globalCompositeOperation = 'source-in'; q.fillStyle = '#dbe1e8'; q.fillRect(0, 0, 320, 180);
            g.imageSmoothingEnabled = true;
            g.drawImage(ob.c, 0, 0, 320, 180, -2, -2, 1284, 724);
          }
          g.restore();
        }
        // 结尾：右侧瓦顶上方、云底下留一道窄窄的暖色亮缝（落日在云下）；远树在亮缝前成剪影
        const slit = smooth(ramp(lt, tCloud + 1.1, tCloud + 1.9));
        if (slit > 0) {
          const X0 = 760, Y0 = 266, SW = 520, SHh = 52;
          const sbf = buf('f7slit', 260, 26), q = sbf.g;
          q.setTransform(0.5, 0, 0, 0.5, -X0 * 0.5, -Y0 * 0.5);
          const vg = q.createLinearGradient(0, 282, 0, 304);
          vg.addColorStop(0, 'rgba(255,206,150,0)'); vg.addColorStop(0.3, 'rgba(255,206,150,0.22)'); vg.addColorStop(0.55, 'rgba(255,206,150,0.68)'); vg.addColorStop(0.73, 'rgba(255,206,150,1)'); vg.addColorStop(1, 'rgba(255,206,150,1)');
          q.fillStyle = vg; q.fillRect(X0, Y0, SW, SHh);
          q.globalCompositeOperation = 'destination-in';
          const hg = q.createLinearGradient(X0, 0, 1280, 0);
          for (let i = 0; i <= 6; i++) hg.addColorStop(i / 6, `rgba(0,0,0,${smooth(Math.min(1, i / 6 * 1.35)).toFixed(3)})`);
          q.fillStyle = hg; q.fillRect(X0, Y0, SW, SHh);
          // 只留瓦顶积雪上沿以上的天空
          q.globalCompositeOperation = 'destination-out'; q.fillStyle = '#000';
          q.beginPath(); q.moveTo(X0 - 4, Y0 + SHh + 4);
          for (let x = X0 - 4; x <= 1284; x += 8) q.lineTo(x, Y_CAP - 7 - 2.5 * A.noise1(x / 60, 9) - 1.2 * A.noise1(x / 14, 10) + 0.8);
          q.lineTo(1284, Y0 + SHh + 4); q.closePath(); q.fill();
          // 远树挡住亮缝：在树影处挖掉（两次，树形更实）
          const ft = farTrees(), fs = ft.width / 1280;
          for (let k = 0; k < 2; k++) q.drawImage(ft, X0 * fs, Y0 * fs, SW * fs, (300 - Y0) * fs, X0, Y0, SW, 300 - Y0);
          g.save(); g.imageSmoothingEnabled = true;
          g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.9 * slit;
          g.drawImage(sbf.c, 0, 0, 260, 26, X0, Y0, SW, SHh);
          g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.3 * slit;
          g.drawImage(sbf.c, 0, 0, 260, 26, X0, Y0, SW, SHh);
          // 瓦顶积雪朝上的一面也映上一点暖光（右侧）
          const d = devBox(g, 900, 280, 1280, 330), cb = buf('f7capw', d.w, d.h), q2 = cb.g;
          q2.setTransform(d.m.a, d.m.b, d.m.c, d.m.d, d.m.e - d.x, d.m.f - d.y);
          q2.drawImage(capWarm(), 0, 280, 1280, 50);
          q2.globalCompositeOperation = 'destination-in';
          const hg2 = q2.createLinearGradient(900, 0, 1280, 0); hg2.addColorStop(0, 'rgba(0,0,0,0)'); hg2.addColorStop(1, 'rgba(0,0,0,1)');
          q2.fillStyle = hg2; q2.fillRect(900, 270, 380, 70);
          g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.18 * slit;
          blitDev(g, cb, d);
          g.restore();
        }
        // ---- 落雪 ----
        if (snowK > 0) {
          const spr = dot('snow7', '#ffffff', 0.5);
          const layer = (n, seed, size, vy, aMax) => {
            for (let i = 0; i < n; i++) {
              const hA = A.h2(i, seed), hB = A.h2(i, seed + 1), hC = A.h2(i, seed + 2);
              const fade = smooth((lt - (tCloud + 0.15 + 0.7 * hC)) / 0.5);
              if (fade <= 0.001) continue;
              const x = -10 + fract(hA + 0.004 * Math.sin(lt * (0.7 + hB) + hA * 30)) * 1300;
              const y = -20 + fract(hB + vy * (0.8 + 0.4 * hC) * lt / 760) * 760;
              const r = size * (0.7 + 0.6 * hA);
              g.globalAlpha = fade * aMax;
              g.drawImage(spr, x - r, y - r, r * 2, r * 2);
            }
            g.globalAlpha = 1;
          };
          layer(110, 801, 1.5, 45, 0.75);
          layer(60, 802, 2.6, 80, 0.85);
          layer(22, 803, 4.4, 130, 0.9);
        }
      },
    });
  })();
})();
