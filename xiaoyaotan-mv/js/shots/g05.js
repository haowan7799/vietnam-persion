/* 分镜镜头 第 05 组：御剑凌云、篝火散席、隔窗听书、醉卧入梦 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  if (!XYT.registerShot) return;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, noise1, mix } = A;
  const PI = Math.PI;
  const E = () => XYT.env, V = () => XYT.vfx, F = () => XYT.fig;

  // 本句第 k 字相对镜头起点的时间（没有歌词时用分镜里的默认值）
  const ct = (c, k, d) => { const v = c.charT && c.charT(k); return v == null ? d : v - (c.t - c.lt); };
  // 事件包络：从 t0 起 0→1 用 d 秒
  const up = (lt, t0, d) => smooth((lt - t0) / d);
  // 柔圆贴图（白色），按色着色后贴
  const tintBlob = (col) => XYT.sprites.tint(XYT.sprites.glow, col);
  function soft(g, x, y, r, col, a) { if (a <= 0.004 || r <= 0) return; g.globalAlpha = Math.min(1, a); g.drawImage(tintBlob(col), x - r, y - r, r * 2, r * 2); }
  const handMemo = new Map();   // 姿势关键点缓存（与时间无关的那些）
  function softE(g, x, y, rx, ry, col, a) { if (a <= 0.004) return; g.globalAlpha = Math.min(1, a); g.drawImage(tintBlob(col), x - rx, y - ry, rx * 2, ry * 2); }

  // =====================================================================
  // 13 第13句 · 御剑凌云：蜀山石笋孤峰、正午云海，少年第一次御剑冲出云层，峰顶酒剑仙举葫芦大笑
  // =====================================================================
  // 低机位仰拍：云海线压到 y≈610，天空占三分之二；日在上方偏左，右侧天色最深（放歌词）
  const SUN5 = [548, 46], HZ5 = 612;
  const E0x = 742, E0y = 652;     // 破云点（近景云堤顶）
  // 远景：天、日、远处石林、远云海、穿云的光（缓存成一张）
  function flyBack() {
    return K.cache('g05|flyback5', W + 160, H + 160, 1, (g) => {
      g.translate(80, 80);
      const e = E();
      e.sky(g, { stops: [[0, '#065279'], [0.42, '#21709f'], [0.72, '#4c8dae'], [0.9, '#9cc8d4'], [1, '#e8f3ec']], y0: -80, y1: HZ5 + 6 });
      // 日边的天亮起来（右侧仍深）
      g.fillStyle = K.rad(g, SUN5[0], SUN5[1], 10, 820, [[0, 'rgba(255,246,220,0.62)'], [0.3, 'rgba(236,240,226,0.3)'], [0.7, 'rgba(200,228,232,0.08)'], [1, 'rgba(200,228,232,0)']]);
      g.fillRect(-80, -80, W + 160, HZ5 + 90);
      // 高空淡云：日边一缕金、远处几片薄纱
      e.clouds(g, { t: 0, y: 150, color: '#fff6de', shade: '#6f9ab8', alpha: 0.55, scale: 1.1, n: 3, seed: 41, speed: 0, lightX: SUN5[0], spread: 70 });
      e.clouds(g, { t: 0, y: 360, color: '#ffffff', shade: '#8fb4c8', alpha: 0.4, scale: 0.8, n: 4, seed: 23, speed: 0, lightX: SUN5[0], spread: 50 });
      // 远处的石林：从云海里冒出的细石笋，越远越淡越蓝
      e.mountains(g, { t: 0, lightDir: 1, layers: [{ kind: 'karst', color: '#8fbcc2', light: '#f4ead0', litA: 0.5, y: HZ5 + 2, scaleY: 0.2, seed: 4, offset: 260, occlude: '#d8e8e6', fog: '#eaf4f0', fogA: 0.65, fogY: 2 }] });
      const pil = [[410, 214, 0.5, 3], [540, 140, 0.68, 5], [652, 96, 0.8, 13], [905, 150, 0.72, 8]];
      for (const [x, h, hz, sd] of pil) {
        const col = mix('#2f7f80', '#d2e6e8', hz * 0.85), lit = mix('#eacd76', '#f0f6f0', hz * 0.6);
        e.stonePeak(g, { x, y: HZ5 + 10, h, w: h * 0.3, color: col, light: lit, lightDir: 1, haze: '#d4e8ea', mist: false, base: '#e8f2ef', seed: sd, wisps: 0 });
      }
      e.cloudSea(g, { t: 0, y: HZ5 - 12, color: '#fbfdf8', shade: '#9fbccb', valley: '#7898b8', far: '#e4eff0', speed: 0, rows: 2, lightX: SUN5[0], seed: 3 });
      g.drawImage(flyRays(), -80, -80, W + 160, H + 160);
    });
  }
  function flyRays() {
    return K.cache('g05|flyrays5', W + 160, H + 160, 0.3, (g) => {
      g.translate(80, 80);
      V().godRays(g, { t: 3, lt: 0 }, { x: SUN5[0], y: SUN5[1], angle: 1.75, spread: 1.25, n: 9, len: 900, start: 0.05, color: '#fff0c4', alpha: 0.24, res: 0.3, beat: 0, night: false, blend: 'lighter' });
    });
  }
  // 孤峰：kit 石笋贴图上罩青绿设色——峰顶石青、山脚赭石，向阳（右）一侧石绿、描金
  function flyPeak() {
    return K.cache('g05|flypeak5', 440, 720, 1, (q) => {
      E().stonePeak(q, { x: 220, y: 720, h: 640, w: 188, color: '#21463f', light: '#8fd0b0', lightDir: 1, haze: '#cfe3e4', mist: false, base: '#eef5f1', seed: 21, wisps: 0 });
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = A.vgrad(q, 60, 720, [[0, 'rgba(6,82,121,0.3)'], [0.35, 'rgba(40,140,130,0.2)'], [0.7, 'rgba(150,110,60,0.22)'], [1, 'rgba(238,245,241,0)']]); q.fillRect(0, 0, 440, 720);
      const gx = q.createLinearGradient(130, 0, 330, 0);
      gx.addColorStop(0, 'rgba(8,30,40,0.3)'); gx.addColorStop(0.45, 'rgba(40,110,100,0.22)'); gx.addColorStop(0.62, 'rgba(72,192,163,0.3)'); gx.addColorStop(1, 'rgba(234,205,118,0.34)');
      q.fillStyle = gx; q.fillRect(0, 0, 440, 720);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 云头贴图（工笔勾云）：一簇大小不一的圆瓣堆成云头，瓣顶细墨勾线、向阳一侧描金，领头一瓣卷出如意纹
  const CH_W = 560, CH_H = 250;
  function cloudHead(i) {
    return K.cache('g05|chead' + i, CH_W, CH_H, 0.8, (g) => {
      const r = A.rng(300 + i * 17), sunL = i % 2 === 0, dir = sunL ? 1 : -1, cx = CH_W / 2 + dir * 30;
      // 一个大云头（领头、带如意卷）+ 两三个中瓣 + 一串小瓣拖成云尾
      const R0 = 66 + r() * 22, lobes = [[cx, CH_H - 20 - R0 * 1.25, R0, 1]];
      const nm = 2 + Math.floor(r() * 2);
      for (let k = 0; k < nm; k++) { const rr = 36 + r() * 24, side = k % 2 ? dir : -dir, d = R0 * (0.75 + 0.35 * r()) + rr * 0.5; lobes.push([cx + side * d, CH_H - 18 - rr * (1.05 + 0.3 * r()), rr, 0]); }
      const nt = 4 + Math.floor(r() * 3);
      for (let k = 0; k < nt; k++) { const rr = 18 + r() * 16 * (1 - k / nt), d = R0 + 40 + k * (30 + r() * 12); lobes.push([cx - dir * d, CH_H - 16 - rr * (0.9 + 0.4 * r()) - 8 * Math.sin(k * 1.3), rr, 0]); }
      for (let k = 0; k < 4; k++) { const rr = 20 + r() * 18; lobes.push([cx + (r() - 0.5) * R0 * 2.4, CH_H - 12 - rr * 0.6, rr, 0]); }
      // 由后往前：圆心高的先画
      lobes.sort((p, q) => (p[1] - p[2] * 0.3) - (q[1] - q[2] * 0.3));
      A.softBlob(g, cx, CH_H - 26, R0 * 2.2, 0.45, '#7898b8');
      for (const [x, y, rr, lead] of lobes) {
        const gr = g.createLinearGradient(0, y - rr, 0, y + rr);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#f0f7f6'); gr.addColorStop(0.8, '#c4d6e0'); gr.addColorStop(1, '#a3bccc');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
        // 瓣底一弯青影，瓣与瓣分得开
        g.fillStyle = 'rgba(120,152,184,0.28)'; g.beginPath(); g.arc(x, y, rr, PI * 0.08, PI * 0.92); g.arc(x, y + rr * 0.18, rr * 0.86, PI * 0.9, PI * 0.1, true); g.fill();
        // 细墨勾边（上半）与向阳一侧的金线
        g.strokeStyle = 'rgba(70,104,124,0.62)'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, rr - 0.7, PI * 1.0, PI * 2.0); g.stroke();
        g.strokeStyle = 'rgba(234,205,118,0.9)'; g.lineWidth = rr > 40 ? 2.6 : 1.8;
        g.beginPath(); if (sunL) g.arc(x, y, rr - 2.4, PI * 1.1, PI * 1.5); else g.arc(x, y, rr - 2.4, PI * 1.5, PI * 1.9); g.stroke();
        if (lead) {
          // 如意卷：大云头里卷进去一道螺线，收尾一笔挑出
          g.strokeStyle = 'rgba(80,116,138,0.72)'; g.lineWidth = 2; g.lineCap = 'round';
          g.beginPath();
          for (let k = 0; k <= 48; k++) { const th = (k / 48) * 2.6 * PI, rad = rr * 0.7 * Math.exp(-th * 0.32), an = -PI * 0.5 - dir * th; const px = x + dir * rr * 0.08 + Math.cos(an) * rad, py = y + rr * 0.12 + Math.sin(an) * rad * 0.9; k ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.stroke();
          g.strokeStyle = 'rgba(234,205,118,0.7)'; g.lineWidth = 1.4;
          g.beginPath(); for (let k = 0; k <= 30; k++) { const th = (k / 30) * 1.4 * PI, rad = rr * 0.6 * Math.exp(-th * 0.32), an = -PI * 0.5 - dir * th; const px = x + dir * rr * 0.08 + Math.cos(an) * rad, py = y + rr * 0.12 - 2 + Math.sin(an) * rad * 0.9; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
        }
      }
      // 底边揉成雾，接得上下面的云体
      g.fillStyle = A.vgrad(g, CH_H - 40, CH_H, [[0, 'rgba(198,216,226,0)'], [1, 'rgba(198,216,226,1)']]); g.fillRect(0, CH_H - 40, CH_W, 40);
    });
  }
  // 一排云头：横向循环漂移，每簇自己起伏（随拍一鼓）；lift(x) 给局部云顶加高
  function cloudRow(g, c, row, lift) {
    const t = c.t, span = W + 700;
    for (let i = 0; i < row.n; i++) {
      const sc = row.s * (0.8 + 0.4 * h2(i, row.seed)), w = CH_W * sc, h = CH_H * sc;
      let x = row.x0 + i * (span / row.n) + h2(i, row.seed + 1) * 60 - row.v * t;
      x = ((x % span) + span) % span - 350;
      const heave = Math.sin(t * 1.3 + i * 1.7 + row.seed) * 6 + (5 * c.be(0.35) + 4 * c.de(0.6)) * (i % 2 ? 1 : -0.6);
      const y = row.y + h2(i, row.seed + 2) * row.jy - heave - (lift ? lift(x) : 0);
      g.drawImage(cloudHead((i + row.seed) % 8), x - w / 2, y - h, w, h);
    }
    // 云体底：铺满到画面下沿
    g.fillStyle = A.vgrad(g, row.y - 24, row.y + 60, [[0, 'rgba(198,216,226,0)'], [0.4, '#c6d8e2'], [1, '#d8e6ea']]);
    g.fillRect(-60, row.y - 24, W + 120, H + 200 - row.y);
  }
  const ROW_B = { n: 7, s: 0.62, y: 676, jy: 26, v: 9, x0: 40, seed: 3 };
  const ROW_F = { n: 6, s: 0.95, y: 760, jy: 30, v: 20, x0: 180, seed: 11 };
  // 云团贴图：冲出云层时炸开的水汽
  function puffTex() {
    return K.cache('g05|puff', 64, 52, 1, (q) => {
      A.softBlob(q, 35, 33, 26, 0.85, '#6a88a2');
      A.softBlob(q, 31, 25, 25, 1, '#ffffff');
      A.softBlob(q, 27, 20, 14, 0.7, '#fff4d2');
    });
  }
  // 御剑轨迹：“凌”起 0.35 秒内从云里急冲到半空，滑翔到“几”；“几”到“酬”假拉远（人物层 1.45 → 0.2），飞向右上深空
  function flight(lt, T) {
    const a = T.a, b = T.a + 0.35;
    if (lt < b) {
      const u = easeOut((lt - a) / 0.35);
      return { x: lerp(E0x, 792, u), y: lerp(E0y + 40, 384, u), s: 1.45, rot: lerp(-0.62, -0.3, u) };
    }
    if (lt < T.b) {
      const v = (lt - b) / (T.b - b), bob = 5 * Math.sin((lt - b) * 3.2) * v;
      return { x: lerp(792, 848, v), y: lerp(384, 304, 1 - (1 - v) * (1 - v)) + bob, s: 1.45, rot: lerp(-0.3, -0.18, v) };
    }
    const v = clamp((lt - T.b) / (T.c - T.b)), q = 1 - Math.pow(1 - v, 2.4), bob0 = 5 * Math.sin((T.b - b) * 3.2);
    const P = { x: lerp(848, 990, q) + 30 * Math.sin(q * PI) , y: lerp(304 + bob0, 168, q) - 20 * Math.sin(q * PI), s: lerp(1.45, 0.2, q), rot: lerp(-0.18, -0.42, q) };
    if (lt > T.c) { const w = lt - T.c; P.x += 34 * w; P.y -= 28 * w; P.s *= Math.exp(-w * 0.6); }
    return P;
  }
  // 酒剑仙：几帧缓存（大笑时肩头抖、随拍前俯；“酬”字再仰天举葫芦）
  const JJ5 = { x: 262, y: 258, s: 0.8 };
  const JJ5F = [[0, 0], [0.06, 0.1], [0.12, 0.2], [-0.14, -0.25]];
  function jjx5(k, sh) {
    const o = { pose: 'laugh', prop: 'gourd', facing: 1, wind: 0.7, lean: JJ5F[k][0], head: JJ5F[k][1] };
    const tt = sh ? 3 / 28 : 1 / 28;
    return K.cache('g05|jjx5|' + k + sh, 260, 300, 1, (q) => F().draw(q, 'jiujianxian', 130, 270, JJ5.s, tt, o));
  }
  function jjx5Pts(k, sh) {
    const key = 'jjx5p' + k + sh;
    let p = handMemo.get(key);
    if (!p) { p = F().points('jiujianxian', 0, 0, JJ5.s, sh ? 3 / 28 : 1 / 28, { pose: 'laugh', prop: 'gourd', facing: 1, lean: JJ5F[k][0], head: JJ5F[k][1] }); handMemo.set(key, p); }
    return p;
  }
  // 拖尾：三层锥形色带（宽光晕、金身、白芯），按年龄收窄、沿轨迹渐隐
  function ribbonFill(g, pts, wf, col) {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const w = wf(p) / 2; L.push([p[0] - dy * w, p[1] + dx * w]); R.push([p[0] + dy * w, p[1] - dx * w]);
    }
    const h = pts[0], e = pts[pts.length - 1];
    const gr = g.createLinearGradient(h[0], h[1], e[0], e[1]);
    gr.addColorStop(0, col(1)); gr.addColorStop(0.5, col(0.45)); gr.addColorStop(1, col(0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < L.length; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath(); g.fill();
  }
  XYT.registerShot('vb5_flysword', {
    name: '御剑凌云', zone: 'right', night: false,
    text: '#fdf8ea', shadow: 'rgba(6,44,86,0.95)', accent: '#f4cf6a', bloom: 0.3,
    draw(g, c) {
      const t = c.t, lt = c.lt, f = F(), v = V();
      const T0 = ct(c, 0, 0.21), T1 = ct(c, 1, 0.65), T2 = ct(c, 2, 0.97), T4 = ct(c, 4, 1.87), T6 = ct(c, 6, 2.67);
      const T = { a: T2 - 0.06, b: T4, c: T6 };
      // 镜头：上升跟拍（世界下移）+ “几”后假拉远（背景 1.15 → 1.0）
      const pz = easeInOut(clamp((lt - T4) / (T6 - T4)));
      const zb = lerp(1.15, 1.0, pz), tilt = 36 * smooth((lt - T2) / (T4 - T2 + 0.4)) * (1 - 0.5 * pz);
      const cam = (k) => { g.translate(760, 420 + tilt * k); g.scale(zb, zb); g.translate(-760, -420); };
      g.save(); cam(0.6);
      g.drawImage(flyBack(), -80, -80, W + 160, H + 160);
      // 日轮白热，拍点时日晕一涨
      const pulse = 0.5 * c.be(0.45) + 0.6 * c.de(0.9);
      K.lighter(g, () => { soft(g, SUN5[0], SUN5[1], 150 + 50 * pulse, '#ffd890', 0.12 + 0.18 * pulse); soft(g, SUN5[0], SUN5[1], 34, '#fff4dc', 0.75); soft(g, SUN5[0], SUN5[1], 17, '#ffffff', 0.95); });
      g.globalAlpha = 1;
      g.restore();
      g.save(); cam(1);
      // 剑光：“壮”字云面先爆一团金光，一道金线直刺上天
      const beam = up(lt, T0, 0.16), beamFade = 1 - up(lt, T0 + 0.3, 0.9);
      const swell = up(lt, T1, 0.1) * (1 - up(lt, T2 + 0.05, 0.3));
      if (beam > 0 && beamFade > 0) {
        const top = lerp(E0y, -80, easeOut(beam)), k = beamFade * beamFade * (0.85 + 0.15 * Math.sin(t * 47));
        const path = () => { g.beginPath(); g.moveTo(E0x, E0y); g.bezierCurveTo(E0x + 4, lerp(E0y, top, 0.4), lerp(E0x, 860, 0.5), lerp(E0y, top, 0.75), lerp(E0x, 900, smooth(beam)), top); };
        g.lineCap = 'round';
        g.strokeStyle = `rgba(232,160,50,${0.22 * k})`; g.lineWidth = 34 * (0.4 + 0.6 * beamFade); path(); g.stroke();
        g.strokeStyle = `rgba(240,176,64,${0.7 * k})`; g.lineWidth = 9 * (0.4 + 0.6 * beamFade); path(); g.stroke();
        K.lighter(g, () => {
          g.strokeStyle = `rgba(255,240,200,${0.95 * k})`; g.lineWidth = 5; path(); g.stroke();
          for (let i = 0; i < 12; i++) { const u = h2(i, 61), py = lerp(E0y, top, u), px = E0x + (lerp(E0x, 920, u) - E0x) * u + (h2(i, 62) - 0.5) * 34, tw = 0.5 + 0.5 * Math.sin(t * 9 + i * 2); soft(g, px, py, 4 + 7 * h2(i, 63), '#ffe2a0', 0.7 * k * tw); }
        });
        g.globalAlpha = 1;
      }
      // 石笋孤峰（左，占画高八成）与流云
      g.drawImage(flyPeak(), 236 - 220, 178, 440, 720);
      for (let i = 0; i < 3; i++) { const q = ((lt / (9 + i * 3) + h2(i, 71)) % 1), wx = lerp(40, 440, q), wy = 330 + i * 110; softE(g, wx, wy, 170 - i * 20, 14 + i * 4, '#ffffff', 0.34 * Math.sin(q * PI)); softE(g, wx + 50, wy + 10, 100, 8, '#ffffff', 0.22 * Math.sin(q * PI)); }
      g.globalAlpha = 1;
      // 峰顶酒剑仙：随拍前俯大笑；葫芦高举，一道酒线弧着落进嘴里；“酬”字再仰天举葫芦
      const toast = up(lt, T6, 0.12) * (1 - up(lt, T6 + 0.55, 0.25));
      const bk = c.be(0.3), k5 = toast > 0.5 ? 3 : bk > 0.55 ? 2 : bk > 0.2 ? 1 : 0, sh = Math.floor(t * 14) % 2;
      const jy = JJ5.y - 4 * bk - 3 * toast;
      g.drawImage(jjx5(k5, sh), JJ5.x - 130, jy - 270, 260, 300);
      const jp = jjx5Pts(k5, sh);
      if (jp.gourdMouth && jp.mouth) {
        const gm = [JJ5.x + jp.gourdMouth[0], jy + jp.gourdMouth[1]], mo = [JJ5.x + jp.mouth[0], jy + jp.mouth[1]];
        const at = (u) => [lerp(gm[0], mo[0], u) + 16 * Math.sin(u * PI), gm[1] + (mo[1] - gm[1]) * u * u - 6 * Math.sin(u * PI)];
        g.strokeStyle = 'rgba(236,246,244,0.55)'; g.lineWidth = 1.3; g.lineCap = 'round';
        g.beginPath(); for (let i = 0; i <= 10; i++) { const p = at(i / 10); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
        for (let i = 0; i < 8; i++) { const u = (t * 1.6 + i / 8) % 1, p = at(u); g.fillStyle = 'rgba(240,250,248,0.9)'; g.beginPath(); g.arc(p[0], p[1], 1.7, 0, TAU); g.fill(); }
        K.lighter(g, () => { for (let i = 0; i < 8; i += 2) { const u = (t * 1.6 + i / 8) % 1, p = at(u); soft(g, p[0] + 1, p[1] - 1, 3.2, '#ffe9a8', 0.8); } });
        g.globalAlpha = 1;
      }
      // 一对白鹤远远飞过
      for (let k = 0; k < 2; k++) A.crane(g, 430 + k * 56 + lt * 22, 420 + k * 22 + Math.sin(t * 1.3 + k) * 4, 0.3 - k * 0.05, t * 5.2 + k * 1.7, { color: '#1c3640' });
      g.restore();
      // 后排云头（他身下的那一层）：“志”字破云点附近云顶一鼓
      const lift = (x) => 14 * swell * Math.exp(-Math.pow((x - E0x) / 200, 2));
      g.save(); cam(1.3); cloudRow(g, c, ROW_B, lift); g.restore();
      // 人物层：少年御剑
      const P = flight(lt, T);
      if (lt > T.a - 0.02) {
        // 金色尾迹：过去 2.2 秒轨迹上的点（固定偏移，不随缩放变），按年龄收窄
        const N = 30, pts = [];
        for (let i = 0; i <= N; i++) { const tt = lt - (i / N) * 2.2; if (tt < T.a) break; const q = flight(tt, T); pts.push([q.x - 10 * Math.cos(q.rot), q.y - 10 * Math.sin(q.rot), q.s, i / N]); }
        if (pts.length > 2) {
          const pf = (p) => (1 - 0.72 * p[3]) * (0.55 + 0.45 * clamp(p[2] / 1.45));
          ribbonFill(g, pts, (p) => 30 * pf(p), (a) => `rgba(236,170,60,${0.26 * a})`);
          ribbonFill(g, pts, (p) => 8 * pf(p), (a) => `rgba(246,196,90,${0.8 * a})`);
          K.lighter(g, () => ribbonFill(g, pts, (p) => 2.6 * pf(p) + 0.6, (a) => `rgba(255,246,214,${0.95 * a})`));
        }
        // 少年：月白衣在深蓝天上，身后一层暖光托住剪影
        g.save(); g.translate(P.x, P.y); g.rotate(P.rot);
        K.lighter(g, () => { softE(g, -6 * P.s, -96 * P.s, 70 * P.s + 6, 120 * P.s + 8, '#ffe2a8', 0.26); softE(g, -10 * P.s, -130 * P.s, 34 * P.s + 4, 50 * P.s + 4, '#fff4dc', 0.2); });
        g.globalAlpha = 1;
        f.draw(g, 'xiaoyao', 0, 0, P.s, t, { pose: 'flySword', facing: 1, wind: 1.1, windDir: -1, glow: 0.35, glowColor: '#ffe6a8', lean: 0.2, fx: 0.4 });
        g.restore();
        // 剑身：金芯琥珀晕，剑穗红缨向后飘
        const sp = swordPts(P.s);
        const cr = Math.cos(P.rot), sr = Math.sin(P.rot), Wp = (p) => [P.x + p[0] * cr - p[1] * sr, P.y + p[0] * sr + p[1] * cr];
        if (sp.swordTip) {
          const tip = Wp(sp.swordTip), hil = Wp(sp.swordHilt), dx = tip[0] - hil[0], dy = tip[1] - hil[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, bw = 2.6 * P.s + 0.6;
          g.lineCap = 'round';
          // 剑光：沿剑身一抹琥珀柔光
          g.save(); g.translate((hil[0] + tip[0]) / 2, (hil[1] + tip[1]) / 2); g.rotate(Math.atan2(dy, dx));
          K.lighter(g, () => { softE(g, 0, 0, L * 0.62 + 8, 9 * P.s + 3, '#f0a030', 0.42); softE(g, L * 0.2, 0, L * 0.4, 4 * P.s + 2, '#ffe6a8', 0.5); });
          g.restore(); g.globalAlpha = 1;
          g.fillStyle = '#ffe6a0'; g.beginPath(); g.moveTo(hil[0] + nx * bw, hil[1] + ny * bw); g.lineTo(tip[0], tip[1]); g.lineTo(hil[0] - nx * bw, hil[1] - ny * bw); g.closePath(); g.fill();
          K.lighter(g, () => { g.strokeStyle = 'rgba(255,250,232,0.95)'; g.lineWidth = 1.2 * P.s + 0.5; g.beginPath(); g.moveTo(hil[0], hil[1]); g.lineTo(tip[0] - dx * 0.08, tip[1] - dy * 0.08); g.stroke(); soft(g, tip[0], tip[1], 6 * P.s + 2, '#fff8e0', 0.75); });
          g.globalAlpha = 1;
          // 剑穗：从剑柄甩向身后
          const fl = Math.sin(t * 11) * 4 * P.s, ux = -dx / L, uy = -dy / L;
          g.strokeStyle = '#c8322a'; g.lineWidth = 2.4 * P.s + 0.4;
          g.beginPath(); g.moveTo(hil[0], hil[1]); g.quadraticCurveTo(hil[0] + ux * 16 * P.s + nx * fl, hil[1] + uy * 16 * P.s + 8 * P.s + ny * fl, hil[0] + ux * 30 * P.s - nx * fl, hil[1] + uy * 30 * P.s + 14 * P.s); g.stroke();
        }
      }
      // 前排云头：刚冲出时只遮住他的脚
      g.save(); cam(1.3); cloudRow(g, c, ROW_F, lift); g.restore();
      // 冲出云层（“凌”）：撕开的云团炸开、水汽四溅
      const age = lt - T2;
      if (age > -0.05 && age < 1.3) {
        const m = clamp(age / 1.3), pf = puffTex();
        for (let i = 0; i < 10; i++) {
          const an = -PI / 2 + (h2(i, 31) - 0.5) * 3.0, spd = 260 + 420 * h2(i, 32), d = (spd * (1 - Math.exp(-3 * Math.max(0, age)))) / 3;
          const x = E0x + Math.cos(an) * d * 1.3, y = E0y + 10 + Math.sin(an) * d * 0.62 + 60 * age * age, r = (30 + 44 * h2(i, 33)) * (0.55 + 1.2 * m);
          g.globalAlpha = (1 - m) * smooth(age / 0.05) * 0.95;
          g.drawImage(pf, x - r, y - r * 0.8, r * 2, r * 1.6);
        }
        K.lighter(g, () => { for (let i = 0; i < 16; i++) { const an = -PI / 2 + (h2(i, 41) - 0.5) * 2.6, d = (620 * h2(i, 42) + 160) * (1 - Math.exp(-4 * Math.max(0, age))) / 4; soft(g, E0x + Math.cos(an) * d, E0y + Math.sin(an) * d + 140 * age * age, 3 + 4 * h2(i, 43), '#ffd890', 0.9 * (1 - m)); } });
        g.globalAlpha = 1;
      }
      // 云下透出的金光（“壮”）与“志”字云面的光环（压在近景云上）
      const flare = beam * beamFade;
      const under = (flare * 0.6 + swell) * (0.85 + 0.15 * Math.sin(t * 30)) * (1 - up(lt, T2 + 0.1, 0.4));
      if (under > 0.01 || flare > 0.01) {
        softE(g, E0x, E0y + 16, 240 + 90 * swell, 60 + 24 * swell, '#f2b850', 0.45 * under);
        K.lighter(g, () => {
          softE(g, E0x, E0y + 6, 130 + 50 * swell, 36 + 12 * swell, '#ffe6a8', 0.55 * under);
          soft(g, E0x, E0y, 60, '#ffd27a', 0.9 * flare); soft(g, E0x, E0y, 26, '#ffffff', 0.9 * flare);
          softE(g, E0x, E0y, 150, 10, '#fff0c8', 0.7 * flare);
        });
        g.globalAlpha = 1;
      }
      const rg = up(lt, T1, 0.6);
      if (lt > T1 && rg < 1) {
        const a = swell * (1 - rg);
        g.strokeStyle = `rgba(255,222,140,${0.8 * a})`; g.lineWidth = 3.2; g.beginPath(); g.ellipse(E0x, E0y + 4, 40 + 200 * rg, 10 + 46 * rg, 0, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(255,255,250,${0.6 * a})`; g.lineWidth = 1.4; g.beginPath(); g.ellipse(E0x, E0y + 4, 30 + 150 * rg, 8 + 34 * rg, 0, 0, TAU); g.stroke();
      }
      // “几”后从尾迹上簌簌落下的金屑
      if (lt > T4) K.lighter(g, () => {
        for (let i = 0; i < 26; i++) {
          const tb = T4 + (i / 26) * 1.5 + 0.05 * h2(i, 91), a = lt - tb;
          if (a < 0 || a > 1.6) continue;
          const q = flight(tb, T), x = q.x + (h2(i, 92) - 0.5) * 30 + 14 * Math.sin(a * 3 + i), y = q.y + 18 * a + 26 * a * a;
          soft(g, x, y, 2 + 3 * h2(i, 93), '#ffe2a0', 0.8 * (1 - a / 1.6) * (0.6 + 0.4 * Math.sin(t * 12 + i)));
        }
      });
      g.globalAlpha = 1;
      v.bokeh(g, c, { n: 6, colors: ['#fff4d0', '#e8fff4'], area: [480, 0, 1000, 480], size: [30, 80], alpha: 0.12, night: false });
    },
  });
  function swordPts(s) {
    const key = 'sw' + s.toFixed(3);
    let p = handMemo.get(key);
    if (!p) { p = F().points('xiaoyao', 0, 0, s, 0, { pose: 'flySword', facing: 1, lean: 0.2 }); if (handMemo.size > 400) handMemo.clear(); handMemo.set(key, p); }
    return p;
  }
  // =====================================================================
  // 14 第14句 · 篝火散席：夏夜山野，众人围火举杯，阿奴抢走酒剑仙的葫芦，随后一组组离席，只剩逍遥与一圈空杯
  // =====================================================================
  const FX = 500, FY = 610;   // 篝火位置（偏左）
  const LZ = 1.3;             // 中景、前景放大到中景景别（绕火堆）
  const LCX = FX, LCY = FY - 40;
  // 远景：夏夜星河（满天细星、银河暗尘带）、远山、林梢剪影、草地（缓存）
  function fireBack() {
    return K.cache('g05|fireback6', W + 120, H + 120, 1, (g) => {
      g.translate(60, 60);
      const e = E();
      e.sky(g, { stops: [[0, '#05071a'], [0.45, '#141530'], [0.8, '#2e2740'], [1, '#4a3a5c']], y0: -60, y1: 500 });
      e.stars(g, { t: 0, n: 0, seed: 14, maxY: 470, minY: -40, twinkle: 0, milky: 1, milkyX: 760, milkyY: 190, milkyAngle: -0.42, milkyColor: '#c8c0ff' });
      e.stars(g, { t: 0, n: 0, seed: 15, maxY: 470, milky: 0.55, milkyX: 700, milkyY: 210, milkyAngle: -0.38, milkyColor: '#ffd8e8' });
      // 银河里的暗尘带：顺着河身两三道墨色
      const ca = Math.cos(-0.42), sa = Math.sin(-0.42), r = A.rng(77);
      for (let k = 0; k < 3; k++) for (let i = 0; i < 26; i++) {
        const u = (i / 25 - 0.5) * 1500, off = (k - 1) * 26 + 14 * Math.sin(i * 0.7 + k * 2), x = 760 + ca * u - sa * off, y = 190 + sa * u + ca * off;
        A.softBlob(g, x, y, 30 + 26 * r(), 0.16 + 0.1 * r(), '#05040c');
      }
      // 满天细星：大小 0.5–2 像素，一成偏暖；银河附近更密
      for (let i = 0; i < 680; i++) {
        let x = r() * (W + 120) - 60, y = r() * 520 - 40;
        if (i < 260) { const u = (r() - 0.5) * 1500, off = (r() - 0.5) * (r() * 180); x = 760 + ca * u - sa * off; y = 190 + sa * u + ca * off; }
        if (y > 470) continue;
        const sz = 0.25 + Math.pow(r(), 3) * 0.85, warm = r() < 0.1, b = 0.45 + 0.55 * r();
        g.fillStyle = warm ? `rgba(255,214,170,${b})` : `rgba(${210 + r() * 40},${220 + r() * 30},255,${b})`;
        g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill();
      }
      e.mountains(g, { t: 0, lightDir: 1, layers: [
        { kind: 'far', color: '#2c2440', light: '#574266', litA: 0.4, y: 452, scaleY: 0.34, seed: 6, offset: 400, occlude: '#3a3050', fog: '#4a3e5a', fogA: 0.35 },
        { kind: 'mid', color: '#171322', light: '#3a2e44', litA: 0.3, y: 492, scaleY: 0.4, seed: 2, offset: 120, occlude: '#221c2e' },
      ] });
      g.fillStyle = A.vgrad(g, 480, H + 60, [[0, '#1c1724'], [0.4, '#251c22'], [1, '#120e14']]); g.fillRect(-60, 486, W + 120, H - 426);
      g.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const x = r() * (W + 120) - 60, y = 490 + Math.pow(r(), 0.7) * 260, k = (y - 480) / 240, hh = (5 + r() * 12) * (0.5 + k);
        g.strokeStyle = `rgba(${40 + r() * 30},${46 + r() * 30},${36 + r() * 20},${0.5 + r() * 0.4})`; g.lineWidth = 0.8 + k;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 6, y - hh * 0.6, x + (r() - 0.5) * 10, y - hh); g.stroke();
      }
      e.pines(g, { xs: [-30, 90, 1180, 1300], y: 520, ys: [10, -10, 0, 16], s: 0.72, sizes: [1.2, 0.85, 1.05, 1.25], color: '#120f18', ink: '#0b090f', seed: 8, sway: 0 });
      // 夜色：离火越远越暗（内圈留得更宽，不见边）
      g.save(); g.translate(FX, FY - 40); g.scale(1, 0.62);
      const vg = g.createRadialGradient(0, 0, 140, 0, 0, 1000);
      vg.addColorStop(0, 'rgba(10,6,16,0)'); vg.addColorStop(0.45, 'rgba(10,6,16,0.16)'); vg.addColorStop(0.7, 'rgba(8,5,12,0.62)'); vg.addColorStop(1, 'rgba(6,4,10,0.92)');
      g.fillStyle = vg; g.fillRect(-FX - 80, -(FY - 40) / 0.62 - 120, W + 160, (H + 160) / 0.62 + 120);
      g.restore();
    });
  }
  // 火塘石圈（缓存）
  function fireStones() {
    return K.cache('g05|stones', 420, 120, LZ, (g) => {
      const r = A.rng(31);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + r() * 0.2, x = 210 + Math.cos(a) * 120, y = 56 + Math.sin(a) * 26, rr = 13 + r() * 9;
        const gr = g.createRadialGradient(x - rr * 0.2, y - rr * 0.6, 1, x, y, rr * 1.2);
        gr.addColorStop(0, Math.sin(a) < 0.2 ? '#c98a5a' : '#8a5a3e'); gr.addColorStop(0.6, '#3a2a26'); gr.addColorStop(1, '#16100e');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr * 1.2, rr * 0.7, 0, 0, TAU); g.fill();
      }
      const gr = g.createRadialGradient(210, 58, 4, 210, 58, 100);
      gr.addColorStop(0, '#ffb24a'); gr.addColorStop(0.35, '#a83a14'); gr.addColorStop(1, 'rgba(40,14,8,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(210, 58, 100, 22, 0, 0, TAU); g.fill();
      for (let i = 0; i < 7; i++) { const x = 150 + i * 20, y = 50 + (i % 2) * 8; g.strokeStyle = '#2a140c'; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 18, y + 8); g.lineTo(x + 18, y - 6); g.stroke(); }
    });
  }
  // 白瓷小杯：向火一侧杯口映火
  function cup(g, x, y, k, side) {
    g.fillStyle = 'rgba(20,12,10,0.7)'; g.beginPath(); g.ellipse(x - side * 3 * k, y + 1, 7.5 * k, 2.2 * k, 0, 0, TAU); g.fill();
    const gr = g.createLinearGradient(x + side * 6 * k, 0, x - side * 6 * k, 0);
    gr.addColorStop(0, '#ffe2b0'); gr.addColorStop(0.5, '#d8c0a0'); gr.addColorStop(1, '#6a5446');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - 5.5 * k, y - 7 * k); g.lineTo(x + 5.5 * k, y - 7 * k); g.lineTo(x + 3.2 * k, y); g.lineTo(x - 3.2 * k, y); g.closePath(); g.fill();
    g.fillStyle = '#3a2418'; g.beginPath(); g.ellipse(x, y - 7 * k, 5.5 * k, 1.6 * k, 0, 0, TAU); g.fill();
  }
  // 葫芦（与 kit 人物手里的同形；原点在葫芦颈，ang=0 时葫芦身向下垂）
  function gourd(g, x, y, ang, k) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(k, k);
    g.fillStyle = '#a8602c';
    g.beginPath(); g.arc(0, 4.6, 4.2, 0, TAU); g.fill(); g.beginPath(); g.arc(0, 13.6, 6.8, 0, TAU); g.fill(); g.fillRect(-1.6, -1.6, 3.2, 3.6);
    g.fillStyle = 'rgba(255,214,150,0.6)'; g.beginPath(); g.ellipse(-2.4, 11.6, 1.8, 3.2, 0.3, 0, TAU); g.fill();
    g.strokeStyle = '#9a3324'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3.6, 8.6); g.lineTo(3.6, 8.6); g.stroke();
    g.restore();
  }
  // 坐姿 + 另一姿势的近侧手臂（肩头对齐）：举杯、举葫芦
  function armOffset(who, x, y, s, t, o, armPose, armFacing) {
    const pb = F().points(who, x, y, s, t, o), ao = Object.assign({}, o, { pose: armPose, prop: 'none', part: 'front' });
    if (armFacing) ao.facing = armFacing;
    const pa = F().points(who, 0, 0, s, t, ao);
    return { ax: pb.shoulderN[0] - pa.shoulderN[0], ay: pb.shoulderN[1] - pa.shoulderN[1], ao };
  }
  function sitArm(g, who, x, y, s, t, o, armPose) {
    const f = F();
    if (!armPose) { f.draw(g, who, x, y, s, t, o); return; }
    f.draw(g, who, x, y, s, t, Object.assign({}, o, { part: 'back' }));
    const { ax, ay, ao } = armOffset(who, x, y, s, t, o, armPose);
    f.draw(g, who, ax, ay, s, t, ao);
  }
  // 火光打在人身上：向火一侧暖、背火一侧沉（只染在人物像素上）
  function fireLit(q, x0, y0, w, h, dx, dy, warm, dark) {
    const cx = x0 + w / 2, cy = y0 + h / 2, L = Math.max(w, h) * 0.5;
    q.globalCompositeOperation = 'source-atop';
    q.fillStyle = K.lin(q, cx + dx * L, cy + dy * L, cx - dx * L, cy - dy * L, [[0, `rgba(255,150,70,${warm})`], [0.45, 'rgba(150,70,40,0.1)'], [1, `rgba(20,10,30,${dark})`]]);
    q.fillRect(x0, y0, w, h);
    q.globalCompositeOperation = 'source-over';
  }
  const fireDir = (x, y) => { const dx = FX - x, dy = FY - 30 - y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
  // 坐着的人缓存成贴图（只随拍整体起伏）
  function sitSprite(key, who, x, y, s, o, armPose) {
    return K.cache('g05|sit6|' + key, 240, 230, LZ, (q) => {
      sitArm(q, who, 120, 214, s, 2.0, o, armPose);
      const [dx, dy] = fireDir(x, y);
      fireLit(q, 0, 0, 240, 230, dx, dy * 0.6 - 0.3, 0.36, 0.5);
    });
  }
  function sitHand(who, s, o, armPose) {
    const key = 'h6' + who + s + o.facing + (armPose || '');
    let h = handMemo.get(key);
    if (!h) {
      if (!armPose) h = F().points(who, 150, 280, s, 2.0, o).handN;
      else { const { ax, ay, ao } = armOffset(who, 150, 280, s, 2.0, o, armPose); h = F().points(who, ax, ay, s, 2.0, ao).handN; }
      handMemo.set(key, h);
    }
    return h;
  }
  // 把人物画进一块小缓冲，按 dark 压暗后贴回（走进黑暗的人用）；mask 可在压暗前改缓冲（盖掉腰间葫芦）
  let dkC = null;
  function darkDraw(g, x, y, dark, fn, mask) {
    const S = ((XYT.sprites && XYT.sprites.S) || 1) * 0.92, BW = 260, BH = 262, AX = 130, AY = 248;   // 走远的人略虚一点，也省时间
    if (!dkC) dkC = document.createElement('canvas');
    if (dkC.width !== Math.round(BW * S)) { dkC.width = Math.round(BW * S); dkC.height = Math.round(BH * S); }
    const q = dkC.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, dkC.width, dkC.height);
    q.setTransform(S, 0, 0, S, 0, 0);
    fn(q, AX, AY);
    if (mask) mask(q, AX, AY);
    // 火光：向火一侧暖、背火一侧沉
    const [fdx, fdy] = fireDir(x, y);
    fireLit(q, 0, 0, BW, BH, fdx, fdy * 0.5 - 0.2, 0.34, 0.5);
    if (dark > 0.01) { q.globalCompositeOperation = 'source-atop'; q.fillStyle = `rgba(8,5,12,${Math.min(0.97, dark)})`; q.fillRect(0, 0, BW, BH); q.globalCompositeOperation = 'source-over'; }
    g.drawImage(dkC, 0, 0, dkC.width, dkC.height, x - AX, y - AY, BW, BH);
  }
  // 盖掉酒剑仙腰间那只（kit 总会画的）小葫芦：只染在人物像素上，像一片衣褶
  function hideWaistGourd(q, p, s) {
    q.globalCompositeOperation = 'source-atop';
    q.fillStyle = K.rad(q, p[0], p[1] + 4 * s, 1, 13 * s, [[0, 'rgba(98,80,60,1)'], [0.7, 'rgba(98,80,60,0.95)'], [1, 'rgba(98,80,60,0)']]);
    q.fillRect(p[0] - 14 * s, p[1] - 12 * s, 28 * s, 34 * s);
    q.globalCompositeOperation = 'source-over';
  }
  // 座位（中景局部坐标）：who, x, y(脚), s, facing, 离席字序号, 去向 [dx, dy, s1], lag
  const SEATS = [
    { who: 'yueru', x: 420, y: 518, s: 0.94, f: 1, go: 3, to: [-300, -52, 0.66], lag: 0.08 },
    { who: 'jinyuan', x: 344, y: 528, s: 0.96, f: 1, go: 3, to: [-300, -44, 0.68] },
    { who: 'anu', x: 624, y: 524, s: 1.02, f: -1, go: 2, run: true, to: [520, -14, 0.9] },
    { who: 'tangyu', x: 724, y: 548, s: 1.0, f: -1, go: 2, run: true, to: [480, -4, 1.0], lag: 0.16 },
    { who: 'linger', x: 262, y: 566, s: 1.04, f: 1, go: 4, to: [-240, -74, 0.72], look: true },
  ];
  const JX = 236, JY = 668, JS = 1.12, XX = 842, XY = 668, XS = 1.26;
  const RIMF = '#ffb060';
  XYT.registerShot('vb6_bonfire', {
    name: '篝火散席', zone: 'top', night: true,
    text: '#e9f1f6', shadow: 'rgba(12,8,20,0.92)', accent: '#ffb054', bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = c.lt, f = F(), v = V();
      const C = [0.08, 0.6, 1.04, 1.36, 1.9, 2.28, 2.76].map((d, k) => ct(c, k, d));
      const pe = easeInOut(clamp(lt / c.dur));
      const lay = (k) => { const z = (k > 0.3 ? LZ : 1) * (1 + 0.08 * k * pe); g.translate(LCX, LCY); g.scale(z, z); g.translate(-LCX, -LCY); };
      const bob = (i) => 1.4 * Math.sin(c.b.x * TAU * 0.5 + i) + 2 * c.be(0.25) * (i % 2 ? 1 : -0.6);
      const dim = 0.3 * up(lt, C[2], 0.3) + 0.25 * up(lt, C[3], 0.3) + 0.2 * up(lt, C[4], 0.3) + 0.25 * up(lt, C[6], 0.3);   // 每走一组，火光暗一档；“留”字只剩余火
      const fl = 0.55 * noise1(t * 7, 3) + 0.3 * noise1(t * 17, 4) + 0.15 * noise1(t * 31, 5);
      const fireK = (0.82 + 0.18 * fl) * (1 - 0.32 * dim) * (1 + 0.12 * c.be(0.3));
      // “人”字起推近逍遥（他在右前，留到最后被转场盖住）
      const zp = 1 + 0.12 * easeInOut(clamp((lt - C[5]) / 0.7));
      g.save(); g.translate(944, 620); g.scale(zp, zp); g.translate(-944, -620);
      // 远景
      g.save(); lay(0.2);
      g.drawImage(fireBack(), -60, -60, W + 120, H + 120);
      K.lighter(g, () => {
        for (let i = 0; i < 14; i++) { const x = h2(i, 81) * W, y = 20 + h2(i, 82) * 380, a = 0.5 + 0.5 * Math.sin(t * (1.5 + 2 * h2(i, 83)) + i * 2.3); soft(g, x, y, 5 + 4 * h2(i, 84), '#dfe4ff', 0.35 * a); }
        // “难”字一颗流星划过
        const sa = lt - C[2];
        if (sa > 0 && sa < 0.6) {
          const u = easeOut(sa / 0.45), hx = lerp(1010, 700, u), hy = lerp(70, 210, u), k = 1 - smooth((sa - 0.3) / 0.3);
          const gr = g.createLinearGradient(hx, hy, hx + 150, hy - 68);
          gr.addColorStop(0, `rgba(255,250,236,${0.95 * k})`); gr.addColorStop(1, 'rgba(200,210,255,0)');
          g.strokeStyle = gr; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + 150, hy - 68); g.stroke();
          soft(g, hx, hy, 9, '#ffffff', 0.9 * k);
        }
      });
      g.globalAlpha = 1;
      g.restore();
      // 中景：火圈与围坐的人
      g.save(); lay(0.5);
      K.lighter(g, () => softE(g, FX, FY + 6, 400 * fireK, 110 * fireK, '#ff9a48', 0.42 * fireK));
      g.globalAlpha = 1;
      const hands = {};
      const toast = lt >= C[0] && lt < C[1];
      const leaving = [];
      for (let i = 0; i < SEATS.length; i++) {
        const S = SEATS[i], tGo = C[S.go] + (S.lag || 0), o = { pose: 'sit', facing: S.f, wind: 0.15 };
        if (lt < tGo) {
          let arm = toast ? 'reach' : null;
          if (S.who === 'anu') arm = lt < C[0] ? null : lt < C[0] + 0.34 ? 'reach' : 'swordUp';
          const img = sitSprite(S.who + (arm || ''), S.who, S.x, S.y, S.s, o, arm), dy = bob(i);
          // 背火一侧的地影
          softE(g, S.x - Math.sign(FX - S.x) * 34, S.y + 2, 66, 9, '#050307', 0.55);
          g.drawImage(img, S.x - 120, S.y - 214 + dy, 240, 230);
          const h = sitHand(S.who, S.s, o, arm);
          hands[S.who] = [S.x - 150 + h[0], S.y - 280 + dy + h[1], !!arm];
        } else leaving.push([S, lt - tGo]);
      }
      // 离席的人：起身（一拍内弹起），回头一眼（灵儿），再走进黑暗或跑出画外；走得越远越暗
      for (const [S, a] of leaving) {
        if (S.who === 'anu' && a < 0.12) { darkDraw(g, S.x, S.y, 0.1, (q, x, y) => anuGourd(q, x, y + 8 * (1 - a / 0.12), S.s, t, { pose: 'stand', facing: S.f, wind: 0.2 })); continue; }
        if (a < 0.12) { darkDraw(g, S.x, S.y, 0.1, (q, x, y) => f.draw(q, S.who, x, y + 8 * (1 - a / 0.12), S.s, t, { pose: 'stand', facing: S.f, wind: 0.2 })); continue; }
        const face = S.to[0] < 0 ? -1 : 1;
        if (S.look && a < 0.34) { darkDraw(g, S.x, S.y, 0.12, (q, x, y) => f.draw(q, S.who, x, y, S.s, t, { pose: 'lookBack', facing: face, wind: 0.3 })); continue; }
        const run = S.run, aa = a - (S.look ? 0.34 : 0.12), dur = run ? 0.6 : S.look ? 0.55 : 1.0, k = Math.min(1.3, aa / dur);
        const x = S.x + S.to[0] * (run ? easeIn(Math.min(1, k * 1.15)) * 0.7 + 0.3 * k : k), y = S.y + S.to[1] * k;
        const ss = lerp(S.s, S.to[2], Math.min(1, k));
        if (x < -150 || x > W + 150) continue;
        const walked = Math.hypot(x - S.x, (y - S.y) * 2);
        const dk = 0.08 + 0.9 * smooth((walked - (S.look ? 10 : 30)) / (S.look ? 90 : 170));
        if (dk > 0.94) continue;   // 已经没入黑暗
        const wo = { pose: 'walk', facing: face, wind: 0.3, speed: run ? 2.4 : 1.9, seed: S.go * 3 + (S.lag ? 1 : 0) };
        if (dk > 0.6) {
          // 快没进黑里了：直接画成和夜色相近的剪影（省一块缓冲）
          const so = Object.assign({}, wo, { tone: 'silhouette', ink: mix('#2a1a1c', '#120d16', (dk - 0.6) / 0.34) });
          if (S.who === 'anu') anuGourd(g, x, y, ss, t, so, dk); else f.draw(g, S.who, x, y, ss, t, so);
        } else if (S.who === 'anu') {
          // 阿奴举着葫芦跑（攥着葫芦颈，葫芦身在手下晃）
          darkDraw(g, x, y, dk, (q, lx, ly) => anuGourd(q, lx, ly, ss, t, wo));
        } else darkDraw(g, x, y, dk, (q, lx, ly) => f.draw(q, S.who, lx, ly, ss, t, wo));
      }
      // 篝火
      g.drawImage(fireStones(), FX - 210, FY - 56, 420, 120);
      v.flame(g, c, { kind: 'fire', x: FX, y: FY - 4, s: 0.86 * (1 - 0.18 * dim), burn: 1 - 0.35 * dim, glow: 1 - 0.3 * dim, wind: 0.08 + 0.06 * Math.sin(t * 0.7), seed: 7 });
      v.sparks(g, c, { on: 'beat', x: FX, y: FY - 30, angle: -PI / 2, spread: 1.4, n: 22, speed: 380, gravity: 500, dur: 1.0, size: 0.8, alpha: 0.8 * (1 - 0.4 * dim) });
      // 被抢的葫芦：“知”字从酒剑仙手里高高飞过火苗，落进对面阿奴的手；酒洒成一串火光里的珠子
      const s0 = C[0] + 0.04, s1 = s0 + 0.3;
      const jh = jjxHand(), gm0 = [JX - 180 + jh[0], JY - 230 + jh[1]];
      if (lt >= s0 && lt < C[2] + 0.12 && hands.anu) {
        const hA = hands.anu, u = clamp((lt - s0) / (s1 - s0));
        const ue = u * (2 - u), gx = lerp(gm0[0], hA[0], ue), gy = lerp(gm0[1], hA[1], ue) - 4 * 170 * ue * (1 - ue);
        const ang = u < 1 ? -2.2 + ue * TAU * 1.25 : 0.4 * Math.sin((lt - s1) * 10) * Math.exp(-(lt - s1) * 2);
        gourd(g, gx, gy, ang, JS * 1.7);
        const da = lt - s0;
        if (da < 0.9) K.lighter(g, () => {
          for (let i = 0; i < 12; i++) {
            const tb = (i / 12) * 0.3, q = da - tb; if (q < 0) continue;
            const ub = tb / 0.3, ube = ub * (2 - ub), bx = lerp(gm0[0], hA[0], ube), by = lerp(gm0[1], hA[1], ube) - 680 * ube * (1 - ube);
            const px = bx + (h2(i, 10) - 0.5) * 50 * q, py = by + 40 * q + 420 * q * q;
            soft(g, px, py, 2.2 + 2 * h2(i, 11), '#ffd890', 0.9 * (1 - q / 0.9));
          }
        });
        g.globalAlpha = 1;
      }
      // 石上的杯子：举杯时在手里，放下后回到石上；人走了，杯还在
      const cupAt = { tangyu: -0.3, yueru: -2.0, jinyuan: -2.5, anu: -0.9, linger: 2.95, jiujianxian: 2.4, xiaoyao: 0.7 };
      for (const who in cupAt) {
        const h = hands[who], a = cupAt[who];
        if (h && h[2] && who !== 'anu') { cup(g, h[0] + 2, h[1] + 3, 1.4, Math.sign(FX - h[0])); continue; }
        if (who === 'xiaoyao' && toast) continue;
        const x = FX + Math.cos(a) * 132, y = FY + Math.sin(a) * 30 - 4;
        cup(g, x, y, 1.7, Math.sign(FX - x) || 1);
      }
      // 杯口映着火：向火一侧一点暖光，随火苗闪
      K.lighter(g, () => {
        const k0 = toast ? 0.7 * Math.exp(-(lt - C[0]) / 0.25) : 0;
        for (const who in cupAt) {
          const h = hands[who];
          if (h && h[2] && who !== 'anu') { soft(g, h[0] + 2, h[1] - 6, 14, '#ffd890', 0.25 + k0); continue; }
          const a = cupAt[who], x = FX + Math.cos(a) * 132, y = FY + Math.sin(a) * 30 - 4, sd = Math.sign(FX - x) || 1;
          soft(g, x + sd * 5, y - 11, 7, '#ffcf80', (0.35 + 0.25 * fl) * (1 - 0.3 * dim));
        }
      });
      g.globalAlpha = 1;
      g.restore();
      // 前景：酒剑仙（左前，侧卧）与逍遥（右前，坐）——设色＋火光＋轮廓光
      g.save(); lay(0.5);
      const jo = { facing: 1, rim: RIMF, light: [FX, FY - 70], rimAlpha: 0.85, night: true, wind: 0.1 };
      const jGo = C[4] + 0.08;
      if (lt < jGo) {
        const st = lt < s0 + 0.05 ? 'drink' : lt < C[2] + 0.2 ? 'reach' : 'empty';
        g.drawImage(jjxLie(st, jo), JX - 180, JY - 230 + 0.8 * Math.sin(t * 1.4), 380, 260);
      } else {
        // “几人”：空着手爬起来，踉踉跄跄往左边的黑里走，一只手还往回够那只葫芦
        const a = lt - jGo;
        if (a < 0.14) g.drawImage(jjxKneel(jo), JX - 10 - 190, JY - 260, 380, 280);
        else {
          const aa = a - 0.14, stum = Math.exp(-Math.pow((aa - 0.2) / 0.07, 2));
          const x = JX - 10 - aa * 260 + 12 * Math.sin(aa * 9), y = JY - 4 - aa * 14 + 7 * stum;
          const sway = 0.12 * Math.sin(aa * 7.5) + 0.22 * stum;
          const dk = 0.05 + 0.85 * smooth((aa - 0.05) / 0.35);
          if (dk < 0.95) {
            const wo = Object.assign({}, jo, { rim: null, pose: 'walk', facing: -1, speed: 1.7, lean: 0.12 + 0.3 * stum, head: 0.15 + 0.1 * Math.sin(aa * 5), prop: 'none' });
            g.save(); g.translate(x, y); g.rotate(-sway); g.translate(-x, -y);
            const body = (q, lx, ly, o) => {
              f.draw(q, 'jiujianxian', lx, ly, JS, t, Object.assign({}, o, { part: 'back' }));
              const { ax, ay, ao } = armOffset('jiujianxian', lx, ly, JS, t, o, 'reach', 1);
              f.draw(q, 'jiujianxian', ax, ay, JS, t, ao);
            };
            if (dk > 0.6) body(g, x, y, Object.assign({}, wo, { tone: 'silhouette', ink: mix('#2a1a1c', '#120d16', (dk - 0.6) / 0.34) }));
            else darkDraw(g, x, y, dk, (q, lx, ly) => body(q, lx, ly, wo), (q, lx, ly) => { const gp = f.points('jiujianxian', lx, ly, JS, t, wo).gourdMouth; if (gp) hideWaistGourd(q, gp, JS); });
            g.restore();
          }
        }
      }
      // 逍遥：坐在右前；举杯时手臂伸向火；“人”字后慢慢低下头
      const hd = Math.round(3 * up(lt, C[5] + 0.15, 0.5)), xv = toast ? 'toast' : 'rest' + hd;
      const ximg = xySprite(toast, hd);
      softE(g, XX + 40, XY + 2, 90, 11, '#050307', 0.6);
      K.lighter(g, () => softE(g, XX - 60, XY - 20, 150, 46, '#ff8a3a', 0.16 * fireK));
      g.globalAlpha = 1;
      g.drawImage(ximg, XX - 150, XY - 254 + 0.6 * bob(7), 300, 270);
      if (toast) { const h = sitHand('xiaoyao', XS, { pose: 'sit', facing: -1 }, 'reach'); const hx = XX - 150 + h[0] + 2, hy = XY - 280 + 0.6 * bob(7) + h[1] + 3; cup(g, hx, hy, 1.6, -1); K.lighter(g, () => soft(g, hx, hy - 8, 20, '#ffd890', 0.25 + 0.7 * Math.exp(-(lt - C[0]) / 0.25))); g.globalAlpha = 1; }
      g.restore();
      // 余烬与萤火（只在草间）
      v.embers(g, c, { n: 24, x0: FX - 60, x1: FX + 60, y: FY - 60, rise: 520, speed: 80, wind: 12, size: [1, 4], color: '#ff8a3a', alpha: 0.9 * (1 - 0.35 * dim) });
      v.fireflies(g, c, { n: 6, area: [0, 560, 320, 700], color: '#c8f08a', size: 0.5, alpha: 0.8, seed: 5, trail: 2 });
      v.fireflies(g, c, { n: 6, area: [960, 560, 1280, 700], color: '#c8f08a', size: 0.5, alpha: 0.8, seed: 9, trail: 2 });
      // 前景草影（最近一层，推得最多）
      g.save(); lay(1);
      g.drawImage(fireFront(), -40, 600, W + 80, 200);
      g.restore();
      g.restore();
    },
  });
  // 逍遥坐像（举杯 / 低头三档）：设色＋火光＋轮廓光
  function xySprite(toast, hd) {
    return K.cache('g05|xy6|' + (toast ? 'toast' : 'rest' + hd), 300, 270, LZ, (q) => {
      const o = { pose: 'sit', facing: -1, rim: RIMF, light: [FX - XX + 150, FY - 70 - XY + 254], rimAlpha: 0.95, night: true, wind: 0.12, head: 0.09 * (toast ? 0 : hd) };
      sitArm(q, 'xiaoyao', 150, 254, XS, 2.0, o, toast ? 'reach' : null);
      const [dx, dy] = fireDir(XX, XY);
      fireLit(q, 0, 0, 300, 270, dx, dy * 0.5 - 0.2, 0.5, 0.12);
    });
  }
  // 酒剑仙侧卧：喝酒 / 葫芦被抢、手往前够 / 空手（缓存，腰间小葫芦盖成衣褶）
  function jjxLie(st, jo) {
    return K.cache('g05|jjx6|' + st, 380, 260, LZ, (q) => {
      const o = Object.assign({}, jo, { light: [FX - JX + 180, FY - 70 - JY + 230] });
      const f = F();
      if (st === 'drink') f.draw(q, 'jiujianxian', 180, 230, JS, 2.0, Object.assign({ pose: 'lie', prop: 'gourd' }, o));
      else {
        const lo = Object.assign({ pose: 'lie', prop: 'none' }, o);
        if (st === 'reach') {
          f.draw(q, 'jiujianxian', 180, 230, JS, 2.0, Object.assign({}, lo, { part: 'back' }));
          const { ax, ay, ao } = armOffset('jiujianxian', 180, 230, JS, 2.0, lo, 'reach');
          f.draw(q, 'jiujianxian', ax, ay, JS, 2.0, Object.assign({}, ao, { rim: RIMF }));
        } else f.draw(q, 'jiujianxian', 180, 230, JS, 2.0, lo);
        const gp = f.points('jiujianxian', 180, 230, JS, 2.0, lo).gourdMouth;
        if (gp) hideWaistGourd(q, gp, JS);
      }
      const [dx, dy] = fireDir(JX, JY);
      fireLit(q, 0, 0, 380, 260, dx, dy * 0.5 - 0.2, 0.3, 0.45);
    });
  }
  function jjxKneel(jo) {
    return K.cache('g05|jjx6k', 380, 280, LZ, (q) => {
      const o = Object.assign({}, jo, { pose: 'kneel', prop: 'none', facing: -1, light: [FX - JX + 190 + 10, FY - 70 - JY + 260] });
      F().draw(q, 'jiujianxian', 190, 260, JS, 2.0, o);
      const gp = F().points('jiujianxian', 190, 260, JS, 2.0, o).gourdMouth;
      if (gp) hideWaistGourd(q, gp, JS);
      const [dx, dy] = fireDir(JX, JY);
      fireLit(q, 0, 0, 380, 280, dx, dy * 0.5 - 0.2, 0.3, 0.45);
    });
  }
  // 阿奴高举抢来的葫芦（攥着葫芦颈，葫芦身在手下晃）
  function anuGourd(q, lx, ly, ss, t, wo, dk) {
    const f = F(), { ax, ay, ao } = armOffset('anu', lx, ly, ss, t, wo, 'swordUp');
    f.draw(q, 'anu', lx, ly, ss, t, Object.assign({}, wo, { part: 'back' }));
    f.draw(q, 'anu', ax, ay, ss, t, ao);
    if (dk > 0.75) return;
    const hp = f.points('anu', ax, ay, ss, t, ao).handN;
    q.globalAlpha = 1 - (dk || 0); gourd(q, hp[0], hp[1] - 2, 0.35 * Math.sin(t * 11), JS * 1.6); q.globalAlpha = 1;
  }
  function jjxHand() {
    let h = handMemo.get('jjx6hand');
    if (!h) { const p = F().points('jiujianxian', 180, 230, JS, 2.0, { pose: 'lie', prop: 'gourd', facing: 1 }); h = p.gourdMouth || p.handN; handMemo.set('jjx6hand', h); }
    return h;
  }
  function fireFront() {
    return K.cache('g05|firefront', W + 80, 200, 1, (g) => {
      const r = A.rng(91);
      g.lineCap = 'round';
      for (let i = 0; i < 90; i++) {
        const x = r() * (W + 80), edge = Math.min(1, Math.abs(x - 600) / 560), hh = (30 + r() * 90) * (0.4 + edge);
        if (r() > 0.3 + edge) continue;
        g.strokeStyle = `rgba(8,6,10,${0.75 + r() * 0.25})`; g.lineWidth = 2 + r() * 3;
        g.beginPath(); g.moveTo(x, 200); g.quadraticCurveTo(x + (r() - 0.5) * 20, 200 - hh * 0.6, x + (r() - 0.5) * 40, 200 - hh); g.stroke();
      }
    });
  }
  // =====================================================================
  // 15 第15句 · 隔窗听书：掌灯时分的余杭茶楼，窗纸上说书人拍醒木、听众前仰后合，最前面店小二的影子跟着比划
  // =====================================================================
  const WX0 = 300, WX1 = 980, WY0 = 222, WY1 = 530, WW = WX1 - WX0, WH = WY1 - WY0;
  const LAMP = [664, 430];   // 屋里油灯（窗纸上最亮处，在说书人右侧）
  const TABLE = [470, 492, 300];   // 桌面左端 x、桌面 y、桌长
  // 茶楼门面（缓存，含窗纸）：暮色天与远处屋脊、檐口瓦当、椽子、木柱板壁、半卷竹帘、竖招牌、窗台、冷紫湿石板街
  function teaFront() {
    return K.cache('g05|teafront7', W + 160, H + 40, 1, (g) => {
      g.translate(80, 20);
      const e = E(), u = e.util, r = A.rng(17);
      // 暮色天：上紫下粉，远处一线屋脊
      g.fillStyle = A.vgrad(g, -20, 122, [[0, '#1e1838'], [0.55, '#4e3462'], [1, '#9a5a70']]); g.fillRect(-80, -20, W + 160, 142);
      g.fillStyle = K.rad(g, 980, 120, 10, 420, [[0, 'rgba(255,170,130,0.35)'], [1, 'rgba(255,170,130,0)']]); g.fillRect(-80, -20, W + 160, 142);
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,240,220,${0.3 + 0.4 * r()})`; g.beginPath(); g.arc(-60 + r() * (W + 120), -10 + r() * 60, 0.5 + r() * 0.8, 0, TAU); g.fill(); }
      g.save(); g.translate(-40, 0); A.roofs(g, 124, '#2e2238', 9, 1); g.restore();
      // 屋面（仰看只见檐口一段瓦）
      g.fillStyle = A.vgrad(g, 96, 160, [[0, '#2a2430'], [1, '#18141c']]);
      g.beginPath(); g.moveTo(-80, 92); g.quadraticCurveTo(640, 118, W + 80, 92); g.lineTo(W + 80, 160); g.lineTo(-80, 160); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(150,120,160,0.35)'; g.lineWidth = 2;
      for (let x = -80; x < W + 80; x += 13) { g.beginPath(); g.moveTo(x, 104 + 0.000016 * (x - 640) * (x - 640)); g.lineTo(x + 2, 156); g.stroke(); }
      g.strokeStyle = 'rgba(255,190,150,0.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-80, 92); g.quadraticCurveTo(640, 118, W + 80, 92); g.stroke();
      for (let x = -74; x < W + 80; x += 13) { g.fillStyle = '#100c12'; g.beginPath(); g.arc(x, 160, 6, 0, PI); g.fill(); }
      // 檐下椽子，被灯笼和窗光照得发暖
      g.fillStyle = A.vgrad(g, 160, 194, [[0, '#2c1a12'], [1, '#4a2c1a']]); g.fillRect(-80, 160, W + 160, 34);
      for (let x = -76; x < W + 80; x += 22) { g.fillStyle = A.vgrad(g, 160, 190, [[0, '#1e120c'], [1, '#6a4428']]); g.fillRect(x, 160, 9, 30); g.fillStyle = '#7a5030'; g.fillRect(x, 186, 9, 4); }
      g.fillStyle = '#3a2214'; g.fillRect(-80, 190, W + 160, 14);
      g.fillStyle = '#8a5a32'; g.fillRect(-80, 190, W + 160, 2);
      // 板壁与柱
      g.fillStyle = A.vgrad(g, 204, 612, [[0, '#3a2418'], [1, '#2a1a12']]); g.fillRect(-80, 204, W + 160, 408);
      for (let x = -80; x < W + 80; x += 26) { g.strokeStyle = 'rgba(16,8,4,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, 204); g.lineTo(x, 612); g.stroke(); }
      for (const cx of [40, 262, 1018, 1240]) {
        g.fillStyle = K.lin(g, cx - 14, 0, cx + 14, 0, [[0, '#2a160c'], [0.4, '#6a4026'], [1, '#1e100a']]); g.fillRect(cx - 14, 194, 28, 418);
        g.fillStyle = '#1a0e08'; g.fillRect(cx - 18, 598, 36, 16);
      }
      // 左：门洞，竹帘半卷（帘子压暗一半），帘缝透出屋里的灯
      g.fillStyle = '#140a06'; g.fillRect(80, 236, 160, 376);
      g.fillStyle = A.vgrad(g, 236, 486, [[0, '#6a4a26'], [1, '#7e5830']]); g.fillRect(88, 242, 144, 244);
      for (let y = 244; y < 486; y += 4) { g.fillStyle = 'rgba(255,190,110,0.32)'; g.fillRect(88, y, 144, 1); g.fillStyle = 'rgba(40,24,10,0.5)'; g.fillRect(88, y + 2, 144, 1); }
      g.fillStyle = '#4a321a'; g.beginPath(); g.ellipse(160, 488, 74, 7, 0, 0, TAU); g.fill();
      g.fillStyle = A.vgrad(g, 494, 612, [[0, 'rgba(255,190,100,0.5)'], [1, 'rgba(120,70,30,0.2)']]); g.fillRect(90, 494, 140, 118);
      // 右：竖招牌“今日说书”
      g.fillStyle = '#1e120a'; g.fillRect(1084, 226, 74, 262);
      g.fillStyle = A.vgrad(g, 232, 482, [[0, '#d8c08a'], [1, '#b89a62']]); g.fillRect(1090, 232, 62, 250);
      u.glyphs(g, '今日说书', 1121, 357, 50, '#2a1608', { vertical: true });
      g.strokeStyle = '#1e120a'; g.lineWidth = 2; g.beginPath(); g.moveTo(1100, 204); g.lineTo(1100, 226); g.moveTo(1142, 204); g.lineTo(1142, 226); g.stroke();
      // 窗纸（烘进门面，省一次贴图）
      g.drawImage(paperTex(), WX0, WY0, WW, WH);
      // 窗下槛墙、窗台
      g.fillStyle = '#24160e'; g.fillRect(WX0 - 30, WY1, WW + 60, 14);
      g.fillStyle = '#7a4c2c'; g.fillRect(WX0 - 30, WY1, WW + 60, 3);
      g.fillStyle = A.vgrad(g, WY1 + 14, 612, [[0, '#2e1c12'], [1, '#1c120c']]); g.fillRect(WX0 - 20, WY1 + 14, WW + 40, 612 - WY1 - 14);
      for (let x = WX0; x < WX1; x += 85) { g.strokeStyle = 'rgba(120,80,40,0.25)'; g.lineWidth = 2; g.strokeRect(x + 6, WY1 + 24, 72, 44); }
      g.fillStyle = '#1a0e08'; g.fillRect(WX0 - 18, WY0 - 18, WW + 36, 18); g.fillRect(WX0 - 18, WY0 - 18, 18, WH + 18); g.fillRect(WX1, WY0 - 18, 18, WH + 18);
      // 街：冷紫的湿石板，近大远小；窗光、灯笼在石板上拉出暖色倒影
      g.fillStyle = A.vgrad(g, 612, 720, [[0, '#574266'], [0.5, '#3e3050'], [1, '#2a2036']]); g.fillRect(-80, 612, W + 160, 128);
      g.strokeStyle = 'rgba(16,10,24,0.55)'; g.lineWidth = 1.4;
      for (let k = 0; k < 6; k++) { const y = 616 + Math.pow(k / 6, 1.5) * 112; g.beginPath(); g.moveTo(-80, y); g.lineTo(W + 80, y); g.stroke(); }
      for (let k = -18; k <= 18; k++) { g.beginPath(); g.moveTo(640 + k * 44, 616); g.lineTo(640 + k * 110, 744); g.stroke(); }
      for (const [cx, w0, a0] of [[640, 330, 0.36], [160, 70, 0.26], [262, 26, 0.3], [1018, 26, 0.3]]) {
        const rg = g.createRadialGradient(cx, 616, 6, cx, 616, w0 * 1.3);
        rg.addColorStop(0, `rgba(255,170,90,${a0})`); rg.addColorStop(0.6, `rgba(255,140,70,${a0 * 0.3})`); rg.addColorStop(1, 'rgba(255,140,60,0)');
        g.save(); g.translate(cx, 616); g.scale(1, 0.3); g.translate(-cx, -616); g.fillStyle = rg; g.fillRect(cx - w0 * 1.4, 616, w0 * 2.8, w0 * 1.4); g.restore();
      }
      // 帘缝透出的灯光，一条条斜铺在门前石板上
      for (let k = 0; k < 9; k++) { const x0 = 96 + k * 16; g.fillStyle = 'rgba(255,186,110,0.12)'; g.beginPath(); g.moveTo(x0, 614); g.lineTo(x0 + 7, 614); g.lineTo(x0 - 30 + k * 4 + 16, 720); g.lineTo(x0 - 30 + k * 4, 720); g.closePath(); g.fill(); }
      for (let i = 0; i < 40; i++) { const x = WX0 + 40 + r() * (WW - 80), y = 622 + r() * 90; g.fillStyle = `rgba(255,${190 + r() * 40},140,${0.06 + r() * 0.14})`; g.fillRect(x, y, 20 + r() * 50, 1.5); }
    });
  }
  // 窗纸：暖色、带纸纹（缓存）
  function paperTex() {
    return K.cache('g05|paper7', WW, WH, 1, (g) => {
      const gr = g.createRadialGradient(LAMP[0] - WX0, LAMP[1] - WY0 - 30, 20, LAMP[0] - WX0, LAMP[1] - WY0 - 30, 520);
      gr.addColorStop(0, '#fff2c8'); gr.addColorStop(0.35, '#ffcf7e'); gr.addColorStop(0.75, '#f0a24a'); gr.addColorStop(1, '#c8742e');
      g.fillStyle = gr; g.fillRect(0, 0, WW, WH);
      const r = A.rng(5);
      for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(140,80,30,${0.04 + r() * 0.06})`; g.lineWidth = 0.6 + r(); const x = r() * WW, y = r() * WH, a = r() * PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (6 + r() * 20), y + Math.sin(a) * (6 + r() * 20)); g.stroke(); }
    });
  }
  // 窗格（缓存，透明底）：三扇格心，竖棂横棂，外框深木
  function latticeTex() {
    return K.cache('g05|lattice7', WW, WH, 1, (g) => {
      g.strokeStyle = '#24140a'; g.lineCap = 'butt';
      const panes = 3, pw = WW / panes;
      for (let p = 0; p < panes; p++) {
        const x0 = p * pw;
        g.lineWidth = 2.4;
        for (let i = 1; i < 6; i++) { const x = x0 + (i * pw) / 6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WH); g.stroke(); }
        for (let j = 1; j < 8; j++) { const y = (j * WH) / 8; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + pw, y); g.stroke(); }
        g.lineWidth = 3; g.strokeRect(x0 + 16, 16, pw - 32, WH - 32);
        g.lineWidth = 9; g.strokeStyle = '#1e100a'; g.beginPath(); g.moveTo(x0 + pw, 0); g.lineTo(x0 + pw, WH); g.stroke(); g.strokeStyle = '#24140a';
      }
      g.strokeStyle = 'rgba(255,200,120,0.18)'; g.lineWidth = 1;
      for (let p = 0; p < 3; p++) for (let i = 1; i < 6; i++) { const x = p * pw + (i * pw) / 6 + 1.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WH); g.stroke(); }
    });
  }
  // 街上一汪积水：倒映着窗纸与窗格（缓存，椭圆软边）
  const PUD = [646, 676, 380, 60];
  function puddleTex() {
    return K.cache('g05|puddle7', PUD[2], PUD[3], 1, (g) => {
      g.save(); g.translate(0, PUD[3]); g.scale(PUD[2] / WW, -PUD[3] / WH * 1.1);
      g.drawImage(paperTex(), 0, 0); g.globalAlpha = 0.9; g.drawImage(latticeTex(), 0, 0); g.restore();
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(70,40,70,0.35)'; g.fillRect(0, 0, PUD[2], PUD[3]);
      g.globalCompositeOperation = 'destination-in';
      g.save(); g.translate(PUD[2] / 2, PUD[3] / 2); g.scale(1, PUD[3] / PUD[2]);
      g.fillStyle = K.rad(g, 0, 0, PUD[2] * 0.25, PUD[2] / 2, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(-PUD[2] / 2, -PUD[2] / 2, PUD[2], PUD[2]);
      g.restore(); g.globalCompositeOperation = 'source-over';
    });
  }
  // 近景：左上一角飞檐（带风铃）——比门面多移 1.5 倍
  function eaveCorner() {
    return K.cache('g05|eave7', 460, 230, 1, (g) => {
      g.fillStyle = '#0e080c';
      g.beginPath(); g.moveTo(-10, -10); g.lineTo(380, -10); g.quadraticCurveTo(330, 40, 250, 70); g.quadraticCurveTo(160, 100, 60, 104); g.quadraticCurveTo(10, 112, -10, 120); g.closePath(); g.fill();
      // 翘起的檐角
      g.beginPath(); g.moveTo(240, 74); g.quadraticCurveTo(330, 60, 400, 4); g.quadraticCurveTo(372, 52, 300, 84); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,170,120,0.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(60, 104); g.quadraticCurveTo(160, 100, 250, 70); g.quadraticCurveTo(330, 60, 400, 4); g.stroke();
      for (let x = 20; x < 250; x += 16) { g.fillStyle = '#0a0608'; g.beginPath(); g.arc(x, 104 - (x - 20) * 0.14, 5, 0, PI); g.fill(); }
    });
  }
  // 影子缓冲（低分辨率，影子边自然发虚）
  const shBufs = {};
  function shadowBuf(name, k, x0 = WX0, x1 = WX1) {
    const S = (XYT.sprites && XYT.sprites.S) || 1;
    let b = shBufs[name];
    const pw = Math.round((x1 - x0) * S * k), ph = Math.round(WH * S * k);
    if (!b) { const cv = document.createElement('canvas'); b = shBufs[name] = { cv, q: cv.getContext('2d') }; }
    if (b.cv.width !== pw || b.cv.height !== ph) { b.cv.width = pw; b.cv.height = ph; }
    b.x0 = x0; b.w = x1 - x0;
    const q = b.q;
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, pw, ph);
    q.setTransform(S * k, 0, 0, S * k, -x0 * S * k, -WY0 * S * k);
    return b;
  }
  function flatten(b, col) {
    const q = b.q; q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, b.cv.width, b.cv.height); q.globalCompositeOperation = 'source-over';
  }
  // 两节手臂：肩→手（肘按 bend 向外弯），宽袖
  function arm2(q, s, h, L1, L2, bend, w) {
    let dx = h[0] - s[0], dy = h[1] - s[1], d = Math.hypot(dx, dy);
    const dm = L1 + L2 - 0.5; if (d > dm) { h = [s[0] + dx / d * dm, s[1] + dy / d * dm]; d = dm; }
    const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * Math.max(1, d)), -1, 1)), b0 = Math.atan2(dy, dx);
    const e = [s[0] + Math.cos(b0 + bend * a) * L1, s[1] + Math.sin(b0 + bend * a) * L1];
    q.lineCap = 'round'; q.lineJoin = 'round'; q.lineWidth = w; q.beginPath(); q.moveTo(s[0], s[1]); q.lineTo(e[0], e[1]); q.lineTo(h[0], h[1]); q.stroke();
    q.beginPath(); q.moveTo(e[0], e[1]); q.quadraticCurveTo((e[0] + h[0]) / 2 + w * 0.6, (e[1] + h[1]) / 2 + w * 1.6, h[0] - (h[0] - e[0]) * 0.15, h[1] + w * 0.7); q.lineTo(h[0], h[1]); q.closePath(); q.fill();
    return h;
  }
  // 听众：坐着的影子缓存成贴图，绕腰前仰后合
  function listenerTex(v, s, facing) {
    return K.cache('g05|lis7' + v + facing + s, 300, 320, 1, (q) => { F().draw(q, 'villager', 150, 300, s, 2.0, { pose: 'sit', variant: v, facing, tone: 'silhouette', ink: '#000000', wind: 0 }); });
  }
  const LIS = [[800, 574, 1.8, 0, -1, 0.3], [878, 566, 1.92, 1, -1, 1.7], [956, 580, 2.04, 2, -1, 0.9]];
  const BOY_POSES = [['swordUp', 1], ['swordPoint', -1], ['reach', 1], ['swordPoint', -1], ['swordUp', -1], ['lookBack', 1]];   // 剑招与朝向：刺剑总朝外，不戳着说书人
  XYT.registerShot('vb7_storyteller', {
    name: '隔窗听书', zone: 'top', night: true,
    text: '#f6ead0', shadow: 'rgba(24,10,6,0.92)', accent: '#ffb648', bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt, e = E(), v = V(), f = F();
      const C = [0.18, 0.46, 1.04, 1.68, 2.26, 2.7, 3.04].map((d, k) => ct(c, k, d));
      const per = c.b.period || 0.5;
      // 隔街横移 ±60；近景一角多移 1.5 倍
      const pan = lerp(60, -60, easeInOut(clamp((lt + 0.9) / (c.dur + 0.9))));
      const slam = lt >= C[0] ? Math.exp(-(lt - C[0]) / 0.18) : 0;
      const fl = 0.6 * noise1(t * 8, 2) + 0.4 * noise1(t * 21, 3);
      const flame = 0.86 + 0.14 * fl + 0.85 * slam + 0.12 * c.be(0.3);   // 醒木一落，灯焰一跳
      const laughK = up(lt, C[5], 0.12) * (1 - up(lt, c.dur + 0.2, 0.3));
      g.save(); g.translate(pan, 0);
      g.drawImage(teaFront(), -80, -20, W + 160, H + 40);
      // 窗纸上的灯晕（压在影子下面，影子挡得住）
      K.lighter(g, () => { softE(g, LAMP[0], LAMP[1] - 14, 300 * flame, 120 * flame, '#ffd890', 0.3 * flame); soft(g, LAMP[0], LAMP[1] - 4, 44 * flame, '#fff6dc', 0.55 * flame); });
      g.globalAlpha = 1;
      // ---- 远影（靠灯，大而虚）：说书人、桌、茶具、热气 ----
      const jit = (fl - 0.5) * 3 + slam * 7;
      const B1 = shadowBuf('soft', 0.42), q1 = B1.q;
      q1.fillStyle = '#000'; q1.strokeStyle = '#000';
      const SX = 560 + jit * 1.6, SY = 600, SS = 1.62, so = { pose: 'stand', facing: 1, prop: 'none', tone: 'silhouette', ink: '#000', wind: 0, lean: -0.04 + 0.03 * Math.sin(lt * 2.4) + 0.05 * slam, head: 0.06 * Math.sin(lt * 3.1) + 0.12 * slam };
      f.draw(q1, 'storyteller', SX, SY, SS, t, Object.assign({ part: 'back' }, so));
      const sp = spPts(SX, SY, SS, t, so), sh = sp.shoulderN;
      // 醒木：“再”之前高举（微微发抖），“再”字狠狠拍在桌上；之后醒木留在桌上，手随说书比划
      const gav = [652, TABLE[1] - 4];
      let hand;
      if (lt < C[0] - 0.1) hand = [sh[0] + 26 + 2 * Math.sin(t * 40), sh[1] - 92];
      else if (lt < C[0]) { const u = easeIn((lt - (C[0] - 0.1)) / 0.1); hand = [lerp(sh[0] + 26, gav[0], u), lerp(sh[1] - 92, gav[1] - 6, u)]; }
      else if (lt < C[0] + 0.32) hand = [gav[0], gav[1] - 6 - 10 * smooth((lt - C[0] - 0.18) / 0.14)];
      else {
        // 每拍一个手势：上扬 / 前指，拍点上落定
        const bx = c.b.x, n = Math.floor(bx), w = easeOut(clamp((bx - n) / 0.35));
        const P = (k) => (k % 2 ? [sh[0] + 64, sh[1] - 66] : [sh[0] + 82, sh[1] - 6]);
        const a0 = P(n - 1), a1 = P(n), k0 = smooth((lt - C[0] - 0.32) / 0.2);
        const hb = [lerp(a0[0], a1[0], w), lerp(a0[1], a1[1], w)];
        hand = [lerp(gav[0], hb[0], k0), lerp(gav[1] - 16, hb[1], k0)];
      }
      hand = arm2(q1, sh, hand, 32 * SS, 30 * SS, 1, 9 * SS);
      const holding = lt < C[0] + 0.2;
      // 醒木：举着时在手里，落下后留在桌上
      if (holding) { q1.save(); q1.translate(hand[0], hand[1]); q1.rotate(lt < C[0] ? -0.4 : 0); q1.fillRect(-6 * SS, -4 * SS, 14 * SS, 7 * SS); q1.restore(); }
      else q1.fillRect(gav[0] - 7 * SS, gav[1] - 7 * SS, 14 * SS, 7 * SS);
      // 折扇：远手举在胸前，按拍一摇
      const fa = -0.4 + 0.35 * Math.sin(c.b.x * PI) + 0.2 * c.be(0.3);
      const sf = sp.shoulderF, fh = arm2(q1, sf, [sf[0] + 26 * SS, sf[1] + 14 * SS], 26 * SS, 22 * SS, 1, 8 * SS);
      q1.beginPath(); q1.moveTo(fh[0], fh[1]); q1.arc(fh[0], fh[1], 30 * SS, fa - 1.9, fa - 0.4); q1.closePath(); q1.fill();
      // 桌与茶具：“再”字一拍，茶杯跳起
      q1.fillRect(TABLE[0], TABLE[1], TABLE[2], 12); q1.fillRect(TABLE[0] + 16, TABLE[1] + 12, 10, 40); q1.fillRect(TABLE[0] + TABLE[2] - 26, TABLE[1] + 12, 10, 40);
      const hop = lt >= C[0] ? 9 * Math.max(0, Math.sin(clamp((lt - C[0]) / 0.22) * PI)) : 0;
      q1.beginPath(); q1.ellipse(714, TABLE[1] - 12, 15, 11, 0, 0, TAU); q1.fill(); q1.fillRect(708, TABLE[1] - 26, 12, 6);
      q1.lineWidth = 4; q1.beginPath(); q1.moveTo(726, TABLE[1] - 14); q1.quadraticCurveTo(742, TABLE[1] - 22, 744, TABLE[1] - 32); q1.stroke();
      q1.save(); q1.translate(756, TABLE[1] - 2 - hop); q1.rotate(0.25 * Math.sin(clamp((lt - C[0]) / 0.22) * PI) * (lt >= C[0] ? 1 : 0)); q1.fillRect(-6, -9, 12, 9); q1.restore();
      // 茶壶口的热气：影子在纸上袅袅地扭；“再”字一震，热气一团冲起
      q1.lineCap = 'round';
      const puff = lt >= C[0] ? Math.exp(-(lt - C[0]) / 0.5) : 0;
      for (let k = 0; k < 2; k++) for (let i = 0; i < 12; i++) {
        const u0 = i / 12, u1 = (i + 1) / 12, wx = (u) => 744 + k * 8 + Math.sin(t * 2.2 + u * 7 + k * 2.4) * (12 + 20 * puff) * u, wy = (u) => TABLE[1] - 32 - u * (110 + 40 * puff);
        q1.globalAlpha = (0.32 + 0.3 * puff) * (1 - u0) * (k ? 0.7 : 1); q1.lineWidth = 5 + (6 + 14 * puff) * u0;
        q1.beginPath(); q1.moveTo(wx(u0), wy(u0)); q1.lineTo(wx(u1), wy(u1)); q1.stroke();
      }
      q1.globalAlpha = 1;
      // 听众（靠灯一侧，影子大而虚）：每拍前仰后合，“笑”字仰天大笑、拍桌子
      const laugh = 1 + 1.4 * laughK;
      for (let i = 0; i < LIS.length; i++) {
        const [x, y, s2, vv, fc, ph] = LIS[i];
        const rock = (0.13 * Math.sin(c.b.x * PI + ph) - 0.14 * c.be(0.35) * (0.6 + 0.4 * Math.sin(ph * 3))) * laugh - fc * 0.35 * laughK * (0.75 + 0.25 * Math.sin(t * 9 + ph));
        const img = listenerTex(vv, s2, fc), px = x + jit, py = y - 46 * s2;
        q1.save(); q1.translate(px, py); q1.rotate(rock); q1.drawImage(img, -150, -300 + 46 * s2, 300, 320); q1.restore();
        if (i === 0 && laughK > 0.01) {
          // 笑得拍桌子：每拍一巴掌拍在桌沿
          const ca = Math.cos(rock), sa = Math.sin(rock), sx0 = px + (-8 * s2) * ca - (-50 * s2) * sa, sy0 = py + (-8 * s2) * sa + (-50 * s2) * ca;
          const down = c.be(0.18);
          arm2(q1, [sx0, sy0], [TABLE[0] + TABLE[2] - 10, lerp(TABLE[1] - 64, TABLE[1] - 2, down)], 26 * s2, 24 * s2, -1, 7 * s2);
        }
      }
      flatten(B1, '#2a1406');
      // ---- 近影（贴窗，清楚）：店小二 ----
      const B2 = shadowBuf('crisp', 0.8, WX0, 720), q2 = B2.q;
      q2.fillStyle = '#000'; q2.strokeStyle = '#000';
      // 店小二：最前面，比说书人慢半拍学他的手势；拍前一蹲、拍后一冲
      const bxh = c.b.x - 0.5, nb = Math.floor(bxh), frb = bxh - nb, sinceB = frb * per, untilB = (1 - frb) * per;
      const bp0 = BOY_POSES[((nb % 6) + 6) % 6];
      let pose = lt < 0.05 ? 'stand' : bp0[0], face = lt < 0.05 ? 1 : bp0[1], dy = 0, lean = 0.05 * Math.sin(lt * 5), jump = 0;
      const mimic = C[0] + per * 0.5;   // 学说书人拍醒木
      if (lt > mimic - 0.1 && lt < mimic + 0.3) { pose = 'reach'; face = 1; dy += 8; }
      dy += 6 * smooth(1 - untilB / 0.1); lean += -0.1 * smooth(1 - untilB / 0.1) + 0.14 * Math.exp(-sinceB / 0.1) * (lt > 0.05 ? 1 : 0);
      if (lt > C[5] - 0.12) {
        // “笑传”：一蹲，抱膝跳起，落地亮相
        const u = clamp((lt - C[5]) / (C[6] - C[5]));
        if (lt < C[5]) { dy = 12 * smooth((lt - (C[5] - 0.12)) / 0.12); pose = 'swordUp'; face = 1; lean = -0.12; }
        else if (u < 1) { jump = 110 * Math.sin(u * PI); pose = 'kneel'; face = -1; dy = 0; lean = 0.15; }
        else { const a = lt - C[6]; pose = 'swordPoint'; face = -1; lean = 0.1; dy = 10 * Math.exp(-a / 0.1) * (a < 0.4 ? 1 : 0); }
      }
      const BX = 440 + jit * 0.6, BY = 528 + dy - jump, BS = 1.4;
      const bo = { pose, stage: 'youth', facing: face, prop: 'sword', tone: 'silhouette', ink: '#000', wind: 0.3 + 0.5 * (jump > 0 ? 1 : 0), lean };
      f.draw(q2, 'xiaoyao', BX, BY, BS, t, bo);
      // 抹布：“笑”字前搭在肩上，“笑”字甩飞，翻着跟头落下
      const bp = f.points('xiaoyao', BX, BY, BS, t, bo), shN = bp.shoulderN;
      if (lt < C[5] + 0.02) {
        const sw = 3 * Math.sin(t * 6);
        q2.beginPath(); q2.moveTo(shN[0] - 12, shN[1] - 4); q2.lineTo(shN[0] + 10, shN[1] - 5); q2.lineTo(shN[0] + 14 + sw, shN[1] + 26); q2.lineTo(shN[0] + 4 + sw, shN[1] + 28); q2.lineTo(shN[0] - 2, shN[1] + 6); q2.lineTo(shN[0] - 10 + sw * 0.6, shN[1] + 34); q2.lineTo(shN[0] - 20 + sw * 0.6, shN[1] + 30); q2.closePath(); q2.fill();
      } else {
        const a = lt - C[5], s0 = f.points('xiaoyao', 440, 540, BS, t - a, { pose: 'swordUp', stage: 'youth', facing: 1, prop: 'sword', lean: -0.12 }).shoulderN;
        const tx = s0[0] - 240 * a, ty = s0[1] - 380 * a + 760 * a * a, rot = -a * 7;
        const cr = Math.cos(rot), sr = Math.sin(rot), P = (x, y) => [tx + x * cr - y * sr, ty + x * sr + y * cr];
        const f1 = 6 * Math.sin(a * 26), f2 = 6 * Math.sin(a * 22 + 1.3);
        const pts = [P(-25, -11 + f1), P(25, -11 - f2), P(25 + f1 * 0.5, 11 + f2), P(-25, 11 - f1)];
        q2.beginPath(); q2.moveTo(pts[0][0], pts[0][1]); q2.quadraticCurveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2 - 4, pts[1][0], pts[1][1]); for (let i = 2; i < 4; i++) q2.lineTo(pts[i][0], pts[i][1]); q2.closePath(); q2.fill();
      }
      flatten(B2, '#1c0c04');
      // 合成到窗纸上（缓冲本身就是窗纸大小，不用裁切）
      g.globalAlpha = 0.95; g.drawImage(B1.cv, WX0, WY0, WW, WH);
      g.globalAlpha = 0.92; g.drawImage(B2.cv, B2.x0, WY0, B2.w, WH);
      g.globalAlpha = 1;
      // 灯芯一点亮（在影子之上，淡淡的）
      K.lighter(g, () => soft(g, LAMP[0], LAMP[1], 26 * flame, '#ffe8b0', 0.28 * flame));
      g.globalAlpha = 1;
      g.drawImage(latticeTex(), WX0, WY0, WW, WH);
      // 窗光漫到檐下与街上（随灯焰明暗）
      K.lighter(g, () => { softE(g, 640, 650, 420, 66, '#ff9a48', 0.14 * flame); softE(g, 640, 196, 520, 36, '#ffb060', 0.12 * flame); });
      g.globalAlpha = 1;
      // 积水里的窗影：随拍起涟漪
      const pd = puddleTex(), rip = c.be(0.4), sl = 6, hh = PUD[3] / sl;
      for (let i = 0; i < sl; i++) {
        const ox = (2 + 5 * rip) * Math.sin(t * 3.1 + i * 1.3), sx = pd.width / PUD[2];
        g.globalAlpha = 0.8; g.drawImage(pd, 0, i * hh * sx, pd.width, hh * sx, PUD[0] - PUD[2] / 2 + ox, PUD[1] - PUD[3] / 2 + i * hh, PUD[2], hh + 0.5);
      }
      g.globalAlpha = 1;
      const ra = c.b.since || 0;
      if (ra < 0.9) { const u = ra / 0.9; g.strokeStyle = `rgba(255,214,160,${0.35 * (1 - u) * (c.b.str ?? 1)})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(PUD[0] - 60, PUD[1] + 4, 14 + 90 * u, 3 + 14 * u, 0, 0, TAU); g.stroke(); }
      // 檐下灯笼，随拍轻摆，“笑”字甩得更欢
      const sw = 0.05 * Math.sin(c.b.x * PI) + 0.07 * c.be(0.5) + 0.15 * laughK * Math.sin(t * 7);
      e.lantern(g, { x: 262, y: 204, s: 2.1, t, seed: 3, swing: 0.03, tilt: sw, cord: 14, text: '茶', glowColor: '#ff9a4a' });
      e.lantern(g, { x: 1018, y: 204, s: 2.1, t, seed: 8, swing: 0.03, tilt: -sw * 0.8, cord: 14, text: '书', glowColor: '#ff9a4a' });
      g.restore();
      // 近景：左上飞檐一角、右边一根挂灯的木柱（比门面移得快，拉开纵深）
      const fx = pan * 2.5;
      g.drawImage(eaveCorner(), -60 + fx * 0.6, -14, 460, 230);
      const px = 1292 + fx;
      if (px < W + 90) {
        g.fillStyle = K.lin(g, px - 16, 0, px + 16, 0, [[0, '#0c0608'], [0.6, '#2a1810'], [1, '#0c0608']]); g.fillRect(px - 16, 0, 32, H);
        g.fillStyle = '#0c0608'; g.fillRect(px, 296, 72, 9);
        e.lantern(g, { x: px + 58, y: 305, s: 1.5, t, seed: 11, swing: 0.05, tilt: 0.6 * sw, cord: 10, color: '#c8302a', glowColor: '#ff8a40' });
      }
      // 灯下飞蛾、暮色里的浮尘
      v.fireflies(g, c, { n: 8, area: [160, 160, 1120, 340], color: '#ffd8a0', core: '#fff4dc', size: 0.5, trail: 2, speed: 2, alpha: 0.7, seed: 21 });
      v.dust(g, c, { n: 30, area: [0, 540, W, H], size: [1, 2.4], color: '#ffd8a8', alpha: 0.3, seed: 4 });
    },
  });
  function spPts(SX, SY, SS, t, so) { return F().points('storyteller', SX, SY, SS, t, so); }
  // =====================================================================
  // 16 第16句 · 醉卧入梦：满月下余杭客栈的屋脊，酒剑仙与少年并卧；杯落、天翻成墨色云涡、少年飘起，云涡吞没镜头，白闪接副歌
  // =====================================================================
  const MX = 900, MY = 170;    // 满月
  const RIDGE = 520, EAVE = 690;   // 近处客栈屋顶：正脊、檐口
  // 远处层层屋瓦与近处客栈屋顶（缓存成一张；世界坐标 y 380..760）
  function roofScene() {
    return K.cache('g05|roofscene8', W + 160, 380, 1, (g0) => {
      // 远处屋瓦先画进临时画布，再微糊一下贴回（滤镜只在建贴图时用一次）
      const tmp = document.createElement('canvas'); tmp.width = g0.canvas.width; tmp.height = g0.canvas.height;
      const g = tmp.getContext('2d'), S0 = tmp.width / (W + 160);
      g.scale(S0, S0); g.translate(80, -380);
      const e = E();
      e.mountains(g, { t: 0, lightDir: 1, layers: [{ kind: 'far', color: '#26325a', light: '#6a80c0', litA: 0.45, y: 548, scaleY: 0.26, seed: 3, offset: 200, occlude: '#2c3a64', fog: '#3e4e80', fogA: 0.5 }] });
      e.jiangnanTown(g, { t: 0, y: 586, scale: 0.42, color: '#4c5a86', roof: '#161c30', haze: '#34426e', hazeA: 0.45, lit: 0.5, seed: 11, smoke: 0, bank: false, lightColor: '#ffb060' });
      e.mist(g, { t: 0, y: 590, h: 60, color: '#4a5a8c', alpha: 0.5, seed: 3 });
      e.jiangnanTown(g, { t: 0, y: 650, scale: 0.62, color: '#4a5886', roof: '#10142a', haze: '#34426e', hazeA: 0.3, lit: 0.6, seed: 4, smoke: 0, bank: false, lightColor: '#ffb060', light: '#a8b8e8', lightX: MX });
      e.mist(g, { t: 0, y: 660, h: 70, color: '#3e4e80', alpha: 0.5, seed: 6 });
      e.jiangnanTown(g, { t: 0, y: 742, scale: 0.85, color: '#46527c', roof: '#0a0e1e', haze: '#2a3458', hazeA: 0.2, lit: 0.5, seed: 9, smoke: 0, bank: false, lightColor: '#ffa850', light: '#9fb0e0', lightX: MX });
      e.mist(g, { t: 0, y: 730, h: 80, color: '#3a4a7c', alpha: 0.35, seed: 8 });
      g0.save(); g0.setTransform(1, 0, 0, 1, 0, 0);
      try { g0.filter = `blur(${(1.1 * S0).toFixed(2)}px)`; } catch (err) { /* 不支持滤镜就不糊 */ }
      g0.drawImage(tmp, 0, 0); g0.filter = 'none'; g0.restore();
      // 近处客栈屋顶：正脊横过画面，屋面一垄垄筒瓦朝镜头斜下，檐口一排瓦当；右端翘角
      g0.save(); g0.translate(80, -380);
      const g1 = g0, x1 = 780;
      g1.beginPath(); g1.moveTo(-80, RIDGE); g1.lineTo(x1, RIDGE); g1.quadraticCurveTo(x1 + 70, RIDGE + 90, x1 + 110, EAVE - 30); g1.quadraticCurveTo(x1 + 130, EAVE - 46, x1 + 150, EAVE - 70);
      g1.quadraticCurveTo(x1 + 132, EAVE - 6, x1 + 96, EAVE + 6); g1.lineTo(-80, EAVE + 8); g1.closePath();
      g1.fillStyle = A.vgrad(g1, RIDGE, EAVE + 8, [[0, '#1c2236'], [0.6, '#151a2c'], [1, '#0c0f1c']]); g1.fill();
      g1.save(); g1.clip();
      // 筒瓦垄：近大远小地向下张开，朝月一侧一线冷光
      for (let i = -12; i < 40; i++) {
        const xt = i * 22, xb = xt * 1.18 - 40;
        g1.strokeStyle = 'rgba(6,8,14,0.85)'; g1.lineWidth = 6; g1.beginPath(); g1.moveTo(xt, RIDGE + 6); g1.lineTo(xb, EAVE + 10); g1.stroke();
        g1.strokeStyle = `rgba(160,180,230,${0.1 + 0.22 * clamp((xt + 80) / 900)})`; g1.lineWidth = 1.5; g1.beginPath(); g1.moveTo(xt + 4, RIDGE + 8); g1.lineTo(xb + 5, EAVE + 10); g1.stroke();
      }
      // 横向瓦行（杯子顺着它们一级级滚下去）
      for (let k = 1; k < 7; k++) { const y = RIDGE + 8 + k * ((EAVE - RIDGE - 8) / 7); g1.strokeStyle = 'rgba(4,6,12,0.5)'; g1.lineWidth = 1.4; g1.beginPath(); g1.moveTo(-80, y); g1.lineTo(x1 + 140, y); g1.stroke(); g1.strokeStyle = 'rgba(150,170,220,0.12)'; g1.lineWidth = 1; g1.beginPath(); g1.moveTo(-80, y + 2); g1.lineTo(x1 + 140, y + 2); g1.stroke(); }
      g1.fillStyle = K.lin(g1, 200, 0, x1 + 60, 0, [[0, 'rgba(140,160,220,0)'], [1, 'rgba(160,180,240,0.14)']]); g1.fillRect(-80, RIDGE, x1 + 240, EAVE - RIDGE + 20);
      g1.restore();
      // 正脊：一道厚脊，脊背受月光
      g1.fillStyle = A.vgrad(g1, RIDGE - 16, RIDGE + 8, [[0, '#2c3250'], [1, '#0e111c']]);
      g1.beginPath(); g1.moveTo(-80, RIDGE - 14); g1.lineTo(x1 - 30, RIDGE - 14); g1.quadraticCurveTo(x1 + 14, RIDGE - 16, x1 + 38, RIDGE - 62); g1.quadraticCurveTo(x1 + 44, RIDGE - 32, x1 + 24, RIDGE + 6); g1.lineTo(-80, RIDGE + 8); g1.closePath(); g1.fill();
      g1.strokeStyle = 'rgba(206,218,255,0.6)'; g1.lineWidth = 1.6; g1.beginPath(); g1.moveTo(-80, RIDGE - 14); g1.lineTo(x1 - 30, RIDGE - 14); g1.quadraticCurveTo(x1 + 14, RIDGE - 16, x1 + 38, RIDGE - 62); g1.stroke();
      for (let x = -70; x < x1 - 30; x += 18) { g1.fillStyle = 'rgba(180,196,240,0.12)'; g1.fillRect(x, RIDGE - 12, 9, 3); }
      // 檐口：一排瓦当（圆头上一圈冷光）
      for (let x = -70; x < x1 + 100; x += 19) {
        const y = EAVE + 4 - Math.max(0, x - x1 + 20) * 0.3;
        g1.fillStyle = '#0a0d18'; g1.beginPath(); g1.arc(x, y, 8.5, 0, TAU); g1.fill();
        g1.strokeStyle = 'rgba(190,206,250,0.45)'; g1.lineWidth = 1.2; g1.beginPath(); g1.arc(x, y, 7, PI * 1.05, PI * 1.85); g1.stroke();
        g1.fillStyle = '#070910'; g1.beginPath(); g1.moveTo(x + 6, y + 6); g1.lineTo(x + 13, y + 6); g1.lineTo(x + 9.5, y + 13); g1.closePath(); g1.fill();
      }
      g1.restore();
    });
  }
  // 墨色云涡贴图：几条长长的、两头收尖的墨笔旋臂（墨心、蓝灰云身，朝月一侧镀银边）；外圈几道星轨
  function inkVortex() {
    return K.cache('g05|inkvortex8', 1000, 1000, 0.5, (g) => {
      const cx = 500, cy = 500, r = A.rng(9), arms = 4;
      // 底：被月光照亮的一盘薄云（中心亮、外缘散开），墨笔才看得出
      g.fillStyle = K.rad(g, cx, cy, 40, 500, [[0, 'rgba(176,192,240,0.75)'], [0.35, 'rgba(110,128,190,0.5)'], [0.7, 'rgba(60,74,130,0.25)'], [1, 'rgba(40,50,100,0)']]);
      g.fillRect(0, 0, 1000, 1000);
      const arm = (base, turns, r0, r1, w0, wMax, col, a, inner) => {
        const N = 60, L = [], R = [], E = [];
        for (let i = 0; i <= N; i++) {
          const u = i / N, th = base + u * turns * TAU, rr = r0 + (r1 - r0) * Math.pow(u, 1.05);
          const w = w0 + wMax * Math.pow(Math.sin(PI * Math.pow(u, 0.75)), 1.3);
          const px = cx + Math.cos(th) * rr, py = cy + Math.sin(th) * rr, nx = Math.cos(th), ny = Math.sin(th);
          L.push([px - nx * w * 0.5, py - ny * w * 0.5]); R.push([px + nx * w * 0.5, py + ny * w * 0.5]); E.push([px - nx * w * 0.5, py - ny * w * 0.5, w]);
        }
        g.fillStyle = col; g.globalAlpha = a; g.beginPath(); g.moveTo(L[0][0], L[0][1]);
        for (const p of L) g.lineTo(p[0], p[1]);
        for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
        g.closePath(); g.fill();
        if (inner) {
          // 朝月（向内）一侧的银边：分段描，粗细随笔身
          g.strokeStyle = '#cdd8f6'; g.lineCap = 'round';
          for (let i = 1; i < E.length; i++) { const w = E[i][2]; g.globalAlpha = inner * Math.min(1, w / 40); g.lineWidth = 1 + w * 0.03; g.beginPath(); g.moveTo(E[i - 1][0], E[i - 1][1]); g.lineTo(E[i][0], E[i][1]); g.stroke(); }
        }
        g.globalAlpha = 1;
      };
      for (let k = 0; k < arms; k++) {
        const b = (k / arms) * TAU + r() * 0.3;
        arm(b, 0.95, 70, 520, 6, 120, '#26305a', 0.45, 0);           // 淡墨云身（宽）
        arm(b + 0.05, 0.92, 74, 500, 4, 64, '#101530', 0.78, 0.6);   // 墨心 + 朝月银边
        arm(b + 0.38, 0.7, 120, 470, 2, 22, '#0c1028', 0.6, 0.3);    // 一道细笔
      }
      // 外圈星轨
      g.lineCap = 'round';
      for (let k = 0; k < 26; k++) {
        const base = r() * TAU, len = 0.5 + r() * 1.1, r0 = 400 + r() * 90;
        g.strokeStyle = `rgba(${200 + r() * 40},${210 + r() * 30},255,${0.16 + r() * 0.22})`; g.lineWidth = 1 + r() * 1.8;
        g.beginPath(); g.arc(cx, cy, r0, base, base + len); g.stroke();
      }
    });
  }
  // 酒剑仙侧卧在正脊上（头朝少年，一膝支起）：四档头部角度，打鼾时轮着用；整体罩一层冷月色
  function jjxRoof(k) {
    return K.cache('g05|jjxroof8|' + k, 420, 220, 1, (q) => {
      F().draw(q, 'jiujianxian', 210, 196, 1.25, 2.0, { pose: 'lie', prop: 'none', facing: -1, wind: 0.15, rim: '#dfe8ff', light: [MX - JXr + 210, MY - JYr + 196], rimAlpha: 0.85, head: -0.04 + 0.035 * k });
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = K.lin(q, 420, 0, 0, 220, [[0, 'rgba(150,170,230,0.2)'], [0.5, 'rgba(60,76,130,0.28)'], [1, 'rgba(20,26,56,0.42)']]); q.fillRect(0, 0, 420, 220);
      q.globalCompositeOperation = 'source-over';
    });
  }
  const JXr = 300, JYr = RIDGE - 12;          // 酒剑仙（正脊上）
  const BXr = 590, BYr = RIDGE + 46, BSr = 1.3; // 少年（下一行瓦上）
  // 青瓷酒杯（k 为放大倍数）：杯里一汪酒
  function wineCup(g, x, y, ang, k, full) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(k, k);
    const gr = g.createLinearGradient(-6, 0, 6, 0); gr.addColorStop(0, '#cfe8dc'); gr.addColorStop(0.55, '#8fbfae'); gr.addColorStop(1, '#4f7c70');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-6, -8); g.lineTo(6, -8); g.quadraticCurveTo(5, -1, 2.6, 0); g.lineTo(-2.6, 0); g.quadraticCurveTo(-5, -1, -6, -8); g.closePath(); g.fill();
    g.fillStyle = '#3c5e56'; g.fillRect(-2.2, 0, 4.4, 1.6);
    g.fillStyle = full ? '#c8a860' : '#1e3430'; g.beginPath(); g.ellipse(0, -8, 6, 1.7, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(230,246,240,0.8)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-5, -7); g.lineTo(-3.6, -1.6); g.stroke();
    g.restore();
  }
  // 歌曲时间 T 所在的拍序号
  function beatAt(c, T) { let i = c.b.i; if (!c.grid) return i; while (i > 0 && c.grid.time(i) > T) i--; while (c.grid.time(i + 1) <= T) i++; return i; }
  XYT.registerShot('vb8_drunkroof', {
    name: '醉卧入梦', zone: 'left', night: true,
    text: '#e9f1f6', shadow: 'rgba(8,10,26,0.92)', accent: '#eacd76', bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = c.lt, e = E(), f = F();
      const C0 = ct(c, 0, 0.18), C1 = ct(c, 1, 0.54), C2 = ct(c, 2, 1.4), GAP = 3.51, END = c.dur, T00 = c.t - c.lt;
      if (lt > END - 0.04) { g.fillStyle = '#fffffc'; g.fillRect(0, 0, W, H); return; }
      // 镜头：“醉”字一推（1.0→1.06，对着杯子），之后缓推；空拍后仰起、冲向月心（≤1.3）
      const swallow = easeIn(clamp((lt - GAP) / (END - 0.2 - GAP)));
      const zDrunk = 1 + 0.06 * easeOut(up(lt, C0, 0.6));
      const z = zDrunk * lerp(1, 1.06, easeInOut(clamp(lt / GAP))) + 0.2 * swallow;
      const cxz = lerp(500, MX, 0.25 * smooth(lt / GAP) + 0.75 * swallow), cyz = lerp(600, MY, 0.25 * smooth(lt / GAP) + 0.75 * swallow);
      const tilt = 320 * smooth((lt - GAP) / (END - GAP - 0.25));
      g.save(); g.translate(cxz, cyz + tilt); g.scale(z, z); g.translate(-cxz, -cyz);
      // 夜空：云涡张满后只铺底色
      if (swallow < 0.45) e.sky(g, { stops: [[0, '#070a1c'], [0.4, '#0a0f26'], [0.72, '#1c2a52'], [1, '#3e4e80']], y0: -480, y1: 560 });
      else { g.fillStyle = '#0c1230'; g.fillRect(-400, -800, W + 800, H + 1200); }
      // 星：“梦”字起拉成绕月的细线（三组，一组一笔）
      const sw = Math.max(0, lt - C1), spin = 0.05 * sw + 0.11 * sw * sw;
      const tw = 0.85 + 0.15 * Math.sin(t * 2.3);
      if (swallow < 0.5) K.lighter(g, () => {
        g.lineCap = 'round';
        for (let grp = 0; grp < 3; grp++) {
          g.strokeStyle = `rgba(228,234,255,${(0.35 + 0.22 * grp) * tw})`; g.lineWidth = grp === 2 ? 1.8 : 1.1;
          g.beginPath();
          for (let i = grp; i < 51; i += 3) {
            const ang = h2(i, 101) * TAU, rr = 80 + Math.pow(h2(i, 102), 0.8) * 760;
            const sx = MX + Math.cos(ang) * rr, sy = MY + Math.sin(ang) * rr * 0.92;
            if (sy > 540 || sx < -60 || sx > W + 60) continue;
            const da = Math.min(1.7, spin * (300 / (rr + 120)) * (0.6 + 0.8 * h2(i, 105)));
            if (da < 0.004) { g.moveTo(sx - 0.7, sy); g.lineTo(sx + 0.7, sy); }
            else { g.moveTo(MX + Math.cos(ang - da) * rr, MY + Math.sin(ang - da) * rr * 0.92); g.ellipse(MX, MY, rr, rr * 0.92, 0, ang - da, ang); }
          }
          g.stroke();
        }
      });
      // 墨色云涡：以月为心翻卷，越转越快，空拍时张满整个画面
      const vk = up(lt, C1, 1.2), vr = lerp(0.4, 0.82, easeOut(clamp((lt - C1) / 2.6))) + 1.9 * swallow;
      if (vk > 0.01) {
        const rot = -(0.12 * sw + 0.09 * sw * sw);
        g.save(); g.translate(MX, MY); g.rotate(rot); g.scale(vr, vr * 0.92);
        g.globalAlpha = Math.min(1, vk * (0.88 + 0.12 * c.be(0.4)));
        g.drawImage(inkVortex(), -500, -500, 1000, 1000);
        g.globalAlpha = 1; g.restore();
      }
      // 满月（压在云涡中心），拍点时晕光一涨
      e.moon(g, { x: MX, y: MY, r: 62, color: '#f6efd6', haze: '#8fa6e0', glow: 0.55 + 0.25 * c.de(0.8) + 0.4 * swallow, spread: 4 });
      const roofsIn = tilt < 200;   // 镜头仰起后屋顶出画，不再画
      if (roofsIn) g.drawImage(roofScene(), -80, 380, W + 160, 380);
      // ---- 人物 ----
      const LM = [MX, MY];
      // 酒剑仙：鼾声一呼一吸（两拍一回），头跟着点，呼气时口边一团白气
      const sn = 0.5 + 0.5 * Math.sin(c.b.x * PI * 0.5 + 0.6), hk = Math.min(3, Math.floor(sn * 4));
      if (roofsIn) {
        g.drawImage(jjxRoof(hk), JXr - 210, JYr - 196, 420, 220);
        // 葫芦横倒在脊边，酒顺着一条瓦沟流下去
        const gx = JXr + 96, gy = RIDGE + 2;
        gourd(g, gx, gy, 1.3, 1.9);
        const tx0 = gx + 3, ty0 = gy + 4, tx1 = tx0 + 24, ty1 = EAVE + 2;
        g.strokeStyle = 'rgba(200,216,255,0.42)'; g.lineWidth = 1.6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(tx0, ty0); g.quadraticCurveTo(tx0 + 6, (ty0 + ty1) / 2, tx1 + Math.sin(t * 3) * 1.2, ty1); g.stroke();
        K.lighter(g, () => {
          for (let i = 0; i < 5; i++) { const u = (t * 0.9 + i / 5) % 1, x = lerp(tx0, tx1, u) + 6 * Math.sin(u * PI) * 0.5, y = lerp(ty0, ty1, u); soft(g, x, y, 3.2, '#e6eeff', 0.85 * Math.sin(u * PI)); }
          softE(g, tx1 + 2, ty1 + 3, 14 + 3 * Math.sin(t * 2), 3.5, '#c8d6ff', 0.45);
          // 呼气：一团白气从嘴边升起、散开
          const ex = clamp(-Math.cos(c.b.x * PI * 0.5 + 0.6)), ph = (c.b.x * 0.25 + 0.15) % 1;
          const jm = jjxMouth();
          soft(g, JXr - 210 + jm[0] + 8 + 14 * ph, JYr - 196 + jm[1] - 10 - 34 * ph, 15 + 14 * ph, '#d4defc', 0.3 * ex * (1 - ph));
        });
        g.globalAlpha = 1;
      }
      // 少年：“中”字后轻轻离开瓦面，头朝上斜起；一拍上换成伸手向月；空拍时被吸进月光
      const lift = easeInOut(clamp((lt - C2) / 2.3)), drift = Math.max(0, lt - C2);
      const sk = smooth((lt - GAP) / (END - GAP - 0.15));
      const tReach = c.grid ? c.grid.time(beatAt(c, T00 + 2.45) + 1) - T00 : 2.6;
      const reach = lt >= tReach;
      const YX = lerp(BXr + 120 * lift, MX - 40, sk), YY = lerp(BYr - 210 * lift - 8 * Math.sin(drift * 1.8) * lift, MY + 50, sk);
      const ang = reach ? lerp(-0.25, 0.1, smooth((lt - tReach) / 0.6)) : -0.5 * lift + 0.04 * Math.sin(drift * 1.3) * lift;
      const ys = 1.3 * (1 - 0.6 * sk);
      // 腰间两条飘带卷向云涡
      if (lift > 0.02 && roofsIn) {
        const wp = [YX + (reach ? -10 : 0), YY - (reach ? 70 : 24) * ys];
        g.lineCap = 'round';
        for (let k = 0; k < 2; k++) {
          const L = (160 + 60 * k) * lift, ph = t * 2.2 + k * 1.7;
          g.strokeStyle = k ? 'rgba(170,200,255,0.5)' : 'rgba(120,150,230,0.55)'; g.lineWidth = 3 - k;
          g.beginPath(); g.moveTo(wp[0], wp[1]);
          for (let i = 1; i <= 12; i++) { const u = i / 12, a = -0.6 - u * 2.2 + 0.25 * Math.sin(ph + u * 5); g.lineTo(wp[0] - L * u * 0.5 + Math.cos(a) * 30 * u, wp[1] - L * u * 0.35 + Math.sin(a) * 26 * u + 12 * Math.sin(ph + u * 4)); }
          g.stroke();
        }
      }
      g.save(); g.translate(YX, YY); g.rotate(ang);
      if (lift > 0.02) { K.lighter(g, () => softE(g, reach ? 20 * ys : 0, -(reach ? 80 : 30) * ys, (reach ? 110 : 120) * ys, (reach ? 90 : 50) * ys, '#9fb4f0', 0.3 * lift)); g.globalAlpha = 1; }
      if (reach) f.draw(g, 'xiaoyao', 0, 0, ys, t, { pose: 'fall', facing: -1, wind: 1.0, windDir: -1 });
      else if (lift > 0.02) f.draw(g, 'xiaoyao', 0, 0, ys, t, { pose: 'lie', facing: -1, wind: 0.25 + 0.75 * lift, windDir: -1 });
      else g.drawImage(boyRest(), -200, -170, 400, 200);
      g.restore();
      // 换姿势的那一拍：一圈光屑
      const ra = lt - tReach;
      if (ra > 0 && ra < 0.7) K.lighter(g, () => { for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU, d = 20 + 160 * easeOut(ra / 0.7); soft(g, YX + Math.cos(an) * d, YY - 60 + Math.sin(an) * d * 0.7, 3 + 2 * h2(i, 141), '#e0e8ff', 0.8 * (1 - ra / 0.7)); } });
      // 杯子：“醉”字从他指间滑落，顺着瓦行一级级滚下，拍点上弹两下，洒出一弧银酒，停在檐口瓦当上
      if (roofsIn) {
        const hp = boyHand(), ca = lt - C0;
        const b0 = beatAt(c, T00 + C0 + 0.24), tb1 = c.grid ? c.grid.time(b0 + 1) - T00 : C0 + 0.4, tb2 = c.grid ? c.grid.time(b0 + 2) - T00 : C0 + 0.8, tEnd = tb2 + 0.32;
        const yS = BYr + 44, y1 = yS + 28, y2 = y1 + 24, yE = EAVE - 6;
        let cx2 = hp[0] + 4, cy2 = hp[1] + 2, cr = 0.2;
        if (ca > 0) {
          if (lt < C0 + 0.22) { const u = (lt - C0) / 0.22; cx2 = hp[0] + 4 - 14 * u; cy2 = lerp(hp[1] + 2, yS, u * u); cr = 0.2 + 1.6 * u; }
          else if (lt < tb1) { const u = clamp((lt - C0 - 0.22) / (tb1 - C0 - 0.22)); cx2 = hp[0] - 6 - 14 * u; cy2 = lerp(yS, y1, u) - 22 * Math.sin(u * PI); cr = 1.5 + 3.2 * u; }
          else if (lt < tb2) { const u = clamp((lt - tb1) / (tb2 - tb1)); cx2 = hp[0] - 20 - 12 * u; cy2 = lerp(y1, y2, u) - 14 * Math.sin(u * PI); cr = 4.7 + 2.6 * u; }
          else { const u = clamp((lt - tb2) / (tEnd - tb2)); cx2 = hp[0] - 32 - 6 * u; cy2 = lerp(y2, yE, easeIn(u)); cr = 7.3 + 1.0 * easeOut(u) - 0.25 * Math.sin(clamp((lt - tEnd) / 0.4) * PI * 2) * Math.exp(-(lt - tEnd) * 3) * (lt > tEnd ? 1 : 0); }
        }
        wineCup(g, cx2, cy2, cr, 2.7, ca <= 0.05);
        // 洒出的一弧银酒与每次落瓦的一点闪
        if (ca > 0 && ca < 1.4) K.lighter(g, () => {
          for (let i = 0; i < 12; i++) { const tb = i * 0.02, q = ca - 0.08 - tb; if (q < 0 || q > 0.8) continue; const px = hp[0] - 4 + 70 * q * (0.4 + h2(i, 131)), py = hp[1] - 6 - 90 * q * (0.6 + 0.6 * h2(i, 132)) + 420 * q * q; soft(g, px, py, 2.3, '#e8f0ff', 0.85 * (1 - q / 0.8)); }
          for (const tl of [C0 + 0.22, tb1, tb2, tEnd]) { const q = lt - tl; if (q > 0 && q < 0.35) soft(g, cx2, cy2 - 4, 12 + 30 * q, '#dfe8ff', 0.55 * (1 - q / 0.35)); }
        });
        g.globalAlpha = 1;
      }
      // 梦起：少年身边升起细碎的光屑，飘向云涡
      if (lift > 0.01) K.lighter(g, () => { for (let i = 0; i < 22; i++) { const u = ((drift * (0.25 + 0.2 * h2(i, 121)) + h2(i, 122)) % 1); const px = YX - 80 + h2(i, 123) * 170 + u * (MX - YX) * 0.5, py = YY - 10 - u * 240; soft(g, px, py, 2 + 3 * h2(i, 124), i % 3 ? '#cfdcff' : '#ffe8b0', 0.6 * lift * Math.sin(u * PI)); } });
      g.globalAlpha = 1;
      if (roofsIn) e.mist(g, { t, y: RIDGE + 50, h: 80, color: '#6a7ab0', alpha: 0.16, speed: 6, seed: 4 });
      g.restore();
      // 被吸进月心：最后 0.2 秒加亮成白（与月心的光合成一道）
      if (swallow > 0) {
        const sx = cxz + (MX - cxz) * z, sy = cyz + tilt + (MY - cyz) * z;
        const white = smooth((lt - (END - 0.2)) / 0.16);
        K.lighter(g, () => {
          soft(g, sx, sy, 160 + 700 * swallow, '#e4ecff', 0.9 * swallow);
          if (white > 0) { g.globalAlpha = white; g.fillStyle = '#fffffc'; g.fillRect(0, 0, W, H); }
        });
        g.globalAlpha = 1;
      }
    },
  });
  // 少年躺在瓦上（还没飘起时用缓存，带月光轮廓）
  function boyRest() {
    return K.cache('g05|boyrest8', 400, 200, 1, (q) => F().draw(q, 'xiaoyao', 200, 170, BSr, 2.0, { pose: 'lie', facing: -1, wind: 0.25, rim: '#dfe8ff', light: [MX - BXr + 200, MY - BYr + 170], rimAlpha: 0.9 }));
  }
  function boyHand() {
    let h = handMemo.get('boyhand8');
    if (!h) { h = F().points('xiaoyao', BXr, BYr, BSr, 2.0, { pose: 'lie', facing: -1 }).handN; handMemo.set('boyhand8', h); }
    return h;
  }
  function jjxMouth() {
    let h = handMemo.get('jjxmouth8');
    if (!h) { h = F().points('jiujianxian', 210, 196, 1.25, 2.0, { pose: 'lie', prop: 'none', facing: -1 }).mouth; handMemo.set('jjxmouth8', h); }
    return h;
  }
  // 空闲时先把本组的静态贴图烘好，免得切镜那一帧现烘而卡顿（只是缓存，不影响画面）；
  // 只在播放头接近本组（40–82 s）或暂停时才烘，一次烘一张
  const JO6 = { facing: 1, rim: RIMF, light: [FX, FY - 70], rimAlpha: 0.85, night: true, wind: 0.1 };
  const WARM = [flyBack, flyPeak, puffTex, ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => () => cloudHead(i)),
    ...[0, 1, 2, 3].map((k) => () => { jjx5(k, 0); jjx5(k, 1); }),
    fireBack, fireStones, fireFront, () => { jjxLie('drink', JO6); jjxLie('reach', JO6); }, () => { jjxLie('empty', JO6); jjxKneel(JO6); },
    () => { xySprite(true, 0); xySprite(false, 0); }, () => { xySprite(false, 1); xySprite(false, 2); xySprite(false, 3); },
    ...SEATS.map((S) => () => { const o = { pose: 'sit', facing: S.f, wind: 0.15 }; for (const arm of S.who === 'anu' ? [null, 'reach', 'swordUp'] : [null, 'reach']) sitSprite(S.who + (arm || ''), S.who, S.x, S.y, S.s, o, arm); }),
    teaFront, latticeTex, puddleTex, eaveCorner, () => LIS.forEach(([, , s2, vv, fc]) => listenerTex(vv, s2, fc)),
    roofScene, inkVortex, () => { jjxRoof(0); jjxRoof(1); }, () => { jjxRoof(2); jjxRoof(3); }, boyRest];
  function songPos() {
    try {
      const st = XYT.api && XYT.api.state && XYT.api.state();
      if (!st) return { pos: 0, playing: false };
      if (!st.playing || !st.actx) return { pos: st.pos || 0, playing: false };
      return { pos: st.startOff + (st.actx.currentTime - st.startCtx), playing: true };
    } catch (e) { return { pos: 0, playing: false }; }
  }
  let wi = 0;
  function warmTick() {
    if (wi >= WARM.length) return;
    const sp = songPos(), near = sp.pos > 40 && sp.pos < 82;
    if (!XYT.sprites || !XYT.sprites.S || !(near || !sp.playing)) { setTimeout(warmTick, 1500); return; }
    const run = () => { try { WARM[wi](); } catch (e) { /* 预热失败不影响正式绘制 */ } wi++; setTimeout(warmTick, 60); };
    if (window.requestIdleCallback) window.requestIdleCallback(run); else setTimeout(run, 120);
  }
  setTimeout(warmTick, 3000);
})();
