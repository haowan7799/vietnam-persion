/* 分镜镜头 第 11 组：副歌2 后四句——月如回眸、塔倾红穗、孤光抗魔、怀中红光 */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot || !XYT.kit || !XYT.env || !XYT.vfx || !XYT.fig) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 本组通用小工具 ----------
  const C = (key, w, h, sc, fn) => K.cache('g11|' + key, w, h, sc, fn);
  const ramp = (x, a, b) => smooth((x - a) / (b - a));
  const add = (g, fn) => { const op = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; fn(); g.globalCompositeOperation = op; };
  // 柔光贴图：乘上调用方的透明度
  function glo(g, x, y, r, col, a) {
    if (!(a > 0.003) || !(r > 0.5)) return;
    const p = g.globalAlpha;
    g.globalAlpha = p * clamp(a);
    g.drawImage(XYT.sprites.tint(XYT.sprites.glow, col), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = p;
  }
  // 椭圆柔光
  function gloE(g, x, y, rx, ry, col, a, rot) {
    if (!(a > 0.003)) return;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(1, ry / rx); glo(g, 0, 0, rx, col, a); g.restore();
  }
  const base = (g, col) => { g.fillStyle = col; g.fillRect(-400, -400, W + 800, H + 800); };
  // 镜内时刻 lt0 之后的第一拍序号（从当前拍往前后找）
  function beatAfter(c, lt0) { const s0 = c.t - c.lt; let k = c.b.i; while (k > 0 && c.grid.time(k) - s0 > lt0) k--; for (let j = 0; j < 64 && c.grid.time(k) - s0 <= lt0; j++) k++; return k; }
  // 本句第 k 个字的镜内时间（没有歌词时用实测值）
  const chT = (c, k, def) => { const v = c.charT ? c.charT(k) : null; return v == null ? def[k] : v - (c.t - c.lt); };
  // 镜头：绕 (cx, cy) 缩放 z，平移 (px, py)，可加震动
  function cam(g, o) {
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, k = o.kick || 0, t = o.t || 0;
    g.save(); g.translate(cx + (o.px || 0) + k * Math.sin(t * 87), cy + (o.py || 0) + k * Math.cos(t * 71));
    if (o.rot) g.rotate(o.rot);
    g.scale(o.z || 1, o.z || 1); g.translate(-cx, -cy);
  }
  // 静态底版：比画面大一圈（四周各留 PM），整张贴一次
  const PM = 120;
  const plate = (key, sc, fn) => C('plate-' + key, W + PM * 2, H + PM * 2, sc, (q) => { q.translate(PM, PM); fn(q); });
  const putPlate = (g, img) => g.drawImage(img, -PM, -PM, W + PM * 2, H + PM * 2);
  function vignette(g, a, col, r0) {
    const gr = g.createRadialGradient(640, 360, r0 || 300, 640, 360, 900);
    gr.addColorStop(0, rgba(col || '#000000', 0)); gr.addColorStop(1, rgba(col || '#000000', a));
    g.fillStyle = gr; g.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM);
  }
  // 最近一个时刻（数组）之后的衰减包络
  function kickOf(lt, list, d) { let v = 0; for (const s of list) if (lt >= s) v = Math.max(v, Math.exp(-(lt - s) / d)); return v; }
  // 只算一次的几何数据（由常量决定，不随帧变）
  const MEMO = new Map();
  const memo = (key, fn) => { let v = MEMO.get(key); if (!v) { v = fn(); MEMO.set(key, v); } return v; };
  // 低分辨率草稿缓冲：每次用前清空，画完放大贴回（得到柔和的虚焦效果）
  let scr = null;
  function soft(g, res, fn, rect) {
    const [x0, y0, x1, y1] = rect || [0, 0, W, H];
    const S = (XYT.sprites && XYT.sprites.S) || 1, k = res * S, w = Math.ceil((x1 - x0) * k), h = Math.ceil((y1 - y0) * k);
    if (!scr) scr = document.createElement('canvas');
    if (scr.width < w || scr.height < h) { scr.width = Math.max(scr.width, w); scr.height = Math.max(scr.height, h); }
    const q = scr.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, w + 1, h + 1);
    q.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    fn(q);
    g.drawImage(scr, 0, 0, w, h, x0, y0, w / k, h / k);
  }
  // 光束贴图（白，用时着色）：起点最亮，沿长度渐隐，横向柔边
  const beamTex = () => C('beam', 512, 64, 1, (q) => {
    const gr = q.createLinearGradient(0, 0, 512, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.04, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    q.fillStyle = gr; q.fillRect(0, 0, 512, 64);
    q.globalCompositeOperation = 'destination-in';
    const v = q.createLinearGradient(0, 0, 0, 64);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = v; q.fillRect(0, 0, 512, 64);
  });
  // 一道光束：从 (x,y) 沿 ang 射出，长 len，宽 w（叠加模式由调用方决定）
  function beam(g, x, y, ang, len, w, col, a) {
    if (!(a > 0.003)) return;
    const p = g.globalAlpha;
    g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = p * clamp(a);
    g.drawImage(XYT.sprites.tint(beamTex(), col), 0, -w / 2, len, w);
    g.restore();
  }
  // 软团：整团的雾、尘、烟（普通叠加）
  function puff(g, x, y, r, col, a) { if (a > 0.003) glo(g, x, y, r, col, a); }

  // ---------- 工笔侧脸 ----------
  // 本地坐标：脸朝右，耳在 (-10,-4) 附近，头顶约 y=-108，下巴约 y=48；s 缩放，rot 旋转，flip=-1 朝左
  // 轮廓：女、男两套控制点，按 m 插值
  const PF = {
    f: [[20, -80], [30, -76, 37, -60, 39.5, -40], [40.5, -30, 40.5, -23], [41, -17, 44, -9], [48.5, -1, 53.5, 3, 51.5, 6.5], [50, 9.5, 45.5, 10], [45, 13, 47.5, 16], [48.8, 18, 47.8, 19.5], [46, 21, 44.3, 22], [46.8, 23.5, 45.9, 26.5], [45, 29.5, 41.5, 30.5], [41, 33, 43, 37], [44, 42, 41, 46, 35, 47.5], [29, 49, 23, 51, 19.5, 57], [16.5, 80, 15.5, 108]],
    m: [[16, -84], [32, -80, 40, -60, 41.5, -40], [44, -30, 42.5, -22], [42, -17, 46, -8], [51, 1, 57, 6, 54.5, 9.5], [52.5, 12.5, 47, 12.5], [46, 15.5, 48.5, 19], [50.5, 21, 49.5, 23], [47, 24.5, 45, 25.5], [48.5, 27, 47.5, 30], [46, 33.5, 42.5, 34.5], [42, 37.5, 44.5, 42], [46.5, 50, 42, 56, 33, 57], [26, 58, 21, 61, 19, 68], [16, 88, 18, 112]],
  };
  // sm 笑意：唇往回收、嘴角后拉（侧影上的唇不再前噘）
  const LIPK = [0, 0, 0, 0, 0, 0.35, 0.8, 1, 0.9, 0.7, 0.3, 0, 0, 0, 0];
  function profileLine(g, m, noNeck, sm) {
    const a = PF.f, b = PF.m, k = sm || 0, L = (i, j) => a[i][j] + (b[i][j] - a[i][j]) * m - (j % 2 ? 0 : LIPK[i] * k * 3);
    g.moveTo(L(0, 0), L(0, 1));
    for (let i = 1; i < a.length - (noNeck ? 1 : 0); i++) {
      if (a[i].length === 6) g.bezierCurveTo(L(i, 0), L(i, 1), L(i, 2), L(i, 3), L(i, 4), L(i, 5));
      else g.quadraticCurveTo(L(i, 0), L(i, 1), L(i, 2), L(i, 3));
    }
  }
  const HAIR = '#141018';
  // 眼：e 0 闭 1 睁；sm 笑意（下睑上推、眼尾微弯）
  function eyeGeo(e, m, sm) {
    return {
      ix: 38.5 - m, iy: -12.6, ox: 21 - m, oy: -14.8 - 0.6 * m,
      up: lerp(-10.4, -19.2 + m * 0.8, e) + sm * 0.8, low: lerp(-10.4, -9.4, e) - sm * 2.6, flick: lerp(0.6, 2.6, e) * (1 - 0.6 * m),
    };
  }
  function gongbi(g, o) {
    const m = o.male ? 1 : 0, t = o.t || 0, s = o.s, e = clamp(o.eye ?? 0), sm = o.smile || 0;
    const ink = '#3a2624', skin = o.skin || (m ? '#ead2c0' : '#f2dfd4'), lw = (w) => (w * 1.15) / Math.max(0.3, s);
    const lit = o.lit || mix(skin, '#ffffff', 0.25), shade = o.shade || mix(skin, '#a88276', 0.45);
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0); g.scale(s * (o.flip || 1), s);
    // turn：1 侧脸，0 背影；背影时脸、五官都不画（被发罩盖住），转过来时才淡入
    const turn = o.turn ?? 1, fw = lerp(0.1, 1, turn), fa = smooth((turn - 0.3) / 0.2), a0 = g.globalAlpha;
    if (o.backHair) o.backHair(g, t, turn);
    // 颈：下颌下面在阴影里，往下渐亮，没进衣领；后颈线比前颈宽出一截
    const nk = o.neck ?? 84, bk = o.neckBack ?? (-36 - 6 * m);
    g.fillStyle = K.lin(g, 0, 44, 0, nk, [[0, mix(skin, '#6a4a42', 0.6)], [0.55, mix(skin, '#8a6458', 0.45)], [1, mix(skin, '#a07a6c', 0.32)]]);
    g.beginPath(); g.moveTo(22, 50); g.lineTo(19.5, 57); g.quadraticCurveTo(16.5, 80, 15.5 + 2 * m, nk + 8); g.lineTo(bk, nk + 12); g.bezierCurveTo(bk + 1, 72, bk + 5, 46, -24 - 2 * m, 24); g.lineTo(-16 - 4 * m, 20); g.closePath(); g.fill();
    // 颈侧筋影、前颈线（画在衣领之前，免得压到领上）
    g.strokeStyle = rgba('#6a4a42', 0.25); g.lineWidth = lw(2.2); g.beginPath(); g.moveTo(-10, 40); g.quadraticCurveTo(0, 70, 10, nk + 6); g.stroke();
    g.strokeStyle = rgba(ink, 0.7 * fa); g.lineWidth = lw(1.1); g.beginPath(); g.moveTo(19.5, 57); g.quadraticCurveTo(16.5, 80, 15.5 + 2 * m, nk + 6); g.stroke();
    if (o.collar) o.collar(g, t);
    if (fa > 0.01) {
      g.globalAlpha = a0 * fa;
      // 脸（转头时按 fw 压扁前半张脸）；迎光一半暖亮，背光一半红褐
      g.save(); g.translate(-14, 0); g.scale(fw, 1); g.translate(14, 0);
      g.fillStyle = K.lin(g, -24, 0, 50, 0, [[0, shade], [0.45, skin], [1, lit]]);
      g.beginPath(); profileLine(g, m, true, sm); g.quadraticCurveTo(4, 52 + 6 * m, -12 - 4 * m, 34); g.quadraticCurveTo(-18 - 4 * m, 20, -20, 0); g.bezierCurveTo(-22, -50, -6, -80, PF.f[0][0] - 4 * m, PF.f[0][1] - 4 * m); g.closePath(); g.fill();
      g.save(); g.clip();
      // 颊红、眼窝、颧骨受光、颌下阴影（男子不打胭脂，颌下多一层青影）
      if (!m) A.softBlob(g, 25, 6, 17, 0.2 + 0.1 * sm, '#ec8a86');
      A.softBlob(g, 30, -16, 10, 0.2 + 0.1 * m, '#8a5a52');
      A.softBlob(g, 30, -2, 9, 0.12, '#ffffff');
      A.softBlob(g, 14, 56 + 8 * m, 22, 0.32, '#6a4238');
      A.softBlob(g, -16, -30, 26, 0.2, '#7a5a50');
      A.softBlob(g, -10, 34, 22, 0.28, '#7a5248');
      if (m) { A.softBlob(g, 26, 40, 20, 0.16, '#4a5a5a'); A.softBlob(g, 6, 30, 18, 0.12, '#4a5a5a'); }
      if (o.faceFx) o.faceFx(g);
      g.restore();
      // 唇：笑时往嘴角收一点（整块按嘴角缩到 0.8）
      const lip = o.lip || (m ? '#9a6a62' : '#cf7a76'), dy = m * 3, lk = 1 - 0.2 * Math.min(1, sm * 1.2) - 0.15 * m;
      g.save(); g.translate(40.5, 21 + dy); g.scale(lk, lk); g.translate(-40.5 - sm * 1.4, -21 - dy);
      g.fillStyle = lip;
      g.beginPath(); g.moveTo(45.5, 13 + dy); g.quadraticCurveTo(48.8 + 1.7 * m, 17.5 + dy, 47.8 + 1.7 * m, 19.5 + dy); g.quadraticCurveTo(46, 21 + dy, 44.3 + 0.7 * m, 22 + dy);
      g.quadraticCurveTo(46.8 + 1.7 * m, 23.5 + dy, 45.9 + 1.6 * m, 26.5 + dy); g.quadraticCurveTo(45, 29.5 + dy, 42, 30 + dy); g.bezierCurveTo(39, 27 + dy, 39, 24 + dy, 40.5, 20 + dy); g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', 0.2 * (1 - m)); g.beginPath(); g.ellipse(45, 25.2 + dy, 1.4, 0.6, -0.3, 0, TAU); g.fill();
      g.restore();
      // 唇缝与嘴角：笑时嘴角上扬 6–7 个单位，外侧一道笑纹
      g.strokeStyle = rgba('#6a2a28', 0.85); g.lineWidth = lw(1.1); g.lineCap = 'round';
      g.beginPath(); g.moveTo(44.2 + 0.5 * m - sm * 1.2, 22 + dy); g.quadraticCurveTo(41.5 - sm, 22.8 + dy - sm * 1.4, 39.4 - sm * 2, 21.6 + dy - sm * 6.5); g.stroke();
      if (sm > 0.05) { g.strokeStyle = rgba('#9a5a52', 0.45 * sm); g.lineWidth = lw(0.9); g.beginPath(); g.moveTo(38.5, 13 - sm * 2); g.quadraticCurveTo(34.5, 20, 36.5, 28); g.stroke(); }
      // 鼻翼
      g.strokeStyle = rgba(ink, 0.5); g.lineWidth = lw(0.85);
      g.beginPath(); g.moveTo(45.5, 9.5 + 1.5 * m); g.bezierCurveTo(41, 10 + 1.5 * m, 40, 5 + m, 43, 3.5 + m); g.stroke();
      // 眉：女柳叶，男剑眉（眉头粗而乱）；brow 愁时眉头上提
      const br = o.brow || 0;
      g.fillStyle = '#1c1416';
      g.beginPath();
      g.moveTo(39.5 + m, -27.5 - br * 2.4 + m * 1.5);
      g.quadraticCurveTo(30, lerp(-33, -35.5, m) - br * 0.8, 15 - 2 * m, lerp(-28.5, -33, m) + br * 0.2);
      g.quadraticCurveTo(29, lerp(-31.4, -28.4, m) - br * 0.6, 39.5 + m, lerp(-26.4, -23.2, m) - br * 2.2);
      g.closePath(); g.fill();
      if (m) { g.strokeStyle = rgba('#1c1416', 0.7); g.lineWidth = lw(0.6); for (let k = 0; k < 7; k++) { const x = 38 - k * 2.6; g.beginPath(); g.moveTo(x, -24.5 - k * 0.6 - br * 2); g.lineTo(x - 2.2, -29.5 - k * 0.5 - br * 2 + (k % 2) * 1.2); g.stroke(); } }
      // 眼
      const G = eyeGeo(e, m, sm), ES = o.eyeS || (m ? 1.25 : 1.4);
      g.save(); g.translate(31, -14); g.scale(ES, ES); g.translate(-31, 14);
      const upPath = () => { g.moveTo(G.ix, G.iy); g.quadraticCurveTo(30, G.up, G.ox, G.oy); };
      if (e > 0.05) {
        g.save();
        g.beginPath(); upPath(); g.quadraticCurveTo(28, G.low, G.ix - 0.5, G.iy + 1); g.closePath();
        g.fillStyle = o.sclera || '#f6f1ee'; g.fill(); g.clip();
        const ir = g.createRadialGradient(33.2, -15, 0.5, 33.2, -14, 5);
        ir.addColorStop(0, '#0a0606'); ir.addColorStop(0.4, '#2a1612'); ir.addColorStop(1, '#5a3a2a');
        g.fillStyle = ir; g.beginPath(); g.ellipse(33, -14, 3.1, 4.8, 0, 0, TAU); g.fill();
        g.fillStyle = rgba('#3a2020', 0.35); g.fillRect(16, G.up - 2.5, 26, 3.2);
        g.restore();
        g.fillStyle = rgba('#ffffff', 0.95 * e); g.beginPath(); g.arc(34.6, -16, 1.05, 0, TAU); g.fill();
        if (o.catch) { g.fillStyle = rgba(o.catch, 0.8 * e); g.beginPath(); g.ellipse(32.2, -12.6, 0.8, 1.4, 0, 0, TAU); g.fill(); }
        if (o.wet > 0) { g.fillStyle = rgba('#ffffff', 0.75 * o.wet); g.beginPath(); g.ellipse(31, G.low + 1.4, 5, 0.9, 0, 0, TAU); g.fill(); }
        g.strokeStyle = rgba(o.lowLid || '#6a4038', 0.45 * e + (o.lowLid ? 0.3 : 0)); g.lineWidth = lw(o.lowLid ? 0.9 : 0.6);
        g.beginPath(); g.moveTo(G.ix - 0.5, G.iy + 1); g.quadraticCurveTo(28, G.low, G.ox + 1, G.oy + 1.4); g.stroke();
      }
      // 上睑：浓墨一笔；女子眼尾上挑，男子收在眼角
      g.strokeStyle = '#140c0e'; g.lineWidth = lw(m ? 1.9 : 1.7);
      g.beginPath(); upPath(); if (!m) g.quadraticCurveTo(G.ox - 1.5, G.oy - 0.5 * G.flick, G.ox - 3, G.oy - G.flick); g.stroke();
      // 睫毛：女子在眼尾几根细长上翘；男子短而直、稀
      const nl = m ? 4 : 5, lashL = m ? 1.8 : 4.8;
      g.fillStyle = '#140c0e';
      for (let i = 0; i < nl; i++) {
        const u = 0.45 + 0.55 * (i + 0.5) / nl, iu = 1 - u;
        const px = iu * iu * G.ix + 2 * u * iu * 30 + u * u * G.ox, py = iu * iu * G.iy + 2 * u * iu * G.up + u * u * G.oy;
        const a = lerp(lerp(1.5, 2.3, u), lerp(-1.35, -2.55, u) * (m ? 0.8 : 1), e), L = lashL * (0.55 + 0.6 * u), bw = 0.42;
        const cv = m ? 0.05 : 0.25;
        const cx = px + Math.cos(a) * L * 0.55 + Math.cos(a + PI / 2) * L * cv * (e * 2 - 1), cy = py + Math.sin(a) * L * 0.55 + Math.sin(a + PI / 2) * L * cv * (e * 2 - 1);
        const tx = px + Math.cos(a) * L, ty = py + Math.sin(a) * L, nx = Math.cos(a + PI / 2) * bw, ny = Math.sin(a + PI / 2) * bw;
        g.beginPath(); g.moveTo(px - nx, py - ny); g.quadraticCurveTo(cx, cy, tx, ty); g.quadraticCurveTo(cx, cy, px + nx, py + ny); g.closePath(); g.fill();
      }
      // 双眼皮褶（男子是一道沉重的眼睑褶）
      g.strokeStyle = rgba('#6a4440', 0.4 + 0.2 * m); g.lineWidth = lw(0.65 + 0.5 * m);
      g.beginPath(); g.moveTo(36.5, lerp(-13.5, -17, e)); g.quadraticCurveTo(30, lerp(-12.5, -21.6, e) + sm - m * 1.2, 21.5, lerp(-16, -18.6, e)); g.stroke();
      // 泪珠：下睑上鼓起一颗，带一点高光
      if (o.tear > 0.02) {
        const tb = clamp(o.tear), bx = 33.5, by = G.low + 1.1 + 0.8 * tb;
        g.fillStyle = rgba('#e8f4f8', 0.32 * tb); g.strokeStyle = rgba('#ffffff', 0.65 * tb); g.lineWidth = lw(0.45);
        g.beginPath(); g.ellipse(bx, by, 1.5 + 0.5 * tb, 1.2 + 1.1 * tb, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = rgba('#ffffff', 0.95 * tb); g.beginPath(); g.arc(bx - 0.5, by - 0.6, 0.55, 0, TAU); g.fill();
      }
      g.restore();
      // 侧脸轮廓与颌线
      g.strokeStyle = ink; g.lineWidth = lw(1.1); g.lineJoin = 'round';
      g.beginPath(); profileLine(g, m, true, sm); g.stroke();
      g.strokeStyle = rgba(ink, 0.18 + 0.12 * m); g.beginPath(); g.moveTo(-13, 14); g.bezierCurveTo(-10, 30, 0, 44 + 6 * m, 14, 51 + 6 * m); g.stroke();
      // 轮廓光：只描到下巴，不往颈上挂
      if (o.rim) add(g, () => { const ra = o.rimA ?? 0.5; g.strokeStyle = rgba(o.rim, ra); g.lineWidth = lw(o.rimW || 2.6); g.beginPath(); profileLine(g, m, true, sm); g.stroke(); g.lineWidth = lw(1); g.strokeStyle = rgba('#ffffff', ra * 0.7); g.beginPath(); profileLine(g, m, true, sm); g.stroke(); });
      g.restore();
      g.globalAlpha = a0;
    }
    // 耳
    if (o.ear) {
      g.fillStyle = mix(skin, '#c4907e', 0.3); g.beginPath(); g.ellipse(-12, -6, 6.5, 12.5, 0.15, 0, TAU); g.fill();
      g.strokeStyle = rgba(ink, 0.55); g.lineWidth = lw(0.9);
      g.beginPath(); g.moveTo(-8, -16); g.bezierCurveTo(-19, -20, -21, 5, -9, 6); g.moveTo(-10, -10); g.quadraticCurveTo(-14, -4, -10, 1); g.stroke();
      if (o.earring) { g.fillStyle = o.earring; g.beginPath(); g.arc(-10.5, 9.5, 1.8, 0, TAU); g.fill(); }
    }
    // 背影：两侧露出一点耳尖
    if (turn < 0.5 && o.backEars) {
      const ea = 1 - turn / 0.5;
      g.fillStyle = rgba(mix(skin, '#a06a5a', 0.35), ea);
      for (const ex of [-66, 56]) { g.beginPath(); g.ellipse(ex, -4, 7, 12, ex < 0 ? -0.15 : 0.15, 0, TAU); g.fill(); }
    }
    if (o.hair) o.hair(g, t, turn);
    g.restore();
  }
  // 三次贝塞尔上的点
  const bz = (p, u) => { const iu = 1 - u, a = iu * iu * iu, b = 3 * iu * iu * u, c = 3 * iu * u * u, d = u * u * u; return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]; };
  // 一束发丝：沿 p（四点贝塞尔）铺 n 根，宽 sp，col 颜色
  function lock(g, p, n, sp, col, a, w) {
    g.strokeStyle = rgba(col, a); g.lineWidth = w; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? (i / (n - 1) - 0.5) * sp : 0;
      g.beginPath(); g.moveTo(p[0][0] + k * 0.4, p[0][1]);
      g.bezierCurveTo(p[1][0] + k, p[1][1] + k * 0.3, p[2][0] + k * 1.2, p[2][1] + k * 0.2, p[3][0] + k * 1.4, p[3][1]);
      g.stroke();
    }
  }
  // 发面：深墨底色上一道受光的光泽
  function hairFill(g, x0, y0, x1, y1) {
    g.fillStyle = K.lin(g, x0, y0, x1, y1, [[0, '#2e2a3a'], [0.35, HAIR], [1, '#0a080c']]);
  }
  const lw1 = (g) => { const m = g.getTransform(); return 1.1 / Math.max(0.3, Math.hypot(m.a, m.b) / ((XYT.sprites && XYT.sprites.S) || 1)); };
  // 路径按弧长重采样成 n 个点（两种形状之间插值用）
  function resample(segs, n) {
    const d = [];
    let [px, py] = segs[0];
    d.push([px, py]);
    for (let i = 1; i < segs.length; i++) {
      const s = segs[i];
      for (let k = 1; k <= 24; k++) {
        const u = k / 24, iu = 1 - u;
        if (s.length === 6) d.push([iu * iu * iu * px + 3 * iu * iu * u * s[0] + 3 * iu * u * u * s[2] + u * u * u * s[4], iu * iu * iu * py + 3 * iu * iu * u * s[1] + 3 * iu * u * u * s[3] + u * u * u * s[5]]);
        else d.push([iu * iu * px + 2 * iu * u * s[0] + u * u * s[2], iu * iu * py + 2 * iu * u * s[1] + u * u * s[3]]);
      }
      px = s[s.length - 2]; py = s[s.length - 1];
    }
    const L = [0];
    for (let i = 1; i < d.length; i++) L.push(L[i - 1] + Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]));
    const out = [], tot = L[L.length - 1];
    let j = 1;
    for (let k = 0; k < n; k++) {
      const s = (k / n) * tot;
      while (j < L.length - 1 && L[j] < s) j++;
      const f = (s - L[j - 1]) / Math.max(1e-6, L[j] - L[j - 1]);
      out.push([lerp(d[j - 1][0], d[j][0], f), lerp(d[j - 1][1], d[j][1], f)]);
    }
    return out;
  }
  // 月如发罩：侧面（turn=1，头发梳向脑后、露耳）与背面（turn=0，后脑勺一直盖到后颈发际）两种轮廓之间插值
  const YRCAP = () => memo('yrcap', () => {
    const prof = resample([[20, -80], [16, -102, -16, -116, -44, -112], [-74, -106, -90, -66, -84, -26], [-80, 0, -64, 22, -40, 30], [-28, 34, -22, 22], [-22, 8, -24, -6, -20, -20], [-12, -28, -5, -27], [-1, -20, -2, -12], [0, -36, 4, -50], [10, -64, 20, -80]], 64);
    const back = [];
    for (let k = 0; k < 64; k++) {
      // 背面：从右上起绕过头顶；下半截收窄成后颈，发际一道参差的齿边
      const u = k / 64, a = -0.55 - u * TAU, sn = Math.sin(a);
      let x = -4 + Math.cos(a) * 62, y = -38 + sn * 82;
      if (sn > 0.45) { const q = (sn - 0.45) / 0.55; x = -4 + (x + 4) * lerp(1, 0.66, q); y = Math.min(y, 44) - (k % 2 ? 7 * q : 0); }
      back.push([x, y]);
    }
    return { prof, back };
  });
  function capYueru(g, t, turn) {
    const S = YRCAP(), P = S.prof.map((p, i) => [lerp(S.back[i][0], p[0], turn), lerp(S.back[i][1], p[1], turn)]);
    const tie = [lerp(-4, -44, turn), lerp(-104, -112, turn)];
    hairFill(g, -10, -110, -60, 20);
    g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    // 梳向发结的发丝
    g.save(); g.clip();
    g.strokeStyle = rgba('#5a5470', 0.5); g.lineWidth = lw1(g) * 0.7;
    for (let k = 0; k < 26; k++) {
      const p = P[(k * 5 + 3) % 64], mx = lerp(p[0], tie[0], 0.5) + (p[1] - tie[1]) * 0.12, my = lerp(p[1], tie[1], 0.5);
      g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(mx, my, tie[0], tie[1]); g.stroke();
    }
    g.fillStyle = rgba('#8a86a0', 0.12); g.beginPath(); g.ellipse(tie[0] + 18, tie[1] + 40, 30, 16, -0.6, 0, TAU); g.fill();
    g.restore();
    // 背面：后颈发际垂下几缕碎发
    if (turn < 0.5) {
      const wa = 1 - turn / 0.5;
      g.strokeStyle = rgba(HAIR, 0.85 * wa); g.lineWidth = lw1(g) * 0.9; g.lineCap = 'round';
      for (let k = 0; k < 7; k++) { const x = -26 + k * 8 + (k % 2) * 2, sw = Math.sin(t * 1.6 + k) * 1.5; g.beginPath(); g.moveTo(x, 34); g.quadraticCurveTo(x + sw, 44, x + 1.5 + sw * 1.4, 50 + (k % 3) * 4); g.stroke(); }
    }
    return tie;
  }
  // 马尾：swing>0 向后上甩开，<0 往前荡；整束以发结为根，梢上分成几簇
  function yueruHair(swing) {
    return (g, t, turn) => {
      const tie = capYueru(g, t, turn);
      const sw = swing + 0.06 * Math.sin(t * 1.7), up = Math.max(0, sw), dn = Math.max(0, -sw);
      const x0 = tie[0], y0 = tie[1];
      // 背面：从头顶的结垂下，压过后脑与后颈
      const pb = [[0, 0], [-4, 40], [6, 124], [2 + 4 * Math.sin(t * 1.4), 244]];
      // 侧面：静 rest、甩起 hi（向后外抛，梢微垂）、前荡 lo
      const rest = [[0, 0], [-30, -12], [-64, 46], [-56 + 4 * Math.sin(t * 2.1), 214]];
      const hi = [[0, 0], [-38, -26], [-88, -18], [-98 + 6 * Math.sin(t * 3), 90]];
      const lo = [[0, 0], [-24, -6], [-44, 60], [-26, 216]];
      const p = rest.map((q, i) => {
        const px = q[0] + (hi[i][0] - q[0]) * up + (lo[i][0] - q[0]) * dn, py = q[1] + (hi[i][1] - q[1]) * up + (lo[i][1] - q[1]) * dn;
        return [x0 + lerp(pb[i][0], px, turn), y0 + lerp(pb[i][1], py, turn)];
      });
      const N = 20, Lp = [], Rp = [], U1 = 0.8;
      const wid = (u) => lerp(14, 4, Math.pow(u, 1.3)) + 6 * Math.sin(PI * u) * (1 - u);
      const nrm = (u) => { const q = bz(p, u), q2 = bz(p, Math.min(1, u + 0.02)), q1 = bz(p, Math.max(0, u - 0.02)); const an = Math.atan2(q2[1] - q1[1], q2[0] - q1[0]) + PI / 2; return [q, Math.cos(an), Math.sin(an)]; };
      for (let i = 0; i <= N; i++) { const u = (i / N) * U1, [q, cx, cy] = nrm(u), w = wid(u); Lp.push([q[0] + cx * w, q[1] + cy * w]); Rp.push([q[0] - cx * w, q[1] - cy * w]); }
      hairFill(g, x0, y0, x0 - 60, y0 + 160);
      g.beginPath(); Lp.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); for (let i = N; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]); g.closePath(); g.fill();
      // 发梢分成四簇，各自晃
      const [qe, ex, ey] = nrm(U1), we = wid(U1), tip = bz(p, 1), [, tx, ty] = nrm(1);
      for (let k = 0; k < 4; k++) {
        const f = (k - 1.5) / 1.5, bx = qe[0] + ex * we * f * 0.9, by = qe[1] + ey * we * f * 0.9, ww = we * 0.42;
        const spread = 9 + 10 * up, wob = Math.sin(t * 2.6 + k * 1.7) * (3 + 4 * up);
        const ux = tip[0] + tx * (f * spread + wob) + (k % 2 ? 4 : -2), uy = tip[1] + ty * (f * spread + wob) + (k === 1 ? 10 : k === 2 ? 4 : 0);
        const mx = (bx + ux) / 2 + tx * f * 3, my = (by + uy) / 2 + ty * f * 3;
        g.beginPath(); g.moveTo(bx + ex * ww, by + ey * ww); g.quadraticCurveTo(mx + ex * ww * 0.5, my + ey * ww * 0.5, ux, uy); g.quadraticCurveTo(mx - ex * ww * 0.5, my - ey * ww * 0.5, bx - ex * ww, by - ey * ww); g.closePath(); g.fill();
      }
      lock(g, p, 6, 13, '#5a5470', 0.5, lw1(g) * 0.7);
      // 红发带：结与两尾
      g.fillStyle = '#c8302a'; g.save(); g.translate(x0, y0); g.rotate(lerp(0, -0.5, turn)); g.fillRect(-8, -4, 16, 8); g.restore();
      for (const k of [0, 1]) {
        g.save(); g.translate(x0, y0); g.rotate(lerp(0.15 - k * 0.3, 1.2 - 0.9 * up - k * 0.35, turn) + Math.sin(t * 2.2 + k) * 0.1);
        E.util.ribbon(g, 0, 0, 40 + k * 10, 3.4, t + k, { color: '#c8302a', amp: 5, freq: 0.8, speed: 2.4, bias: 6, shade: true });
        g.restore();
      }
    };
  }
  // 碎石：不规则多边形，受光一侧镶一道金边
  function rockShape(seed) {
    return memo('rock' + seed, () => { const r = A.rng(seed * 31 + 5), n = 5 + Math.floor(r() * 3), p = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + (r() - 0.5) * 0.6; p.push([Math.cos(a) * (0.6 + 0.4 * r()), Math.sin(a) * (0.6 + 0.4 * r())]); } return p; });
  }
  function rock(g, x, y, r, rot, seed, col, rim, ra, lx) {
    const p = rockShape(seed);
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(r, r);
    g.beginPath(); p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
    g.fillStyle = col; g.fill();
    if (rim && ra > 0) { const c0 = Math.cos(-rot) * lx, s0 = Math.sin(-rot) * lx; g.fillStyle = K.lin(g, c0, s0, -c0 * 0.2, -s0 * 0.2, [[0, rgba('#6a5034', 0.75 * ra)], [1, rgba('#6a5034', 0)]]); g.fill(); }
    if (rim && ra > 0) {
      // 光从 lx 方向来：边上朝光的几段描亮
      g.strokeStyle = rgba(rim, ra * 0.7); g.lineWidth = 1.5 / r;
      g.beginPath();
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], nx = (a[1] - b[1]), wx = Math.cos(rot) * nx; if (wx * lx > 0) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } }
      g.stroke();
    }
    g.restore();
  }
  // 铁链：沿下垂弧排一环环链节
  function chainLine(q, x0, y0, x1, y1, sag, s, col, hi, ha) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(L / (11 * s)));
    const P = (u) => [lerp(x0, x1, u), lerp(y0, y1, u) + sag * 4 * u * (1 - u)];
    q.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const [ax, ay] = P(i / n), [bx, by] = P((i + 1) / n), an = Math.atan2(by - ay, bx - ax);
      q.save(); q.translate((ax + bx) / 2, (ay + by) / 2); q.rotate(an);
      if (i % 2 === 0) { q.strokeStyle = col; q.lineWidth = 2.6 * s; q.beginPath(); q.ellipse(0, 0, 7.5 * s, 4.2 * s, 0, 0, TAU); q.stroke(); if (hi) { q.strokeStyle = rgba(hi, ha); q.lineWidth = s; q.beginPath(); q.ellipse(0, 0, 7.5 * s, 4.2 * s, 0, PI * 0.9, PI * 1.5); q.stroke(); } }
      else { q.fillStyle = col; q.fillRect(-7.5 * s, -1.4 * s, 15 * s, 2.8 * s); }
      q.restore();
    }
  }
  // =====================================================================
  // 37 月如回眸：自嘲墨尽｜千情万怨｜英杰愁
  // 结构 A-B-A：①中景（门前两人，月如背对站在右三分）②月如回眸近景 ③回到中景，她走进落石与烟尘
  // =====================================================================
  const YR_T = [0.26, 0.62, 1.02, 1.36, 2.04, 2.62, 3.14, 3.6, 3.98, 4.32, 4.86];
  const GOLD = '#eacd76';
  const DX = 228, DW = 236, DTOP = 196, DSPR = 296, FLOOR = 614;   // 光门（拱）与地面
  const PAIR = { x: 336, y: 624, s: 1.6 };                       // 他跪在门前
  const YRX = 880, YRS = 1.8;                                    // 月如站位
  const SHARED_K = ['rim', 'light', 'rimDir', 'rimWidth', 'rimAlpha', 'wind', 'windDir', 'night', 'alpha', 'ghost', 'tone', 'facing', 'fx', 'feibai', 'wash'];

  XYT.registerShot('c2_yueru', {
    name: '月如回眸', zone: 'right', night: true, text: '#e9f1f6', shadow: 'rgba(10,6,8,0.92)', accent: '#eacd76', bloom: 0.3,
    draw(g, c) {
      const T = (k) => chT(c, k, YR_T);
      if (c.lt < T(4)) yrPanel1(g, c, T);
      else if (c.lt < T(8)) yrPanel2(g, c, T);
      else yrPanel3(g, c, T);
    },
  });

  // 碎石图集：8 块预先画好（墨色渐变、受光边一线金），用时旋转贴图
  const ROCKN = 8, RK = 64;
  const rockAtlas = (col, rim) => C('rocks|' + col + rim, RK * ROCKN, RK, 1.5, (q) => {
    for (let k = 0; k < ROCKN; k++) {
      const p = rockShape(k + 900), cx = k * RK + RK / 2, cy = RK / 2, R = RK * 0.44;
      q.save(); q.translate(cx, cy); q.scale(R, R);
      q.beginPath(); p.forEach((v, i) => (i ? q.lineTo(v[0], v[1]) : q.moveTo(v[0], v[1]))); q.closePath();
      q.fillStyle = K.lin(q, -0.8, -0.8, 0.7, 0.7, [[0, mix(col, rim, 0.45)], [0.45, col], [1, mix(col, '#000000', 0.6)]]); q.fill();
      q.strokeStyle = rgba(rim, 0.85); q.lineWidth = 2.2 / R;
      q.beginPath(); for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if (a[0] + b[0] + a[1] + b[1] < -0.3) { q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); } } q.stroke();
      q.restore();
    }
  });
  function rockA(g, atlas, x, y, r, rot, k) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.drawImage(atlas, (k % ROCKN) * RK * 1.5, 0, RK * 1.5, RK * 1.5, -r / 0.88, -r / 0.88, 2 * r / 0.88, 2 * r / 0.88);
    g.restore();
  }

  // 锁妖塔石壁：大小不一的条石（行高 0.7–1.4 倍），缝里积墨，石面干笔飞白；门边被光照亮，往上沉进墨色里
  function ashlar(q, o) {
    const r = A.rng(o.seed), X0 = -PM, X1 = W + PM, Y1 = o.y1;
    q.fillStyle = K.lin(q, 0, -PM, 0, Y1, [[0, '#050507'], [1, o.base || '#121117']]); q.fillRect(X0, -PM, X1 - X0, Y1 + PM);
    let y = Y1;
    while (y > -PM) {
      const hh = o.bh * (0.62 + 0.85 * r());
      let x = X0 - r() * 90;
      while (x < X1) {
        const bw = hh * (0.9 + 2.6 * r()), j = () => (r() - 0.5) * 6;
        const cx = x + bw / 2, cy = y - hh / 2, d = Math.hypot(cx - o.lx, (cy - o.ly) * 1.3), L = Math.pow(clamp(1 - d / o.lr), 1.6);
        const pts = [[x + j(), y - hh + j()], [x + bw * (0.3 + 0.4 * r()), y - hh + j()], [x + bw + j(), y - hh + j()], [x + bw + j(), y + j()], [x + j(), y + j()]];
        const path = () => { q.beginPath(); pts.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); q.closePath(); };
        path(); q.fillStyle = rgba(mix(o.stone, o.lit, L), r() < 0.25 ? 0.2 + 0.2 * r() : 0.45 + 0.4 * r()); q.fill();
        // 石面：靠光一侧略亮，底下一层阴；干笔几道飞白
        q.save(); path(); q.clip();
        q.fillStyle = K.lin(q, 0, y - hh, 0, y, [[0, rgba(o.lit, 0.12 * L)], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]); q.fillRect(x - 4, y - hh - 4, bw + 8, hh + 8);
        for (let k = 0; k < 3; k++) {
          const yy = y - hh * (0.2 + 0.6 * r()), col = r() < 0.5 ? mix(o.lit, '#ffffff', 0.2) : '#000000', al = (col === '#000000' ? 0.18 : 0.05 + 0.14 * L) * (0.5 + r());
          q.strokeStyle = rgba(col, al); q.lineWidth = 1 + 3 * r(); q.lineCap = 'round';
          q.beginPath(); let xx = x + bw * 0.1 * r(); while (xx < x + bw) { const dl = 6 + 22 * r(); q.moveTo(xx, yy + (r() - 0.5) * 2); q.lineTo(xx + dl, yy + (r() - 0.5) * 3); xx += dl + 3 + 10 * r(); } q.stroke();
        }
        q.restore();
        // 石缝积墨：粗细不匀，角上一团洇开
        path(); q.strokeStyle = rgba('#000000', 0.55 + 0.3 * r()); q.lineWidth = 2.2 + 2.6 * r(); q.lineJoin = 'round'; q.stroke();
        if (r() < 0.35) A.softBlob(q, pts[0][0], pts[0][1], 6 + 10 * r(), 0.45, '#000000');
        x += bw;
      }
      y -= hh;
    }
    // 刻在石上的符箓：凹槽里一点暗金的光
    for (let k = 0; k < (o.fu || 0); k++) {
      const x = o.fuX[k][0], yy = o.fuX[k][1], w = 22, h = 64;
      q.fillStyle = rgba('#000000', 0.45); q.fillRect(x - 2, yy - 2, w + 4, h + 4);
      q.fillStyle = rgba('#3a2a18', 0.6); q.fillRect(x, yy, w, h);
      add(q, () => {
        q.strokeStyle = rgba('#d8a040', 0.32); q.lineWidth = 1.6; q.lineCap = 'round'; q.beginPath();
        for (let i = 0; i < 6; i++) { const yy2 = yy + 8 + i * 9; q.moveTo(x + 5, yy2); q.lineTo(x + w - 5, yy2 + (i % 2 ? 3 : -2)); if (i % 2) { q.moveTo(x + w / 2, yy2 - 3); q.lineTo(x + w / 2 + 2, yy2 + 6); } }
        q.stroke(); glo(q, x + w / 2, yy + h / 2, 46, '#c88a30', 0.16);
      });
    }
    // 墙面上大团的墨晕与几道水渍，冲淡砖格的规整
    for (let k = 0; k < 12; k++) { const x = X0 + r() * (X1 - X0), yy = r() * Y1, d = Math.hypot(x - o.lx, yy - o.ly); if (d > 220) A.softBlob(q, x, yy, 110 + 140 * r(), 0.3 + 0.25 * r(), '#020203'); }
    for (let k = 0; k < 26; k++) { const x = X0 + r() * (X1 - X0), y0 = r() * Y1 * 0.8, L = 40 + 160 * r(); q.fillStyle = K.lin(q, 0, y0, 0, y0 + L, [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(x, y0, 1.5 + 3 * r(), L); }
    // 上三成沉进墨色：渐暗，再叠几团墨晕让边缘不齐
    q.fillStyle = K.lin(q, 0, -PM, 0, 0.36 * H, [[0, 'rgba(2,2,3,0.96)'], [0.6, 'rgba(2,2,3,0.6)'], [1, 'rgba(2,2,3,0)']]); q.fillRect(X0, -PM, X1 - X0, 0.36 * H + PM);
    for (let k = 0; k < 16; k++) A.softBlob(q, X0 + (k + r() * 0.6) * (X1 - X0) / 15, 0.2 * H + (r() - 0.5) * 90, 70 + 80 * r(), 0.5, '#020203');
  }
  // ①③共用的塔内布景：石壁、拱形光门、烘焙好的门光光束、石柱、铁链、石板地
  const DOOR_ARCH = (q, o) => { const L = DX - DW / 2 - o, R = DX + DW / 2 + o; q.beginPath(); q.moveTo(L, FLOOR); q.lineTo(L, DSPR); q.quadraticCurveTo(L, DTOP - o, DX, DTOP - o); q.quadraticCurveTo(R, DTOP - o, R, DSPR); q.lineTo(R, FLOOR); };
  function yrSet() {
    return plate('yrset', 1, (q) => {
      base(q, '#07070a');
      ashlar(q, { seed: 9, y1: FLOOR + 6, bh: 62, stone: '#1c1b21', lit: '#6e5032', lx: DX, ly: 420, lr: 600, fu: 5, fuX: [[560, 300], [760, 410], [500, 470], [40, 330], [930, 250]] });
      add(q, () => { glo(q, DX, 420, 560, '#ffcf80', 0.2); glo(q, DX, 430, 320, '#ffe6b0', 0.22); });
      // 门：拱形门洞，门里是白金色的光；厚墨门框，内沿一线金
      DOOR_ARCH(q, 0); q.closePath();
      q.fillStyle = K.lin(q, 0, DTOP, 0, FLOOR, [[0, '#fff6e2'], [0.55, '#ffe9bc'], [1, '#ffd890']]); q.fill();
      add(q, () => glo(q, DX, 420, 170, '#ffffff', 0.5));
      q.strokeStyle = '#08070a'; q.lineWidth = 22; DOOR_ARCH(q, 11); q.stroke();
      q.strokeStyle = rgba('#ffd890', 0.45); q.lineWidth = 2.5; DOOR_ARCH(q, 1); q.stroke();
      // 门里漫出来的光束：斜着铺向右下（烘焙，帧里只叠一层呼吸的光）
      add(q, () => { for (let i = 0; i < 7; i++) beam(q, DX + 40, 260 + i * 46, 0.1 + i * 0.06 + (h2(i, 5) - 0.5) * 0.04, 1150, 70 + 50 * h2(i, 6), '#ffe0a0', 0.07 + 0.04 * h2(i, 7)); });
      // 右边粗石柱：墨色干笔，几道箍
      q.fillStyle = K.lin(q, 990, 0, 1130, 0, [[0, '#17161c'], [0.25, '#24232a'], [1, '#060608']]); q.fillRect(990, -PM, 140, FLOOR + PM + 10);
      { const r = A.rng(55); for (let i = 0; i < 40; i++) { const x = 994 + r() * 132, y0 = -PM + r() * (FLOOR + PM), L = 40 + 140 * r(); q.strokeStyle = rgba(r() < 0.6 ? '#000000' : '#3a3842', 0.2 + 0.25 * r()); q.lineWidth = 1 + 3 * r(); q.beginPath(); q.moveTo(x, y0); q.lineTo(x + (r() - 0.5) * 6, y0 + L); q.stroke(); } }
      for (let k = 0; k < 5; k++) { q.fillStyle = '#09090c'; q.fillRect(984, 40 + k * 130, 152, 14); q.fillStyle = rgba('#ffd890', 0.1); q.fillRect(984, 40 + k * 130, 152, 2); }
      chainLine(q, 820, -PM, 860, 260, 10, 1.4, '#060608', '#ffd890', 0.25);
      chainLine(q, 900, -PM, 960, 190, -20, 1.2, '#060608', '#ffd890', 0.2);
      chainLine(q, 1180, -PM, 1220, 330, 14, 1.5, '#050507', '#ffd890', 0.15);
      // 地面：石板（透视线向门收拢），门里漫出来的光
      q.fillStyle = K.lin(q, 0, FLOOR, 0, H + PM, [[0, '#1c1916'], [1, '#060507']]); q.fillRect(-PM, FLOOR, W + 2 * PM, H + PM);
      add(q, () => { gloE(q, DX + 220, FLOOR + 30, 640, 70, '#ffcf80', 0.4); gloE(q, DX, FLOOR + 8, 220, 26, '#fff0d0', 0.5); });
      q.strokeStyle = rgba('#000000', 0.5); q.lineWidth = 2;
      for (let k = 0; k < 6; k++) { q.beginPath(); q.moveTo(-PM, FLOOR + 8 + k * k * 6); q.lineTo(W + PM, FLOOR + 8 + k * k * 6); q.stroke(); }
      for (let k = -6; k < 14; k++) { q.beginPath(); q.moveTo(DX + k * 30, FLOOR); q.lineTo(DX + k * 170, H + PM); q.stroke(); }
      const r = A.rng(77);
      for (let i = 0; i < 30; i++) rock(q, r() * W, FLOOR + 6 + r() * 100, 3 + 12 * r() * r(), r() * 6, i + 200, '#0c0b0e', '#ffcf80', 0.45, -1);
    });
  }

  // ③用的布景：裂缝已经全开，连同漏光一起烘进底版
  const yrSetC = () => plate('yrset-c', 1, (q) => { q.drawImage(yrSet(), -PM, -PM, W + 2 * PM, H + 2 * PM); drawCrackNet(q, YRCRACK(), 1.02, 0.6, 0, 0.7); });
  // 墙上的裂缝：从拱顶起，六成笔段斜劈过石块、四成沿石缝走阶梯；宽度由 6 收到 1，子枝更细
  const YRCRACK = () => memo('yrcrack', () => {
    const r = A.rng(29), out = [];
    const grow = (x, y, a, len, w0, d0, depth) => {
      const pts = [[x, y, w0]]; let cx = x, cy = y, an = a, L = 0, stepDir = 0;
      while (L < len) {
        const sl = 18 + 22 * r();
        if (r() < 0.66) { an = a + (r() - 0.5) * 0.9; cx += Math.cos(an) * sl; cy += Math.sin(an) * sl; }
        else { stepDir ^= 1; const sa = stepDir ? (Math.cos(a) < 0 ? PI : 0) : (Math.sin(a) < 0 ? -PI / 2 : PI / 2), ja = sa + (r() - 0.5) * 0.55, ls = sl * (0.5 + 0.6 * r()); cx += Math.cos(ja) * ls; cy += Math.sin(ja) * ls; }
        L += sl; pts.push([cx, cy, w0 * (1 - 0.85 * L / len)]);
        if (depth > 0 && r() < 0.28 && L < len * 0.75) grow(cx, cy, a + (r() < 0.5 ? -1 : 1) * (0.6 + 0.6 * r()), len * (0.25 + 0.25 * r()), w0 * (1 - 0.85 * L / len) * 0.6, d0 + 0.6 * L / len, depth - 1);
      }
      out.push({ pts, d0, d1: Math.min(1, d0 + 0.55 + 0.25 * r()) });
    };
    const ox = DX, oy = DTOP - 14;
    grow(ox, oy, -1.05, 330, 6, 0, 2);
    grow(ox, oy, -2.15, 250, 5, 0.05, 2);
    grow(ox + 6, oy, -0.22, 640, 5.5, 0.08, 2);
    grow(ox - 4, oy, -1.6, 200, 4, 0.12, 1);
    return out;
  });
  // 一枝裂缝的外形（左右两条边），e 生长到的点数（可带小数），k 宽度倍数，add 加宽
  function crackPoly(g, P, e, k, ad) {
    const n = Math.min(P.length - 1, Math.floor(e)), f = e - n, L = [], R = [];
    const pt = (i) => (i <= n ? P[i] : [lerp(P[n][0], P[n + 1][0], f), lerp(P[n][1], P[n + 1][1], f), lerp(P[n][2], P[n + 1][2], f)]);
    const m = n + (f > 0 && n < P.length - 1 ? 1 : 0);
    for (let i = 0; i <= m; i++) {
      const p = pt(i), a = pt(Math.max(0, i - 1)), b = pt(Math.min(m, i + 1)), dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = (p[2] * k + ad) * (i === m ? 0.2 : 1) / 2;
      L.push([p[0] - dy / d * w, p[1] + dx / d * w]); R.push([p[0] + dy / d * w, p[1] - dx / d * w]);
    }
    L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath();
  }
  function drawCrackNet(g, net, prog, open, t, fade = 1) {
    if (prog <= 0) return;
    g.save(); g.beginPath(); g.rect(-PM, -PM, 1040 + PM, H + 2 * PM); g.clip();
    const vis = [];
    for (const b of net) { const u = clamp((prog - b.d0) / (b.d1 - b.d0)); if (u > 0) vis.push([b, u * (b.pts.length - 1)]); }
    // 墨边：一次填完
    g.fillStyle = rgba('#020203', 0.9); g.beginPath(); for (const [b, e] of vis) crackPoly(g, b.pts, e, 1.5 + 0.6 * open, 2.4); g.fill();
    // 柔光：沿裂缝每隔一点贴一团光；张开后几道光从裂口斜漏下来
    add(g, () => {
      for (const [b, e] of vis) { const P = b.pts, n = Math.floor(e); for (let i = 0; i <= n; i += 4) glo(g, P[i][0], P[i][1], 16 + 42 * (0.3 + open) * P[i][2] / 6, '#ffcf80', 0.13 * (0.3 + open) * fade); }
      if (open > 0.02) for (let i = 0; i < 4; i++) { const P = net[i % 3].pts, p = P[Math.min(P.length - 1, 2 + i * 2)]; beam(g, p[0], p[1], 0.9 + 0.25 * i, 640, 40 + 20 * i, '#ffd890', 0.13 * open * fade * (0.8 + 0.2 * Math.sin(t * 1.3 + i))); }
    });
    // 裂口：金色亮芯随张开变宽（靠拱顶最宽，成一道光楔），中间一线白
    add(g, () => {
      g.fillStyle = rgba('#ffc870', (0.5 + 0.4 * open) * fade); g.beginPath(); for (const [b, e] of vis) crackPoly(g, b.pts, e, 0.3 + 1.3 * open, 0.3); g.fill();
      if (open > 0.05) { g.fillStyle = rgba('#fff4d8', 0.6 * open); g.beginPath(); for (const [b, e] of vis) crackPoly(g, b.pts, e, 0.45 * open, 0); g.fill(); }
    });
    g.restore();
  }
  // 墨片：裂缝边上的墙皮先翻起，再翻着跟头往下飘（翻到里面那面时露出受光的石色与金边）
  function flakes(g, a0, net, t) {
    if (a0 <= 0) return;
    for (let i = 0; i < 14; i++) {
      const b = net[i % 3], P = b.pts, q = P[2 + Math.floor(h2(i, 3) * (P.length - 4))], st = h2(i, 4) * 0.7, age = a0 - st;
      if (age <= 0 || q[0] > 1020) continue;
      const peel = clamp(age / 0.22), fa = Math.max(0, age - 0.22), sz = 10 + 10 * h2(i, 7);
      const x = q[0] + 8 * (h2(i, 5) - 0.5) + fa * 26 * (h2(i, 6) - 0.4) + Math.sin(fa * 2.4 + i) * 10, y = q[1] + 10 + 110 * fa * fa + 26 * fa;
      const rot = (h2(i, 8) - 0.5) + fa * (1.2 + 1.6 * h2(i, 9)) * (i % 2 ? 1 : -1), flip = Math.cos(fa * (3 + 3 * h2(i, 10)) + peel * 1.2);
      const p = rockShape(i + 40);
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(sz * (0.35 + 0.65 * Math.abs(flip)), sz * 0.6 * lerp(1, 0.4, peel * (1 - Math.min(1, fa * 4))));
      g.beginPath(); p.forEach((v, j) => (j ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1]))); g.closePath();
      g.fillStyle = flip > 0 ? '#0a090c' : '#5a4430'; g.fill();
      g.strokeStyle = rgba('#ffd890', flip > 0 ? 0.55 : 0.9); g.lineWidth = 1.6 / sz; g.stroke();
      g.restore();
    }
  }
  // 怀抱的两人：灵儿慢慢醒来（上身微抬），分 6 档缓存，档与档之间交叉淡化
  const PB = [PAIR.x - 100, PAIR.y - 250, 500, 280];
  const pairOpts = (w) => ({ rim: '#ffe0a0', light: [DX, 330], rimAlpha: 0.95, rimWidth: 2.4, wind: 0.2, facing: 1, b: { glow: 0.2 + 0.35 * w, glowColor: '#e3f9fd', lean: 0.28 * w, head: -0.12 * w } });
  const pairTex = (k) => C('yr-pair' + k, PB[2], PB[3], 1.25, (q) => { q.translate(-PB[0], -PB[1]); F.cradle(q, PAIR.x, PAIR.y, PAIR.s, 3, pairOpts(k / 5)); });
  function drawPair(g, w) {
    const f = clamp(w) * 5, k = Math.min(5, Math.floor(f)), u = f - k;
    g.drawImage(pairTex(k), PB[0], PB[1], PB[2], PB[3]);
    if (u > 0.01 && k < 5) { const a = g.globalAlpha; g.globalAlpha = a * u; g.drawImage(pairTex(k + 1), PB[0], PB[1], PB[2], PB[3]); g.globalAlpha = a; }
  }
  // 怀里那人的关键点（与 fig.cradle 的摆法一致）
  const heldPts = (w) => memo('yr-held' + Math.round(w * 5), () => {
    const o = pairOpts(Math.round(w * 5) / 5), c = {}; for (const k of SHARED_K) if (o[k] !== undefined) c[k] = o[k];
    const bo = Object.assign({ pose: 'lie', flat: true, limp: true }, c, { wind: (c.wind ?? 0.35) * 0.5 }, o.b);
    const bp = F.points('linger', 0, PAIR.y, PAIR.s, 3, bo), xB = PAIR.x + 50 * PAIR.s - bp.back[0];
    return F.points('linger', xB, PAIR.y, PAIR.s, 3, bo);
  });
  // 月如（全身）：门光在左，轮廓镶金，身后一团金色背光，长影子拖到右边地上
  function yrFigure(g, x, st, pose, a, o) {
    const p0 = g.globalAlpha;
    if (a < 0.12) return;
    g.globalAlpha = p0 * a;
    if (a > 0.3) {
      g.fillStyle = K.lin(g, x, 0, x + 560, 0, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
      g.beginPath(); g.moveTo(x - 18, FLOOR + 12); g.lineTo(x + 560, FLOOR + 2); g.lineTo(x + 560, FLOOR + 50); g.lineTo(x + 14, FLOOR + 20); g.closePath(); g.fill();
      add(g, () => { glo(g, x - 30, FLOOR - 170, 190, '#ffcf80', 0.28 * a); glo(g, x - 20, FLOOR - 200, 90, '#ffe6b0', 0.22 * a); });
    }
    const fo = Object.assign({ pose, facing: 1, wind: 0.55, windDir: 1, rim: '#ffd890', light: [DX, 330], rimAlpha: 1, rimWidth: 3.4 }, o);
    // 静立时（①）缓存成一张贴图；走路时（③）每帧画
    if (pose === 'stand') g.drawImage(C('yr-stand', 320, 380, 1.25, (q) => { q.translate(-(YRX - 150), -(FLOOR - 350)); F.draw(q, 'yueru', YRX, FLOOR + 14, YRS, 3, fo); }), x - 150, FLOOR - 350, 320, 380);
    else F.draw(g, 'yueru', x, FLOOR + 14, YRS, st, fo);
    g.globalAlpha = p0;
  }
  // 细沙瀑：一簇簇往下坠，宽度随噪声起伏，落地处扬起一小团
  function sandStream(g, lt, x, y0, y1, w, a, seed) {
    if (a <= 0.01) return;
    add(g, () => {
      for (let i = 0; i < 12; i++) {
        const ph = (lt * (0.42 + 0.12 * h2(i, seed)) + h2(i, seed + 1)) % 1, y = lerp(y0, y1, ph * ph * 0.7 + ph * 0.3);
        const ww = w * (0.5 + noise1(i * 0.7 + lt * 0.8, seed)), L = 30 + 50 * h2(i, seed + 2) * (0.4 + ph);
        gloE(g, x + Math.sin(lt * 1.3 + i) * 2, y, L, ww, '#ffd890', 0.16 * a * (0.5 + h2(i, seed + 3)), PI / 2);
        if (i % 3 === 0) glo(g, x + (h2(i, seed + 4) - 0.5) * ww * 2, y + L * 0.3, 1.6 + 1.6 * h2(i, seed + 5), '#fff0c8', 0.6 * a);
      }
      glo(g, x, y1 - 6, w * 4, '#ffcf90', 0.1 * a);
    });
    for (let k = 0; k < 2; k++) { const ph = (lt * 0.8 + k * 0.5) % 1; puff(g, x + (k ? 14 : -12) * ph, y1 - 8 - 22 * ph, w * (2 + 3 * ph), '#5a4a3a', 0.22 * a * (1 - ph)); }
  }

  // ① 自嘲墨尽：中景。“自”字她在他臂弯里醒来，头部一圈光，身上淡光漫开；“墨/尽”拱顶上的墙裂开，金光漏进来，墨片剥落；月如背对两人站在右边
  function yrPanel1(g, c, T) {
    const t = c.t, lt = c.lt, p = clamp(lt / T(4));
    cam(g, { z: 1.1 + 0.06 * easeInOut(p), cx: 560, cy: 430, t });
    putPlate(g, yrSet());
    add(g, () => glo(g, DX, 380, 260, '#fff0d0', 0.1 + 0.08 * c.be(0.5)));
    const crack = ramp(lt, T(2) - 0.12, T(3) + 0.35), open = ramp(lt, T(3) - 0.05, T(4) - 0.1), net = YRCRACK();
    drawCrackNet(g, net, crack, open, t);
    flakes(g, lt - (T(3) - 0.1), net, t);
    // 慢慢落下的几块碎石
    const atl = rockAtlas('#100e10', '#ffd890');
    for (let i = 0; i < 7; i++) { const per = 2.6 + h2(i, 2), age = (lt + h2(i, 3) * per) % per, x = 480 + h2(i, 4) * 520, y = -40 + age * 90 + 40 * age * age; if (y < FLOOR) rockA(g, atl, x, y, 4 + 7 * h2(i, 5), age * 2 + i, i); }
    // 灵儿醒来：“自”字前一点点开始，0.45 秒抬起
    const wake = easeInOut((lt - T(0) + 0.05) / 0.45), hp = heldPts(wake);
    drawPair(g, wake);
    const pulse = lt > T(0) - 0.05 ? Math.exp(-(lt - T(0) + 0.05) / 0.5) : 0, glow = ramp(lt, T(0) - 0.05, T(1) + 0.4);
    add(g, () => {
      glo(g, hp.head[0], hp.head[1], 40 + 140 * (1 - pulse), '#e3f9fd', 0.55 * pulse);
      glo(g, hp.head[0], hp.head[1], 26, '#ffffff', 0.5 * pulse + 0.25 * glow);
      glo(g, hp.chest[0], hp.chest[1], 120, '#cfeef6', 0.3 * glow);
      glo(g, hp.waist[0] + 40, hp.waist[1], 160, '#cfeef6', 0.16 * glow);
      for (let i = 0; i < 18; i++) {
        const ph = (lt * 0.3 + h2(i, 21)) % 1, x = hp.head[0] - 40 + h2(i, 22) * 300 + Math.sin(t + i) * 10, y = hp.waist[1] + 10 - ph * 220;
        glo(g, x, y, 2 + 3 * h2(i, 23), '#e8fbff', 0.7 * glow * Math.sin(PI * ph));
      }
      // 裂缝的光照到她身上
      glo(g, hp.chest[0], hp.chest[1] - 40, 160, '#ffcf80', 0.12 * open);
    });
    // 月如：背对两人，望着塔里的黑暗
    yrFigure(g, YRX, t * 0.5, 'stand', 1, {});
    V.dust(g, c, { n: 50, area: [0, 120, W, 700], color: '#ffe0a0', size: [1, 3.5], speed: 0.35, alpha: 0.6, seed: 31 });
    g.restore();
  }

  // 面板二的底：景深极浅，只剩光斑——左边一道拱形的门光（金色辉光），远处几团暖色虚斑
  function yrPlate2() {
    return plate('yr2b', 0.16, (q) => {
      base(q, '#0a0809');
      q.fillStyle = K.lin(q, 0, -PM, 0, H + PM, [[0, '#060506'], [0.6, '#120e0e'], [1, '#0a0809']]); q.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM);
      // 拱形门光：一层层放大的拱，越外越淡
      const arch = (cx, w, top, bot) => { q.beginPath(); q.moveTo(cx - w / 2, bot); q.lineTo(cx - w / 2, top + w * 0.45); q.quadraticCurveTo(cx - w / 2, top, cx, top); q.quadraticCurveTo(cx + w / 2, top, cx + w / 2, top + w * 0.45); q.lineTo(cx + w / 2, bot); q.closePath(); };
      add(q, () => {
        for (let k = 6; k >= 0; k--) { arch(150, 180 + k * 70, 40 - k * 34, H + 200); q.fillStyle = rgba(k > 3 ? '#c88a40' : '#ffcf80', 0.07 + 0.02 * (6 - k)); q.fill(); }
        arch(150, 150, 70, H + 200); q.fillStyle = rgba('#ffe0a0', 0.35); q.fill();
      });
      // 远处的暖色光斑与冷暗
      const r = A.rng(17);
      add(q, () => { for (let i = 0; i < 18; i++) glo(q, 360 + r() * 980, 40 + r() * 640, 30 + 70 * r(), r() < 0.7 ? '#a8783c' : '#5a3a2a', 0.12 + 0.2 * r()); });
      for (let i = 0; i < 8; i++) A.softBlob(q, 400 + r() * 900, r() * H, 120 + 140 * r(), 0.4, '#020203');
      vignette(q, 0.55, '#000000', 320);
    });
  }
  // 月如的衣领：红衣交领、黑缘（本地坐标）
  function yueruCollar(g) {
    g.save(); g.translate(0, -12);
    g.fillStyle = '#2a0a0e';
    g.beginPath(); g.moveTo(26, 86); g.quadraticCurveTo(0, 100, -38, 86); g.lineTo(-44, 110); g.quadraticCurveTo(0, 126, 32, 108); g.closePath(); g.fill();
    g.fillStyle = '#3a1014';
    g.beginPath(); g.moveTo(26, 86); g.quadraticCurveTo(16, 104, -2, 132); g.lineTo(10, 134); g.quadraticCurveTo(28, 110, 34, 100); g.closePath(); g.fill();
    g.strokeStyle = rgba('#eacd76', 0.75); g.lineWidth = lw1(g) * 1.1;
    g.beginPath(); g.moveTo(26, 86); g.quadraticCurveTo(0, 100, -38, 86); g.stroke();
    g.beginPath(); g.moveTo(26, 86); g.quadraticCurveTo(16, 104, -2, 132); g.stroke();
    g.restore();
  }
  // ② 千情万怨：月如背对着我们，在“情”字回头一笑（迎着门光，暖金色的脸），高马尾甩起，“怨”字那一拍落下，下睑一颗泪
  function yrPanel2(g, c, T) {
    const t = c.t, lt = c.lt, l2 = lt - T(4), st = t * 0.45;
    cam(g, { z: 1.03 + 0.03 * clamp(l2 / 2), cx: 700, cy: 360, t });
    putPlate(g, yrPlate2());
    add(g, () => { glo(g, 150, 330, 420, '#ffd890', 0.16 + 0.05 * c.be(0.5)); });
    // 远处慢慢落下的碎石（虚成一团团暗影）
    for (let i = 0; i < 7; i++) {
      const per = 4 + 2 * h2(i, 51), age = (lt + h2(i, 52) * per) % per, x = 420 + h2(i, 53) * 860 + Math.sin(age + i) * 10, y = -60 + age * (40 + 30 * h2(i, 54)) + 12 * age * age, r = 10 + 22 * h2(i, 55);
      puff(g, x, y, r * 1.6, '#050406', 0.7);
      add(g, () => glo(g, x - r * 0.4, y - r * 0.3, r * 0.9, '#ffb060', 0.12));
    }
    // 回头：情字前 0.3 秒开始转，0.6 秒转过来
    const turn = easeInOut((lt - T(5) + 0.3) / 0.6), smile = easeOut((lt - T(5)) / 0.5);
    // 马尾：转头时甩起，怨字那一拍落下，余下轻轻摆
    const tUp = T(5) - 0.15, tDn = T(7);
    let swing = 0;
    if (lt > tUp) swing = easeOut((lt - tUp) / 0.4);
    if (lt > tDn) { const a = lt - tDn; swing = lerp(1, -0.35, easeIn(a / 0.22)); if (a > 0.22) swing = -0.35 * Math.exp(-(a - 0.22) * 4) * Math.cos((a - 0.22) * 9); }
    const hx = 700, hy = 330, s = 2.1, ny = hy + 80 * s;
    // 肩背与上臂：红衣，靠光门一侧镶金边；肩随回头微微侧转
    const sh = 16 * turn;
    const back = () => {
      g.beginPath(); g.moveTo(hx - 60, ny - 8);
      g.bezierCurveTo(hx - 100, ny + 10 - sh, hx - 150, ny + 34 - sh, hx - 196, ny + 58 - sh);
      g.bezierCurveTo(hx - 236, ny + 80 - sh, hx - 246, ny + 130, hx - 248, ny + 190); g.lineTo(hx - 262, H + 60);
      g.lineTo(hx + 268, H + 60); g.lineTo(hx + 252, ny + 196);
      g.bezierCurveTo(hx + 250, ny + 130, hx + 236, ny + 82, hx + 196, ny + 62);
      g.bezierCurveTo(hx + 150, ny + 38, hx + 104, ny + 12, hx + 64, ny - 8); g.closePath();
    };
    g.fillStyle = K.lin(g, hx - 260, 0, hx + 270, 0, [[0, '#d24a2c'], [0.3, '#a82a30'], [0.75, '#7a1a22'], [1, '#3a0a10']]);
    back(); g.fill();
    g.save(); back(); g.clip();
    g.strokeStyle = rgba('#2a0608', 0.5); g.lineWidth = 3;
    g.beginPath(); g.moveTo(hx - 186, ny + 70 - sh); g.quadraticCurveTo(hx - 168, ny + 200, hx - 176, H + 40); g.stroke();
    g.beginPath(); g.moveTo(hx + 188, ny + 72); g.quadraticCurveTo(hx + 168, ny + 200, hx + 180, H + 40); g.stroke();
    g.strokeStyle = rgba('#5a1014', 0.55); g.lineWidth = 2;
    for (const [cx, cy] of [[hx - 130, ny + 70], [hx + 120, ny + 76]]) { g.beginPath(); g.arc(cx, cy, 14, PI, TAU * 0.95); g.arc(cx + 20, cy + 2, 9, PI, TAU * 0.9); g.stroke(); }
    g.strokeStyle = rgba('#2a0608', 0.28); g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(hx - 70 + k * 70, ny + 60); g.quadraticCurveTo(hx - 60 + k * 74, ny + 180, hx - 70 + k * 80, H + 40); g.stroke(); }
    add(g, () => glo(g, hx - 250, ny + 90, 190, '#ffb060', 0.22));
    g.restore();
    add(g, () => { g.strokeStyle = rgba(GOLD, 0.75); g.lineWidth = 3; g.beginPath(); g.moveTo(hx - 60, ny - 8); g.bezierCurveTo(hx - 100, ny + 10 - sh, hx - 150, ny + 34 - sh, hx - 196, ny + 58 - sh); g.bezierCurveTo(hx - 236, ny + 80 - sh, hx - 246, ny + 130, hx - 248, ny + 190); g.lineTo(hx - 262, H + 60); g.stroke(); });
    // 脸：回头时迎着门光，受光一半暖金、背光一半红褐，侧影一道 3 像素金边
    const skin = mix('#8a5a4c', '#efcfb6', 0.25 + 0.75 * turn), tear = ramp(lt, T(7) - 0.05, T(7) + 0.35);
    gongbi(g, { x: hx, y: hy, s, rot: 0.05, flip: -1, eye: lerp(1, 0.9, smile), smile, brow: 0.5 * turn, turn, t: st, hair: yueruHair(swing), collar: yueruCollar, neck: 84, ear: turn > 0.5, backEars: true, earring: '#eacd76', skin, lit: mix(skin, '#f8d4a0', 0.85), shade: mix(skin, '#5a2a22', 0.6), rim: '#ffd88a', rimA: 0.85 * turn, rimW: 2.8, wet: (0.25 + 0.45 * tear) * turn, tear: tear * turn, catch: '#ffe6b0' });
    add(g, () => { glo(g, hx - 80, hy - 10, 150, '#ffcf80', 0.14 * turn); });
    // 门里射来的几道光，斜斜扫过她的肩
    add(g, () => { for (let i = 0; i < 4; i++) beam(g, 120, 200 + i * 70, 0.32 + i * 0.07, 1100, 70 + 40 * h2(i, 3), '#ffe0a0', (0.07 + 0.03 * Math.sin(t * 0.9 + i * 1.7)) * (1 + 0.3 * c.be(0.5))); });
    V.dust(g, c, { n: 60, area: [0, 0, W, H], color: '#ffe0a0', size: [1, 4], speed: 0.4, alpha: 0.65, seed: 23 });
    // 前景失焦落石：大而虚的暗影慢慢掠过
    for (let i = 0; i < 2; i++) {
      const per = 4.6, age = (lt + h2(i, 61) * per) % per, x = 300 + h2(i, 62) * 800, y = -160 + age * 220, r = 60 + 30 * h2(i, 63);
      puff(g, x, y, r * 1.5, '#020203', 0.85);
    }
    g.restore();
  }

  // 断落的石梁：缺角的长条石，迎光一面暖褐、一道金边，面上几道裂纹
  function slab(g, x, y, w, h, rot, lx) {
    g.save(); g.translate(x, y); g.rotate(rot);
    const pts = [[-w / 2 + 10, -h / 2], [w / 2 - 4, -h / 2 + 3], [w / 2, -h / 2 + 14], [w / 2 - 6, h / 2], [-w / 2 + 22, h / 2 - 2], [-w / 2, h / 2 - 16], [-w / 2 + 2, -h / 2 + 12]];
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    g.fillStyle = K.lin(g, -w / 2 * lx, 0, w / 2 * lx, 0, [[0, '#4a3a2c'], [0.35, '#1a1618'], [1, '#08070a']]); g.fill();
    g.strokeStyle = rgba('#050406', 0.9); g.lineWidth = 2; g.stroke();
    g.strokeStyle = rgba('#ffd890', 0.7); g.lineWidth = 2.4; g.beginPath(); g.moveTo(pts[6][0], pts[6][1]); g.lineTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.stroke();
    g.strokeStyle = rgba('#000000', 0.6); g.lineWidth = 1.4; g.beginPath(); g.moveTo(-w * 0.1, -h / 2); g.lineTo(-w * 0.05, -h * 0.1); g.lineTo(-w * 0.12, h / 2); g.moveTo(w * 0.25, -h / 2 + 4); g.lineTo(w * 0.3, h * 0.2); g.stroke();
    g.restore();
  }
  // 烟尘贴图（白，用时着色）：一大片软团
  const dustTex = () => C('dusttex', 900, 460, 0.22, (q) => {
    const r = A.rng(404);
    for (let i = 0; i < 60; i++) A.softBlob(q, 90 + r() * 720, 120 + r() * 240, 60 + r() * 110, 0.22, '#ffffff');
  });
  // 一片烟尘：(x,y) 中心，宽 w，着色 col
  function dustSheet(g, x, y, w, col, a) {
    if (!(a > 0.003)) return;
    const p = g.globalAlpha; g.globalAlpha = p * a;
    g.drawImage(XYT.sprites.tint(dustTex(), col), x - w / 2, y - w * 0.256, w, w * 0.511);
    g.globalAlpha = p;
  }

  // ③ 英杰愁：回到中景（更宽）。他抱着醒来的她在门前；她转身慢慢走开；“杰”字一根石梁翻落，“愁”字砸在中间，随后一道落石帘把两边隔开，暗尘把她吞没
  function yrPanel3(g, c, T) {
    const t = c.t, lt = c.lt, l3 = lt - T(8), st = t * 0.5, land = T(10), t0 = T(9);
    cam(g, { z: 1.0 + 0.04 * clamp(l3 / 2.7), cx: 600, cy: 420, t, kick: 7 * kickOf(lt, [land], 0.22) });
    putPlate(g, yrSetC());
    add(g, () => glo(g, DX, 380, 260, '#fff0d0', 0.12 + 0.1 * c.be(0.5)));
    const atl = rockAtlas('#100e10', '#ffd890');
    // 远处细沙与碎石
    const farSand = 1 - ramp(lt, land + 0.2, land + 0.8);
    sandStream(g, lt, 600, -40, FLOOR, 7, 0.8 * farSand, 3);
    sandStream(g, lt, 790, -40, FLOOR + 4, 9, 0.9 * farSand, 7);
    for (let i = 0; i < 8; i++) { const per = 2.4 + h2(i, 2), age = (lt + 3 + h2(i, 3) * per) % per, x = 560 + h2(i, 4) * 260, y = -40 + age * 80 + 45 * age * age; if (y < FLOOR) rockA(g, atl, x, y, 4 + 8 * h2(i, 5), age * 2 + i, i + 3); }
    drawPair(g, 1);
    const hp = heldPts(1);
    add(g, () => { glo(g, hp.chest[0], hp.chest[1], 90, '#e3f9fd', 0.26 + 0.06 * Math.sin(t * 2)); glo(g, hp.head[0], hp.head[1], 30, '#ffffff', 0.2); });
    // 月如：转身慢慢走开（升格：步频与位移都放慢，脚不打滑）
    const ws = F.walkSpeed('yueru', YRS, { speed: 0.5 }) * 0.5, yx = YRX + ws * Math.max(0, l3);
    const swallow = ramp(lt, land + 0.1, c.dur - 0.3);
    yrFigure(g, yx, st, 'walk', 1 - swallow, { speed: 0.5 });
    // 断梁：杰字从顶上翻落，愁字砸在两人与她之间
    const fall = clamp((lt - t0) / (land - t0));
    if (lt > t0 && lt < land) {
      const fy = lerp(-200, 560, fall * fall);
      g.fillStyle = K.lin(g, 0, fy - 320, 0, fy - 30, [[0, 'rgba(40,30,24,0)'], [1, 'rgba(40,30,24,0.4)']]); g.fillRect(640, fy - 320, 130, 290);
      slab(g, 705, fy, 230, 60, -0.9 + fall * 0.75, -1);
    }
    if (lt >= land) {
      const a = lt - land;
      slab(g, 705, 598, 230, 60, -0.12, -1);
      for (let i = 0; i < 16; i++) { const an = -PI * (0.06 + 0.88 * h2(i, 5)), v = 180 + 300 * h2(i, 6), x = 705 + Math.cos(an) * v * a, y = 590 + Math.sin(an) * v * a + 340 * a * a; if (y < 640) rockA(g, atl, x, y, 3 + 7 * h2(i, 7), a * 6 + i, i); }
      if (a < 0.5) add(g, () => glo(g, 705, 590, 170, '#ffd890', 0.35 * (1 - a / 0.5)));
    }
    // 她身后（右边）漫过来的暗尘；大石落地后暗尘向两边翻开，最后把右边整个吞没
    const dens = 0.25 + 0.75 * ramp(lt, t0, c.dur);
    soft(g, 0.16, (q) => {
      dustSheet(q, 1240 - 50 * l3, 430, 1250, '#1a1512', 0.75 * dens);
      if (lt >= land) {
        const a = lt - land, k = 1 - Math.exp(-a * 1.4);
        for (let i = 0; i < 3; i++) { const sd = i % 2 ? -0.3 : 1, rr = (30 + 300 * k) * (0.4 + 0.7 * h2(i, 3)); dustSheet(q, 705 + sd * rr, 560 - 80 * h2(i, 4) - 70 * a, (380 + 360 * a) * (i % 2 ? 0.7 : 1), i % 2 ? '#5a4632' : '#4a3a2a', 0.8 * (0.6 + 0.4 * k)); }
        dustSheet(q, 960, 420, 1100 + 300 * a, '#0c0a08', 0.9 * k);
      }
    }, [lt >= land ? -20 : 700, 140, W + 40, 720]);
    // 落石帘：愁字以后一阵阵碎石带着尘尾落在中间
    if (lt > land - 0.2) {
      for (let i = 0; i < 26; i++) {
        const b = land - 0.15 + 1.7 * h2(i, 81), age = lt - b; if (age <= 0) continue;
        const x = 640 + 140 * h2(i, 82) + Math.sin(age * 2 + i) * 4, y = -60 + 160 * age + 260 * age * age, r = 6 + 16 * Math.pow(h2(i, 83), 1.4);
        if (y > FLOOR + 10) continue;
        if (i % 2) puff(g, x, y - r * 3, r * 2.6, '#6a5440', 0.26);
        rockA(g, atl, x, y, r, age * (2 + 3 * h2(i, 84)) + i, i);
      }
      sandStream(g, lt, 690, -40, FLOOR + 6, 14, ramp(lt, land, land + 0.4), 11);
    }
    if (lt >= land) add(g, () => glo(g, 705, 560, 260, '#ffcf90', 0.22 * Math.exp(-(lt - land) * 1.5)));
    if (swallow < 0.8) V.dust(g, c, { n: 40, area: [0, 100, W, 700], color: '#ffe0a0', size: [1, 3.5], speed: 0.35, alpha: 0.55 * (1 - swallow), seed: 31 });
    // 收尾：整个画面沉进暗尘，只剩门里一点暖光
    const endA = ramp(lt, land + 0.6, c.dur);
    if (endA > 0) { const gr = g.createRadialGradient(DX, 420, 120, DX, 420, 900); gr.addColorStop(0, rgba('#070605', 0.15 * endA)); gr.addColorStop(0.4, rgba('#070605', 0.5 * endA)); gr.addColorStop(1, rgba('#070605', 0.75 * endA)); g.fillStyle = gr; g.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM); }
    g.restore();
  }

  // =====================================================================
  // 38 塔倾红穗：曲终人散｜发华鬓白｜红颜殁
  // ①远景：断塔烟尘落定（假拉远） ②过肩极近：鬓角一缕发由根到梢变白 ③石缝里的红剑穗松脱，落进他捧着的手里
  // =====================================================================
  const TS_T = [0.24, 0.6, 0.96, 1.48, 2.18, 2.7, 3.09, 3.48, 3.92, 4.34, 4.8];
  const TSUN = [900, 296];
  const RUIN = [880, 366];                 // 残塔塔基（峰顶）

  XYT.registerShot('c2_tassel', {
    name: '塔倾红穗', zone: 'left', night: false, text: '#1a2026', shadow: 'rgba(246,240,226,0.92)', accent: '#9d2933', bloom: 0.32,
    draw(g, c) {
      const T = (k) => chT(c, k, TS_T);
      if (c.lt < T(4)) tsPanel1(g, c, T);
      else if (c.lt < T(8)) tsPanel2(g, c, T);
      else tsPanel3(g, c, T);
    },
  });

  // 断塔残骸（泼墨剪影）：残存三层塔身、断檐（一角斜挂、一片要掉不掉）、斜出的梁，塔顶倒在左坡上
  function ruinShape(q, x, y, s, o) {
    const ink = o.ink || '#26282e';
    q.save(); q.translate(x, y); q.scale(s, s);
    q.fillStyle = ink;
    // 倒下的塔顶：斜躺在左坡上，半埋在碎石里
    q.save(); q.translate(-150, 6); q.rotate(-1.25);
    for (let k = 0; k < 2; k++) { const w = 54 - k * 12, yy = -k * 46; q.fillRect(-w / 2, yy - 40, w, 40); q.beginPath(); q.moveTo(-w / 2 - 22, yy - 40); q.quadraticCurveTo(0, yy - 52, w / 2 + 22, yy - 40); q.lineTo(w / 2 + 26, yy - 46); q.quadraticCurveTo(0, yy - 60, -w / 2 - 26, yy - 46); q.closePath(); q.fill(); }
    q.fillRect(-3, -150, 6, 50);
    q.restore();
    // 残存塔身：越往上越窄，每层一道翘角檐；右檐断了一截斜挂下来
    const tiers = [[96, 64], [80, 58], [66, 40]];
    let yy = -18;
    q.fillRect(-70, -18, 140, 18);
    tiers.forEach(([w, hh], k) => {
      q.fillRect(-w / 2, yy - hh, w, hh);
      if (k < 2) {
        const ey = yy - hh;
        q.beginPath(); q.moveTo(-w / 2 - 30, ey + 4); q.quadraticCurveTo(-w / 2 - 34, ey - 4, -w / 2 - 42, ey - 14); q.quadraticCurveTo(-w * 0.1, ey - 2, w * 0.18, ey - 3); q.lineTo(w * 0.18, ey + 4); q.closePath(); q.fill();
        // 断下的右半片檐：绕断口往下耷拉
        q.save(); q.translate(w * 0.18, ey); q.rotate(k ? 0.55 : 0.32);
        q.beginPath(); q.moveTo(0, 4); q.lineTo(0, -3); q.quadraticCurveTo(w * 0.35, -2, w * 0.5 + 34, -12); q.quadraticCurveTo(w * 0.5 + 30, -2, w * 0.5 + 24, 6); q.closePath(); q.fill();
        q.restore();
      }
      yy -= hh;
    });
    // 参差的断口
    q.beginPath(); q.moveTo(-33, yy + 2); q.lineTo(-30, yy - 18); q.lineTo(-18, yy - 6); q.lineTo(-8, yy - 30); q.lineTo(4, yy - 10); q.lineTo(14, yy - 22); q.lineTo(24, yy - 4); q.lineTo(33, yy - 14); q.lineTo(33, yy + 2); q.closePath(); q.fill();
    q.save(); q.translate(30, yy - 6); q.rotate(-0.6); q.fillRect(0, -3, 60, 6); q.restore();
    q.save(); q.translate(-26, yy + 30); q.rotate(-2.5); q.fillRect(0, -2.5, 46, 5); q.restore();
    // 碎石堆顺着山脊两边往下坡，越往下越淡，没进山体
    const r = A.rng(5);
    q.fillStyle = K.lin(q, 0, -30, 0, 130, [[0, ink], [0.55, rgba(ink, 0.85)], [1, rgba(ink, 0)]]);
    q.beginPath(); q.moveTo(-270, 150); for (let i = 0; i <= 40; i++) { const u = i / 40, xx = -270 + u * 490, B = lerp(84, 110, u); q.lineTo(xx, lerp(B, -12, Math.pow(Math.sin(PI * u), 0.7)) - r() * 12); } q.lineTo(220, 170); q.closePath(); q.fill();
    q.restore();
  }
  // 逆光的残塔：先铺一层金色剪影（向四周错开两像素），再盖墨色剪影，于是四周一圈金边；剪影里擦干笔飞白
  const tsRuinTex = () => C('ts-ruin2', 900, 700, 1, (q) => {
    const ox = 450, oy = 470, s = 1.4;
    for (const [dx, dy] of [[-2.5, 0], [2.5, 0], [0, -2.5], [-1.8, -1.8], [1.8, -1.8]]) ruinShape(q, ox + dx, oy + dy, s, { ink: '#f4d690' });
    ruinShape(q, ox, oy, s, { ink: '#2a2c32' });
    q.globalCompositeOperation = 'source-atop';
    const r = A.rng(13);
    for (let i = 0; i < 90; i++) {
      const x = 140 + r() * 620, y = 160 + r() * 320, L = 20 + 80 * r(), an = -1.2 + 0.5 * r(), w = 1 + 4 * r();
      q.strokeStyle = rgba(r() < 0.6 ? '#000000' : '#6a6c72', 0.16 + 0.25 * r()); q.lineWidth = w; q.lineCap = 'round';
      q.beginPath(); q.moveTo(x, y); q.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L); q.stroke();
    }
    // 门洞与窗里透出的一点天光
    q.fillStyle = rgba('#f4dc98', 0.35); q.fillRect(ox - 11, oy - 84, 22, 36); q.fillRect(ox - 8, oy - 174, 16, 28);
    q.globalCompositeOperation = 'source-over';
  });
  // 蜀山主峰的轮廓：从左下的云海里升到塔基，再向右落下
  function ridgePath(q, x0, y0, peakX, peakY, rough, seed) {
    q.beginPath(); q.moveTo(-PM, H + PM);
    for (let x = -PM; x <= W + PM; x += 8) {
      const d = (x - peakX) / (x < peakX ? 640 : 420), b = peakY + (y0 - peakY) * Math.min(1, Math.pow(Math.abs(d), 1.05));
      q.lineTo(x, b + (noise1(x * 0.02, seed) - 0.5) * rough + (noise1(x * 0.07, seed + 1) - 0.5) * rough * 0.4 + (noise1(x * 0.18, seed + 2) - 0.5) * rough * 0.3);
    }
    q.lineTo(W + PM, H + PM); q.closePath();
  }
  // 斧劈皴：斜劈下来的一笔笔方折墨块，湿边洇开；受光的峰脊擦一道金
  function axeCuts(q, n, x0, x1, yTop, yBot, seed, clipFn, sc = 1) {
    const r = A.rng(seed);
    q.save(); clipFn(); q.clip();
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, r()), y = lerp(yTop, yBot, Math.pow(r(), 0.8)), L = (22 + 34 * r()) * sc, w = (4 + 9 * r()) * sc, an = (x < RUIN[0] ? 2.0 : 1.1) + (r() - 0.5) * 0.35;
      const c0 = Math.cos(an), s0 = Math.sin(an), nx = -s0, ny = c0, dark = r() < 0.7;
      if (!dark) continue;
      q.fillStyle = rgba('#121316', 0.08 + 0.12 * r());
      q.beginPath(); q.moveTo(x, y); q.lineTo(x + c0 * L, y + s0 * L); q.lineTo(x + c0 * L * 0.8 + nx * w, y + s0 * L * 0.8 + ny * w); q.lineTo(x + nx * w * 0.6, y + ny * w * 0.6); q.closePath(); q.fill();
      if (dark && r() < 0.5) A.softBlob(q, x + c0 * L, y + s0 * L, w * 0.8, 0.25, '#0a0a0c');
    }
    q.restore();
  }
  function tsPlate1() {
    return plate('ts1c', 1, (q) => {
      base(q, '#c2ccd0');
      E.sky(q, { y0: -PM, y1: 520, stops: [[0, '#5a6670'], [0.42, '#9aa6ac'], [0.76, '#e4d4a6'], [1, '#f2dc9a']] });
      E.sun(q, { x: TSUN[0], y: TSUN[1], r: 34, color: '#fff6d8', glow: 0.8, haze: '#f4dc98', spread: 3 });
      E.mountains(q, { t: 0, lightDir: 1, layers: [
        { kind: 'karst', color: '#a2acb2', light: '#f4e4b8', litA: 0.45, y: 486, scaleY: 0.42, speed: 0, seed: 7, fog: '#dcd6c0', fogA: 0.55 },
        { kind: 'karst', color: '#86929c', light: '#eedcae', litA: 0.4, y: 500, scaleY: 0.3, speed: 0, seed: 12, fog: '#cfcab8', fogA: 0.5 },
      ] });
      E.cloudSea(q, { t: 0, y: 492, color: '#f2e8cc', shade: '#9aa2ae', speed: 0, lightX: TSUN[0], rows: 4, seed: 3 });
      // 主峰：墨色由上往下淡进云里；斧劈皴；逆光的峰脊一道金边
      const ridge = () => ridgePath(q, 0, 700, RUIN[0], RUIN[1] - 6, 34, 31);
      ridge(); q.fillStyle = K.lin(q, 0, 340, 0, 720, [[0, '#26282e'], [0.5, '#44464c'], [1, rgba('#9aa0a8', 0)]]); q.fill();
      axeCuts(q, 200, 230, 1240, 360, 580, 19, ridge);
      q.strokeStyle = rgba('#f6dc98', 0.65); q.lineWidth = 2.4;
      q.save(); q.beginPath(); q.rect(540, 280, 700, 220); q.clip(); ridge(); q.stroke(); q.restore();
      // 峰上几棵斜出的松
      E.pines(q, { xs: [640, 1060, 1110, 560], ys: [0, 0, 0, 0].map((_, i) => [432, 408, 432, 470][i]), y: 0, s: 0.13, sizes: [1, 1.2, 0.8, 0.9], seed: 5, color: '#2a3430', ink: '#14161a' });
      add(q, () => { for (let i = 0; i < 9; i++) beam(q, TSUN[0], TSUN[1], PI * (0.62 + 0.065 * i) + (h2(i, 3) - 0.5) * 0.05, 1100, 50 + 50 * h2(i, 4), '#ffe8b0', 0.07 + 0.04 * h2(i, 5)); });
      q.drawImage(tsRuinTex(), RUIN[0] - 450, RUIN[1] + 6 - 470, 900, 700);
      E.mist(q, { t: 0, y: 560, h: 120, color: '#e6e0cc', alpha: 0.55, speed: 0, seed: 4 });
    });
  }
  // 前景崖台：他跪在上面
  function tsLedge() {
    return C('ts-ledge2', 760, 260, 1, (q) => {
      const top = () => { q.beginPath(); q.moveTo(0, 60); q.bezierCurveTo(120, 36, 260, 40, 420, 58); q.bezierCurveTo(520, 70, 600, 96, 660, 150); q.lineTo(760, 260); q.lineTo(0, 260); q.closePath(); };
      top(); q.fillStyle = K.lin(q, 0, 30, 0, 260, [[0, '#2c2c30'], [1, '#101012']]); q.fill();
      axeCuts(q, 40, 0, 700, 70, 250, 23, top, 1.5);
      q.strokeStyle = rgba('#f4dc98', 0.55); q.lineWidth = 2; q.beginPath(); q.moveTo(0, 60); q.bezierCurveTo(120, 36, 260, 40, 420, 58); q.bezierCurveTo(520, 70, 600, 96, 660, 150); q.stroke();
      const r = A.rng(11);
      for (let i = 0; i < 14; i++) rock(q, 40 + r() * 560, 58 + r() * 30, 4 + 10 * r(), r() * 6, i + 500, '#1a1a1e', '#f4dc98', 0.6, 1);
      q.strokeStyle = '#1a1a1c'; q.lineWidth = 1.2;
      for (let i = 0; i < 40; i++) { const x = 20 + r() * 600, y = 50 + r() * 12; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + 4, y - 10, x + 10 + r() * 8, y - 14 - r() * 10); q.stroke(); }
    });
  }

  // ① 曲终人散：远景。一股烟尘从残塔向左翻滚（顶上受金光、底下灰紫），在曲/终/人里一点点沉下去，“散”字散开露出镶金边的残骸与两三道光；他跪在左下崖台上（人物层缩小，假拉远）
  function tsPanel1(g, c, T) {
    const t = c.t, lt = c.lt, p = clamp((lt + 0.7) / (T(4) + 0.7));
    cam(g, { z: 1.06 - 0.04 * easeOut(p), cx: 820, cy: 340, t });
    putPlate(g, tsPlate1());
    const clear = ramp(lt, T(3) - 0.25, T(3) + 0.45), sink = smooth(clamp((lt - T(0) + 0.1) / (T(3) - T(0) + 0.1)));
    // 逆光：太阳从烟尘后面透出来；散开以后光束更清楚
    add(g, () => { for (let i = 0; i < 3; i++) beam(g, RUIN[0] + (i - 1) * 40, RUIN[1] - 120 - i * 30, PI * (0.72 + 0.09 * i), 900, 60 + 30 * i, '#fff0c8', 0.12 * clear * (0.8 + 0.2 * Math.sin(t * 0.9 + i))); });
    // 烟尘：从残塔升起的一股烟柱，到半空被风压弯向左翻滚；底下灰紫、顶上受金光；随“曲终人”沉下去，“散”字散开
    soft(g, 0.2, (q) => {
      const dA = 1 - 0.85 * clear;
      for (let i = 0; i < 7; i++) {
        const u = i / 6, bend = smooth(u * 1.6);
        const x = lerp(RUIN[0] - 10, RUIN[0] - 120, bend) - lerp(0, 760, Math.max(0, u - 0.3) / 0.7) - lt * (6 + 20 * u);
        const y = lerp(RUIN[1] - 60, RUIN[1] - 250, bend) + 40 * Math.max(0, u - 0.4) + (60 + 60 * u) * sink + Math.sin(lt * 0.9 + i * 1.3) * 10;
        const w = 220 + 340 * u + 20 * lt, a = dA * (1 - 0.45 * u);
        dustSheet(q, x - 10, y + w * 0.12, w, '#5e5872', 0.7 * a);
        dustSheet(q, x + w * 0.08, y - w * 0.1, w * 0.78, '#f2d8a4', 0.55 * a);
      }
      // 落到峰脚的一层沉尘
      dustSheet(q, RUIN[0] - 160, RUIN[1] + 90 + 30 * sink, 700, '#c8b898', 0.12 * (1 - 0.5 * clear));
    }, [-60, 20, W + 60, 560]);
    V.dust(g, c, { n: 40, area: [200, 120, 1100, 520], color: '#fff0c8', size: [1, 3], speed: 0.3, alpha: 0.5, seed: 41 });
    // 人物层：崖台与跪着的他，整体慢慢缩小（假拉远）；逆光，影子拖向左后方
    const zs = 1.0 - 0.2 * easeInOut(p), fx = 330, fy = 622;
    g.save(); g.translate(fx, 650); g.scale(zs, zs); g.translate(-fx, -650);
    g.drawImage(tsLedge(), -40, 560, 760, 260);
    g.fillStyle = K.lin(g, fx - 300, 0, fx + 10, 0, [[0, 'rgba(10,10,12,0)'], [1, 'rgba(10,10,12,0.55)']]);
    g.beginPath(); g.moveTo(fx + 14, fy + 2); g.lineTo(fx - 300, fy - 4); g.lineTo(fx - 300, fy + 10); g.lineTo(fx - 10, fy + 8); g.closePath(); g.fill();
    F.draw(g, 'xiaoyao', fx, fy, 0.62, t, { pose: 'kneel', facing: 1, wind: 0.5, windDir: -1, rim: '#f4dc98', light: TSUN, rimAlpha: 0.95, prop: 'sword' });
    g.restore();
    E.mist(g, { t, y: 640, h: 110, color: '#d8d2c0', alpha: 0.35, speed: 10, seed: 6 });
    g.restore();
  }

  // ② 发华鬓白：过肩极近景（侧后方，看不见口鼻）。画面中间是他耳前垂下的一缕鬓发，“华”字发根起霜，“白”字一路白到梢
  // 底：灰金的天，右下远处虚掉的残塔
  function tsPlate2() {
    return plate('ts2b', 0.2, (q) => {
      base(q, '#b8c0c2');
      E.sky(q, { y0: -PM, y1: H + PM, stops: [[0, '#6e7a84'], [0.45, '#aab4b8'], [0.8, '#e4d6ae'], [1, '#ecd8a0']] });
      add(q, () => { glo(q, 1180, 140, 560, '#ffe6a8', 0.5); glo(q, 1180, 140, 200, '#fff6dc', 0.55); });
      q.globalAlpha = 0.5; ruinShape(q, 1200, 700, 1.7, { ink: '#3a3c42' }); q.globalAlpha = 1;
    });
  }
  // 男子发罩（本地坐标，脸朝右）：发际、后脑、发髻与蓝发带；鬓角那一缕另画（在世界坐标里垂直下垂）
  function capXY(g, t) {
    hairFill(g, -10, -110, -60, 20);
    g.beginPath();
    g.moveTo(17, -84);
    g.bezierCurveTo(10, -106, -26, -118, -56, -110);
    g.bezierCurveTo(-88, -98, -98, -52, -90, -12);
    g.bezierCurveTo(-86, 16, -74, 34, -56, 40);
    g.quadraticCurveTo(-42, 44, -32, 30); g.bezierCurveTo(-28, 10, -24, -10, -22, -18);
    g.quadraticCurveTo(-10, -32, 0, -54);
    g.quadraticCurveTo(8, -72, 17, -84);
    g.closePath(); g.fill();
    g.save(); g.clip();
    // 发丝：顺着头形梳向发髻，一道受光的光泽带；后脑边缘背光
    g.lineCap = 'round';
    for (let k = 0; k < 64; k++) {
      const a = -0.35 - (k / 64) * 2.5, r0 = 86 + 8 * h2(k, 3), x0 = -40 + Math.cos(a) * r0 * 0.62, y0 = -40 + Math.sin(a) * r0 * 0.9;
      g.strokeStyle = rgba(k % 3 ? '#4e4e64' : '#7a7a94', 0.3 + 0.3 * h2(k, 4)); g.lineWidth = lw1(g) * (0.6 + 0.9 * h2(k, 5));
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(lerp(x0, -46, 0.5) + (y0 + 60) * 0.12, lerp(y0, -112, 0.5), -46, -112); g.stroke();
    }
    g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = lw1(g) * 1;
    for (let k = 0; k < 18; k++) { const y0 = -96 + k * 7, x0 = 14 - Math.abs(k - 5) * 2.4; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 - 30, y0 - 26 + k, -50, -110 + k * 0.3); g.stroke(); }
    A.softBlob(g, -24, -74, 34, 0.2, '#9a9ab4'); A.softBlob(g, -60, -60, 26, 0.12, '#9a9ab4');
    A.softBlob(g, -80, -10, 40, 0.4, '#000000');
    g.restore();
    // 后脑外缘被天光勾出一线
    g.strokeStyle = rgba('#9a9ab8', 0.4); g.lineWidth = lw1(g) * 2.2;
    g.beginPath(); g.moveTo(-56, -110); g.bezierCurveTo(-88, -98, -98, -52, -90, -12); g.bezierCurveTo(-86, 16, -74, 34, -56, 40); g.stroke();
    // 后脑边缘几缕翘起的碎发
    g.strokeStyle = rgba(HAIR, 0.55); g.lineWidth = lw1(g) * 0.6;
    for (let k = 0; k < 7; k++) { const a = PI * (0.62 + 0.09 * k), x0 = -44 + Math.cos(a) * 50, y0 = -38 + Math.sin(a) * 72, sw = Math.sin(t * 2 + k) * 0.6; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 - 2 + sw, y0 + 1.5, x0 - 3.5 + sw, y0 + 3.5 + (k % 2) * 1.5); g.stroke(); }
    g.fillStyle = HAIR; g.beginPath(); g.ellipse(-46, -112, 19, 12, -0.35, 0, TAU); g.fill();
    g.fillStyle = '#3b6db3'; g.save(); g.translate(-38, -110); g.rotate(-0.35); g.fillRect(-3, -11, 6, 22); g.restore();
    g.save(); g.translate(-40, -104); g.rotate(1.2 + Math.sin(t * 1.4) * 0.12);
    E.util.ribbon(g, 0, 0, 58, 4, t, { color: '#3b6db3', amp: 5, freq: 0.7, speed: 1.5, bias: 6, shade: true });
    g.restore();
  }
  // 那一缕鬓发：24 根分 3 簇，根在太阳穴 (rx, ry)，顺着重力垂下 len；wt 白到梢的进度（每根有先后），frost 发根起霜
  function templeLock(g, t, rx, ry, len, wt, frost, gust) {
    const sway = Math.sin(t * 1.1) * 8 + gust * 10;
    g.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const cl = i % 3, k = (i / 3 | 0) / 7 - 0.5, ph = h2(i, 7) * TAU, d = 0.14 * h2(i, 8);
      const x0 = rx + (cl - 1) * 9 + k * 12, y0 = ry + cl * 5 + Math.abs(k) * 6;
      const bend = (cl - 1) * 14, L = len * (0.88 + 0.16 * h2(i, 9)) - cl * 20;
      const P = (u) => [x0 - 16 * u + bend * u * u + (k * 18 + Math.sin(u * 3 + ph + t * 1.6) * (3 + 4 * u)) * u + sway * u * u + 10 * Math.sin(u * 5 + t * 2.1 + i) * u * u * gust, y0 + u * L];
      const w = clamp(frost * (0.12 + 0.06 * h2(i, 10)) + clamp((wt - d) / 0.86)), w0 = 2.6 * (1 - 0.3 * cl) * (0.7 + 0.5 * h2(i, 11));
      const pts = []; for (let sI = 0; sI <= 10; sI++) pts.push(P(sI / 10));
      const stroke = (col, from, to, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(pts[from][0], pts[from][1]); for (let sI = from + 1; sI <= to; sI++) g.lineTo(pts[sI][0], pts[sI][1]); g.stroke(); };
      for (let seg = 0; seg < 3; seg++) {
        const a = seg * 3, b = seg === 2 ? 10 : seg * 3 + 4, lw = w0 * (1 - 0.3 * seg), m = Math.max(a, Math.min(b, Math.round(w * 10)));
        if (m > a) stroke('#f4f2ee', a, m, lw);
        if (m < b) stroke('#120e14', m, b, lw);
      }
      if (w > 0.02 && w < 0.98 && i % 2 === 0) { const q = P(w); add(g, () => { glo(g, q[0], q[1], 9, '#fff4dc', 0.5); glo(g, q[0], q[1], 2.4, '#ffffff', 0.9); }); }
    }
    // 几根飞起的乱发，风里一颤一颤
    g.strokeStyle = rgba(wt > 0.6 ? '#e8e6e2' : '#1a1620', 0.85); g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const u = 0.25 + 0.1 * i, x = rx - 20 - 16 * u + sway * u * u, y = ry + u * len, a = Math.sin(t * 5 + i * 1.9) * (4 + 4 * h2(i, 3)); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 18 + a, y + 4, x + 30 + a * 1.4, y - 10 + (i % 2) * 18); g.stroke(); }
  }
  // 逍遥的衣领与肩：月白长衫、浅青交领（本地坐标）
  function xyCollar(g) {
    g.fillStyle = '#e8eeec';
    g.beginPath(); g.moveTo(20, 80); g.quadraticCurveTo(4, 100, -10, 150); g.lineTo(-60, 150); g.lineTo(-46, 86); g.quadraticCurveTo(-12, 76, 20, 80); g.fill();
    g.fillStyle = '#4e7a80';
    g.beginPath(); g.moveTo(20, 78); g.quadraticCurveTo(8, 104, -2, 152); g.lineTo(-10, 152); g.quadraticCurveTo(0, 104, 13, 76); g.closePath(); g.fill();
    g.strokeStyle = rgba('#4e7a80', 0.8); g.lineWidth = lw1(g) * 2; g.beginPath(); g.moveTo(-46, 86); g.quadraticCurveTo(-12, 76, 20, 80); g.stroke();
  }
  // 颊上的灰、一道干了的泪痕（本地坐标，画在脸的裁切里）
  function xyFaceFx(g) {
    A.softBlob(g, 14, 20, 10, 0.3, '#7a6a5c'); A.softBlob(g, 20, 26, 5, 0.25, '#6a5a50');
    g.strokeStyle = rgba('#fff8ee', 0.07); g.lineWidth = 3.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(31, -8); g.bezierCurveTo(30, 4, 27, 16, 25, 30); g.stroke();
    g.strokeStyle = rgba('#fff8ee', 0.08); g.lineWidth = 1.1; g.stroke();
  }
  const XYH = { x: 640, y: 392, s: 4.4, rot: 0.16 };
  const xyW = (lx, ly) => { const c0 = Math.cos(XYH.rot), s0 = Math.sin(XYH.rot); return [XYH.x + XYH.s * (lx * c0 - ly * s0), XYH.y + XYH.s * (lx * s0 + ly * c0)]; };
  // ② 发华鬓白：极近景，他低着头望向残塔。鬓角一缕在“华”字发根起霜，“白”字一路白到梢；下睑泛红，颊上有灰和干了的泪痕
  // 面板二的整张底：天、远处残塔、光束、他的头（静的部分全部烘进一张；eye 睁/闭两张）
  const XYFACE = (eye) => ({ x: XYH.x, y: XYH.y, s: XYH.s, rot: XYH.rot, male: true, eye, brow: 0.6, wet: 0.3, t: 0, hair: (q, tt) => capXY(q, tt), collar: xyCollar, neck: 90, ear: true, rim: '#fff0c8', rimA: 0.7, rimW: 2, catch: '#fff0c8', lowLid: '#b8323c', sclera: '#f0dcd6', faceFx: xyFaceFx, skin: '#e6c8b2', lit: '#f6dcbc', shade: '#a07a68' });
  const tsComp2 = (closed) => plate('ts2comp' + (closed ? 'c' : 'o'), 1, (q) => {
    q.drawImage(tsPlate2(), -PM, -PM, W + 2 * PM, H + 2 * PM);
    add(q, () => { for (let i = 0; i < 4; i++) beam(q, 1250, 60 + i * 50, PI * 0.86 + i * 0.05, 1200, 70 + 30 * i, '#fff0c8', 0.08); });
    gongbi(q, XYFACE(closed ? 0 : 0.42));
    const root = xyW(3, -54);
    q.fillStyle = rgba('#4a3028', 0.14); q.beginPath(); q.ellipse(root[0] - 14, root[1] + 200, 26, 180, 0, 0, TAU); q.fill();
  });
  function tsPanel2(g, c, T) {
    const t = c.t, lt = c.lt, l2 = lt - T(4);
    cam(g, { z: 1.0 + 0.025 * clamp(l2 / 1.8), cx: 640, cy: 380, t });
    const blink = Math.max(0, 1 - Math.abs(lt - T(6) - 0.1) / 0.09);
    putPlate(g, tsComp2(blink > 0.5));
    add(g, () => { for (let i = 0; i < 2; i++) beam(g, 1250, 90 + i * 90, PI * 0.87 + i * 0.07, 1200, 110, '#fff0c8', 0.04 + 0.03 * Math.sin(t * 1.1 + i * 2)); });
    const root = xyW(3, -54);
    const frost = ramp(lt, T(5) - 0.08, T(5) + 0.3), wt = easeInOut((lt - T(7) + 0.06) / 0.5), gust = c.be(0.5) * 0.6;
    templeLock(g, t, root[0], root[1], 400, wt, frost, gust);
    V.dust(g, c, { n: 60, area: [0, 0, W, H], color: '#fff2cc', size: [1, 4], speed: 0.3, alpha: 0.6, seed: 52 });
    for (let i = 0; i < 3; i++) { const x = ((t * 30 + h2(i, 71) * 1400) % 1500) - 100, y = 160 + h2(i, 72) * 460; puff(g, x, y, 60 + 40 * h2(i, 73), '#d8d0c0', 0.16); }
    g.restore();
  }

  // 面板三的底：石缝特写的背景（虚）
  function tsPlate3() {
    return plate('ts3b', 0.25, (q) => {
      base(q, '#a8aca8');
      E.sky(q, { y0: -PM, y1: H + PM, stops: [[0, '#7e8890'], [0.55, '#c2c0ae'], [1, '#d8c89a']] });
      add(q, () => { glo(q, 1060, 120, 600, '#ffe6a8', 0.45); });
      q.globalAlpha = 0.4; ruinShape(q, 300, 560, 1.4, { ink: '#4a4c50' }); q.globalAlpha = 1;
    });
  }
  // 右上压着的断石：墨分浓淡，斧劈皴湿边，上沿积着灰；中间一道石缝（剑穗的绳卡在缝里）
  function tsRocks() {
    return C('ts-rocks2', 640, 360, 1, (q) => {
      const A1 = [[0, -10], [300, -10], [290, 120], [210, 168], [120, 150], [40, 176], [0, 150]], A2 = [[312, -10], [660, -10], [660, 250], [560, 300], [440, 270], [330, 220], [298, 128]];
      const blk = (pts, c0, c1, seed) => {
        const path = () => { q.beginPath(); pts.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); q.closePath(); };
        path(); q.fillStyle = K.lin(q, 0, 0, 0, 320, [[0, c0], [1, c1]]); q.fill();
        axeCuts(q, 50, pts[0][0], pts[2][0], -10, 300, seed, path, 2);
        q.save(); path(); q.clip();
        // 墨晕：底下一层浓墨往上洇
        for (let i = 0; i < 6; i++) A.softBlob(q, pts[0][0] + (i + 0.5) * (pts[2][0] - pts[0][0]) / 6, 200 + 40 * (i % 2), 70, 0.35, '#0c0c0e');
        q.restore();
        path(); q.strokeStyle = rgba('#141416', 0.85); q.lineWidth = 2.4; q.stroke();
      };
      blk(A1, '#4a4c52', '#1e2024', 31);
      blk(A2, '#55575c', '#222428', 37);
      // 下沿受光：逆光金边与积在棱上的一层灰
      const edge = (pts) => { q.beginPath(); pts.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); };
      q.strokeStyle = rgba('#f4dc98', 0.65); q.lineWidth = 2.6; edge([[0, 150], [40, 176], [120, 150], [210, 168], [290, 120]]); q.stroke(); edge([[330, 220], [440, 270], [560, 300], [660, 250]]); q.stroke();
      q.strokeStyle = rgba('#d8ccb4', 0.4); q.lineWidth = 6; edge([[312, -10], [298, 128]]); q.stroke();
      // 石缝里的暗
      q.fillStyle = '#08080a'; q.beginPath(); q.moveTo(290, 120); q.lineTo(300, -10); q.lineTo(312, -10); q.lineTo(298, 128); q.closePath(); q.fill();
    });
  }
  // 右下角失焦的暗石（前景）
  const tsFgRock = () => C('ts-fgrock', 360, 260, 0.2, (q) => {
    q.fillStyle = '#16161a'; q.beginPath(); q.moveTo(40, 260); q.bezierCurveTo(60, 120, 160, 40, 260, 30); q.bezierCurveTo(330, 30, 370, 80, 380, 260); q.closePath(); q.fill();
    A.softBlob(q, 220, 80, 60, 0.4, '#5a5450');
  });
  // 红剑穗：头（盘长结与玉珠）在 (x,y)，穗丝沿 ang 方向；wave 摆，splay 散开，curl 卷，sag 世界方向往下坠
  function tassel(g, x, y, ang, s, t, o = {}) {
    const wave = o.wave || 0, splay = o.splay || 0, curl = o.curl || 0, sag = o.sag || 0;
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    const dx = Math.sin(ang) / s, dy = Math.cos(ang) / s;
    const n = 28, L = 130;
    for (let i = 0; i < n; i++) {
      const k = (i / (n - 1) - 0.5), ph = h2(i, 5) * TAU, len = L * (0.85 + 0.25 * h2(i, 6)), cu = curl * (15 + 10 * h2(i, 7));
      const pt = (u) => {
        const wv = Math.sin(u * 5 - t * 7 + ph) * wave * 10 * u + Math.sin(t * 3.1 + i) * 2 * u + cu * Math.sin(u * 4.2 + ph + t * 2.3) * u;
        const sg = sag * u * u * len * (0.6 + 0.5 * h2(i, 8));
        return [22 + len * u + dx * sg, k * (9 + u * (22 + 10 * wave + 70 * splay)) + wv + dy * sg];
      };
      const p1 = pt(0.35), p2 = pt(0.7), p3 = pt(1);
      g.strokeStyle = i % 4 === 0 ? '#e0483a' : i % 3 ? '#9d2933' : '#be2a2a'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(22, k * 9); g.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]); g.stroke();
    }
    g.fillStyle = '#c8a050'; g.fillRect(18, -6, 8, 12);
    g.fillStyle = K.lin(g, 4, -8, 14, 8, [[0, '#d8f0e0'], [1, '#6a9a80']]); g.beginPath(); g.arc(8, 0, 8, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(5.5, -3, 2.2, 0, TAU); g.fill();
    g.save(); g.translate(-14, 0); g.rotate(PI / 4); g.fillStyle = '#b02a2a'; g.fillRect(-8, -8, 16, 16); g.strokeStyle = '#e05a4a'; g.lineWidth = 1.2; g.strokeRect(-5, -5, 10, 10); g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.moveTo(0, -8); g.lineTo(0, 8); g.stroke(); g.restore();
    if (o.dust) add(g, () => { glo(g, -14, -6, 10, '#fff4dc', 0.8 * o.dust); glo(g, -14, -6, 3, '#ffffff', o.dust); });
    g.restore();
  }
  // 捧着的一只手（掌心朝上，指尖朝 -y；side=1 右手，拇指在右）：掌、四指（指缝、指节横纹）、拇指、掌纹
  function palmHand(g, side, curl, sk) {
    const dk = mix(sk, '#8a5a4c', 0.45), lt = mix(sk, '#fff4ea', 0.3), ink = '#5a3a32';
    g.save(); g.scale(side, 1);
    // 拇指（在外侧），先画在后面
    g.save(); g.translate(42, 4); g.rotate(-0.32 + 0.2 * curl);
    g.fillStyle = K.lin(g, -10, 0, 10, 0, [[0, dk], [0.5, sk], [1, lt]]); g.beginPath(); g.moveTo(-10, 20); g.bezierCurveTo(-11, -14, -8, -38, 0, -44); g.bezierCurveTo(8, -38, 11, -14, 10, 20); g.closePath(); g.fill();
    g.strokeStyle = rgba(ink, 0.55); g.lineWidth = 1.1; g.stroke();
    g.beginPath(); g.moveTo(-6, -20); g.quadraticCurveTo(0, -17, 6, -20); g.stroke();
    g.fillStyle = rgba('#d89a90', 0.35); g.beginPath(); g.ellipse(0, -34, 5, 7, 0, 0, TAU); g.fill();
    g.restore();
    // 四指：从小指（内侧 -x）到食指；弯起来的指腹朝上，越弯越短
    const F4 = [[-34, 15, 44], [-15, 17, 54], [5, 18, 58], [25, 17, 52]];
    F4.forEach(([fx, fw, fl], i) => {
      const L = fl * (1 - 0.45 * curl), lean = (fx - 0) * 0.06;
      g.save(); g.translate(fx, -26); g.rotate(lean * 0.02 + (i - 1.5) * 0.04);
      g.fillStyle = K.lin(g, -fw / 2, 0, fw / 2, 0, [[0, dk], [0.45, sk], [1, lt]]);
      g.beginPath(); g.moveTo(-fw / 2, 6); g.lineTo(-fw / 2 + 1, -L + fw / 2); g.quadraticCurveTo(0, -L - fw * 0.3, fw / 2 - 1, -L + fw / 2); g.lineTo(fw / 2, 6); g.closePath(); g.fill();
      g.strokeStyle = rgba(ink, 0.6); g.lineWidth = 1.1; g.stroke();
      g.strokeStyle = rgba(ink, 0.35); g.lineWidth = 1;
      for (const v of [0.34, 0.66]) { const y = -L * v; g.beginPath(); g.moveTo(-fw / 2 + 3, y); g.quadraticCurveTo(0, y + 2.5, fw / 2 - 3, y); g.stroke(); }
      g.fillStyle = rgba('#d89a90', 0.35); g.beginPath(); g.ellipse(0, -L + fw * 0.4, fw * 0.32, fw * 0.4, 0, 0, TAU); g.fill();
      g.restore();
    });
    // 掌：腕在下，掌心微凹（中间暗一点）
    const palm = () => { g.beginPath(); g.moveTo(-36, 64); g.bezierCurveTo(-48, 30, -48, -6, -44, -24); g.quadraticCurveTo(-6, -36, 36, -26); g.bezierCurveTo(52, -10, 54, 24, 40, 64); g.closePath(); };
    palm(); g.fillStyle = K.lin(g, -44, 0, 50, 0, [[0, dk], [0.35, sk], [0.8, lt], [1, sk]]); g.fill();
    g.save(); palm(); g.clip();
    A.softBlob(g, 2, 8, 34, 0.28, '#9a6a5c');
    A.softBlob(g, 32, 30, 22, 0.25, '#fff0e4');
    g.restore();
    palm(); g.strokeStyle = rgba(ink, 0.55); g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = rgba(ink, 0.32); g.lineWidth = 1;
    g.beginPath(); g.moveTo(-40, -12); g.quadraticCurveTo(-6, -4, 30, -18); g.moveTo(-38, 4); g.quadraticCurveTo(-6, 6, 24, -2); g.moveTo(30, -8); g.quadraticCurveTo(14, 20, 20, 54); g.stroke();
    g.restore();
  }
  // 一双并在一起捧成碗的手（左手在左、右手在右，小指一侧挨着），袖口从左下伸进来；掌上有灰和一道擦伤
  function bowlHands(g, x, y, s, rot, curl) {
    const sk = '#ecd2bc';
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    // 两只袖：月白长衫，浅青缘
    for (const sd of [-1, 1]) {
      g.save(); g.translate(sd * 46, 70); g.rotate(sd * 0.12 + 0.35);
      g.fillStyle = K.lin(g, -50, 0, 50, 0, [[0, '#a8b4b2'], [0.5, '#e6ecea'], [1, '#c4cecc']]);
      g.beginPath(); g.moveTo(-48, 0); g.lineTo(-70, 340); g.lineTo(70, 340); g.lineTo(48, 0); g.closePath(); g.fill();
      g.fillStyle = '#4e7a80'; g.fillRect(-48, -4, 96, 14);
      g.strokeStyle = rgba('#5a6a6a', 0.35); g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-30 + k * 30, 20); g.quadraticCurveTo(-34 + k * 34, 140, -40 + k * 40, 330); g.stroke(); }
      g.restore();
    }
    // 掌面平放、俯看：沿指向压扁，指头显得短而弯
    g.save(); g.scale(1, 0.64);
    g.save(); g.translate(-46, 0); palmHand(g, -1, curl, mix(sk, '#c8a894', 0.15)); g.restore();
    g.save(); g.translate(46, 2); palmHand(g, 1, curl, sk); g.restore();
    // 两掌之间的一道缝
    g.strokeStyle = rgba('#5a3a32', 0.5); g.lineWidth = 1.4; g.beginPath(); g.moveTo(-2, -40); g.quadraticCurveTo(2, 10, -1, 60); g.stroke();
    // 灰与擦伤
    g.fillStyle = rgba('#7a6a5a', 0.25); g.beginPath(); g.ellipse(62, 30, 18, 9, 0.4, 0, TAU); g.fill();
    g.strokeStyle = rgba('#a03a32', 0.55); g.lineWidth = 1.2; g.beginPath(); g.moveTo(48, 40); g.lineTo(70, 30); g.moveTo(50, 46); g.lineTo(66, 39); g.stroke();
    g.restore();
    g.restore();
  }

  // ③ 红颜殁：石缝里的红剑穗，“红”字被风扯直，“殁”字松脱：先像摆一样往左下荡，再斜着翻飞落下，落进他并拢捧着的手里，穗丝垂过指缘；之后一点尘落在穗上
  function tsPanel3(g, c, T) {
    const t = c.t, lt = c.lt, rel = T(10), land = rel + 0.65;
    cam(g, { z: 1.0, t });
    putPlate(g, tsPlate3());
    // 暖光从右上穿过石缝，正打在剑穗上
    add(g, () => { for (let i = 0; i < 3; i++) beam(g, 1100, 60 + i * 40, PI * 0.8 + i * 0.06, 1100, 90 + 40 * i, '#fff0c8', 0.08); beam(g, 1010, 60, PI * 0.62, 340, 70, '#ffe0a0', 0.32); });
    // 他的手：落定后下一拍指头微微收拢；手在微微发抖
    const HX = 560, HY = 612, HS = 1.45;
    let closeAt = land + 0.3;
    if (c.grid && c.b) { const s0 = c.t - c.lt; let k = c.b.i; while (k > 0 && c.grid.time(k) - s0 > land + 0.05) k--; for (let j = 0; j < 12 && c.grid.time(k) - s0 <= land + 0.05; j++) k++; closeAt = c.grid.time(k) - s0; }
    const curl = 0.35 + 0.22 * easeOut((lt - closeAt) / 0.35);
    const rot = -0.16 + 0.01 * Math.sin(t * TAU * 6);
    bowlHands(g, HX, HY, HS, rot, curl);
    g.drawImage(tsRocks(), 700, 0, 640, 360);
    // 剑穗
    const ax = 700 + 296, ay = 128, gust = ramp(lt, T(8) - 0.05, T(8) + 0.35);
    const cs = Math.cos(rot), sn = Math.sin(rot), palm = [HX + (40 * cs + 4 * sn) * HS, HY + (40 * sn - 4 * cs) * HS];
    let hx, hy, ang, o;
    if (lt < rel) {
      // 绳从石缝垂下，风把穗子吹向左边；松脱前一瞬，绳在缝里一抽一抽
      const sw = Math.sin(t * 2.2) * 0.08 * (1 - gust) + Math.sin(t * 9) * 0.05 * gust;
      ang = lerp(PI / 2 + 0.1, PI * 0.96, gust) + sw;
      const ca = lerp(PI / 2, PI * 0.8, gust);
      hx = ax + Math.cos(ca) * 34; hy = ay + Math.sin(ca) * 34;
      g.strokeStyle = '#8a2a24'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(hx, hy); g.stroke();
      hx += ramp(lt, rel - 0.35, rel) * Math.sin(lt * 60) * 2;
      o = { wave: 0.5 + 1.2 * gust + 0.5 * gust * c.be(0.3) };
    } else if (lt < land) {
      const a = lt - rel, u = a / (land - rel), sx = ax + Math.cos(PI * 0.8) * 34, sy = ay + Math.sin(PI * 0.8) * 34;
      // 头的路线：先往左下荡出一道弧，再左右飘着落向掌心
      const sw = 1 - smooth(a / 0.28), e = easeInOut(u);
      hx = lerp(sx, palm[0], e) - 90 * Math.sin(PI * Math.min(1, a / 0.4)) * (1 - u) + Math.sin(u * PI * 2.6) * 50 * (1 - u);
      hy = lerp(sy, palm[1], e * e * 0.6 + e * 0.4);
      // 穗丝：先像摆一样甩向左下（PI*0.62），然后被下落的风托着斜向上（偏离竖直 30–50 度）翻飞
      const fall = 1.5 * PI - 0.7 + 0.5 * Math.sin(a * 7.5) * (1 - 0.5 * u);
      ang = lerp(fall, lerp(PI * 0.96, PI * 0.62, smooth(a / 0.18)), sw);
      if (u > 0.8) ang = lerp(ang, 0.25, smooth((u - 0.8) / 0.2));
      o = { wave: 1.2 * (1 - u) + 0.2, splay: 0.35 + 0.4 * Math.sin(PI * u), curl: 0.8 * (1 - 0.6 * u) };
    } else {
      // 落定：头躺在掌心，穗丝顺着指缘垂下去，有几根溢出掌边
      const a = lt - land;
      hx = palm[0]; hy = palm[1] + 2 * Math.exp(-a * 8) * Math.sin(a * 30);
      ang = 0.25 + 0.03 * Math.sin(t * 0.8); o = { wave: 0.05, splay: 0.45, curl: 0.15, sag: 1.4 * easeOut(a / 0.3), dust: ramp(lt, land + 0.32, land + 0.42) };
    }
    tassel(g, hx, hy, ang, 1.15, t, o);
    // 落定后飘下的一点尘
    const ds = land + 0.15;
    if (lt > ds && lt < land + 0.42) { const u = ramp(lt, ds, land + 0.38); add(g, () => glo(g, lerp(hx + 70, hx - 16, u), lerp(hy - 170, hy - 8, u) + Math.sin(u * 6) * 8, 4, '#fff4dc', 0.9)); }
    g.drawImage(tsFgRock(), 1010, 520, 360, 260);
    V.dust(g, c, { n: 50, area: [300, 0, W, H], color: '#fff2cc', size: [1, 3.5], speed: 0.3, alpha: 0.55, seed: 63 });
    g.restore();
  }

  // =====================================================================
  // 39 孤光抗魔：烛残未觉｜与日争辉｜徒消瘦
  // =====================================================================
  const NW_T = [0.26, 0.52, 0.98, 1.48, 2.2, 2.7, 3.06, 3.5, 3.82, 4.32, 4.7];
  const NW_HZ = 610;                       // 湖面（仰拍，地平线压得很低）
  const NW_P = [470, 340];                 // 她悬在空中的位置（脚底/蛇尾根）
  const FIVE = ['#3ad6b0', '#ffc94a', '#ff8aa8', '#8ad8ff', '#a888ff'];

  XYT.registerShot('c2_nuwalight', {
    name: '孤光抗魔', zone: 'top', night: true, text: '#eef8f6', shadow: 'rgba(4,12,14,0.85)', accent: '#7ae0c8', bloom: 0.55,
    draw(g, c) {
      const T = (k) => chT(c, k, NW_T);
      nwDraw(g, c, T);
    },
  });

  // 暴风雨的天：墨云压顶（缓存成一条），地平线一线青灰与湖对岸的远山（另一条）；天色本身直接用渐变填，省一次整屏贴图
  const nwSkyClouds = () => C('nw-skycl', W + 2 * PM, 420, 0.45, (q) => {
    q.translate(PM, 0);
    E.clouds(q, { t: 0, y: 140, color: '#2a3036', shade: '#06070a', alpha: 0.95, scale: 1.5, speed: 0, n: 7, seed: 91, spread: 160 });
    E.clouds(q, { t: 0, y: 330, color: '#1e2a2e', shade: '#05060a', alpha: 0.8, scale: 1.2, speed: 0, n: 6, seed: 97, spread: 120 });
  });
  const nwHills = () => C('nw-hills', W + 2 * PM, 160, 0.6, (q) => {
    q.translate(PM, -(NW_HZ - 140));
    E.mountains(q, { t: 0, layers: [{ kind: 'mid', color: '#1a2428', light: '#3a5656', litA: 0.3, y: NW_HZ + 4, scaleY: 0.32, speed: 0, seed: 21, fog: '#2a3a3e', fogA: 0.5 }] });
  });
  // 天色、墨云与远山合成一张底版（半分辨率，暴雨天本来就虚）
  const nwSkyPlate = () => plate('nw-sky', 1, (q) => {
    q.fillStyle = K.lin(q, 0, -PM, 0, NW_HZ + 20, [[0, '#07080c'], [0.45, '#141a22'], [0.85, '#2a3c40'], [1, '#426666']]);
    q.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM);
    q.drawImage(nwSkyClouds(), -PM, -60, W + 2 * PM, 420);
    q.drawImage(nwHills(), -PM, NW_HZ - 140, W + 2 * PM, 160);
  });
  function nwSky(g) { putPlate(g, nwSkyPlate()); }
  // 翻涌的乌云：一条比画面宽的云带，横着慢慢拖
  const nwClouds = () => C('nw-clouds', W + 600, 260, 1, (q) => {
    E.clouds(q, { t: 0, y: 120, color: '#1a2026', shade: '#040507', alpha: 0.8, scale: 1.3, speed: 0, n: 7, seed: 93, spread: 160 });
    q.save(); q.translate(W, 0); E.clouds(q, { t: 0, y: 120, color: '#1a2026', shade: '#040507', alpha: 0.8, scale: 1.3, speed: 0, n: 3, seed: 95, spread: 120 }); q.restore();
  });
  // 一道巨浪（白描水纹加泼墨）：浪背从右边 xR 升到左边的浪峰，浪唇向左前方卷成一个管；
  // 浪面上一道道干笔断续的水纹，浪脊一串浪爪（一次填完），浪头下几处蕾丝状的白沫；cut>0 时浪唇被削掉
  function bigWave(g, t, o) {
    const n = 30, R = o.R * (1 - 0.55 * (o.cut || 0)), Hp = o.Hp, crest = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n, x = lerp(o.xR, o.xL + o.R * 1.1, s);
      const y = o.base - lerp(o.Hr, Hp, Math.pow(s, 1.5)) - 14 * Math.sin(s * 11 - t * 1.4 + o.seed) * (1 - s) - 6 * noise1(s * 8 - t * 0.6, o.seed);
      crest.push([x, y]);
    }
    const pk = crest[n], ccx = pk[0] - R * 0.25, ccy = pk[1] + R * 0.95, lip = [];
    for (let k = 0; k <= 18; k++) { const u = k / 18, a = -PI * 0.5 - u * PI * 1.35, rr = R * (1 - 0.5 * u); lip.push([ccx + Math.cos(a) * rr * 1.25, ccy + Math.sin(a) * rr]); }
    const body = () => {
      g.beginPath(); g.moveTo(o.xR + 300, o.base + 300); g.lineTo(o.xR + 300, crest[0][1]);
      crest.forEach((p) => g.lineTo(p[0], p[1]));
      lip.forEach((p) => g.lineTo(p[0], p[1]));
      const e = lip[18];
      g.bezierCurveTo(e[0] + R * 0.7, e[1] + R * 0.3, ccx + R * 0.5, ccy + R * 1.9, ccx - R * 0.5, o.base - R * 0.2);
      g.quadraticCurveTo(ccx - R * 1.2, o.base + 8, ccx - R * 2.0, o.base + 16);
      g.lineTo(ccx - R * 2.0, o.base + 300); g.closePath();
    };
    // 浪身：浪峰处薄而透青，往下、往右越来越墨
    g.fillStyle = K.lin(g, pk[0], pk[1], pk[0] + 260, o.base, [[0, o.lit], [0.35, o.face], [1, o.deep]]);
    body(); g.fill();
    g.save(); body(); g.clip();
    { const tg = g.createRadialGradient(ccx + R * 0.1, ccy + R * 0.5, 2, ccx + R * 0.1, ccy + R * 0.5, R * 1.7); tg.addColorStop(0, rgba(o.deep, 0.97)); tg.addColorStop(1, rgba(o.deep, 0)); g.fillStyle = tg; g.fillRect(ccx - R * 2, ccy - R * 1.5, R * 4, R * 3.4); }
    // 干笔水纹：每道是断续的笔段（虚线长短不一），随浪势流动
    g.lineCap = 'round';
    for (let k = 1; k <= o.lines; k++) {
      const d = k * (Hp * 0.9) / o.lines, al = o.lineA * (1 - k / (o.lines + 2));
      const r = A.rng(o.seed * 13 + k), dash = []; for (let j = 0; j < 8; j++) dash.push(8 + 46 * r(), 6 + 26 * r());
      g.setLineDash(dash); g.lineDashOffset = -t * (30 + 8 * k);
      g.strokeStyle = rgba(o.foam, al); g.lineWidth = 1 + 1.6 * (1 - k / o.lines) * r();
      g.beginPath();
      for (let i = 0; i <= n; i += 2) {
        const s = i / n, p = crest[i], bend = Math.pow(s, 3) * d * 0.8, wob = 5 * Math.sin(s * 9 + k * 1.3 - t * 1.6);
        const x = p[0] + bend * 0.25 + k * 3, y = p[1] + d * (0.55 + 0.45 * s) + bend + wob;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    g.setLineDash([]);
    // 浪头下的蕾丝白沫：一圈圈小破洞
    g.strokeStyle = rgba(o.foam, 0.4); g.lineWidth = 1.1;
    g.beginPath();
    for (let i = 0; i < o.lace; i++) {
      const s = 0.45 + 0.55 * h2(i, o.seed + 30), p = crest[Math.floor(s * n)], dd = 8 + 40 * h2(i, o.seed + 31), x = p[0] + (h2(i, o.seed + 32) - 0.5) * 30 + Math.sin(t * 1.2 + i) * 3, y = p[1] + dd, rr = 3 + 6 * h2(i, o.seed + 33);
      g.moveTo(x + rr, y); g.ellipse(x, y, rr, rr * 0.6, 0, 0, TAU);
    }
    g.stroke();
    g.restore();
    // 浪唇里的旋涡（断续）
    if ((o.cut || 0) < 0.5) {
      g.setLineDash([20, 9, 34, 12]); g.strokeStyle = rgba(o.foam, 0.45); g.lineWidth = 1.6;
      g.beginPath(); for (const f of [0.78, 0.56, 0.36]) { for (let k = 0; k <= 18; k++) { const u = k / 18, a = -PI * 0.5 - u * PI * (1.35 + (1 - f)), rr = R * f * (1 - 0.45 * u); const x = ccx + Math.cos(a) * rr * 1.25, y = ccy + Math.sin(a) * rr; k ? g.lineTo(x, y) : g.moveTo(x, y); } } g.stroke();
      g.setLineDash([]);
    }
    // 浪爪：浪脊与浪唇外缘一串，合成一条路径一次填完
    g.fillStyle = rgba(o.foam, 0.88);
    g.beginPath();
    const claw = (x, y, a, L, w) => { const c0 = Math.cos(a), s0 = Math.sin(a); g.moveTo(x - s0 * w, y + c0 * w); g.quadraticCurveTo(x + c0 * L * 0.6, y + s0 * L * 0.6 + w * 0.5, x + c0 * L + s0 * L * 0.3, y + s0 * L - c0 * L * 0.3 + L * 0.2); g.quadraticCurveTo(x + c0 * L * 0.4, y + s0 * L * 0.4 - w, x + s0 * w, y - c0 * w); g.closePath(); };
    for (let i = Math.floor(n * 0.3); i < n; i++) { const p = crest[i], q = crest[i + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]) - 0.35 + 0.3 * Math.sin(t * 2.4 + i); claw(p[0], p[1], a, 8 + 14 * h2(i, o.seed + 9) * (i / n), 2); }
    const nl = (o.cut || 0) > 0.5 ? 0 : 15;
    for (let k = 0; k < nl; k++) { const p = lip[k], a = -PI * 0.5 - (k / 18) * PI * 1.35 - PI * 0.5 + 0.35 * Math.sin(t * 3 + k), L = R * (0.18 + 0.26 * h2(k, o.seed + 6)) * (1 + 0.25 * Math.sin(t * 4 + k)); claw(p[0], p[1], a, L, 2.4); }
    g.fill();
    g.strokeStyle = rgba(o.foam, 0.7); g.lineWidth = 2.2;
    g.beginPath(); crest.slice(Math.floor(n * 0.2)).forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); lip.slice(0, (o.cut || 0) > 0.5 ? 2 : 14).forEach((p) => g.lineTo(p[0], p[1])); g.stroke();
    // 浪脚：拍进湖面的一圈白沫（一次填完）
    g.fillStyle = rgba(o.foam, 0.5);
    g.beginPath();
    for (let k = 0; k < 9; k++) { const x = ccx - R * 2.0 + k * R * 0.3 + Math.sin(t * 3 + k) * 4, y = o.base + 8 - 8 * Math.sin(k + t * 2), rx = R * 0.28, ry = 6 + 4 * h2(k, o.seed); g.moveTo(x + rx, y); g.ellipse(x, y, rx, ry, 0, 0, TAU); }
    g.fill();
    if (o.mist) add(g, () => { for (let i = 0; i < 4; i++) { const p = crest[Math.floor(n * (0.4 + 0.6 * i / 3))]; glo(g, p[0], p[1] - 10, 60 + 30 * h2(i, o.seed + 20), o.foam, 0.08 * o.mist); } });
    return { crest, lip, pk, cc: [ccx, ccy], R };
  }
  // 水魔兽：远浪本身就是它——浪管是长吻，浪背上两道卷着白沫的浪峰是双角，浪管的暗影里两点青光是眼
  function beastHorns(g, t, wv, k, de) {
    const C0 = wv.crest, n = C0.length - 1;
    g.lineCap = 'round';
    for (const [si, sc, side] of [[0.52, 1, 1], [0.68, 0.82, -1]]) {
      const p = C0[Math.floor(si * n)], h = 135 * sc * k, sw = Math.sin(t * 0.9 + si * 7) * 10 + de * 12;
      const P = [[p[0] - 30 * sc, p[1] + 10], [p[0] - 10 * sc + sw * 0.3, p[1] - h * 0.45], [p[0] + 50 * sc + sw, p[1] - h * 0.95], [p[0] + 110 * sc + sw, p[1] - h * 0.8]];
      // 角身：墨色，根部宽，尖上卷
      g.fillStyle = K.lin(g, p[0], p[1], p[0] + 60, p[1] - h, [[0, '#060c0d'], [0.55, '#1e3838'], [1, '#4a7a76']]);
      g.beginPath(); g.moveTo(P[0][0] - 34 * sc, P[0][1]); g.bezierCurveTo(P[1][0] - 30 * sc, P[1][1], P[2][0] - 14 * sc, P[2][1] - 10, P[3][0], P[3][1]);
      g.quadraticCurveTo(P[3][0] - 18 * sc, P[3][1] + 22 * sc, P[2][0] + 8 * sc, P[2][1] + 30 * sc); g.bezierCurveTo(P[1][0] + 26 * sc, P[1][1] + 20, P[0][0] + 40 * sc, P[0][1] - 20, P[0][0] + 50 * sc, P[0][1] + 10); g.closePath(); g.fill();
      // 角尖卷成浪花，镶一线白沫
      g.strokeStyle = rgba('#d8f0ea', 0.85); g.lineWidth = 4;
      g.beginPath(); g.moveTo(P[1][0] - 26 * sc, P[1][1]); g.bezierCurveTo(P[1][0] - 22 * sc, P[1][1] - h * 0.3, P[2][0] - 12 * sc, P[2][1] - 12, P[3][0], P[3][1]); g.quadraticCurveTo(P[3][0] - 14 * sc, P[3][1] + 18 * sc, P[3][0] - 26 * sc, P[3][1] + 8 * sc); g.stroke();
      g.fillStyle = rgba('#c8e4de', 0.75); g.beginPath();
      for (let j = 0; j < 5; j++) { const x = P[3][0] - j * 7 * sc, y = P[3][1] + j * 4; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 8 - j, x + 16, y - 2); g.quadraticCurveTo(x + 8, y - 2, x, y + 3); }
      g.fill();
    }
  }
  function beastFace(g, t, wv, k, blink, de) {
    if (k <= 0.01) return;
    const [cx, cy] = wv.cc, R = wv.R;
    // 长吻下的白沫须：几根细长的弧线垂下来，随风摆
    g.strokeStyle = rgba('#c8e4de', 0.4 * k); g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < 4; i++) { const x0 = cx - R * (0.9 + 0.15 * i), y0 = cy + R * (0.5 + 0.1 * i), sw = Math.sin(t * 1.6 + i) * 14 + de * 10; g.moveTo(x0, y0); g.bezierCurveTo(x0 - 40, y0 + 40, x0 - 70 + sw, y0 + 90, x0 - 110 + sw * 1.4, y0 + 120 + 20 * i); }
    g.stroke();
    // 眼：两道细长的青光，随拍一亮
    const e = k * blink;
    if (e > 0.01) add(g, () => {
      for (const [ex, ey, sc] of [[cx + R * 0.15, cy - R * 0.05, 1], [cx + R * 0.72, cy - R * 0.18, 0.8]]) {
        g.save(); g.translate(ex, ey); g.rotate(-0.16);
        gloE(g, 0, 0, 56 * sc, 14 * sc, '#48c0a3', 0.6 * e);
        gloE(g, 0, 0, 20 * sc, 3.6 * sc, '#dffff6', 0.95 * e);
        g.restore();
      }
    });
  }
  // 近处翻滚的湖水：三排向左推的浪脊，浪脊上一线白沫
  function churn(g, t, y0, amp, a) {
    g.fillStyle = K.lin(g, 0, y0 - 20, 0, H + PM, [[0, '#1c3034'], [0.5, '#0c1618'], [1, '#030506']]); g.fillRect(-PM, y0 - 6, W + 2 * PM, H + PM);
    for (let r = 0; r < 3; r++) {
      const u = r / 2, y = y0 + 6 + u * u * 140, A0 = amp * (0.4 + u), sp = 40 + 90 * u, wl = 120 + 200 * u;
      const top = (x) => y - A0 * (0.5 + 0.5 * Math.sin((x + t * sp) / wl * TAU + r * 1.7)) * (0.6 + 0.4 * noise1(x * 0.004 + r, 3));
      const pts = []; for (let x = -PM; x <= W + PM; x += 40) pts.push([x, top(x)]);
      g.fillStyle = mix('#1a2c30', '#0a1214', u);
      g.beginPath(); g.moveTo(-PM, H + PM); pts.forEach((p) => g.lineTo(p[0], p[1])); g.lineTo(W + PM, H + PM); g.closePath(); g.fill();
      g.strokeStyle = rgba('#cfeee8', (0.25 + 0.35 * u) * a); g.lineWidth = 1 + 1.6 * u;
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    }
  }
  // 五色光：同心的五色光晕、慢慢转的五瓣光，再加几道宽光束（画进低分辨率缓冲）
  function fiveLight(q, x, y, t, r0, L, peak) {
    q.globalCompositeOperation = 'lighter';
    const rs = [1.6, 1.32, 1.06, 0.82, 0.58];
    for (let k = 0; k < 5; k++) glo(q, x, y, r0 * rs[k], FIVE[k], (0.12 + 0.04 * k) * L);
    for (let k = 0; k < 5; k++) {
      const a = t * 0.45 + k * TAU / 5, d = r0 * 0.62;
      q.save(); q.translate(x + Math.cos(a) * d, y + Math.sin(a) * d); q.rotate(a); q.scale(1, 0.26); glo(q, 0, 0, r0 * 0.95, FIVE[k], 0.3 * L); q.restore();
    }
    for (let i = 0; i < 7; i++) {
      const an = (i / 7) * TAU + t * 0.12 + Math.sin(t * 0.7 + i) * 0.03, col = FIVE[i % 5], L0 = (500 + 1300 * L) * (0.7 + 0.5 * h2(i, 3)), w0 = 120 + 80 * h2(i, 4), f = (0.2 * L + 0.3 * peak) * (0.6 + 0.4 * Math.sin(t * 3 + i));
      beam(q, x, y, an, L0, w0, col, f * 1.1);
    }
    glo(q, x, y, 260 + 420 * L, '#e3f9fd', 0.14 * L * L + 0.16 * peak);
  }

  function nwDraw(g, c, T) {
    const t = c.t, lt = c.lt;
    const tGrow = T(4), tPeak = T(7), tOut = T(8);
    // 光：①烛火一点；②与字起暴涨，辉字满屏；③徒字熄灭
    const grow = easeIn(clamp((lt - tGrow) / (tPeak - tGrow))), peak = lt >= tPeak ? Math.exp(-(lt - tPeak) / 0.5) : 0;
    const out = ramp(lt, tOut - 0.05, tOut + 0.4);
    const L = lt < tOut ? Math.max(grow, lt >= tPeak ? 1 : 0) : 1 - out;
    const push = 0.07 * easeInOut(clamp((lt - tGrow) / (tPeak - tGrow))) * (1 - 0.5 * out);
    const shake = 5 * peak + 3 * c.de(0.25) * (lt < tGrow ? 1 : 0.3);
    // 天与墨云在无穷远：不随镜头推拉，按整像素贴（走快速路径）
    { const S = (XYT.sprites && XYT.sprites.S) || 1, cx = Math.round(-((t * 26) % 600) * S) / S;
      g.save(); g.setTransform(S, 0, 0, S, 0, 0); nwSky(g); g.drawImage(nwClouds(), cx, -20, W + 600, 260); g.restore(); }
    cam(g, { z: 1.0 + push, cx: NW_P[0], cy: NW_P[1], t, kick: shake });
    let lv = 0;
    if (lt < tOut) lv = nwBolt(g, lt, [0.22, 1.9]);
    // 浪墙：每拍向上拱一次；辉字被光推退、浪唇削掉、矮下去；③塌下去
    const de = c.de(0.6), heave = Math.min(40, 22 * c.be(0.45) + 30 * de), push2 = 180 * easeOut(clamp((lt - tPeak + 0.15) / 0.8)), sink = 300 * easeIn(ramp(lt, tOut, c.dur));
    const drop = 1 - 0.4 * easeOut(clamp((lt - tPeak) / 0.6)), cut = ramp(lt, tPeak - 0.02, tPeak + 0.2), wx = 600 + push2, rise = 1 - 0.3 * out;
    // 远浪（就是水魔兽）与中浪：在雨雾里，一起画进低分辨率缓冲
    let far;
    const brk = ramp(lt, tOut, tOut + 1.4);
    soft(g, 0.36, (q) => {
      far = bigWave(q, t * 0.8, { xL: wx + 300, xR: W + 160, base: NW_HZ + 20 + sink * 0.8, Hp: (470 + heave * 0.6) * rise, Hr: 330 * rise, R: 112, seed: 11, lit: '#3a6462', face: '#16302f', deep: '#010203', foam: '#c8e4de', lines: 6, lineA: 0.22, lace: 10, mist: 1 });
      // 兽头的墨团：浪管后面一大片浓墨
      const [hx0, hy0] = far.cc;
      A.softBlob(q, hx0 + 90, hy0 + 40, 230, 0.55 * (1 - brk), '#010203');
      beastHorns(q, t, far, (1 - 0.6 * brk) * rise, de);
      // 兽与近浪之间一层飞沫水雾
      q.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) gloE(q, wx + 160 + i * 130, NW_HZ - 140 - 40 * Math.sin(i + t * 0.5), 220, 60, '#9fc8c4', 0.12);
      q.globalCompositeOperation = 'source-over';
    }, [wx - 40, -60, W + 60, NW_HZ + 80]);
    beastFace(g, t, far, (1 - 0.5 * grow) * (1 - brk), 0.55 + 0.45 * c.be(0.5), de);
    // 近浪前一层飞沫水雾
    add(g, () => { for (let i = 0; i < 4; i++) gloE(g, wx + 220 + i * 160, NW_HZ - 60, 220, 50, '#a8d0cc', 0.09); });
    // 近浪：浪头离她至少 120 像素，高而前倾（仰拍）
    const nearHp = Math.min(430, (330 + heave) * 1.3) * rise * drop;
    const near = bigWave(g, t, { xL: wx + 100, xR: W + 100, base: NW_HZ + 40 + sink, Hp: nearHp, Hr: 140 * rise, R: 80, seed: 3, lit: '#5a8a84', face: '#1e3836', deep: '#04090a', foam: '#e3f9f6', lines: 7, lineA: 0.42, lace: 16, mist: 1.2, cut });
    if (lv > 0.02) add(g, () => glo(g, 980, 180, 520, '#9fe8d8', 0.4 * lv));
    churn(g, t, NW_HZ + 20, 14 + 10 * c.be(0.4), 1);
    // 最近的一层：右下角一道压过来的暗浪（虚）
    soft(g, 0.35, (q) => bigWave(q, t * 1.1, { xL: 990 + push2 * 0.5, xR: W + 260, base: H + 60 + sink * 0.5, Hp: (250 + heave * 0.5) * rise, Hr: 110, R: 66, seed: 17, lit: '#1e3436', face: '#0a1416', deep: '#020405', foam: '#bcd8d4', lines: 3, lineA: 0.2, lace: 6, mist: 0.6 }), [860, 420, W + 60, H + 40]);
    // 浪脚的雨雾
    add(g, () => { for (let i = 0; i < 3; i++) gloE(g, ((i * 520 + t * 40) % 1560) - 140, NW_HZ + 4, 380, 46, '#5a7c7c', 0.22); });
    // 浪头抛出的飞沫
    add(g, () => {
      for (let i = 0; i < 30; i++) {
        const P = 0.9 + 0.6 * h2(i, 12), ph = ((t / P + h2(i, 13)) % 1), src = near.lip[Math.floor(h2(i, 17) * 8)];
        const px = src[0] - (60 + 120 * h2(i, 14)) * ph * P, py = src[1] - (60 + 120 * h2(i, 15)) * ph * P + 300 * (ph * P) * (ph * P);
        glo(g, px, py, 2 + 4 * h2(i, 16), '#cfeee8', 0.45 * (1 - ph) * (1 - out) * (1 - cut));
      }
    });
    // 她：女娲形态。③变得单薄、半透明，头朝下斜着坠向湖面
    const fall = easeIn(ramp(lt, tOut + 0.1, c.dur + 0.2)), tilt = -0.55 * smooth((lt - tOut - 0.1) / 0.7);
    const fx = NW_P[0] - 30 * fall, fy = NW_P[1] + (580 - NW_P[1]) * fall, ghost = lerp(1, 0.45, out) - 0.2 * fall;
    const fo = { form: 'nuwa', pose: lt < tOut ? 'summon' : 'fall', facing: 1, wind: 0.9, windDir: lt < tOut ? -1 : 1, glow: 0.1 + 0.6 * L, glowColor: '#bff3ee', alpha: ghost, hairLoose: lt >= tOut };
    const piv = [fx, fy - 80], ct = Math.cos(tilt), stt = Math.sin(tilt);
    const rotP = (p) => [piv[0] + (p[0] - piv[0]) * ct - (p[1] - piv[1]) * stt, piv[1] + (p[0] - piv[0]) * stt + (p[1] - piv[1]) * ct];
    const chest = rotP(F.points('linger', fx, fy, 0.95, 3, fo).chest);
    const r0 = 26 + 234 * L;
    // 身后的光晕（半径上限 260）
    add(g, () => {
      if (L <= 0.15) { glo(g, chest[0], chest[1], r0 * 1.5, '#48c0a3', 0.25 * L); glo(g, chest[0], chest[1], r0, '#fff4dc', (0.2 + 0.5 * L) * (1 - grow)); }
      glo(g, chest[0], chest[1], 14 + 30 * L, '#ffffff', 0.7 * (0.4 + 0.6 * L) * (1 - out * 0.9) * (0.85 + 0.15 * Math.sin(t * 9)));
    });
    const orbs = L > 0.15 && (L < 0.75 || lt > tPeak + 0.4);
    if (orbs) V.glowOrbs(g, c, { x: chest[0], y: chest[1], r: 80 + 140 * L, tilt: 0.3, n: 5, colors: FIVE, size: 6 + 12 * L + 10 * peak, layer: 'back', alpha: L });
    g.save(); g.translate(piv[0], piv[1]); g.rotate(tilt); g.translate(-piv[0], -piv[1]);
    F.draw(g, 'linger', fx, fy, 0.95, t * (1 - 0.6 * out), fo);
    g.restore();
    if (orbs) V.glowOrbs(g, c, { x: chest[0], y: chest[1], r: 80 + 140 * L, tilt: 0.3, n: 5, colors: FIVE, size: 6 + 12 * L + 10 * peak, layer: 'front', alpha: L });
    // 烛火：①胸前一点暖光，在风里一跳一跳
    if (lt < tGrow + 0.3) add(g, () => { const f = noise1(t * 9, 3); glo(g, chest[0] + 6, chest[1], 18 + 8 * f, '#ffd890', 0.85 * (1 - grow)); glo(g, chest[0] + 6, chest[1], 5 + 2 * f, '#ffffff', 0.9); });
    V.rain(g, c, { n: 120, angle: -0.25, speed: 1100, len: 46, color: mix('#8ab0b0', '#f4fffc', L), alpha: 0.4 * (1 - 0.5 * out) + 0.3 * L, beat: 0.4 });
    // 她身边 120 像素内的雨丝被烛光照亮
    if (lt < tOut) add(g, () => {
      g.strokeStyle = rgba('#ffe6b0', 0.55 * (1 - 0.6 * grow)); g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i < 26; i++) { const P = 0.32 + 0.2 * h2(i, 3), ph = (t / P + h2(i, 4)) % 1, x = chest[0] - 110 + 220 * h2(i, 5) + (ph - 0.5) * 60, y = chest[1] - 130 + ph * 260; if (Math.hypot(x - chest[0], y - chest[1]) < 120) { g.moveTo(x, y); g.lineTo(x + 6, y + 24); } }
      g.stroke();
    });
    // ②五色光暴涨
    // 辉：一记暖白的满屏辉光，边上一圈虹彩，0.15 秒后褪（与五色光一起画进低分辨率缓冲）
    const ba = lt - tPeak, bf = ba < -0.06 || ba > 0.9 ? 0 : ba < 0 ? clamp(1 + ba / 0.06) : ba < 0.1 ? 1 : Math.exp(-(ba - 0.1) / 0.1);
    if ((L > 0.02 && lt < tOut + 0.5) || bf > 0.01) add(g, () => soft(g, 0.16, (q) => {
      if (L > 0.02) fiveLight(q, chest[0], chest[1], t, r0, L, peak * (1 - 0.7 * bf));
      if (bf > 0.01) { q.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) glo(q, chest[0], chest[1], 860 - k * 80, FIVE[k], 0.2 * bf); glo(q, chest[0], chest[1], 520, '#fff6e8', 0.9 * bf); glo(q, chest[0], chest[1], 240, '#ffffff', bf); }
    }));
    // 浪唇被削掉：五色水珠向右上飞散
    if (lt > tPeak && lt < tPeak + 1.6) {
      const a = lt - tPeak, ex = 600 + 100 + 80 * 1.1, ey = NW_HZ + 40 - 430;
      add(g, () => {
        for (let i = 0; i < 100; i++) {
          const st = 0.12 * h2(i, 21), aa = a - st; if (aa <= 0) continue;
          const an = -1.2 + 1.1 * h2(i, 22), v = 260 + 520 * h2(i, 23), x = ex - 40 + 140 * h2(i, 24) + Math.cos(an) * v * aa + 90 * aa, y = ey + 160 * h2(i, 25) + Math.sin(an) * v * aa + 380 * aa * aa;
          glo(g, x, y, 2 + 4 * h2(i, 26), FIVE[i % 5], 0.85 * clamp(1 - aa / 1.4) * (a < 0.12 ? 0.5 : 1));
        }
      });
    }
    // ③熄灭以后：墨影崩散——一滴滴墨顺着下落的方向拉长，落进湖里洇开一圈；五色余光点点落下；最后一拍她触到水面
    if (lt > tOut) {
      const a = lt - tOut, [bx, by] = far.cc, wy = NW_HZ + 26;
      if (a < 1.6) add(g, () => { const k = Math.sin(PI * clamp(a / 1.6)); gloE(g, bx + 40, by, 300, 180, '#48c0a3', 0.16 * k); });
      for (let i = 0; i < 28; i++) {
        const st = 0.7 * h2(i, 41), age = a - st; if (age <= 0) continue;
        const x0 = bx - 160 + 420 * h2(i, 42), y0 = by - 140 + 300 * h2(i, 44), vx = 20 * (h2(i, 43) - 0.5), v0 = 20 + 30 * h2(i, 46), gy = 320, r = 3 + 6 * h2(i, 45);
        const hit = (-v0 + Math.sqrt(v0 * v0 + 2 * gy * Math.max(1, wy - y0))) / gy;
        if (age < hit) {
          const x = x0 + vx * age, y = y0 + v0 * age + 0.5 * gy * age * age, vy = v0 + gy * age, sp = Math.hypot(vx, vy);
          puff(g, x, y - r, r * 3.2, '#020405', 0.18);
          // 墨滴：圆底尖头，顺着速度拉长，后面拖一道淡墨尾
          const st2 = 1 + sp / 260;
          g.save(); g.translate(x, y); g.rotate(Math.atan2(vy, vx) - PI / 2);
          g.strokeStyle = rgba('#020406', 0.3); g.lineWidth = r * 0.5; g.beginPath(); g.moveTo(0, -r); g.lineTo(0, -r * (2 + 3 * st2)); g.stroke();
          g.fillStyle = rgba('#020406', 0.88); g.beginPath(); g.moveTo(0, -r * 1.6 * st2); g.quadraticCurveTo(r * 0.9, -r * 0.3, r * 0.8, r * 0.2); g.arc(0, r * 0.2, r * 0.8, 0, PI); g.quadraticCurveTo(-r * 0.9, -r * 0.3, 0, -r * 1.6 * st2); g.fill();
          g.restore();
          if (i % 3 === 0) add(g, () => glo(g, x - r * 0.3, y, r * 0.6, '#6ae0c8', 0.4));
        } else if (age - hit < 0.9) {
          const u = (age - hit) / 0.9, x = x0 + vx * hit, rr = 4 + 40 * easeOut(u);
          gloE(g, x, wy + 4, rr * 1.3, rr * 0.34, '#020405', 0.4 * (1 - u));
          g.strokeStyle = rgba('#020406', 0.55 * (1 - u)); g.lineWidth = 2.4 * (1 - u) + 0.6;
          g.beginPath(); g.ellipse(x, wy + 4, rr, rr * 0.22, 0, 0, TAU); g.stroke();
        }
      }
      add(g, () => { for (let i = 0; i < 26; i++) { const ph = (a * 0.25 + h2(i, 51)) % 1, x = fx - 220 + h2(i, 52) * 440 + Math.sin(a * 2 + i) * 20, y = fy - 300 + ph * 380; glo(g, x, y, 2 + 3 * h2(i, 53), FIVE[i % 5], 0.7 * Math.sin(PI * ph) * clamp(1 - a / 2.8)); } });
      // 最后一拍：她的指尖触到水面，一圈涟漪与一小簇水花
      let lb = c.dur - 0.4;
      if (c.grid && c.b) { const s0 = c.t - c.lt; let k = c.b.i; while (k > 0 && c.grid.time(k) - s0 > c.dur - 0.15) k--; for (let j = 0; j < 12 && c.grid.time(k + 1) - s0 <= c.dur - 0.15; j++) k++; lb = c.grid.time(k) - s0; }
      if (lt > lb) {
        const u = clamp((lt - lb) / 0.8), sx = fx - 70, rr = 10 + 90 * easeOut(u);
        g.strokeStyle = rgba('#cfeee8', 0.6 * (1 - u)); g.lineWidth = 2; g.beginPath(); g.ellipse(sx, wy + 2, rr, rr * 0.2, 0, 0, TAU); g.stroke();
        add(g, () => { for (let i = 0; i < 10; i++) { const an = -PI * (0.2 + 0.6 * h2(i, 61)), v = 120 + 120 * h2(i, 62), aa = lt - lb; glo(g, sx + Math.cos(an) * v * aa, wy + Math.sin(an) * v * aa + 300 * aa * aa, 2 + 2 * h2(i, 63), '#e3f9fd', 0.8 * (1 - u)); } });
      }
    }
    g.restore();
  }
  // 闪电：预先算好的一道折线（带两枝岔），亮一下、再闪一下就灭；返回亮度
  const nwBoltPts = (k) => memo('nwbolt' + k, () => {
    const r = A.rng(41 + k * 17), main = [], x0 = 820 + 320 * r();
    let x = x0, y = -30;
    while (y < 340) { x += (r() - 0.5) * 70; y += 18 + 26 * r(); main.push([x, y]); }
    const fork = (i) => { const p = main[i], out = [[p[0], p[1]]]; let fx = p[0], fy = p[1]; const d = r() < 0.5 ? -1 : 1; for (let j = 0; j < 5; j++) { fx += d * (10 + 26 * r()); fy += 14 + 20 * r(); out.push([fx, fy]); } return out; };
    return [[[x0, -30]].concat(main), fork(3 + Math.floor(r() * 3)), fork(6 + Math.floor(r() * 3))];
  });
  function nwBolt(g, lt, at) {
    let lv = 0;
    at.forEach((s, k) => {
      const a = lt - s; if (a < 0 || a > 0.6) return;
      const I = Math.max(Math.exp(-a / 0.05), a > 0.1 ? 0.7 * Math.exp(-(a - 0.1) / 0.08) : 0);
      lv = Math.max(lv, I);
      const P = nwBoltPts(k);
      add(g, () => {
        g.lineJoin = 'round'; g.lineCap = 'round';
        P.forEach((pts, j) => { for (const [lw, al, col] of [[6, 0.3, '#9fe8d8'], [1.8, 0.95, '#ffffff']]) { g.strokeStyle = rgba(col, al * I * (j ? 0.6 : 1)); g.lineWidth = lw * (j ? 0.6 : 1); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); } });
      });
    });
    return lv;
  }

  // =====================================================================
  // 40 怀中红光：当泪干血盈眶涌｜白雪纷飞｜都成红
  // =====================================================================
  const RL_T = [0.28, 0.58, 0.96, 1.36, 1.78, 2.2, 2.5, 3.08, 3.48, 3.86, 4.14, 4.94, 5.56, 5.96];
  const RL = { x: 900, y: 640, s: 2.8 };      // 他跪着的位置（朝左，她横在他怀里朝湖）

  XYT.registerShot('c2_redlight', {
    name: '怀中红光', zone: 'left', night: false, text: '#e9f1f6', shadow: 'rgba(16,20,26,0.9)', accent: '#be002f', bloom: 0.3,
    draw(g, c) {
      const T = (k) => chT(c, k, RL_T);
      if (c.lt < T(7)) rlEye(g, c, T);
      else rlShore(g, c, T);
    },
  });

  // 血丝：从眼角往瞳仁伸的一枝枝细红线（预先算好），grow 0..1
  function veinNet(key, x0, y0, dir, n, seed) {
    return memo('vein-' + key, () => {
      const r = A.rng(seed), out = [];
      const grow = (x, y, a, len, w, d0, depth) => {
        const pts = [[x, y]]; let cx = x, cy = y, an = a;
        const m = Math.max(3, Math.round(len / 9));
        for (let i = 0; i < m; i++) { an += (r() - 0.5) * 0.9; cx += Math.cos(an) * len / m; cy += Math.sin(an) * len / m; pts.push([cx, cy]); if (depth > 0 && r() < 0.3) grow(cx, cy, an + (r() < 0.5 ? -1 : 1) * (0.5 + 0.6 * r()), len * 0.5, w * 0.6, d0 + 0.25 * i / m, depth - 1); }
        out.push({ pts, w, d0 });
      };
      for (let k = 0; k < n; k++) grow(x0, y0 + (r() - 0.5) * 40, dir + (r() - 0.5) * 1.1, 90 + 80 * r(), 1.6 + r(), r() * 0.25, 2);
      return out;
    });
  }
  function drawVeins(g, net, grow, a) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const b of net) {
      const u = clamp((grow - b.d0) / 0.6);
      if (u <= 0) continue;
      const P = b.pts, n = P.length - 1, end = u * n, k = Math.floor(end), f = end - k;
      g.strokeStyle = rgba('#b0202a', a * 0.75); g.lineWidth = b.w;
      g.beginPath(); g.moveTo(P[0][0], P[0][1]); for (let i = 1; i <= k; i++) g.lineTo(P[i][0], P[i][1]); if (k < n) g.lineTo(lerp(P[k][0], P[k + 1][0], f), lerp(P[k][1], P[k + 1][1], f)); g.stroke();
    }
  }

  // 眉：眉头粗而乱（一撮竖着长），往后顺着眉形斜躺、变细（缓存）
  const rlBrow = () => C('rl-brow2', 860, 220, 1, (q) => {
    const r = A.rng(77), P = (u) => [40 + u * 780, 160 - 52 * Math.sin(PI * Math.pow(u, 0.7)) - 30 * u], wid = (u) => 66 * (1 - u * 0.86) + 6;
    for (let i = 0; i < 26; i++) { const u = i / 25, [x, y] = P(u); A.softBlob(q, x, y, wid(u) * 0.75, 0.18 * (1 - 0.6 * u), '#2a1a18'); }
    q.lineCap = 'round';
    for (let i = 0; i < 560; i++) {
      const u = Math.pow(r(), 0.75), [x, y] = P(u), w = wid(u), off = (r() - 0.5) * w;
      const ang = lerp(-1.45, -0.22, Math.pow(u, 0.5)) + (r() - 0.5) * lerp(0.9, 0.3, u), L = lerp(24, 40, u) * (0.6 + 0.6 * r());
      q.strokeStyle = rgba(r() < 0.7 ? '#140c0c' : '#3a2824', 0.5 + 0.4 * r()); q.lineWidth = 1.2 + 1.5 * r() * (1 - u * 0.5);
      q.beginPath(); q.moveTo(x - L * 0.3, y + off); q.quadraticCurveTo(x + Math.cos(ang) * L * 0.5, y + off + Math.sin(ang) * L * 0.5 + 2, x + Math.cos(ang) * L, y + off + Math.sin(ang) * L); q.stroke();
    }
  });
  // 睫毛：男子的，稀而直、短（10–14 像素），不卷
  function lashes(g, X, lid, n, seed, lower) {
    const r = A.rng(seed);
    g.strokeStyle = '#100808'; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const u = lower ? 0.4 + 0.5 * (i + r() * 0.6) / n : 0.15 + 0.8 * (i + r() * 0.5) / n, x = X(u), y = lid(u);
      const a = lower ? PI / 2 + 0.25 + u * 0.4 : -PI / 2 + lerp(-0.25, 0.7, u) + (r() - 0.5) * 0.2, L = lower ? 6 + 5 * r() : 10 + 4 * r();
      g.lineWidth = lower ? 1.1 : 1.8 + 0.6 * r();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
  }
  // ① 当泪干血盈眶涌：极近特写他的眼。下睑积着的一汪泪在“干”字收干；“血”字起血丝从眼角爬进眼白，按拍一涨一涨；“涌”字下睑漫起一弯殷红，眼尾挂下一滴
  function rlEye(g, c, T) {
    const t = c.t, lt = c.lt, p = clamp(lt / T(7));
    const ex = 690, ey = 386, EW = 300;
    cam(g, { z: 1.0 + 0.06 * easeInOut(p), cx: ex, cy: ey, t });
    putPlate(g, rlSkin());
    const X = (u) => ex - EW + u * EW * 2;
    const lidU = (u) => ey + 8 * (1 - u) - 26 * u - 100 * Math.sin(PI * Math.pow(u, 0.8));
    const lidL = (u) => ey + 8 * (1 - u) - 18 * u + 54 * Math.sin(PI * Math.pow(u, 1.2));
    const eyePath = () => { g.beginPath(); for (let i = 0; i <= 36; i++) { const u = i / 36; i ? g.lineTo(X(u), lidU(u)) : g.moveTo(X(u), lidU(u)); } for (let i = 36; i >= 0; i--) { const u = i / 36; g.lineTo(X(u), lidL(u)); } g.closePath(); };
    // 血丝：血字前后长出四成（0.3 秒），之后每拍长一截，涌字长满
    const t3 = T(3), t6 = T(6);
    let steps = ramp(lt, t3 + 0.25, t6);
    if (c.grid && c.b) { const k0 = beatAfter(c, t3 + 0.2), k1 = beatAfter(c, t6 - 0.05); steps = c.b.i < k0 ? 0 : clamp((c.b.i - k0 + 1 - Math.exp(-c.b.since / 0.12)) / Math.max(1, k1 - k0 + 1)); }
    const blood = 0.4 * ramp(lt, t3 - 0.05, t3 + 0.25) + 0.6 * Math.max(steps, ramp(lt, t6 - 0.2, t6 + 0.1));
    const rim = 0.35 + 0.65 * ramp(lt, T(4), t6 + 0.2), well = ramp(lt, t6 - 0.05, t6 + 0.5);
    g.drawImage(rlBrow(), ex - 430, ey - 340, 860, 220);
    // 上睑：皮肤、一道沉重的眼睑褶，褶下阴影
    const fold = (u) => lidU(u) - 40 * Math.sin(PI * Math.pow(u, 0.9)) - 10;
    g.fillStyle = K.lin(g, 0, ey - 190, 0, ey - 40, [[0, rgba('#8a5a50', 0)], [1, rgba('#6a3e36', 0.45)]]);
    g.beginPath(); for (let i = 0; i <= 36; i++) { const u = i / 36; i ? g.lineTo(X(u) + 6, fold(u)) : g.moveTo(X(u), lidU(u) - 4); } for (let i = 36; i >= 0; i--) { const u = i / 36; g.lineTo(X(u), lidU(u)); } g.closePath(); g.fill();
    g.strokeStyle = rgba('#4a2a24', 0.6); g.lineWidth = 4;
    g.beginPath(); for (let i = 2; i <= 35; i++) { const u = i / 36; i > 2 ? g.lineTo(X(u) + 6, fold(u)) : g.moveTo(X(u) + 6, fold(u)); } g.stroke();
    g.strokeStyle = rgba('#8a5a50', 0.3); g.lineWidth = 2;
    g.beginPath(); for (let i = 6; i <= 32; i++) { const u = i / 36; i > 6 ? g.lineTo(X(u) + 8, fold(u) - 16 * Math.sin(PI * u)) : g.moveTo(X(u) + 8, fold(u) - 16 * Math.sin(PI * u)); } g.stroke();
    g.save(); eyePath(); g.clip();
    g.fillStyle = K.lin(g, X(0), 0, X(1), 0, [[0, mix('#c8b4ae', '#c88a86', blood)], [0.25, mix('#ece2de', '#ecc8c2', blood)], [0.7, mix('#f0e8e4', '#eecac4', blood)], [1, mix('#bca8a2', '#c07a76', blood)]]);
    g.fillRect(ex - EW - 10, ey - 140, EW * 2 + 20, 230);
    A.softBlob(g, X(0.06), ey, 130, 0.25 + 0.3 * blood, '#c03a40');
    A.softBlob(g, X(0.95), ey - 20, 120, 0.2 + 0.3 * blood, '#c03a40');
    const beat = 0.75 + 0.25 * c.be(0.35);
    drawVeins(g, veinNet('l', X(0.03), ey + 2, -0.05, 6, 11), blood, beat);
    drawVeins(g, veinNet('r', X(0.97), ey - 22, PI + 0.1, 6, 17), blood, beat);
    const ix = ex - 46, iy = ey - 10, IR = 104;
    const ig = g.createRadialGradient(ix, iy, 8, ix, iy, IR);
    ig.addColorStop(0, '#0a0606'); ig.addColorStop(0.3, '#1c100c'); ig.addColorStop(0.62, '#5a3424'); ig.addColorStop(0.86, '#3a2216'); ig.addColorStop(1, '#0c0604');
    g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, IR, 0, TAU); g.fill();
    g.strokeStyle = rgba('#9a6a48', 0.32); g.lineWidth = 1.1;
    g.beginPath(); for (let k = 0; k < 64; k++) { const a = (k / 64) * TAU + h2(k, 3) * 0.08, r0 = 38 + 6 * h2(k, 5), r1 = 70 + 26 * h2(k, 4); g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); g.quadraticCurveTo(ix + Math.cos(a + 0.06) * (r0 + r1) / 2, iy + Math.sin(a + 0.06) * (r0 + r1) / 2, ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); } g.stroke();
    g.fillStyle = '#030101'; g.beginPath(); g.arc(ix, iy, 36, 0, TAU); g.fill();
    g.fillStyle = K.lin(g, 0, ey - 120, 0, ey - 20, [[0, 'rgba(30,14,12,0.75)'], [1, 'rgba(30,14,12,0)']]); g.fillRect(ex - EW - 10, ey - 130, EW * 2 + 20, 110);
    g.fillStyle = rgba('#f4f8fa', 0.92); g.beginPath(); g.ellipse(ix + 40, iy - 40, 15, 10, -0.5, 0, TAU); g.fill();
    add(g, () => { glo(g, ix - 30, iy + 36, 14, '#ffffff', 0.7 * (1 - 0.6 * p)); glo(g, ix + 40, iy - 40, 40, '#dfeef4', 0.3); });
    g.restore();
    // 下睑：红肿的睑缘（一开始就泛红）
    g.strokeStyle = rgba(mix('#a0545a', '#a01c28', rim), 0.55 + 0.3 * rim); g.lineWidth = 5 + 4 * rim;
    g.beginPath(); for (let i = 2; i <= 34; i++) { const u = i / 36; i > 2 ? g.lineTo(X(u), lidL(u) + 3) : g.moveTo(X(u), lidL(u) + 3); } g.stroke();
    // 泪：下睑积着一弯泪（亮的弯月面和一颗亮珠），“干”字前后收干
    const wet = 1 - ramp(lt, T(1), T(2) + 0.25);
    if (wet > 0.01) {
      g.fillStyle = rgba('#eef6fa', 0.5 * wet);
      g.beginPath(); for (let i = 4; i <= 32; i++) { const u = i / 36; i > 4 ? g.lineTo(X(u), lidL(u) - 3 - 7 * wet * Math.sin(PI * (u - 0.1) / 0.8)) : g.moveTo(X(u), lidL(u) - 2); } for (let i = 32; i >= 4; i--) { const u = i / 36; g.lineTo(X(u), lidL(u) - 1); } g.closePath(); g.fill();
      add(g, () => { glo(g, X(0.6), lidL(0.6) - 6, 30, '#e8f8ff', 0.4 * wet); glo(g, X(0.62), lidL(0.62) - 7, 5, '#ffffff', 0.95 * wet); });
      // 颊上一线淡淡的湿光，顺着脸的弧度
      const track = () => { g.beginPath(); g.moveTo(X(0.66), lidL(0.66) + 14); g.bezierCurveTo(X(0.7), ey + 150, X(0.62), ey + 220, X(0.52), ey + 300); };
      g.strokeStyle = rgba('#ffffff', 0.05 * wet); g.lineWidth = 16; track(); g.stroke(); g.strokeStyle = rgba('#ffffff', 0.07 * wet); g.lineWidth = 5; track(); g.stroke();
    }
    // 涌：下睑中段鼓起一弯殷红的血泪，中间厚、两头薄，上沿一线高光，瞳仁的影子映在里面；眼尾一滴暗红挂着
    if (well > 0) {
      const u0 = 0.14, u1 = 0.9, th = (u) => (3 + 13 * Math.sin(PI * (u - u0) / (u1 - u0))) * well;
      g.fillStyle = K.lin(g, 0, ey + 20, 0, ey + 70, [[0, '#d0102c'], [1, '#6a0010']]);
      g.beginPath(); for (let i = 0; i <= 30; i++) { const u = u0 + (i / 30) * (u1 - u0); i ? g.lineTo(X(u), lidL(u) - th(u)) : g.moveTo(X(u), lidL(u)); } for (let i = 30; i >= 0; i--) { const u = u0 + (i / 30) * (u1 - u0); g.lineTo(X(u), lidL(u) + 2); } g.closePath(); g.fill();
      g.fillStyle = rgba('#200406', 0.45 * well); g.beginPath(); g.ellipse(ix + 4, lidL((ix - X(0)) / (2 * EW)) - th((ix - X(0)) / (2 * EW)) * 0.5, 60, th((ix - X(0)) / (2 * EW)) * 0.35, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba('#ffd8dc', 0.75 * well); g.lineWidth = 2;
      g.beginPath(); for (let i = 0; i <= 24; i++) { const u = 0.3 + (i / 24) * 0.45; i ? g.lineTo(X(u), lidL(u) - th(u) + 2) : g.moveTo(X(u), lidL(u) - th(u) + 2); } g.stroke();
      add(g, () => glo(g, X(0.5), lidL(0.5) - th(0.5) + 3, 7, '#ffffff', 0.8 * well));
      const dr = ramp(lt, t6 + 0.15, T(7) - 0.05), dx = X(0.92), dy = lidL(0.92) + 4 + 22 * dr * dr;
      if (dr > 0) {
        g.fillStyle = '#7a0618'; g.beginPath(); g.moveTo(dx - 3, lidL(0.92)); g.quadraticCurveTo(dx - 4, dy - 6, dx - 6 - 3 * dr, dy); g.arc(dx, dy, 6 + 3 * dr, PI, 0, true); g.quadraticCurveTo(dx + 4, dy - 6, dx + 3, lidL(0.92)); g.closePath(); g.fill();
        g.fillStyle = rgba('#ffd0d4', 0.7); g.beginPath(); g.arc(dx - 2, dy - 2, 1.8, 0, TAU); g.fill();
      }
    }
    // 上睑缘：一笔浓墨收在眼角，不上挑
    g.fillStyle = '#120a0a';
    g.beginPath(); for (let i = 0; i <= 36; i++) { const u = i / 36; i ? g.lineTo(X(u), lidU(u) + 1) : g.moveTo(X(u), lidU(u) + 1); }
    for (let i = 36; i >= 0; i--) { const u = i / 36; g.lineTo(X(u), lidU(u) - 2 - 7 * Math.sin(PI * Math.pow(u, 0.7))); } g.closePath(); g.fill();
    lashes(g, X, (u) => lidU(u) - 4 - 5 * Math.sin(PI * u), 13, 5, false);
    lashes(g, X, (u) => lidL(u) + 4, 7, 9, true);
    g.strokeStyle = rgba('#4a2a26', 0.55); g.lineWidth = 1.6;
    g.beginPath(); for (let i = 0; i <= 36; i++) { const u = i / 36; i ? g.lineTo(X(u), lidL(u)) : g.moveTo(X(u), lidL(u)); } g.stroke();
    // 内眼角泪阜
    g.fillStyle = mix('#d08a86', '#b8323c', rim); g.beginPath(); g.ellipse(X(0) + 16, ey + 4, 16, 11, 0.15, 0, TAU); g.fill();
    g.fillStyle = rgba('#ffffff', 0.5); g.beginPath(); g.ellipse(X(0) + 12, ey + 1, 4, 2.5, 0.2, 0, TAU); g.fill();
    // 一缕白了的鬓发从右边垂过（接上一镜）：三簇，粗细浓淡不一，虚焦，慢慢摆
    soft(g, 0.35, (q) => {
      q.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const sw = Math.sin(t * 0.6 + k * 1.3) * 10, x0 = 1150 + k * 34, w0 = [16, 10, 6][k];
        for (let j = 0; j < 5; j++) {
          const o = (j - 2) * w0 * 0.35;
          q.strokeStyle = rgba(j % 2 ? '#e8e4de' : '#f6f2ec', [0.75, 0.55, 0.4][k] * (0.7 + 0.3 * h2(j, k))); q.lineWidth = w0 * (0.3 + 0.2 * h2(j, k + 3));
          q.beginPath(); q.moveTo(x0 + o, -40); q.bezierCurveTo(x0 - 40 + o + sw * 0.5, 180, x0 + o * 1.4 + sw, 420, x0 - 30 + o * 2 + sw * 1.5, H + 40); q.stroke();
        }
      }
    }, [1060, -40, W + 40, H + 40]);
    g.restore();
  }
  // 极近特写的皮肤底：冷天光，眉骨与颧骨受光，眼窝深、眼下青影；颊上一抹灰、一道细细的擦伤；工笔细纹
  function rlSkin() {
    return plate('rl-skin2', 0.6, (q) => {
      q.fillStyle = K.lin(q, 0, -PM, 0, H + PM, [[0, '#c0a698'], [0.3, '#d8c0b0'], [0.62, '#d0b6a6'], [1, '#aa8e82']]);
      q.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM);
      A.softBlob(q, 660, 150, 460, 0.3, '#ecdcd2');
      A.softBlob(q, 820, 650, 420, 0.25, '#ead8cc');
      A.softBlob(q, 690, 380, 360, 0.32, '#8a645a');
      A.softBlob(q, 330, 420, 260, 0.35, '#8a6a60');
      A.softBlob(q, 1150, 300, 300, 0.25, '#9a7a70');
      A.softBlob(q, 650, 500, 240, 0.35, '#6a4a54');            // 眼下青影
      A.softBlob(q, 940, 580, 70, 0.3, '#7a6a5e'); A.softBlob(q, 980, 610, 40, 0.25, '#6a5a50');   // 灰
      q.strokeStyle = rgba('#a03a32', 0.45); q.lineWidth = 1.4; q.beginPath(); q.moveTo(880, 640); q.lineTo(960, 618); q.moveTo(890, 648); q.lineTo(944, 634); q.stroke();
      // 工笔细纹：顺着肌理的细线
      const r = A.rng(5);
      q.lineCap = 'round';
      for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H, L = 14 + 30 * r(), a = 0.4 + (x - 640) / 1600 + (r() - 0.5) * 0.4; q.strokeStyle = rgba(r() < 0.5 ? '#7a5446' : '#f0e0d4', 0.07 + 0.05 * r()); q.lineWidth = 0.8; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + 3, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); q.stroke(); }
      q.fillStyle = rgba('#7a5a50', 0.06);
      for (let i = 0; i < 400; i++) { q.beginPath(); q.arc(r() * W, r() * H, 1 + 1.5 * r(), 0, TAU); q.fill(); }
    });
  }

  // 湖岸底版：阴天，左边大片湖面留白，远岸一线，近处湿沙由右下铺到画面中间
  function rlPlate() {
    return plate('rl2', 0.8, (q) => {
      base(q, '#c2ccd0');
      E.sky(q, { y0: -PM, y1: 400, stops: [[0, '#8a949a'], [0.6, '#b8c2c6'], [1, '#dfe8ea']] });
      add(q, () => glo(q, 300, 300, 520, '#ffffff', 0.25));
      E.mountains(q, { t: 0, layers: [
        { kind: 'far', color: '#a6b0b6', light: '#d8e0e4', litA: 0.3, y: 402, scaleY: 0.22, speed: 0, seed: 5, fog: '#d0d8dc', fogA: 0.6 },
        { kind: 'mid', color: '#8a969c', light: '#c8d0d4', litA: 0.3, y: 406, scaleY: 0.14, speed: 0, seed: 9, fog: '#c4ccd0', fogA: 0.5 },
      ] });
      const back = (r) => E.mountains(r, { t: 0, layers: [{ kind: 'far', color: '#a6b0b6', y: 402, scaleY: 0.22, speed: 0, seed: 5, fog: '#d0d8dc', fogA: 0.6 }] });
      E.water(q, { y: 404, t: 0, top: '#c6d0d4', bottom: '#8e9aa0', reflectFn: back, reflect: 0.35, wobble: 1, lines: 18, lineColor: '#f2f6f8', lineA: 0.25, mist: '#e4ecee' });
      E.mist(q, { t: 0, y: 420, h: 120, color: '#e8eef0', alpha: 0.6, speed: 0, seed: 3 });
      const sand = () => { q.beginPath(); q.moveTo(180, H + PM); q.bezierCurveTo(300, 660, 480, 626, 700, 612); q.bezierCurveTo(900, 600, 1100, 586, W + PM, 576); q.lineTo(W + PM, H + PM); q.closePath(); };
      sand(); q.fillStyle = K.lin(q, 0, 580, 0, H + PM, [[0, '#7a7e7c'], [1, '#3a3c3c']]); q.fill();
      q.strokeStyle = rgba('#eef4f4', 0.55); q.lineWidth = 2.5;
      q.beginPath(); q.moveTo(190, H + PM); q.bezierCurveTo(310, 662, 490, 628, 700, 614); q.bezierCurveTo(900, 602, 1100, 588, W + PM, 578); q.stroke();
      for (const [x, y, w, h] of [[640, 690, 150, 14], [1120, 660, 120, 12], [420, 706, 110, 10]]) { const pg = q.createRadialGradient(x, y, 0, x, y, w); pg.addColorStop(0, rgba('#dfe6e8', 0.5)); pg.addColorStop(1, rgba('#dfe6e8', 0)); q.save(); q.translate(x, y); q.scale(1, h / w); q.translate(-x, -y); q.fillStyle = pg; q.beginPath(); q.arc(x, y, w, 0, TAU); q.fill(); q.restore(); }
      const r = A.rng(31);
      for (let i = 0; i < 6; i++) { const x = 380 + r() * 880, y = 650 + r() * 70, L = 30 + 70 * r(); q.save(); q.translate(x, y); q.rotate((r() - 0.5) * 0.6); q.fillStyle = '#3a342e'; q.fillRect(-L / 2, -3, L, 6); q.restore(); }
      for (let i = 0; i < 16; i++) rock(q, 320 + r() * 940, 640 + r() * 90, 4 + 12 * r() * r(), r() * 6, i + 600, '#2e3030', '#d8e0e2', 0.4, -1);
    });
  }
  // 两人（中近景）：他朝左跪着，她横在他怀里，头枕在他小臂上。按 fig.cradle 的摆法拆开画：他（不含近臂）→ 她（褪成素白）→ 他的近臂
  const RLBOX = [300, 280, 720, 400];
  const RLO = { facing: -1, wind: 0.2, windDir: -1, light: [300, 100], rim: '#f2f8fa', rimAlpha: 0.35 };
  const rlLayout = () => memo('rl-lay', () => {
    const c = {}; for (const k of SHARED_K) if (RLO[k] !== undefined) c[k] = RLO[k];
    const bo = Object.assign({ pose: 'lie', flat: true, limp: true }, c, { wind: (c.wind ?? 0.35) * 0.5, accent: '#f2f5f7', accent2: '#dfe6ea' });
    const SA = RL.s, bp = F.points('linger', 0, RL.y, RL.s, 3, bo), xB = RL.x - 50 * SA - bp.back[0];
    const hold = (p, dy) => [(p[0] + xB - RL.x) * -1 / SA, (p[1] - RL.y) / SA + dy];
    const ao = Object.assign({ pose: 'kneel', cradle: true }, c, { holdN: hold(bp.back, -1), holdF: hold(bp.waist, 3) });
    return { bo, ao, xB, her: F.points('linger', xB, RL.y, RL.s, 3, bo), him: F.points('xiaoyao', RL.x, RL.y, RL.s, 3, ao) };
  });
  const rlPair = () => C('rl-pair2', RLBOX[2], RLBOX[3], 1, (q) => {
    const L = rlLayout();
    q.translate(-RLBOX[0], -RLBOX[1]);
    F.draw(q, 'xiaoyao', RL.x, RL.y, RL.s, 3, Object.assign({}, L.ao, { part: 'back' }));
    // 她：先画进临时画布，褪掉粉色（只留一点暖），再贴回
    const S = (XYT.sprites && XYT.sprites.S) || 1, cw = Math.ceil(RLBOX[2] * S), ch = Math.ceil(RLBOX[3] * S);
    const A1 = document.createElement('canvas'); A1.width = cw; A1.height = ch;
    const B1 = document.createElement('canvas'); B1.width = cw; B1.height = ch;
    const a = A1.getContext('2d'), b = B1.getContext('2d');
    a.setTransform(S, 0, 0, S, -RLBOX[0] * S, -RLBOX[1] * S);
    F.draw(a, 'linger', L.xB, RL.y, RL.s, 3, L.bo);
    b.drawImage(A1, 0, 0);
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'saturation'; a.fillStyle = '#808080'; a.fillRect(0, 0, cw, ch);
    a.globalCompositeOperation = 'screen'; a.fillStyle = 'rgba(14,16,20,1)'; a.fillRect(0, 0, cw, ch);
    a.globalCompositeOperation = 'destination-in'; a.drawImage(B1, 0, 0);
    q.save(); q.setTransform(1, 0, 0, 1, 0, 0); q.drawImage(A1, 0, 0); q.restore();
    F.draw(q, 'xiaoyao', RL.x, RL.y, RL.s, 3, Object.assign({}, L.ao, { part: 'front' }));
    // 她安静的脸：仰着，闭着眼（他的手臂从她颈后穿过）
    gongbi(q, { x: L.her.head[0], y: L.her.head[1] - 7, s: 0.36, rot: -2.05, flip: 1, eye: 0, t: 3, neck: 60, skin: '#f4ece8', lip: '#c48a88' });
  });
  // 殷红：像墨洇在白衣上，心口一朵不规则的花（深红芯、殷红边、一圈更深的边）；他手上、袖上几点。只落在两人身上（source-atop）
  let stainCv = null;
  function stainedPair(g, k, kh, t) {
    const img = rlPair();
    if (k <= 0.001 && kh <= 0.001) { g.drawImage(img, RLBOX[0], RLBOX[1], RLBOX[2], RLBOX[3]); return; }
    const L = rlLayout(), S = (XYT.sprites && XYT.sprites.S) || 1, w = Math.ceil(RLBOX[2] * S), h = Math.ceil(RLBOX[3] * S);
    if (!stainCv) stainCv = document.createElement('canvas');
    if (stainCv.width !== w || stainCv.height !== h) { stainCv.width = w; stainCv.height = h; }
    const q = stainCv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; q.clearRect(0, 0, w, h);
    q.drawImage(img, 0, 0, w, h);
    q.globalCompositeOperation = 'source-atop';
    q.setTransform(S, 0, 0, S, -RLBOX[0] * S, -RLBOX[1] * S);
    const [cx, cy] = L.her.chest, R0 = 6 + 62 * easeOut(k);
    if (k > 0.001) {
      // 花瓣状的几团，边缘参差
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785 + 0.4 + 0.2 * h2(i, 3), d = R0 * (0.35 + 0.3 * h2(i, 5)), rr = R0 * (0.42 + 0.3 * h2(i, 6));
        const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.75;
        const gr = q.createRadialGradient(px, py, 0, px, py, rr);
        gr.addColorStop(0, rgba('#9d0f24', 0.7)); gr.addColorStop(0.65, rgba('#be002f', 0.5)); gr.addColorStop(0.86, rgba('#6a0012', 0.42)); gr.addColorStop(1, rgba('#be002f', 0));
        q.fillStyle = gr; q.fillRect(px - rr, py - rr, rr * 2, rr * 2);
      }
      const gc = q.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.6);
      gc.addColorStop(0, rgba('#7a0618', 0.9)); gc.addColorStop(1, rgba('#9d0f24', 0)); q.fillStyle = gc; q.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
    }
    // 他的手与袖口：红点慢慢长大
    for (const [hx, hy] of [L.him.handN, L.him.handF]) for (let j = 0; j < 6; j++) {
      const a = j * 1.3 + 0.4, d = 6 + 14 * h2(j, 3), rr = (2 + 4 * h2(j, 4)) * kh * (j < 3 ? 1 : 0.7);
      q.fillStyle = rgba('#a0001e', 0.85); q.beginPath(); q.arc(hx + Math.cos(a) * d, hy + Math.sin(a) * d * 0.6 + (j > 3 ? 18 : 0), rr, 0, TAU); q.fill();
    }
    g.drawImage(stainCv, 0, 0, w, h, RLBOX[0], RLBOX[1], RLBOX[2], RLBOX[3]);
  }

  // ②③ 白雪纷飞｜都成红：中近景，湖岸。“白”字她身上升起一柱光屑，到半空散开，像雪一样落向空湖；
  // 落在她身上和他手上的在“都”字泛红、“成”字加深、“红”字全成殷红，她心口一朵殷红晕开
  function rlShore(g, c, T) {
    const t = c.t, lt = c.lt, l2 = lt - T(7), tRed = T(13), tDu = T(11), tCh = T(12);
    cam(g, { z: 1.0 + 0.015 * clamp(l2 / 3.5), cx: 760, cy: 520, t });
    putPlate(g, rlPlate());
    // 湖上漂移的两层薄雾；强拍时远处湖面一圈淡淡的涟漪
    E.mist(g, { t, y: 470, h: 90, color: '#eef2f4', alpha: 0.35, speed: 8, seed: 12 });
    E.mist(g, { t: t * 1.3 + 7, y: 540, h: 60, color: '#e8eef0', alpha: 0.25, speed: -6, seed: 19 });
    if (c.b) { const sd = c.b.sinceDown, u = clamp(sd / 2.2); if (sd < 2.2) { const rx = 20 + 160 * easeOut(u); g.strokeStyle = rgba('#f4f8fa', 0.35 * (1 - u)); g.lineWidth = 1.4; g.beginPath(); g.ellipse(380, 500, rx, rx * 0.12, 0, 0, TAU); g.stroke(); } }
    g.fillStyle = K.lin(g, -PM, 0, 460, 0, [[0, 'rgba(52,62,74,0.45)'], [0.6, 'rgba(52,62,74,0.16)'], [1, 'rgba(52,62,74,0)']]); g.fillRect(-PM, -PM, 460 + PM, H + 2 * PM);
    const L = rlLayout(), chest = L.her.chest, waist = L.her.waist, head = L.her.head;
    // 她身上的余光与头顶一片渐暗的淡光
    const fade = 1 - 0.85 * ramp(lt, T(7), c.dur);
    add(g, () => { glo(g, chest[0] - 40, chest[1] - 160, 300, '#ffffff', 0.2 * fade); glo(g, chest[0], chest[1], 160, '#ffffff', 0.22 * fade); glo(g, waist[0], waist[1], 110, '#e3f9fd', 0.2 * fade); });
    const stain = smooth(clamp((lt - tDu + 0.05) / 0.5)) * 0.18 + smooth(clamp((lt - tCh + 0.05) / 0.4)) * 0.22 + easeOut(clamp((lt - tRed + 0.05) / 0.6)) * 0.6;
    const handR = ramp(lt, tDu, tRed + 0.5);
    stainedPair(g, stain, handR, t);
    // 红的进度：都字泛红，成字加深，红字殷红
    const redK = (d) => clamp(0.25 * ramp(lt, tDu - 0.05 + 0.2 * d, tDu + 0.4 + 0.2 * d) + 0.3 * ramp(lt, tCh - 0.05 + 0.2 * d, tCh + 0.35 + 0.2 * d) + 0.45 * ramp(lt, tRed - 0.05 + 0.3 * d, tRed + 0.3 + 0.3 * d));
    // 光屑：白字起从她身上升起一柱，再散开像雪一样落下（暖白、带光晕，比天上的雪大）
    const body = [L.her.footN, L.her.kneeN, L.her.pelvis, waist, chest, head];
    const N = 96, gy = RL.y + 6, W0 = [], R0 = [];
    const redAt = (x, y) => { const dx = (x - chest[0] + 40) / 380, dy = (y - chest[1] - 30) / 170, dd = Math.sqrt(dx * dx + dy * dy); return dd < 1 ? dd : -1; };
    for (let i = 0; i < N; i++) {
      const st = T(7) - 0.05 + 0.6 * h2(i, 1), age = lt - st;
      if (age < 0) continue;
      const bu = Math.pow(h2(i, 2), 0.7) * (body.length - 1), bi = Math.min(body.length - 2, Math.floor(bu)), bf = bu - bi;
      const sx = lerp(body[bi][0], body[bi + 1][0], bf), sy = lerp(body[bi][1], body[bi + 1][1], bf) - 16;
      const upT = 0.9 + 0.7 * h2(i, 4), hgt = 200 + 300 * h2(i, 5), spread = (h2(i, 6) - 0.62) * 820;
      let x, y;
      if (age < upT) { const u = easeOut(age / upT); x = sx + spread * u * u + Math.sin(age * 3 + i) * 6; y = sy - hgt * u; }
      else { const d = age - upT, v = 34 + 40 * h2(i, 7); x = sx + spread + Math.sin(d * 1.4 + i) * 18 + d * 8; y = sy - hgt + v * d; }
      if (y > gy + 20) continue;
      const dd = redAt(x, y), red = dd >= 0 ? redK(dd + 0.15 * h2(i, 9)) : 0;
      const r = (2.5 + 2.5 * h2(i, 8)) * (1 + 0.5 * red), tw = clamp(age / 0.2) * (0.7 + 0.25 * Math.sin(t * 5 + i * 2.3) + (h2(i, 11) < 0.3 ? 0.3 * c.be(0.3) : 0));
      W0.push([x, y, r, tw * (1 - red)]); if (red > 0) R0.push([x, y, r, tw * red]);
    }
    // 落在她白衣上、他手上的光屑：飘落后停在身上
    for (let i = 0; i < 44; i++) {
      const onHand = i % 4 === 0, hp = onHand ? (i % 8 ? L.him.handN : L.him.handF) : null;
      const bu = h2(i, 31) * (body.length - 2) + 0.5, bi = Math.min(body.length - 2, Math.floor(bu)), bf = bu - bi;
      const tx = onHand ? hp[0] + (h2(i, 32) - 0.5) * 40 : lerp(body[bi][0], body[bi + 1][0], bf) + (h2(i, 32) - 0.5) * 30;
      const ty = onHand ? hp[1] + (h2(i, 33) - 0.5) * 16 : lerp(body[bi][1], body[bi + 1][1], bf) - 4 + (h2(i, 33) - 0.5) * 30;
      const land = T(8) + (tDu - T(8) + 0.2) * h2(i, 34), fall = clamp((lt - land + 1.2) / 1.2);
      if (fall <= 0) continue;
      const x = tx + (1 - fall) * (40 * Math.sin(i + lt)), y = ty - (1 - fall) * 200;
      const red = fall >= 1 ? redK(Math.hypot(tx - chest[0], ty - chest[1]) / 400) : 0, r = (2.4 + 2 * h2(i, 35)) * (1 + 0.5 * red), tw = clamp(fall * 3) * (0.8 + 0.2 * Math.sin(t * 4 + i));
      W0.push([x, y, r * 0.9, tw * (1 - red)]); if (red > 0) R0.push([x, y, r, tw * red]);
    }
    // 白的：暖白带一圈光晕（加色）；红的：殷红实心，普通叠加，才不发粉
    add(g, () => { for (const [x, y, r, a] of W0) { if (a <= 0.01) continue; glo(g, x, y, r * 3.6, '#fff2dc', 0.3 * a); glo(g, x, y, r * 1.2, '#fff6e8', 0.95 * a); } });
    for (const [x, y, r, a] of R0) { glo(g, x, y, r * 3, '#be002f', 0.22 * a); g.fillStyle = rgba(a > 0.6 ? '#9d0f24' : '#c8203c', 0.9 * a); g.beginPath(); g.arc(x, y, r * 0.9, 0, TAU); g.fill(); }
    add(g, () => { for (let i = 0; i < 6; i++) glo(g, 520 + h2(i, 91) * 700, 660 + h2(i, 92) * 50, 18, '#ffffff', 0.15 + 0.1 * Math.sin(t * 1.5 + i)); });
    g.restore();
  }
})();
