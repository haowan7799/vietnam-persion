/* 分镜镜头 第 02 组：主歌A 前四句——铃静尘浮、风倦纸鸢、落日赖檐、日挂墙头 */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 小工具 ----------
  // 静态图层缓存：用工具包的有界贴图库（总像素有上限，久不用的自动丢弃，丢了按同样参数确定地重建）
  const cache = (key, w, h, sc, fn) => E.util.cached('g02:' + key, [], w, h, sc, fn);
  // 本句第 k 字在镜头内的时间；没有歌词时用分镜表里的时间
  const charAt = (c, k, fb) => { const v = c.charT ? c.charT(k) : null; return v == null ? fb : v - (c.t - c.lt); };
  const glow = (g, x, y, r, col, a) => { if (a > 0.003) A.glow(g, x, y, r, col, a); };
  const add = (g, fn) => { const op = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; fn(); g.globalCompositeOperation = op; };
  const scr = (g, fn) => { const op = g.globalCompositeOperation; g.globalCompositeOperation = 'screen'; fn(); g.globalCompositeOperation = op; };
  const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  // 节拍推进：每拍前进 1，拍头快拍尾缓（用于“每拍一次”的动作）
  const surge = (c, k = 5) => { const x = c.b ? c.b.x : c.t * 1.2, i = Math.floor(x), f = x - i; return i + (1 - Math.exp(-k * f)) / (1 - Math.exp(-k)); };
  // 下一镜的静态贴图在本镜最后 1.3 秒里一格一格先建好（每 0.08 秒最多建一张；建过的直接跳过）。
  //   贴图在不在缓存里不影响画面，只是免得下一镜第一帧卡住
  const pretouch = (c, jobs) => {
    const k = Math.floor((c.lt - (c.dur - 1.3)) / 0.08);
    if (k < 0 || k >= jobs.length) return;
    try { jobs[k](); } catch (e) { /* 预建失败不影响本镜 */ }
  };
  // 远山贴图单独预建：把一层山画进 1×1 的小画布，只为建出它的纹理（柔边远山用共享贴图，不必预建）
  const touchHills = (L) => () => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; E.mountains(cv.getContext('2d'), { t: 0, lightDir: 1, layers: [L] }); };

  // ======================================================================
  // 1 铃静尘浮：老客栈大堂，门被推开，一道金色光柱照进空堂，浮尘、静止的铜铃、落叶入门
  // ======================================================================
  const EYE = [640, 380], Z0 = 1000;
  const proj = (x, y, z) => { const k = Z0 / z; return [EYE[0] + (x - EYE[0]) * k, EYE[1] + (y - EYE[1]) * k]; };
  const D = { x0: 760, x1: 960, y0: 172, y1: 606 };

  // 门外：曝白的深秋街景（远墙黛瓦、红枫枝、亮石板）
  function va1Outside() {
    return cache('g02_va1_out', 240, 470, 1, (q) => {
      q.translate(-750, -160);
      q.fillStyle = K.lin(q, 0, 160, 0, 630, [[0, '#fbe6bc'], [0.55, '#f6d49a'], [1, '#e8b878']]);
      q.fillRect(750, 160, 240, 470);
      // 对街的白墙与瓦檐（逆光里发白）
      q.fillStyle = '#f1dcb4'; q.fillRect(740, 410, 260, 160);
      q.fillStyle = 'rgba(120,96,80,0.55)'; q.fillRect(740, 402, 260, 12);
      q.fillStyle = 'rgba(150,120,96,0.35)';
      for (let x = 742; x < 1000; x += 7) { q.beginPath(); q.arc(x, 414, 2.2, 0, PI); q.fill(); }
      q.fillStyle = 'rgba(160,130,110,0.25)'; q.fillRect(800, 470, 30, 40); q.fillRect(900, 466, 26, 36);
      // 马头墙的翘角
      q.fillStyle = 'rgba(110,90,78,0.45)';
      poly(q, [[930, 402], [990, 402], [990, 360], [952, 360], [946, 352], [944, 362], [930, 362]]); q.fill();
      q.fillStyle = '#fbf0dc'; q.fillRect(932, 364, 58, 38);
      // 亮石板街
      q.fillStyle = K.lin(q, 0, 560, 0, 630, [[0, '#f4dcae'], [1, '#e4bf84']]); q.fillRect(740, 560, 260, 70);
      q.strokeStyle = 'rgba(160,120,80,0.25)'; q.lineWidth = 1;
      for (let k = 0; k < 5; k++) { const y = 566 + k * k * 3.2; q.beginPath(); q.moveTo(740, y); q.lineTo(1000, y); q.stroke(); }
      // 红枫枝从左上垂进门框
      const r = A.rng(31);
      q.strokeStyle = 'rgba(70,40,30,0.55)'; q.lineWidth = 3;
      q.beginPath(); q.moveTo(745, 200); q.quadraticCurveTo(800, 230, 870, 236); q.stroke();
      q.lineWidth = 1.6; q.beginPath(); q.moveTo(820, 228); q.quadraticCurveTo(850, 262, 846, 300); q.stroke();
      for (let i = 0; i < 70; i++) {
        const u = r(), x = lerp(750, 880, u) + (r() - 0.5) * 40, y = 205 + u * 40 + (r() - 0.3) * 60 * (0.4 + u);
        q.fillStyle = rgba(['#e8642c', '#f09a3e', '#d84a26', '#f6c25a'][i % 4], 0.55 + r() * 0.3);
        q.beginPath(); q.ellipse(x, y, 4 + r() * 5, 3 + r() * 3, r() * PI, 0, TAU); q.fill();
      }
      // 整体再冲一层亮
      A.softBlob(q, 880, 330, 200, 0.4, '#fff4dc');
    });
  }

  // 大堂：朝门的那面木墙、梁、楼梯、货架酒坛、地板（门洞挖空）
  function va1Room() {
    return cache('g02_va1_room2', W, H + 80, 1, (q) => {
      q.translate(0, 40);
      const r = A.rng(77);
      // 木板墙：很暗，越往左越沉
      q.fillStyle = K.lin(q, 0, 0, W, 0, [[0, '#0c0806'], [0.45, '#1a110c'], [0.62, '#24170f'], [1, '#160e0a']]);
      q.fillRect(0, -40, W, 660);
      for (let x = 0; x < W; x += 30 + r() * 16) {
        q.fillStyle = rgba('#000000', 0.3 + r() * 0.15); q.fillRect(x, 118, 1.5, 490);
        q.fillStyle = rgba('#5a3e2c', 0.04 + r() * 0.05); q.fillRect(x + 2, 118, 12 + r() * 10, 490);
      }
      for (let k = 0; k < 40; k++) { q.fillStyle = rgba(r() < 0.5 ? '#3a281c' : '#000000', 0.06 + r() * 0.08); A.inkBlob(q, r() * W, 140 + r() * 460, 10 + r() * 60, k, 0.5); q.fill(); }
      // 腰线、地栿
      q.fillStyle = '#0c0705'; q.fillRect(0, 430, W, 9); q.fillRect(0, 596, W, 14);
      q.fillStyle = 'rgba(255,190,120,0.05)'; q.fillRect(600, 430, 680, 1.2);
      // 梁与椽：椽子朝视点收拢
      q.fillStyle = '#080504'; q.fillRect(0, -40, W, 150);
      for (let k = -10; k < 16; k++) {
        const x0 = EYE[0] + k * 150, x1 = EYE[0] + k * 70;
        q.fillStyle = k % 2 ? '#130c08' : '#100a07';
        poly(q, [[x0 - 14, -40], [x0 + 14, -40], [x1 + 7, 74], [x1 - 7, 74]]); q.fill();
      }
      q.fillStyle = K.lin(q, 0, 72, 0, 118, [[0, '#2a1b13'], [0.35, '#34231a'], [1, '#110a07']]); q.fillRect(0, 72, W, 46);
      q.fillStyle = 'rgba(255,190,120,0.06)'; q.fillRect(500, 73, 780, 1.5);
      // 蛛网
      q.strokeStyle = 'rgba(210,190,160,0.1)'; q.lineWidth = 0.7;
      for (let k = 0; k < 7; k++) { q.beginPath(); q.moveTo(990 + k * 9, 118); q.quadraticCurveTo(1015, 150, 1052 + k * 4, 118 + k * 12); q.stroke(); }
      for (let k = 0; k < 5; k++) { q.beginPath(); q.moveTo(0, 130 + k * 14); q.quadraticCurveTo(30, 126, 52 + k * 10, 118); q.stroke(); }
      // 楼梯：贴墙从门边往左上斜上二楼
      const S0 = [600, 606], S1 = [230, 120];
      const along = (u) => [lerp(S0[0], S1[0], u), lerp(S0[1], S1[1], u)];
      q.fillStyle = '#0a0605';
      poly(q, [[S0[0] + 20, S0[1]], [S1[0] + 20, S1[1]], [S1[0] - 40, S1[1]], [S0[0] - 60, S0[1]]]); q.fill();
      // 踏步与扶手：只留一道沉在暗里的剪影，不打亮边（免得和光柱交成叉）
      for (let k = 0; k < 15; k++) { const [x, y] = along((k + 0.5) / 15); q.fillStyle = '#110a07'; q.fillRect(x - 46, y - 3, 66, 5); }
      q.strokeStyle = '#0d0806'; q.lineWidth = 5; q.lineCap = 'round';
      q.beginPath(); q.moveTo(S0[0] - 20, S0[1] - 96); q.lineTo(S1[0] - 20, S1[1] - 96); q.stroke();
      q.lineWidth = 2.4;
      for (let k = 0; k <= 12; k++) { const [x, y] = along(k / 12); q.beginPath(); q.moveTo(x - 20, y - 2); q.lineTo(x - 20, y - 96); q.stroke(); }
      q.lineWidth = 9; q.strokeStyle = '#0b0705'; q.beginPath(); q.moveTo(S0[0] - 20, S0[1]); q.lineTo(S0[0] - 20, S0[1] - 120); q.stroke();
      // 梯下堆着的酒坛
      for (let k = 0; k < 4; k++) {
        const jx = 430 + k * 44 - (k > 2 ? 30 : 0), jy = 606 - (k > 2 ? 52 : 0);
        q.fillStyle = '#100a07'; q.beginPath(); q.ellipse(jx, jy - 24, 21, 25, 0, 0, TAU); q.fill(); q.fillRect(jx - 8, jy - 54, 16, 10);
        q.fillStyle = 'rgba(120,40,24,0.3)'; q.fillRect(jx - 8, jy - 30, 16, 12);
        q.fillStyle = 'rgba(255,190,120,0.09)'; q.beginPath(); q.ellipse(jx + 14, jy - 26, 2.2, 15, 0, 0, TAU); q.fill();
      }
      // 右侧柜台后的货架与酒坛
      q.fillStyle = '#0c0705'; q.fillRect(1010, 214, 270, 9); q.fillRect(1010, 318, 270, 9);
      for (let k = 0; k < 6; k++) {
        const jx = 1040 + k * 42 + r() * 8, jy = 214, jw = 15 + r() * 6;
        q.fillStyle = '#170f0a'; q.beginPath(); q.ellipse(jx, jy - 18, jw, 20, 0, 0, TAU); q.fill();
        q.fillRect(jx - 7, jy - 44, 14, 10);
        q.fillStyle = 'rgba(150,50,32,0.32)'; q.fillRect(jx - 7, jy - 24, 14, 12);
        q.fillStyle = 'rgba(255,190,120,0.14)'; q.beginPath(); q.ellipse(jx - jw * 0.6, jy - 20, 2, 13, 0, 0, TAU); q.fill();
      }
      for (let k = 0; k < 5; k++) {
        const jx = 1050 + k * 50, jy = 318;
        q.fillStyle = '#140d09'; q.beginPath(); q.ellipse(jx, jy - 22, 20, 24, 0, 0, TAU); q.fill();
        q.fillStyle = 'rgba(255,190,120,0.1)'; q.beginPath(); q.ellipse(jx - 13, jy - 24, 2.2, 15, 0, 0, TAU); q.fill();
      }
      // 左边远角一点冷的天光，免得整片死黑（静止，直接烘进墙里）
      q.globalCompositeOperation = 'lighter';
      A.softBlob(q, 40, 470, 330, 0.07, '#7080a8'); A.softBlob(q, 120, 140, 220, 0.05, '#6a78a0');
      q.globalCompositeOperation = 'source-over';
      // 地板：木纹朝视点收拢
      q.fillStyle = K.lin(q, 0, 606, 0, 760, [[0, '#1e130d'], [1, '#0a0604']]); q.fillRect(0, 606, W, 160);
      q.strokeStyle = 'rgba(0,0,0,0.5)'; q.lineWidth = 1.2;
      for (let k = -30; k <= 30; k++) { const xb = EYE[0] + k * 46; q.beginPath(); q.moveTo(xb, 608); q.lineTo(EYE[0] + (xb - EYE[0]) * 2.6, 760); q.stroke(); }
      // 门框：门柱、门楣、门槛
      q.fillStyle = '#0c0705';
      q.fillRect(D.x0 - 26, D.y0 - 30, 26, D.y1 - D.y0 + 40); q.fillRect(D.x1, D.y0 - 30, 26, D.y1 - D.y0 + 40);
      q.fillRect(D.x0 - 36, D.y0 - 36, D.x1 - D.x0 + 72, 36);
      q.fillStyle = '#1a110b'; q.fillRect(D.x0 - 30, D.y1 - 2, D.x1 - D.x0 + 60, 14);
      // 门柱内沿受光
      q.fillStyle = 'rgba(255,200,130,0.32)'; q.fillRect(D.x0 - 2.5, D.y0, 2.5, D.y1 - D.y0); q.fillRect(D.x1, D.y0, 2.5, D.y1 - D.y0);
      q.fillStyle = 'rgba(255,200,130,0.18)'; q.fillRect(D.x0 - 30, D.y1 - 2, D.x1 - D.x0 + 60, 2);
      q.globalCompositeOperation = 'destination-out'; q.fillStyle = '#000'; q.fillRect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0); q.globalCompositeOperation = 'source-over';
    });
  }

  // 八仙桌（略带俯视的四分之三面）：可带倒扣的长凳；dust 桌面积尘的灰白
  function table(q, x, y, w, o = {}) {
    const top = y - 84, dep = 26, sk = 18;
    const T = [[x - w / 2 + sk, top - dep], [x + w / 2 + sk * 0.4, top - dep], [x + w / 2, top], [x - w / 2, top]];
    q.fillStyle = o.top || '#2a1b12'; poly(q, T); q.fill();
    q.fillStyle = rgba('#d8c8a8', o.dust ?? 0.1); poly(q, T); q.fill();
    q.fillStyle = o.col || '#150d08'; q.fillRect(x - w / 2, top, w, 11);
    q.fillStyle = '#100a06'; q.fillRect(x - w / 2 + 10, top + 11, w - 20, 10);
    q.fillStyle = '#0d0805';
    for (const lx of [x - w / 2 + 3, x + w / 2 - 15]) q.fillRect(lx, top + 11, 12, 84 - 11);
    for (const lx of [x - w / 2 + sk + 8, x + w / 2 - 6]) q.fillRect(lx, top - dep + 6, 8, 74);
    if (o.bench) {
      // 倒扣的长凳：凳面压在桌面，四条腿朝天，腿间横枨
      const bw = w * 0.82, bx = x + sk * 0.35, by = top - dep * 0.45;
      q.fillStyle = '#1e140d'; poly(q, [[bx - bw / 2, by], [bx + bw / 2, by], [bx + bw / 2 + 6, by - 10], [bx - bw / 2 + 6, by - 10]]); q.fill();
      q.fillStyle = '#140d08';
      const legs = [[bx - bw / 2 + 10, -0.1], [bx - bw / 2 + 28, 0.06], [bx + bw / 2 - 26, -0.06], [bx + bw / 2 - 8, 0.1]];
      for (const [lx, a] of legs) { q.save(); q.translate(lx, by - 9); q.rotate(a); q.fillRect(-3.5, -62, 7, 62); q.restore(); }
      q.fillRect(bx - bw / 2 + 12, by - 44, bw - 22, 4.5);
    }
  }
  function va1Furniture() {
    return cache('g02_va1_furn2', 760, 300, 1, (q) => {
      q.translate(-40, -440);
      table(q, 600, 700, 250, { bench: true, dust: 0.14 });
      table(q, 170, 714, 220, { bench: true, dust: 0.06, top: '#1a110b', col: '#0e0805' });
      // 倒在地上的椅子
      q.save(); q.translate(760, 712); q.rotate(-1.3);
      q.fillStyle = '#100a06'; q.fillRect(-4, -96, 8, 96); q.fillRect(38, -96, 8, 96); q.fillRect(-4, -48, 50, 7); q.fillRect(-4, -96, 50, 8);
      q.restore();
    });
  }
  function va1Counter() {
    return cache('g02_va1_cnt', 300, 260, 1, (q) => {
      q.translate(-1000, -460);
      q.fillStyle = '#100a06'; q.fillRect(1010, 472, 290, 250);
      q.fillStyle = '#21160e'; q.fillRect(1004, 462, 300, 14);
      q.fillStyle = 'rgba(255,200,140,0.14)'; q.fillRect(1004, 462, 300, 2);
      for (let k = 0; k < 4; k++) { q.fillStyle = 'rgba(0,0,0,0.35)'; q.fillRect(1020 + k * 70, 490, 60, 200); q.fillStyle = 'rgba(70,48,34,0.12)'; q.fillRect(1024 + k * 70, 494, 52, 192); }
      q.fillStyle = '#0c0705'; q.fillRect(1060, 448, 90, 14);
      q.fillStyle = 'rgba(200,160,110,0.18)'; for (let k = 0; k < 9; k++) q.fillRect(1064 + k * 9.5, 450, 5, 10);
      q.fillStyle = '#21170f'; q.fillRect(1180, 440, 50, 22); q.fillStyle = '#2e2218'; q.fillRect(1182, 436, 46, 6);
    });
  }

  // 门扇（透视四边形）：hinge 门轴 x，dir 打开方向（+1 门轴在左），th 打开角度，slit 门缝漏光
  function doorLeaf(g, hinge, dir, th, slit) {
    const wd = (D.x1 - D.x0) / 2, xf = hinge + dir * wd * Math.cos(th), zf = Z0 - wd * Math.sin(th);
    const [ax, ay0] = proj(hinge, D.y0, Z0), [, ay1] = proj(hinge, D.y1, Z0);
    const [bx, by0] = proj(xf, D.y0, zf), [, by1] = proj(xf, D.y1, zf);
    const pts = [[ax, ay0], [bx, by0], [bx, by1], [ax, ay1]];
    g.fillStyle = th > 0.05 ? K.lin(g, ax, 0, bx, 0, [[0, '#120b07'], [1, '#2a1b12']]) : '#1a110b';
    poly(g, pts); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.2;
    for (let k = 1; k < 4; k++) {
      const u = k / 4, x = lerp(ax, bx, u);
      g.beginPath(); g.moveTo(x, lerp(ay0, by0, u)); g.lineTo(x, lerp(ay1, by1, u)); g.stroke();
    }
    // 门钉
    g.fillStyle = 'rgba(140,100,64,0.32)';
    for (let rr = 0; rr < 5; rr++) for (let k = 0; k < 3; k++) {
      const u = (k + 0.5) / 3.2, v = 0.2 + rr * 0.15, x = lerp(ax, bx, u), y = lerp(lerp(ay0, by0, u), lerp(ay1, by1, u), v);
      g.beginPath(); g.arc(x, y, 1.7 * lerp(1, Z0 / zf, u), 0, TAU); g.fill();
    }
    if (slit > 0) add(g, () => {
      g.strokeStyle = rgba('#ffd890', 0.65 * slit); g.lineWidth = 1.3;
      for (let k = 1; k < 4; k++) { const u = k / 4, x = lerp(ax, bx, u); g.beginPath(); g.moveTo(x, lerp(ay0, by0, u) + 8); g.lineTo(x, lerp(ay1, by1, u) - 6); g.stroke(); }
    });
    add(g, () => { g.strokeStyle = rgba('#ffcf88', th > 0.05 ? 0.6 : 0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by0); g.lineTo(bx, by1); g.stroke(); });
  }

  // 屋顶瓦缝漏下的一线细光（世界坐标）：正好斜斜穿过铜铃的肩
  const RAY1 = [[398, 60], [420, 60], [262, 560], [230, 560]];
  // 铜铃：梁下垂绳，钮、圆肩、外撇的铃口，两道凸弦纹；铃舌下挂风签与红穗——纹丝不动。
  //   那线细光从右肩斜擦到左下的铃口：铃身上一道亮带，肩上一点高光
  function bell(g, x, y, lit) {
    const s = 1.6;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = '#2a1c12'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, (118 - y) / s); g.lineTo(0, -27); g.stroke();
    g.strokeStyle = '#4a3418'; g.lineWidth = 2; g.beginPath(); g.arc(0, -25, 3, 0, TAU); g.stroke();
    const body = () => { g.beginPath(); g.moveTo(-7, -21); g.quadraticCurveTo(-11, -20, -11, -12); g.quadraticCurveTo(-11, 2, -16, 9); g.quadraticCurveTo(0, 12.5, 16, 9); g.quadraticCurveTo(11, 2, 11, -12); g.quadraticCurveTo(11, -20, 7, -21); g.closePath(); };
    g.fillStyle = K.lin(g, -16, 0, 16, 0, [[0, '#1a1208'], [0.5, '#3a2914'], [0.8, '#6a5026'], [0.92, '#9a7a40'], [1, '#2e200e']]);
    body(); g.fill();
    // 光带：把细光的多边形换到铃的局部坐标，只在铃身上提亮
    g.save(); body(); g.clip();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgba('#ffc878', 0.55 * lit);
    poly(g, RAY1.map(([X, Y]) => [(X - x) / s, (Y - y) / s])); g.fill();
    g.fillStyle = rgba('#fff0c8', 0.5 * lit);
    poly(g, RAY1.map(([X, Y], i) => [(X - x) / s + (i === 0 || i === 3 ? 4 : -4), (Y - y) / s])); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(20,12,4,0.75)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-11, -12); g.quadraticCurveTo(0, -10, 11, -12); g.moveTo(-12.5, 2); g.quadraticCurveTo(0, 4.5, 12.5, 2); g.stroke();
    g.fillStyle = '#140c05'; g.beginPath(); g.ellipse(0, 9.5, 15.5, 2.8, 0, 0, TAU); g.fill();
    g.strokeStyle = '#2a1c10'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, 9); g.lineTo(0, 24); g.stroke();
    g.fillStyle = '#5e3420'; g.fillRect(-4.5, 24, 9, 20);
    g.strokeStyle = '#9a2a20'; g.lineWidth = 0.9;
    g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(k * 1.1, 44); g.lineTo(k * 1.5, 58); } g.stroke();
    g.restore();
    // 肩上被细光点亮的那一下
    add(g, () => {
      glow(g, x + 3 * s, y - 16 * s, 26, '#ffd08a', 0.5 * lit);
      glow(g, x + 3.5 * s, y - 16.5 * s, 6, '#ffffff', 0.7 * lit);
    });
  }

  // 一条经过若干关键点的平滑路径（Catmull-Rom），keys: [[t, x, y], ...]
  function pathAt(keys, t) {
    const n = keys.length;
    if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
    if (t >= keys[n - 1][0]) return [keys[n - 1][1], keys[n - 1][2]];
    let i = 0; while (t > keys[i + 1][0]) i++;
    const P0 = keys[Math.max(0, i - 1)], P1 = keys[i], P2 = keys[i + 1], P3 = keys[Math.min(n - 1, i + 2)];
    const u = (t - P1[0]) / (P2[0] - P1[0]), u2 = u * u, u3 = u2 * u;
    const f = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u2 + (-a + 3 * b - 3 * c2 + d) * u3);
    return [f(P0[1], P1[1], P2[1], P3[1]), f(P0[2], P1[2], P2[2], P3[2])];
  }
  // 老人推门的那只手臂（剪影）：肩 sh 到手 hd，两节，肘往下弯；宽袖垂在小臂下；上沿一线逆光
  function pushArm(g, sh, hd, s, ink, rim) {
    const L1 = 31 * s, L2 = 29 * s, dx = hd[0] - sh[0], dy = hd[1] - sh[1], d = Math.min(Math.hypot(dx, dy), (L1 + L2) * 0.995);
    const a0 = Math.atan2(dy, dx), cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const side = dx < 0 ? -1 : 1, ea = a0 + side * Math.acos(cosA);
    const el = [sh[0] + Math.cos(ea) * L1, sh[1] + Math.sin(ea) * L1], hx = sh[0] + Math.cos(a0) * d, hy = sh[1] + Math.sin(a0) * d;
    const seg = (A2, B2, w0, w1) => {
      const ang = Math.atan2(B2[1] - A2[1], B2[0] - A2[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
      poly(g, [[A2[0] + nx * w0, A2[1] + ny * w0], [B2[0] + nx * w1, B2[1] + ny * w1], [B2[0] - nx * w1, B2[1] - ny * w1], [A2[0] - nx * w0, A2[1] - ny * w0]]); g.fill();
    };
    g.fillStyle = ink;
    seg(sh, el, 7.5 * s, 6.2 * s); seg(el, [hx, hy], 6.2 * s, 5 * s);
    g.beginPath(); g.arc(el[0], el[1], 6.2 * s, 0, TAU); g.fill();
    // 宽袖：从肘下垂到腕下的一片布
    const ang = Math.atan2(hy - el[1], hx - el[0]);
    g.beginPath(); g.moveTo(el[0], el[1]); g.lineTo(hx - Math.cos(ang) * 6 * s, hy - Math.sin(ang) * 6 * s);
    g.quadraticCurveTo(hx - Math.cos(ang) * 4 * s, hy + 15 * s, lerp(el[0], hx, 0.4), el[1] + 17 * s); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(hx, hy, 4.6 * s, 3.4 * s, ang, 0, TAU); g.fill();
    if (rim) add(g, () => {
      g.strokeStyle = rgba(rim, 0.5); g.lineWidth = 1.3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sh[0], sh[1] - 7 * s); g.lineTo(el[0], el[1] - 6.2 * s); g.lineTo(hx, hy - 4.4 * s); g.stroke();
    });
    return [hx, hy];
  }

  // 门扇自由边在画面上的位置（与 doorLeaf 同一套透视）
  function leafEdge(hinge, dir, th) {
    const wd = (D.x1 - D.x0) / 2, xf = hinge + dir * wd * Math.cos(th), zf = Z0 - wd * Math.sin(th);
    const [bx, by0] = proj(xf, D.y0, zf), [, by1] = proj(xf, D.y1, zf);
    return [bx, by0, by1];
  }
  // 地上那条人影：从脚下顺着光往屋里拖长，有肩、有头（形状是一串宽度，沿影子的中轴展开）
  const SHADOW1 = [[0, 22], [0.08, 44], [0.3, 38], [0.5, 36], [0.7, 50], [0.77, 62], [0.82, 50], [0.86, 20], [0.88, 24], [0.92, 36], [0.97, 30], [1, 8]];
  function manShadow(q, fx, fy, hx, hy) {
    const L = [], R = [];
    for (const [u, w] of SHADOW1) {
      const x = lerp(fx, hx, u), y = lerp(fy, hy, u), k = 1 + 0.5 * u;
      L.push([x - (w * k) / 2, y]); R.push([x + (w * k) / 2, y + 2 * u]);
    }
    q.beginPath(); L.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y)));
    for (let i = R.length - 1; i >= 0; i--) q.lineTo(R[i][0], R[i][1]);
    q.closePath();
  }

  XYT.registerShot('va1_silence', {
    name: '铃静尘浮', zone: 'left', night: true, text: '#e9f1f6', shadow: 'rgba(20,10,6,0.92)', accent: '#f2be45', bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tOpen = charAt(c, 0, 0.24), tLeaf = charAt(c, 5, 2.28);
      // 门：在“岁”字上被他推开——右扇先被身子顶开，左扇跟着他的手缓缓转开
      const u = clamp((lt - tOpen + 0.05) / 1.15), th = 1.18 * easeOut(u), thR = 1.06 * easeOut(clamp(u * 1.35));
      const L = smooth(clamp((lt - tOpen) / 0.75));
      const gap = clamp(th / 1.18);
      // 人：推门时身子随门往里送，推完放下手，再往门槛上迈一小步
      const push = smooth(clamp((lt - tOpen + 0.1) / 0.8)), armDown = smooth(clamp((lt - tOpen - 0.6) / 0.4));
      const mx = lerp(902, 876, push) - 12 * smooth(clamp((lt - tOpen - 0.8) / 0.7));
      // 镜头：从桌面高度缓缓升到门楣（画面整体下移，近处移得多），略推近
      const cam = easeInOut(clamp((lt + 0.2) / (c.dur + 0.4)));
      const dy = (k) => lerp(-24, 24, cam) * k;
      g.save();
      const z = 1.0 + 0.03 * cam;
      g.translate(640, 400); g.scale(z, z); g.translate(-640, -400);

      // 门外（逆光曝白）与门里的人
      g.save(); g.translate(0, dy(0.6));
      // 不裁切：门外这张比门洞大一圈，墙在后面画、只露出门洞（两层视差不同，裁切会在门洞边漏缝）
      g.drawImage(va1Outside(), 750, 160, 240, 470);
      for (let i = 0; i < 5; i++) {
        const P = 3.4 + i * 0.7, q = ((t + i * 1.3) / P) % 1, x = 760 + ((h2(i, 3) * 200 + q * 120) % 210), y = 190 + q * 420;
        g.save(); g.translate(x, y); g.rotate(t * 2 + i); g.scale(Math.cos(t * 3 + i), 1);
        g.fillStyle = rgba(i % 2 ? '#e8742e' : '#d8562a', 0.5); g.beginPath(); g.ellipse(0, 0, 4, 2.5, 0, 0, TAU); g.fill(); g.restore();
      }
      // 门外檐下那面褪色酒旗的一角，被风吹得一掀一掀
      {
        const fw = Math.sin(t * 2.2) * 0.5 + Math.sin(t * 3.7 + 1) * 0.3;
        g.fillStyle = 'rgba(196,120,70,0.55)';
        g.beginPath(); g.moveTo(940, 172); g.lineTo(965, 172); g.lineTo(965, 300);
        g.quadraticCurveTo(948 + fw * 6, 280, 936 + fw * 10, 296 + fw * 6); g.quadraticCurveTo(938, 240, 940, 172); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(120,70,40,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(930, 172); g.lineTo(966, 172); g.stroke();
      }
      if (thR > 0.02) {
        const O = {
          stage: 'old', pose: 'stand', facing: -1, tone: 'silhouette', ink: '#1a110b', rim: '#ffe0a0', light: [930, 160], rimWidth: 2.6, tassel: '#2a1a12',
          wind: 0.2 + 0.18 * L, windDir: -1, lean: 0.14 * push * (1 - armDown), head: -0.05 * smooth(clamp((lt - 1.2) / 1.4)),
        };
        if (armDown < 1) {
          // 推门：身子不带近侧手臂，手臂另画，手按在左扇门的边上（指尖没进门扇后面）
          O.part = 'back';
          F.draw(g, 'xiaoyao', mx, 608, 1.62, t, O);
          const sh = F.points('xiaoyao', mx, 608, 1.62, t, O).shoulderN;
          // 手臂几乎伸直往左前方推，手在门扇背后（被门扇挡住），露出的是没进门边的那截胳膊
          const onDoor = [sh[0] - 96, sh[1] + 16], hang = [sh[0] - 8, sh[1] + 92];
          pushArm(g, sh, [lerp(onDoor[0], hang[0], armDown), lerp(onDoor[1], hang[1], armDown)], 1.62, '#1a110b', '#ffe0a0');
        } else F.draw(g, 'xiaoyao', mx, 608, 1.62, t, O);
      }
      g.restore();

      // 大堂墙
      g.save(); g.translate(0, dy(0.7));
      // 暗而柔的大贴图用最近邻贴（软件渲染下快一倍，看不出差别）
      g.imageSmoothingEnabled = false;
      g.drawImage(va1Room(), 0, -40, W, H + 80);
      g.imageSmoothingEnabled = true;
      const sl = 1 - smooth(clamp((lt - tOpen) / 0.3));
      doorLeaf(g, D.x0, 1, th, sl);
      doorLeaf(g, D.x1, -1, thR, sl);
      if (sl > 0) add(g, () => {
        g.strokeStyle = rgba('#ffd890', 0.85 * sl); g.lineWidth = 2;
        g.strokeRect(D.x0 + 1, D.y0 + 1, D.x1 - D.x0 - 2, D.y1 - D.y0 - 2);
        g.lineWidth = 2.5; g.beginPath(); g.moveTo(860, D.y0); g.lineTo(860, D.y1); g.stroke();
        glow(g, 860, D.y1 - 4, 90, '#ffc070', 0.35 * sl);
      });
      // 门一开，门楣上的积灰被震落：一团淡尘、一串落进光里的灰粒
      if (lt > tOpen - 0.05) {
        V.smoke(g, c, { kind: 'puff', x: 862, y: 188, at: tOpen, n: 8, size: 40, spread: 100, rise: -18, drift: -10, life: 1.4, color: '#d8b888', alpha: 0.24, seed: 7, res: 0.3 });
        add(g, () => {
          for (let i = 0; i < 26; i++) {
            const age = lt - tOpen - h2(i, 91) * 0.25;
            if (age < 0 || age > 1.6) continue;
            const x = 800 + h2(i, 92) * 130 + Math.sin(age * 3 + i) * 6 - age * 14, y = 176 + 230 * age * age + 18 * age * h2(i, 93);
            glow(g, x, y, 1.6 + h2(i, 94) * 2.4, '#ffe6b8', 0.8 * (1 - age / 1.6) * L);
          }
        });
      }
      g.restore();

      // 光：空中的光柱、地上的光斑（人影切在里面）、屋顶漏下照着铜铃的一线细光——都在低分辨率里画，放大后边缘自然柔化
      const hx0 = lerp(858, D.x0 + 54, gap), hx1 = lerp(862, leafEdge(D.x1, -1, thR)[0] - 6, clamp(thR / 1.06));
      g.save(); g.translate(0, dy(0.8));
      V.util.viaScratch(g, 'g02_va1_beam', [200, 0, 1210, 780], 0.2, 'lighter', 1, (q) => {
        // 门口那片暖光反到墙和梁上（门开得越大越亮）
        q.globalAlpha = 1; A.softBlob(q, 820, 300 - dy(0.1), 380, 0.05 + 0.1 * L, '#ffb070');
        if (L > 0.01) {
          // 宽而淡的一层光雾（光柱外沿的散射）
          q.globalAlpha = 0.08 * L;
          q.fillStyle = '#ffcf90';
          poly(q, [[hx0 - 40, D.y0], [hx1 + 10, D.y0], [hx1 + 10, D.y1], [hx1 - 300, 790], [hx0 - 600, 790], [hx0 - 300, 300]]); q.fill();
          q.globalAlpha = 0.55 * L;
          q.fillStyle = K.lin(q, 880, 220, 420, 760, [[0, 'rgba(255,214,140,0.95)'], [0.5, 'rgba(240,170,90,0.4)'], [1, 'rgba(200,120,60,0)']]);
          poly(q, [[hx0, D.y0 + 6], [hx1, D.y0 + 6], [hx1, D.y1], [hx1 - 330, 780], [hx0 - 480, 780]]); q.fill();
          q.globalAlpha = 0.5 * L;
          q.fillStyle = K.lin(q, 860, 260, 540, 700, [[0, 'rgba(255,238,196,0.95)'], [1, 'rgba(255,200,120,0)']]);
          poly(q, [[hx0 + 26, D.y0 + 60], [hx1 - 20, D.y0 + 60], [hx1 - 20, D.y1 - 20], [hx1 - 300, 760], [hx0 - 380, 760]]); q.fill();
          // 地上光斑
          q.globalAlpha = 0.75 * L;
          q.fillStyle = K.lin(q, 860, 606, 520, 770, [[0, 'rgba(255,220,160,0.95)'], [1, 'rgba(230,150,80,0.25)']]);
          poly(q, [[hx0, D.y1], [hx1, D.y1], [hx1 - 330, 780], [hx0 - 480, 780]]); q.fill();
          q.globalCompositeOperation = 'destination-out';
          // 门洞本身不加光（人留成清楚的剪影）
          q.globalAlpha = 1; q.fillRect(D.x0 - 4, D.y0 - 10, D.x1 - D.x0 + 8, D.y1 - D.y0 + 6);
          // 人挡住的影柱（空气里淡淡一道）与地上的长影（有肩有头）
          const ox = mx - 862, fy = 609 - dy(0.2);
          q.globalAlpha = 0.45; poly(q, [[826 + ox, 330], [880 + ox, 330], [880 + ox, 607], [640 + ox, 780], [520 + ox, 780]]); q.fill();
          q.globalAlpha = 0.95; manShadow(q, mx - 2, fy, mx - 252, fy + 94); q.fill();
          q.globalCompositeOperation = 'source-over';
        }
        // 屋顶瓦缝漏下一线细光，斜斜擦过铜铃的肩
        q.globalAlpha = 0.5 + 0.12 * Math.sin(t * 0.7);
        q.fillStyle = K.lin(q, 420, 0, 250, 560, [[0, 'rgba(255,220,160,0.75)'], [0.6, 'rgba(255,200,130,0.25)'], [1, 'rgba(255,190,120,0)']]);
        poly(q, RAY1); q.fill();
      });
      g.restore();

      // 铜铃（梁下 x≈372）：浮尘在它四周飘，它一动不动
      g.save(); g.translate(0, dy(0.75));
      bell(g, 372, 196, 0.6 + 0.4 * L);
      g.restore();

      // 桌椅、柜台
      g.save(); g.translate(0, dy(1.0));
      g.imageSmoothingEnabled = false;
      g.drawImage(va1Furniture(), 40, 440, 760, 300);
      g.drawImage(va1Counter(), 1000, 460, 300, 260);
      g.imageSmoothingEnabled = true;
      // 光扫到的桌沿、凳腿亮边与桌面积尘
      if (L > 0.01) add(g, () => {
        g.globalAlpha = L;
        g.fillStyle = 'rgba(255,206,140,0.55)'; g.fillRect(612, 615, 112, 2.2); g.fillRect(700, 556, 2.5, 50); g.fillRect(668, 552, 2.2, 52);
        g.fillStyle = 'rgba(255,220,170,0.2)'; poly(g, [[612, 590], [740, 590], [725, 616], [600, 616]]); g.fill();
        glow(g, 670, 600, 110, '#ffb860', 0.22);
        g.globalAlpha = 1;
      });
      g.restore();

      // 浮尘：门里的光柱中慢慢旋，每拍轻轻上浮一次；铜铃那线细光里也有几粒。
      //   每粒尘的位置按光线算：门洞上一点（横 sA、高 vA）顺着光走 aA 的路程；靠光柱边缘、落在人影里的都暗下去
      {
        const b0 = c.grid && c.grid.pos ? Math.floor(c.grid.pos(c.t - c.lt)) : Math.floor(surge(c, 4) - lt * 1.2);
        const lift = 7 * Math.max(0, surge(c, 4) - b0);
        const sMan = (mx - hx0) / Math.max(1, hx1 - hx0), d8 = dy(0.8);
        add(g, () => {
          if (L > 0.01) for (let i = 0; i < 120; i++) {
            const sA = h2(i, 11), vA = h2(i, 12), z0 = h2(i, 13), aA = Math.pow(h2(i, 14), 0.85);
            const X = lerp(hx0 + 4, hx1 - 4, sA), Y = lerp(D.y0 + 24, D.y1 - 8, vA), hh = D.y1 - Y, dxk = lerp(-1.12, -0.77, sA);
            const sw = t * (0.22 + 0.3 * z0) + i * 1.7;
            const x = X + dxk * hh * aA + Math.sin(sw) * 15 + (noise1(t * 0.15 + i * 3.1, 7) - 0.5) * 24;
            const y = Y + 1.405 * hh * aA + Math.cos(sw * 0.9) * 10 - lift * (0.5 + z0) + d8;
            const edge = smooth(sA / 0.16) * smooth((1 - sA) / 0.16) * smooth((vA - lift / 500) / 0.16) * smooth((1 - aA) / 0.2);
            const shade = 1 - 0.85 * smooth(1 - Math.abs(sA - sMan) / 0.18) * smooth((vA - 0.2) / 0.12);
            const tw = 0.5 + 0.5 * Math.sin(t * (1 + z0 * 2) + i * 1.7);
            const a = 0.75 * L * edge * shade * (1 - aA * 0.45) * (0.25 + 0.75 * tw) * (0.4 + 0.6 * z0);
            if (a > 0.01) glow(g, x, y, 1.5 + z0 * 3.6, '#ffe4b0', a);
          }
          for (let i = 0; i < 22; i++) {
            const v = h2(i, 21), yy = 80 + ((h2(i, 22) * 460 + t * 6 - lift) % 460 + 460) % 460, f = (yy - 60) / 500;
            const x = lerp(409, 246, f) + (v - 0.5) * lerp(18, 28, f) + Math.sin(t * 0.5 + i) * 4;
            glow(g, x, yy + d8, 1.6 + h2(i, 23) * 2.4, '#ffe8c0', 0.55 * (0.4 + 0.6 * Math.sin(t * 1.3 + i * 2.1)) * smooth((yy - 70) / 40) * (1 - f * 0.6));
          }
        });
      }

      // 落叶：“默”字上从门楣后飘下来（先在门外，裁在门洞里），斜穿光柱最亮的地方，平平落在受光的桌面上，不再动
      {
        const T0 = tLeaf - 0.4, tLand = tLeaf + 0.6;
        if (lt > T0) {
          // 先在门外从他头顶上方斜飘过去（不压在他的剪影上），过了门扇边才进屋
          const keys = [[T0, 944, 120], [tLeaf, 930, 196], [tLeaf + 0.15, 884, 262], [tLeaf + 0.28, 826, 322], [tLeaf + 0.4, 766, 420], [tLeaf + 0.51, 712, 522], [tLand, 664, 608]];
          const tc = Math.min(lt, tLand), q = clamp((tc - T0) / (tLand - T0)), land = lt >= tLand;
          let [x, y] = pathAt(keys, tc);
          x += Math.sin((tc - T0) * 10.5) * 12 * (1 - q * q);
          const kd = lerp(0.7, 1.0, smooth((tc - tLeaf) / 0.6)), yy = y + dy(kd);
          const settle = smooth((q - 0.82) / 0.18);
          const rot = 0.45 + (1 - settle) * ((tLand - tc) * 6.5 + Math.sin(tc * 9) * 0.5);
          let fx = lerp(Math.cos((tc - T0) * 12.5), 1, settle); fx = (fx < 0 ? -1 : 1) * Math.max(0.15, Math.abs(fx));
          const sy = lerp(1, 0.55, settle), sz = lerp(19, 23, q);
          const out = x > leafEdge(D.x0, 1, th)[0] + 6;
          g.save();
          if (out) { g.beginPath(); g.rect(D.x0, D.y0 + dy(0.7) + 1, D.x1 - D.x0, D.y1 - D.y0); g.clip(); }
          if (settle > 0) { g.fillStyle = rgba('#000000', 0.35 * settle); g.beginPath(); g.ellipse(x - 6, yy + 3, sz * 0.9, sz * 0.3, 0, 0, TAU); g.fill(); }
          // 在光里被照透：叶子本身提亮一层，外加一圈暖光；落定后桌面上溅起一小撮尘
          const inBeam = out ? 0.3 : clamp(1 - Math.abs((x - 760) * 0.6 + (yy - 470) * 0.5) / 160);
          g.translate(x, yy); g.rotate(rot); g.scale(fx, sy);
          const lf = V.util.petalTex('maple', 2);
          g.drawImage(lf, -sz, -sz, sz * 2, sz * 2);
          if (inBeam > 0.05 || land) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (land ? 0.25 : 0.45 * inBeam) * L; g.drawImage(lf, -sz, -sz, sz * 2, sz * 2); }
          g.restore();
          add(g, () => {
            glow(g, x, yy, 34, '#ff9a50', L * (land ? 0.22 : 0.2 + 0.35 * inBeam) * (out ? smooth((yy - D.y0 - dy(0.7)) / 30) : 1));
            if (land) {
              const age = lt - tLand;
              for (let i = 0; i < 12; i++) {
                const an = PI + (i / 11) * PI, d = 34 * easeOut(clamp(age / 0.7)) * (0.5 + 0.5 * h2(i, 97));
                const px = x + Math.cos(an) * d * 1.4, py = yy + Math.sin(an) * d * 0.6 - age * 8 * h2(i, 98);
                glow(g, px, py, 1.5 + h2(i, 99) * 2, '#ffe6b8', 0.8 * (1 - clamp(age / 1.1)) * L);
              }
            }
          });
        }
      }

      // 前景：极近处一根柱子（右）与一截桌角（左下），压暗
      g.save(); g.translate(0, dy(1.8));
      g.fillStyle = '#060403';
      poly(g, [[-30, 668], [300, 660], [318, 684], [-30, 700]]); g.fill();
      g.fillRect(236, 680, 24, 120); g.fillRect(-30, 690, 340, 80);
      add(g, () => { g.fillStyle = 'rgba(255,190,120,0.1)'; g.fillRect(0, 661, 300, 2); });
      g.restore();
      g.save(); g.translate(dy(0.5) * 0.4, 0);
      g.fillStyle = K.lin(g, 1196, 0, 1290, 0, [[0, '#0a0604'], [0.25, '#140c08'], [1, '#050302']]);
      g.fillRect(1196, -60, 100, 860);
      add(g, () => { g.fillStyle = 'rgba(255,190,120,0.12)'; g.fillRect(1197, -60, 2, 860); });
      g.restore();
      g.restore();
      // 下一镜的贴图提前建好
      pretouch(c, [touchHills(HILLS2[0]), touchHills(HILLS2[1]), va2Bg, va2Refl, va2Clouds, () => kiteTex(false), () => kiteTex(true), () => { for (let k = 0; k < PR.n; k++) plumeRot('lite', k); }, () => plumeTex('near'), () => plumeTex('blur')]);
    },
  });

  // ======================================================================
  // 2 风倦纸鸢：阴天河滩，冷银芦苇从左下铺到右上；最后一阵风把断线的沙燕纸鸢卷着翻滚，
  //   唱到“漂泊”风骤停，芦苇两拍回正，纸鸢盘旋落进芦苇丛，芦絮这才缓缓落下
  // ======================================================================
  // 芦苇丛上缘（对角线）：左下到右上
  const reedTop = (x) => lerp(628, 372, clamp(x / W, -0.1, 1.1));
  // 风：ts 风停时刻。front 风头从左往右推进；hold 风力（停后迅速掉到 0）；back 芦苇回正（两拍，略带过冲）
  function va2Wind(lt, ts) {
    const hold = lt < ts ? 1 : Math.exp(-(lt - ts) / 0.16);
    const tau = Math.max(0, lt - ts);
    const back = lt < ts ? 1 : Math.exp(-tau / 0.42) * (1 + tau / 0.42) - 0.09 * Math.sin(clamp(tau / 1.7) * PI);
    const integ = lt < ts ? lt : ts + 0.16 * (1 - Math.exp(-(lt - ts) / 0.16));
    return { hold, back, integ, front: -260 + 1300 * Math.min(lt, ts) };
  }
  const bendAt = (w, x, seed) => {
    const f = smooth((w.front - x) / 360);
    // 风里的芦苇像海浪：一道道弯伏自左向右推过去
    const wave = 0.74 + 0.26 * Math.sin(x * 0.011 - w.integ * 8.5 + seed) + 0.12 * (noise1(x * 0.005 - w.integ * 3.5, 3) - 0.5);
    return f * wave * w.back;
  };

  // 芦花穗贴图：朝 +x 蓬开的银白细丝（blur 为近景失焦版）
  function plumeTex(tone) {
    return cache('g02_plume_' + tone, 80, 34, 1.5, (q) => {
      const r = A.rng(tone.length * 7 + 3), dark = tone === 'near';
      q.lineCap = 'round';
      if (tone === 'blur') {
        for (let i = 0; i < 9; i++) A.softBlob(q, 12 + i * 7, 17 + Math.sin(i) * 2, 9 + Math.sin((i / 8) * PI) * 6, 0.22, '#f4f4ee');
        return;
      }
      A.softBlob(q, 40, 17, 22, dark ? 0.14 : 0.24, '#ffffff');
      q.strokeStyle = dark ? 'rgba(80,88,96,0.9)' : 'rgba(150,152,146,0.85)'; q.lineWidth = 1;
      q.beginPath(); q.moveTo(2, 17); q.quadraticCurveTo(38, 15, 74, 19); q.stroke();
      for (let i = 0; i < 64; i++) {
        const u = r(), x = 4 + u * 68, y = 17 + u * u * 2, l = 5 + 10 * Math.sin(u * PI) * (0.6 + r() * 0.6), a = (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.75);
        q.strokeStyle = dark ? rgba(r() < 0.4 ? '#eef0f0' : '#b4bcc4', 0.35 + r() * 0.35) : rgba(r() < 0.4 ? '#ffffff' : '#e4e4dc', 0.4 + r() * 0.45);
        q.lineWidth = 0.55 + r() * 0.55;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + l * 0.6, y + Math.sin(a) * l * 0.35, x + l * Math.cos(a * 0.5), y + Math.sin(a) * l); q.stroke();
      }
    });
  }
  // 预先转好角度的芦花（中层几十株都用它：不带旋转的贴图在软件渲染下快三倍）；锚点在穗根
  const PR = { n: 28, a0: -0.75, a1: 1.6 };
  function plumeRot(tone, k) {
    const th = lerp(PR.a0, PR.a1, k / (PR.n - 1)), ca = Math.cos(th), sa = Math.sin(th);
    const pts = [[-4, -17], [76, -17], [76, 17], [-4, 17]].map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
    const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))), x1 = Math.ceil(Math.max(...pts.map((p) => p[0])));
    const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))), y1 = Math.ceil(Math.max(...pts.map((p) => p[1])));
    const c = cache('g02_plr_' + tone + k, x1 - x0, y1 - y0, 1.5, (q) => { q.translate(-x0, -y0); q.rotate(th); q.drawImage(plumeTex(tone), -4, -17, 80, 34); });
    c.ox = x0; c.oy = y0;
    return c;
  }
  const BANDS = {
    far: { n: 44, h: [30, 56], w: 1.0, maxA: 0.6, ps: 0.45, pa: 0.8, leaf: 0, off: [4, 30], stem: '#a2acb5' },
    mid: { n: 66, h: [90, 150], w: 2.0, maxA: 0.95, ps: 0.95, pa: 0.92, leaf: 1, off: [40, 130], stem: '#66727e' },
    near: { n: 11, h: [300, 440], w: 5.2, maxA: 0.9, ps: 1.9, pa: 0.95, leaf: 3, off: [0, 0], stem: '#3a444e' },
  };
  // 二次曲线上取点与法线（茎、叶都按此画成两头细的填充形，墨色有提按）
  function taper(P, x0, y0, cx, cy, x1, y1, w0, w1, n) {
    const L = [], R = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
      const x = a * x0 + b * cx + d * x1, y = a * y0 + b * cy + d * y1;
      const tx = 2 * (1 - u) * (cx - x0) + 2 * u * (x1 - cx), ty = 2 * (1 - u) * (cy - y0) + 2 * u * (y1 - cy), tl = Math.hypot(tx, ty) || 1;
      const hw = lerp(w0, w1, u) / 2, nx = -ty / tl * hw, ny = tx / tl * hw;
      L.push([x + nx, y + ny]); R.push([x - nx, y - ny]);
    }
    P.moveTo(L[0][0], L[0][1]); for (let k = 1; k <= n; k++) P.lineTo(L[k][0], L[k][1]);
    for (let k = n; k >= 0; k--) P.lineTo(R[k][0], R[k][1]); P.closePath();
  }
  // 一层芦苇：茎、叶合成一条路径一次填完；芦花逐株贴（远层用不旋转的柔光点，便宜）
  function reedBand(q, name, c, w, filter, stemCol) {
    const B = BANDS[name], t = c.t, tips = [];
    const stems = new Path2D(), leaves = new Path2D();
    for (let i = 0; i < B.n; i++) {
      const sd = name.length * 131 + i;
      const x = name === 'near' ? -40 + ((i + 0.15 + h2(sd, 1) * 0.7) / B.n) * 1380 : -40 + h2(sd, 1) * 1360;
      if (filter && !filter(x)) continue;
      const y = name === 'near' ? 790 : reedTop(x) + lerp(B.off[0], B.off[1], h2(sd, 2));
      const h = lerp(B.h[0], B.h[1], h2(sd, 3)) * (name === 'near' ? lerp(0.8, 1.15, x / W) : 1);
      const bend = bendAt(w, x, h2(sd, 8) * 3);
      const a = bend * B.maxA * (0.85 + 0.3 * h2(sd, 4)) + 0.05 * Math.sin(t * (5 + h2(sd, 9) * 4) + i) * (0.3 + bend) + (h2(sd, 5) - 0.5) * 0.14;
      const tx = x + Math.sin(a) * h * 0.92, ty = y - Math.cos(a) * h, cx = x + Math.sin(a * 0.3) * h * 0.25, cy = y - h * 0.6;
      if (name === 'far') stems.moveTo(x, y), stems.quadraticCurveTo(cx, cy, tx, ty);
      else taper(stems, x, y, cx, cy, tx, ty, B.w * (0.8 + 0.4 * h2(sd, 4)), B.w * 0.3, name === 'near' ? 10 : 4);
      // 叶：从茎上斜出的长叶，叶尖下垂；风里被压平向右
      for (let k = 0; k < (name === 'mid' ? (sd % 2) : B.leaf); k++) {
        const s2 = (k + (sd & 1)) % 2 ? 1 : -1, u = 0.18 + 0.2 * k + 0.1 * h2(sd, k + 5), lx = lerp(x, tx, u), ly = lerp(y, ty, u);
        const L = h * (0.22 + 0.14 * h2(sd, k + 7)) * (name === 'near' ? 1.15 : 1.2);
        const ang0 = -PI / 2 + a + s2 * lerp(0.5, 0.2, bend) + bend * 0.5, ang1 = ang0 + s2 * lerp(1.1, 0.3, bend) + bend * 0.9;
        const mx = lx + Math.cos(ang0) * L * 0.55, my = ly + Math.sin(ang0) * L * 0.55;
        const ex = mx + Math.cos(ang1) * L * 0.5, ey = my + Math.sin(ang1) * L * 0.5;
        taper(leaves, lx, ly, mx, my, ex, ey, B.w * (name === 'near' ? 1.0 : 1.4), 0.3, name === 'near' ? 8 : 4);
      }
      tips.push([tx, ty, a, bend, sd]);
    }
    q.fillStyle = q.strokeStyle = stemCol || B.stem;
    if (name === 'far') { q.lineCap = 'round'; q.lineWidth = B.w; q.stroke(stems); }
    else { q.fill(stems); q.globalAlpha = name === 'near' ? 0.9 : 0.8; q.fill(leaves); q.globalAlpha = 1; }
    if (name === 'far') {
      // 远处芦花只是一点点柔白，随风偏
      q.globalAlpha = B.pa;
      for (const [tx, ty, a, bend] of tips) E.util.streak(q, tx + 6 + bend * 6, ty + 3 - bend * 2, 9 + bend * 5, 3.2, '#eef0ec', 0.8);
      q.globalAlpha = 1;
      return;
    }
    // 芦花：风里平飘向右，风停后垂下
    const tex = plumeTex(name === 'near' ? 'near' : 'lite'), m = q.getTransform();
    q.globalAlpha = B.pa;
    if (name === 'mid') {
      for (const [tx, ty, a, bend, sd] of tips) {
        const pa = lerp(0.6 + (h2(sd, 11) - 0.5) * 0.6, -0.12, bend) + a * 0.3 + 0.09 * Math.sin(t * 8 + sd) * bend;
        const k = Math.round(clamp((pa - PR.a0) / (PR.a1 - PR.a0)) * (PR.n - 1)), img = plumeRot('lite', k), ps = B.ps * (0.75 + 0.5 * h2(sd, 6));
        q.drawImage(img, tx + img.ox * ps, ty + img.oy * ps, img.lw * ps, img.lh * ps);
      }
      q.globalAlpha = 1;
      return;
    }
    for (const [tx, ty, a, bend, sd] of tips) {
      const pa = lerp(0.6 + (h2(sd, 11) - 0.5) * 0.6, -0.12, bend) + a * 0.3 + 0.09 * Math.sin(t * 8 + sd) * bend;
      const ps = B.ps * (0.75 + 0.5 * h2(sd, 6)), ca = Math.cos(pa) * ps, sa = Math.sin(pa) * ps;
      q.setTransform(m.a * ca + m.c * sa, m.b * ca + m.d * sa, -m.a * sa + m.c * ca, -m.b * sa + m.d * ca, m.a * tx + m.c * ty + m.e, m.b * tx + m.d * ty + m.f);
      q.drawImage(tex, -4, -17, 80, 34);
    }
    q.setTransform(m); q.globalAlpha = 1;
  }

  // 沙燕纸鸢贴图（正面，中心在身体中央）：back 背面（透出竹骨、颜色发灰）
  function kiteTex(back) {
    return cache('g02_kite' + (back ? 'b' : ''), 130, 130, 2, (q) => {
      q.translate(65, 60);
      const ink = back ? '#6a645a' : '#24272b', paper = back ? '#cfc6b2' : '#f0e8d4', ora = back ? '#b89a76' : '#e29c45', blu = back ? '#8a96a0' : '#4c7a9c';
      const wing = (sd) => { q.beginPath(); q.moveTo(sd * 6, -24); q.quadraticCurveTo(sd * 30, -46, sd * 60, -36); q.quadraticCurveTo(sd * 52, -22, sd * 42, -10); q.quadraticCurveTo(sd * 24, 1, sd * 8, 4); q.closePath(); };
      for (const sd of [-1, 1]) {
        wing(sd); q.fillStyle = paper; q.fill();
        q.save(); wing(sd); q.clip();
        q.fillStyle = ink; q.beginPath(); q.moveTo(sd * 6, -24); q.quadraticCurveTo(sd * 30, -46, sd * 60, -36); q.quadraticCurveTo(sd * 34, -30, sd * 8, -13); q.closePath(); q.fill();
        q.fillStyle = ora; q.beginPath(); q.ellipse(sd * 26, -13, 9, 5.5, sd * -0.3, 0, TAU); q.fill();
        q.fillStyle = blu; q.beginPath(); q.ellipse(sd * 42, -20, 5, 3, sd * -0.3, 0, TAU); q.fill();
        q.strokeStyle = ink; q.lineWidth = 1.3; q.beginPath(); q.arc(sd * 26, -13, 12, 0, TAU); q.stroke();
        q.strokeStyle = rgba(ora, 0.8); q.lineWidth = 1; q.beginPath(); q.arc(sd * 26, -13, 15, 0.4, 2.6); q.stroke();
        q.restore();
        q.strokeStyle = 'rgba(40,36,30,0.6)'; q.lineWidth = 1; wing(sd); q.stroke();
      }
      // 身子与燕尾
      q.fillStyle = paper;
      q.beginPath(); q.moveTo(0, -36); q.quadraticCurveTo(10, -26, 8, -6); q.quadraticCurveTo(9, 14, 19, 54); q.lineTo(0, 35); q.lineTo(-19, 54); q.quadraticCurveTo(-9, 14, -8, -6); q.quadraticCurveTo(-10, -26, 0, -36); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(40,36,30,0.6)'; q.stroke();
      q.fillStyle = ink; q.beginPath(); q.moveTo(0, 35); q.lineTo(19, 54); q.quadraticCurveTo(10, 30, 7, 12); q.lineTo(-7, 12); q.quadraticCurveTo(-10, 30, -19, 54); q.closePath(); q.fill();
      q.fillStyle = ora; q.beginPath(); q.ellipse(0, 0, 5, 9, 0, 0, TAU); q.fill();
      q.fillStyle = '#c23a2a'; q.beginPath(); q.arc(0, -9, 2.6, 0, TAU); q.fill();
      q.fillStyle = ink; q.beginPath(); q.arc(0, -34, 9, 0, TAU); q.fill();
      q.fillStyle = paper; q.beginPath(); q.arc(-3.5, -35, 2.4, 0, TAU); q.arc(3.5, -35, 2.4, 0, TAU); q.fill();
      if (back) { q.strokeStyle = 'rgba(90,70,50,0.7)'; q.lineWidth = 1.6; q.beginPath(); q.moveTo(-58, -35); q.quadraticCurveTo(0, -48, 58, -35); q.moveTo(0, -40); q.lineTo(0, 40); q.stroke(); }
      q.globalCompositeOperation = 'source-atop';
      const r = A.rng(3);
      for (let k = 0; k < 14; k++) { q.fillStyle = rgba('#8a7a60', 0.06 + r() * 0.08); A.inkBlob(q, (r() - 0.5) * 110, (r() - 0.6) * 90, 6 + r() * 14, k, 0.5); q.fill(); }
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 纸鸢的位置、姿态（镜头内时间 lt；ts 风停；tl 落定）：从画外左边被风卷进来，风停后盘旋落到芦花上
  function kiteAt(lt, ts, tl) {
    if (lt < ts) {
      const x = -120 + 420 * lt + 34 * Math.sin(2.3 * lt), y = 292 - 40 * Math.sin(1.4 * lt + 0.4) + 22 * Math.sin(4.1 * lt);
      return { x, y, rot: 0.5 + 3.4 * lt + 0.45 * Math.sin(5 * lt), roll: 0.6 + 0.4 * Math.cos(3.0 * lt + 0.5), s: 1.15 };
    }
    const A0 = kiteAt(ts - 1e-4, ts, tl), q = clamp((lt - ts) / (tl - ts)), tau = lt - ts;
    // 失了风：先一顿，再左右摆着盘旋下坠，越落越慢，被芦花托住
    const fallE = smooth(q) * 0.7 + Math.pow(q, 1.6) * 0.3, lx = A0.x + 110;
    const x = A0.x + 110 * smooth(q) + 50 * Math.sin(tau * 5.5) * (1 - q) * smooth(tau / 0.2);
    const y = lerp(A0.y, reedTop(lx) + 18, fallE) - 16 * Math.sin(Math.min(1, tau / 0.25) * PI) * (1 - q);
    const R = A0.rot + ((((-0.42 - A0.rot) % TAU) + TAU) % TAU);
    const rot = lerp(A0.rot, R, easeOut(q)) + 0.5 * Math.sin(tau * 5.5) * (1 - q);
    const roll = lerp(A0.roll, 0.8, smooth(q)) + 0.3 * Math.sin(tau * 6) * (1 - q);
    return { x, y, rot, roll, s: lerp(1.15, 1.08, q) };
  }
  const wrapA = (a) => a - TAU * Math.round(a / TAU);
  // 燕尾飘带：从纸鸢当前的尾尖长出，每节朝“落后一点时间的来风方向”转，转角每节不超过 0.5；没了风就垂下来
  function kiteTails(g, t, lt, ts, tl, K0, hold) {
    const vel = (d) => { const A2 = kiteAt(lt - d, ts, tl), B2 = kiteAt(lt - d - 0.03, ts, tl); return [(A2.x - B2.x) / 0.03, (A2.y - B2.y) / 0.03]; };
    const ca = Math.cos(K0.rot), sa = Math.sin(K0.rot), segL = lerp(4.4, 6.6, hold);
    for (const sd of [-1, 1]) {
      const bx = sd * 17 * K0.roll, by = 52;
      let x = K0.x + (bx * ca - by * sa) * K0.s, y = K0.y + (bx * sa + by * ca) * K0.s, th = K0.rot + PI / 2 + sd * 0.12;
      const pts = [[x, y]];
      for (let k = 1; k <= 9; k++) {
        const [vx, vy] = vel(k * 0.018), sp = Math.hypot(vx, vy), m = clamp((sp - 60) / 220);
        let want = PI / 2 + 0.15 * Math.sin(t * 1.3 + sd + k * 0.3);
        want += m * wrapA(Math.atan2(-vy, -vx) - want);
        want += Math.sin(t * 9 - k * 0.8 + sd) * 0.35 * hold;
        // 第一节可以多转一些（贴着燕尾长出来），之后每节转角不超过 0.24，不会打卷
        const lim = k === 1 ? 0.5 : 0.24;
        th += clamp(wrapA(want - th), -lim, lim);
        x += Math.cos(th) * segL; y += Math.sin(th) * segL;
        pts.push([x, y]);
      }
      g.fillStyle = sd < 0 ? 'rgba(222,130,60,0.92)' : 'rgba(200,70,46,0.88)';
      g.beginPath();
      const hw = (k) => 2.8 * (1 - k / 10.5);
      const nrm = (k) => { const A2 = pts[Math.max(0, k - 1)], B2 = pts[Math.min(pts.length - 1, k + 1)], an = Math.atan2(B2[1] - A2[1], B2[0] - A2[0]); return [-Math.sin(an), Math.cos(an)]; };
      pts.forEach(([px, py], k) => { const [nx, ny] = nrm(k); k ? g.lineTo(px + nx * hw(k), py + ny * hw(k)) : g.moveTo(px + nx * hw(k), py + ny * hw(k)); });
      for (let k = pts.length - 1; k >= 0; k--) { const [nx, ny] = nrm(k); g.lineTo(pts[k][0] - nx * hw(k), pts[k][1] - ny * hw(k)); }
      g.closePath(); g.fill();
    }
  }

  // 远山（底图与倒影共用）
  const HILLS2 = [
    { kind: 'far', color: '#b2bdca', light: '#e8ecee', litA: 0.35, y: 436, scaleY: 0.3, speed: 0, seed: 6, fog: '#d8dee2', fogA: 0.5 },
    { kind: 'mid', color: '#92a0b0', light: '#d8dee4', litA: 0.3, y: 448, scaleY: 0.24, speed: 0, seed: 9, fog: '#d0d8dc', fogA: 0.45, offset: 400 },
  ];
  function va2Hills(k) {
    E.mountains(k, { t: 0, lightDir: 1, layers: HILLS2 });
    k.fillStyle = '#8692a0'; k.fillRect(-40, 442, W + 80, 7);
    const r = A.rng(13);
    for (let i = 0; i < 300; i++) { const x = -40 + r() * (W + 80), h = 3 + r() * 11; k.fillRect(x, 443 - h, 1.1, h); }
    // 对岸几丛远柳，淡淡的
    for (let j = 0; j < 5; j++) { const x = 90 + j * 270 + r() * 90; for (let m = 0; m < 9; m++) E.util.streak(k, x + (r() - 0.5) * 30, 432 + (r() - 0.5) * 10, 12 + r() * 10, 5 + r() * 4, '#8a98a6', 0.3); }
  }
  // 静态底：阴天、远山、对岸、河、淡倒影、芦苇丛底色（软边，里面几层斜斜的远苇与薄雾）
  function va2Bg() {
    return cache('g02_va2_bg2', W + 80, H + 80, 1, (q) => {
      q.translate(40, 40);
      q.fillStyle = K.lin(q, 0, -40, 0, 470, [[0, '#8796a8'], [0.5, '#bcc5cd'], [1, '#e0e4e4']]); q.fillRect(-40, -40, W + 80, 520);
      A.softBlob(q, 1010, 110, 320, 0.3, '#f6f7f4');
      va2Hills(q);
      // 河
      q.fillStyle = K.lin(q, 0, 449, 0, 600, [[0, '#ccd3d6'], [0.4, '#b9c2c8'], [1, '#98a4ae']]); q.fillRect(-40, 449, W + 80, H + 40 - 449);
      q.save(); q.globalAlpha = 0.18; q.translate(0, 898); q.scale(1, -1); q.beginPath(); q.rect(-40, 300, W + 80, 149); q.clip(); va2Hills(q); q.restore();
      // 岸边一线水光：断断续续、有浓有淡，不是一条直尺线
      { const r0 = A.rng(17); for (let x = -40; x < W + 40; x += 22 + r0() * 30) E.util.streak(q, x, 450, 14 + r0() * 30, 1.4, '#eef2f2', 0.25 + r0() * 0.35); }
      // 芦苇丛底色：顶上一片银白的芦花海，往下转青灰；里面几层斜斜的远苇（带一点芦花头）、几道薄雾
      const top = (x) => reedTop(x) + 26;
      q.save();
      q.beginPath(); q.moveTo(-40, H + 40); for (let x = -40; x <= W + 40; x += 16) q.lineTo(x, top(x) + Math.sin(x * 0.045) * 7 + Math.sin(x * 0.13) * 3); q.lineTo(W + 40, H + 40); q.closePath(); q.clip();
      q.fillStyle = K.lin(q, 0, 340, 0, H, [[0, '#d2d8da'], [0.3, '#a8b2ba'], [0.65, '#76828e'], [1, '#4c5762']]); q.fillRect(-40, 300, W + 80, 500);
      const r = A.rng(29);
      q.lineCap = 'round';
      const tips = [];
      for (let pass = 0; pass < 3; pass++) {
        const P = new Path2D();
        for (let i = 0; i < 60; i++) {
          const x = -40 + r() * (W + 80), y0 = top(x) + 12 + pass * 46 + r() * 40, h = 44 + r() * 40 + pass * 28, lean = 12 + r() * 18 + pass * 5;
          P.moveTo(x, y0 + h); P.quadraticCurveTo(x + lean * 0.15, y0 + h * 0.5, x + lean, y0);
          tips.push([x + lean, y0, pass, r()]);
        }
        q.strokeStyle = ['rgba(120,132,144,0.32)', 'rgba(96,108,120,0.36)', 'rgba(70,80,92,0.4)'][pass]; q.lineWidth = 0.9 + pass * 0.4; q.stroke(P);
        // 一道薄雾把这一层和下一层隔开
        for (let x = -40; x < W + 60; x += 120) E.util.streak(q, x + r() * 60, top(x) + 50 + pass * 50, 150, 16, '#c4ccd2', 0.16);
      }
      for (const [x, y, pass, v] of tips) E.util.streak(q, x + 5, y + 2, 9 + pass * 3, 3 + pass, pass ? '#c8d0d4' : '#e6eaea', 0.4 - pass * 0.08, 0.4 + v * 0.3);
      q.restore();
      for (let i = 0; i < 140; i++) {
        const x = -40 + r() * (W + 80), y = top(x) - 4 + Math.pow(r(), 1.5) * 70;
        E.util.streak(q, x, y, 24 + r() * 46, 5 + r() * 7, r() < 0.7 ? '#f2f3ee' : '#c8d0d4', 0.16 + r() * 0.2);
      }
    });
  }
  // 静水里清楚一些的倒影（风停才显出来）
  function va2Refl() {
    return cache('g02_va2_refl', W + 80, 150, 1, (q) => {
      q.translate(40, -449);
      q.translate(0, 898); q.scale(1, -1);
      q.beginPath(); q.rect(-40, 300, W + 80, 149); q.clip();
      va2Hills(q);
    });
  }
  // 云带：一条可平铺的淡墨云气（周期 1600）
  function va2Clouds() {
    return cache('g02_va2_cloud', 1600, 240, 0.5, (q) => {
      const r = A.rng(41);
      for (let i = 0; i < 46; i++) {
        const x = r() * 1600, y = 50 + r() * 150, rx = 80 + r() * 200, ry = 14 + r() * 26, v = r();
        for (const dx of [-1600, 0, 1600]) E.util.streak(q, x + dx, y, rx, ry, mix('#f2f4f4', '#8e9aa8', v * 0.7), 0.16 + r() * 0.16);
      }
    });
  }

  // 近景芦苇：五株在焦（左矮右高，接着对角线），两株极近、失焦的框住左右两边。
  //   叶是带状长叶：宽处在三成，S 形，叶尖下垂；风里顺风拉直、抖动，风停后慢慢垂回去
  const NEAR = (() => {
    const out = [];
    const xs = [150, 380, 610, 850, 1080].map((x, i) => x + (h2(i, 301) - 0.5) * 2 * 0.4 * 230);
    xs.forEach((x, i) => {
      const nl = 1 + Math.floor(h2(i, 302) * 3.99), leaves = [];
      for (let k = 0; k < nl; k++) leaves.push({ u: 0.12 + 0.5 * h2(i * 7 + k, 303), side: (k + i) % 2 ? 1 : -1, len: lerp(0.3, 0.5, h2(i * 7 + k, 304)), w: lerp(9, 13, h2(i * 7 + k, 305)), sd: i * 7 + k });
      out.push({ x, h: lerp(330, 430, h2(i, 306)) * lerp(0.55, 1.15, x / W), tone: mix('#3a444e', '#5a6672', h2(i, 307)), w: lerp(5.5, 7.5, h2(i, 308)), leaves, sd: i });
    });
    out.push({ x: 26, h: 430, tone: '#56616c', w: 14, blur: true, sd: 20, leaves: [{ u: 0.22, side: 1, len: 0.42, w: 26, sd: 51 }, { u: 0.45, side: -1, len: 0.36, w: 22, sd: 52 }] });
    out.push({ x: 1252, h: 660, tone: '#4e5964', w: 16, blur: true, sd: 21, leaves: [{ u: 0.18, side: -1, len: 0.4, w: 30, sd: 53 }, { u: 0.36, side: 1, len: 0.32, w: 24, sd: 54 }, { u: 0.55, side: -1, len: 0.3, w: 22, sd: 55 }] });
    return out;
  })();
  // 一株近景芦苇：茎、叶填进路径 P（同色），返回穗根位置与角度
  function nearStem(P, R, c, w, y0) {
    const t = c.t, x = R.x, h = R.h, bend = bendAt(w, x, h2(R.sd, 8) * 3);
    const a = bend * 0.9 * (0.85 + 0.3 * h2(R.sd, 4)) + 0.05 * Math.sin(t * (5 + h2(R.sd, 9) * 4) + R.sd) * (0.3 + bend) + (h2(R.sd, 5) - 0.5) * 0.12;
    const tx = x + Math.sin(a) * h * 0.92, ty = y0 - Math.cos(a) * h, cx = x + Math.sin(a * 0.3) * h * 0.25, cy = y0 - h * 0.6;
    taper(P, x, y0, cx, cy, tx, ty, R.w, R.w * 0.3, 12);
    for (const L of R.leaves) {
      const u = L.u, b0 = (1 - u) * (1 - u), b1 = 2 * u * (1 - u), b2 = u * u;
      let px = b0 * x + b1 * cx + b2 * tx, py = b0 * y0 + b1 * cy + b2 * ty;
      const dX = 2 * (1 - u) * (cx - x) + 2 * u * (tx - cx), dY = 2 * (1 - u) * (cy - y0) + 2 * u * (ty - cy);
      const th0 = Math.atan2(dY, dX) + L.side * 0.5, len = L.len * h, N = 12, ds = len / N, Lp = [], Rp = [];
      for (let k = 0; k <= N; k++) {
        const v = k / N;
        const calm = th0 + L.side * (2.3 * v * v - 0.35 * v);
        const windy = lerp(th0, 0.18 + 0.1 * Math.sin(t * 9 + v * 4 + L.sd), smooth(v * 1.5));
        const th = lerp(calm, windy, bend * 0.9) + Math.sin(t * 12 + v * 5 + L.sd) * 0.12 * v * bend + Math.sin(t * 1.4 + L.sd) * 0.04 * v;
        const ww = L.w * (0.25 + 0.75 * Math.pow(v < 0.3 ? v / 0.3 : 1 - (v - 0.3) / 0.7, 0.75)) * (k === N ? 0.1 : 1) / 2;
        const nx = -Math.sin(th) * ww, ny = Math.cos(th) * ww;
        Lp.push([px + nx, py + ny]); Rp.push([px - nx, py - ny]);
        px += Math.cos(th) * ds; py += Math.sin(th) * ds;
      }
      P.moveTo(Lp[0][0], Lp[0][1]); for (let k = 1; k <= N; k++) P.lineTo(Lp[k][0], Lp[k][1]);
      for (let k = N; k >= 0; k--) P.lineTo(Rp[k][0], Rp[k][1]); P.closePath();
    }
    return [tx, ty, a, bend];
  }
  function nearPlume(g, tex, tx, ty, a, bend, sd, ps, t) {
    const pa = lerp(0.6 + (h2(sd, 11) - 0.5) * 0.6, -0.12, bend) + a * 0.3 + 0.09 * Math.sin(t * 8 + sd) * bend;
    const m = g.getTransform(), ca = Math.cos(pa) * ps, sa = Math.sin(pa) * ps;
    g.setTransform(m.a * ca + m.c * sa, m.b * ca + m.d * sa, -m.a * sa + m.c * ca, -m.b * sa + m.d * ca, m.a * tx + m.c * ty + m.e, m.b * tx + m.d * ty + m.f);
    g.drawImage(tex, -4, -17, 80, 34);
    g.setTransform(m);
  }

  XYT.registerShot('va2_kite', {
    name: '风倦纸鸢', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(236,240,242,0.92)', accent: '#ca6924', bloom: 0.3,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const ts = charAt(c, 4, 1.77) + 0.08, tl = ts + 0.85;
      const w = va2Wind(lt, ts);
      // 镜头：风停后轻轻下摇，跟着纸鸢落下（画面上移，近处移得多）
      const tilt = smooth(clamp((lt - ts + 0.1) / 1.15));
      const dy = (k) => -34 * tilt * k;
      const calm = 1 - w.hold;

      g.save(); g.translate(0, dy(0.5));
      g.imageSmoothingEnabled = false;
      g.drawImage(va2Bg(), -40, -40, W + 80, H + 80);
      g.imageSmoothingEnabled = true;
      // 云在风里跑，风停也慢下来
      {
        const cl = va2Clouds(), off = ((w.integ * 150 + lt * 8) % 1600 + 1600) % 1600;
        g.globalAlpha = 0.8;
        for (let x = off - 1600; x < W; x += 1600) g.drawImage(cl, x, 50, 1600, 240);
        g.globalAlpha = 1;
      }
      // 远天一行雁，缓缓往南去
      V.birds(g, c, { kind: 'v', n: 7, x: 1130, y: 196, dir: -1, speed: 14, size: 0.42, color: '#5a6470', alpha: 0.55, seed: 4 });
      // 风停以后河面静成镜子：对岸的倒影清楚起来，近岸一道断断续续的天光
      if (calm > 0.02) {
        g.globalAlpha = 0.25 * calm; g.drawImage(va2Refl(), -40, 449, W + 80, 150); g.globalAlpha = 1;
        g.fillStyle = '#f8fafa';
        for (let i = 0; i < 16; i++) {
          const x = 380 + i * 17 + (h2(i, 47) - 0.5) * 8, len = 5 + 12 * h2(i, 48), fl = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.9);
          g.globalAlpha = 0.6 * calm * fl * Math.sin(((i + 0.5) / 16) * PI);
          g.fillRect(x, 466 + Math.sin(i * 2.3) * 1.5, len, 1.3);
        }
        g.globalAlpha = 1;
      }
      // 河面风纹：一道道皱纹在跑
      if (w.hold > 0.02) {
        g.fillStyle = 'rgba(92,106,120,0.24)';
        for (let i = 0; i < 50; i++) {
          const y = 453 + Math.pow(h2(i, 41), 1.3) * 110, k = (y - 449) / 110;
          const x = ((h2(i, 42) * 1500 + w.integ * (320 + 520 * k)) % 1500) - 110;
          if (x > w.front + 80) continue;
          g.globalAlpha = w.hold * (0.5 + 0.5 * h2(i, 44));
          g.fillRect(x, y, (20 + 60 * h2(i, 43)) * (0.5 + k), 1 + k * 1.5);
        }
        g.globalAlpha = 1;
      }
      E.mist(g, { t: lt, y: 446, h: 64, color: '#eef0ee', alpha: 0.42, speed: 4 + 30 * w.hold, seed: 3 });
      g.restore();

      // 远、中两层活动的芦苇
      g.save(); g.translate(0, dy(0.8));
      reedBand(g, 'far', c, w);
      E.mist(g, { t: lt, y: reedTop(700) + 46, h: 110, color: '#c8d0d6', alpha: 0.4, speed: 6 + 50 * w.hold, seed: 5 });
      reedBand(g, 'mid', c, w);
      g.restore();

      // 纸鸢、断线、两条燕尾飘带
      const K0 = kiteAt(lt, ts, tl);
      const rest = smooth(clamp((lt - tl + 0.35) / 0.6));
      g.save(); g.translate(0, dy(0.8));
      {
        // 断线：沿纸鸢走过的路拖在后面，风里扭动、越远越淡；落定后搭在几支芦花上
        const pts = [[K0.x, K0.y + 6]];
        for (let k = 1; k <= 21; k++) {
          const P = kiteAt(lt - k * 0.05, ts, tl), u = k / 21;
          const wob = Math.sin(t * 9 - k * 0.8) * k * 0.45 * w.hold + Math.sin(t * 3 - k * 0.4) * k * 0.2;
          let x = P.x - k * 4 * (0.4 + w.hold), y = P.y + 8 + Math.pow(k, 1.35) * 1.5 + wob;
          // 落定后的样子：往左搭过三支芦花，每两支之间垂下一点，末梢垂进苇丛
          const rx = K0.x - 8 - u * 280, sag = 13 * Math.abs(Math.sin(u * 3 * PI)), base = reedTop(rx) + 14;
          const ry = lerp(K0.y + 6, base, smooth(u * 5)) + sag + Math.max(0, u - 0.88) * 520;
          x = lerp(x, rx, rest); y = lerp(y, ry, rest);
          pts.push([x, y]);
        }
        kiteTails(g, t, lt, ts, tl, K0, w.hold);
        const back = K0.roll < 0, sx = Math.max(0.12, Math.abs(K0.roll));
        g.save(); g.translate(K0.x, K0.y); g.rotate(K0.rot); g.scale(sx * K0.s * (back ? -1 : 1), K0.s);
        g.drawImage(kiteTex(back), -65, -60, 130, 130);
        g.restore();
        // 纸鸢是全片唯一的暖色：淡淡一圈暖光
        scr(g, () => glow(g, K0.x, K0.y, 70, '#ffd8a0', 0.18));
        // 落点右前方的两三支芦苇，把纸鸢半掩住（不挡住鸢面）
        reedBand(g, 'mid', c, w, (x) => x > K0.x + 14 && x < K0.x + 96 && lt > ts + 0.45, '#56626e');
        // 线最后画，压在芦花上（1.5 像素，越远越淡）
        g.lineWidth = lerp(1.1, 1.5, rest); g.lineCap = 'round'; g.lineJoin = 'round';
        for (let j = 0; j < 3; j++) {
          g.strokeStyle = rgba('#2a3036', lerp([0.7, 0.45, 0.2][j], [0.75, 0.65, 0.5][j], rest));
          g.beginPath(); g.moveTo(pts[j * 7][0], pts[j * 7][1]);
          for (let k = j * 7 + 1; k <= j * 7 + 7; k++) g.lineTo(pts[k][0], pts[k][1]);
          g.stroke();
        }
      }
      g.restore();

      // 近景芦苇：五株在焦的深色芦苇
      const dN = dy(1.3);
      g.save(); g.translate(0, dN);
      {
        const tex = plumeTex('lite');
        for (const R of NEAR) {
          if (R.blur) continue;
          const P = new Path2D(), [tx, ty, a, bend] = nearStem(P, R, c, w, 790);
          g.fillStyle = R.tone; g.globalAlpha = 0.95; g.fill(P);
          g.globalAlpha = 0.95; nearPlume(g, tex, tx, ty, a, bend, R.sd + 400, 1.9 * (0.8 + 0.4 * h2(R.sd, 6)) * lerp(0.75, 1.1, R.x / W), t);
          g.globalAlpha = 1;
        }
      }
      g.restore();
      // 两株极近的失焦芦苇：在低分辨率里画，放大后自然虚掉
      {
        const blurT = plumeTex('blur');
        for (const R of NEAR) {
          if (!R.blur) continue;
          const bx0 = R.x < 640 ? -24 : 1020, bx1 = R.x < 640 ? 300 : W + 24;
          V.util.viaScratch(g, 'g02_va2_nb' + R.sd, [bx0, -24, bx1, H + 24], 0.16, 'source-over', 0.82, (q) => {
            q.translate(0, dN);
            const P = new Path2D(), [tx, ty, a, bend] = nearStem(P, R, c, w, 800);
            q.fillStyle = R.tone; q.fill(P);
            q.globalAlpha = 0.9; nearPlume(q, blurT, tx, ty, a, bend, R.sd, 3.4, t); q.globalAlpha = 1;
          });
        }
      }

      // 芦絮：风里被卷着横飞；风停后剩下的慢慢往下落；一切静下来以后，穗上才松下几朵大的，在深色苇丛前慢慢飘落
      {
        const tp = plumeRot('lite', 9);
        for (let i = 0; i < 44; i++) {
          const z = h2(i, 61), s = lerp(0.06, 0.2, z * z);
          const x0 = -900 + h2(i, 62) * 2200, y0 = 150 + h2(i, 63) * 480;
          const x = x0 + w.integ * (520 + 700 * z) + Math.sin(t * 1.3 + i) * 12;
          const y = y0 + Math.sin(t * 2 + i * 2) * 10 + Math.max(0, lt - ts - 0.4) * (10 + 18 * z) - w.integ * 26;
          if (x < -20 || x > W + 20) continue;
          g.globalAlpha = 0.6 * (0.4 + 0.6 * z);
          g.drawImage(tp, x + tp.ox * s, y + tp.oy * s, tp.lw * s, tp.lh * s);
        }
        for (let i = 0; i < 12; i++) {
          const age = lt - tl + 0.05 - h2(i, 71) * 0.3;
          if (age < 0) continue;
          const bx = 200 + ((i + h2(i, 72)) / 12) * 980, s = lerp(0.35, 0.5, h2(i, 74));
          const x = bx + Math.sin(age * 1.8 + i) * 10 + age * 7, y = reedTop(bx) + 30 + h2(i, 73) * 110 + age * lerp(10, 14, h2(i, 75)) + dy(1.0);
          g.globalAlpha = 0.9 * smooth(age / 0.3);
          g.drawImage(tp, x + tp.ox * s, y + tp.oy * s, tp.lw * s, tp.lh * s);
        }
        g.globalAlpha = 1;
      }
      // 下一镜的贴图提前建好
      pretouch(c, [touchHills(HILLS3[0]), va3Far, va3Eave, () => va3Post(-1), () => va3Post(1), va3Sash, va3Sill, () => { for (let v = 0; v < 4; v++) ghostTex(v, 0); }, () => { for (let v = 0; v < 4; v++) ghostTex(v, 1); }, () => { for (let v = 0; v < 4; v++) trailTex(v); }]);
    },
  });

  // ======================================================================
  // 3 落日赖檐：客栈二楼窗内外望黄昏长街。落日钩在对街翘起的檐角上一动不动，
  //   街上行人、云影、炊烟按二十倍速流过——每拍掠过一阵；“赖”字上一缕炊烟抹过日轮，太阳仍不动
  // ======================================================================
  const SUN3 = [816, 242, 44];
  // 街面透视：石板缝收向远处街口的灭点
  const VP3 = [700, 500];
  const HILLS3 = [{ kind: 'far', color: '#b0605a', light: '#f0a060', litA: 0.4, y: 488, scaleY: 0.3, speed: 0, seed: 3, fog: '#e8984e', fogA: 0.5, soft: true }];
  // 远景：晚霞天、远处沿街的屋脊与山、塔影、街面（静态，烘成一张）
  function va3Far() {
    return cache('g02_va3_far2', W + 80, 780, 1, (q) => {
      q.translate(40, 0);
      q.fillStyle = K.lin(q, 0, 0, 0, 560, [[0, '#4a3248'], [0.28, '#8a4a4a'], [0.55, '#d8783e'], [0.8, '#f2b452'], [1, '#f8d68a']]);
      q.fillRect(-40, 0, W + 80, 600);
      // 天边一抹淡紫的霞
      for (let i = 0; i < 14; i++) E.util.streak(q, 100 + i * 90, 330 + Math.sin(i) * 20, 120, 8, '#b85a5a', 0.18);
      // 远山与塔
      E.mountains(q, { t: 0, lightDir: 1, layers: HILLS3 });
      q.fillStyle = 'rgba(120,60,54,0.75)';
      const px = 380, py = 420;
      for (let k = 0; k < 6; k++) { const w = 18 - k * 2, y = py - k * 13; q.fillRect(px - w / 2, y - 9, w, 9); q.beginPath(); q.moveTo(px - w / 2 - 6, y - 8); q.lineTo(px + w / 2 + 6, y - 8); q.lineTo(px + w / 2, y - 12); q.lineTo(px - w / 2, y - 12); q.closePath(); q.fill(); }
      q.fillRect(px - 1, py - 92, 2, 14);
      // 远处沿街的屋脊：逆光的剪影，三层由远到近、由淡到深，脊上一线夕照
      roofline(q, 452, 0.45, '#c87a5e', 'rgba(255,200,130,0.5)', 5, -40, 900);
      roofline(q, 490, 0.66, '#9a5446', 'rgba(255,190,120,0.55)', 9, -40, 880);
      roofline(q, 526, 0.9, '#6e3a32', 'rgba(255,180,110,0.6)', 13, -40, 860);
      // 街面：青石板反着天光，越近越暗
      q.fillStyle = K.lin(q, 0, 526, 0, 780, [[0, '#e8a060'], [0.3, '#b86c40'], [1, '#4a2818']]); q.fillRect(-40, 526, W + 80, 260);
      q.fillStyle = 'rgba(255,220,150,0.4)'; q.fillRect(-40, 526, W + 80, 1.6);
      // 夕阳顺着湿石板拉下来的一道亮
      q.save(); q.translate(SUN3[0], 600); q.scale(0.32, 1); A.softBlob(q, 0, 0, 240, 0.42, '#ffd890'); q.restore();
      A.softBlob(q, SUN3[0], 545, 150, 0.25, '#ffc070');
      // 石板：横缝按透视越近越疏、略有起伏；竖缝收向灭点，一行一行错开
      const r = A.rng(71), rows = [528, 536, 546, 559, 576, 598, 626, 662, 708, 770];
      q.lineCap = 'round';
      for (let j = 0; j < rows.length - 1; j++) {
        const y0 = rows[j], y1 = rows[j + 1], k = (y0 - VP3[1]) / 280;
        q.strokeStyle = rgba('#3a1a10', 0.16 + 0.12 * k); q.lineWidth = 0.6 + 1.2 * k;
        q.beginPath();
        for (let x = -40; x <= W + 40; x += 40) { const yy = y1 + Math.sin(x * 0.03 + j) * 0.8 * k; x === -40 ? q.moveTo(x, yy) : q.lineTo(x, yy); }
        q.stroke();
        for (let m = -40; m <= 40; m++) {
          if ((m + j) % 2) continue;
          const xb = VP3[0] + (m + (j % 3) * 0.33) * 34;
          const xa = VP3[0] + (xb - VP3[0]) * ((y0 - VP3[1]) / 280), xc = VP3[0] + (xb - VP3[0]) * ((y1 - VP3[1]) / 280);
          if (Math.max(xa, xc) < -40 || Math.min(xa, xc) > W + 40) continue;
          q.beginPath(); q.moveTo(xa + (r() - 0.5) * 2, y0 + 1); q.lineTo(xc + (r() - 0.5) * 2, y1 - 1); q.stroke();
        }
        // 石板上零星的水亮与暗斑（软边，扁扁的）
        for (let i = 0; i < 5 + j; i++) E.util.streak(q, -40 + r() * (W + 80), (y0 + y1) / 2, (18 + r() * 40) * (0.5 + k), (y1 - y0) * 0.35, r() < 0.5 ? '#ffcf90' : '#3a1a10', 0.06 + 0.06 * r());
      }
      // 对街楼脚下的一道排水沟，沟沿反一线光
      q.fillStyle = '#2a140c'; poly(q, [[846, 688], [1340, 688], [1340, 700], [840, 698]]); q.fill();
      q.fillStyle = 'rgba(255,200,130,0.35)'; q.fillRect(846, 698, 494, 1.4);
    });
  }
  // 一排屋脊剪影：硬山、歇山、马头墙随机相接；y 墙脚，s 尺度，rim 脊上受光
  function roofline(q, y, s, col, rim, seed, x0, x1) {
    const r = A.rng(seed), P = new Path2D(), R = new Path2D();
    let x = x0;
    while (x < x1) {
      const w = (60 + r() * 90) * s, h = (40 + r() * 46) * s, top = y - h, kind = r();
      if (kind < 0.4) {
        // 马头墙：两三级台阶，外端起翘
        const st = 2 + Math.floor(r() * 2), sh = 12 * s;
        P.moveTo(x, y); P.lineTo(x, top);
        for (let k = 0; k < st; k++) { const xa = x + (k * w) / (st * 2), xb = x + ((k + 1) * w) / (st * 2); P.lineTo(xa, top - k * sh); P.lineTo(xa - 3 * s, top - k * sh - 5 * s); P.lineTo(xb, top - k * sh - 2 * s); R.moveTo(xa, top - k * sh - 1); R.lineTo(xb, top - k * sh - 1); }
        for (let k = st - 1; k >= 0; k--) { const xa = x + w - ((k + 1) * w) / (st * 2), xb = x + w - (k * w) / (st * 2); P.lineTo(xa, top - k * sh - 2 * s); P.lineTo(xb + 3 * s, top - k * sh - 5 * s); P.lineTo(xb, top - k * sh); R.moveTo(xa, top - k * sh - 1); R.lineTo(xb, top - k * sh - 1); }
        P.lineTo(x + w, y); P.closePath();
      } else {
        // 坡屋顶：檐角起翘，正脊两端鸱吻
        const rh = (16 + r() * 18) * s, ov = 10 * s;
        P.moveTo(x, y); P.lineTo(x, top + 4 * s); P.lineTo(x - ov, top + 2 * s); P.quadraticCurveTo(x - ov * 0.4, top - 2 * s, x + w * 0.18, top - rh); P.lineTo(x + w * 0.82, top - rh);
        P.quadraticCurveTo(x + w + ov * 0.4, top - 2 * s, x + w + ov, top + 2 * s); P.lineTo(x + w, top + 4 * s); P.lineTo(x + w, y); P.closePath();
        P.moveTo(x + w * 0.18, top - rh); P.lineTo(x + w * 0.16, top - rh - 7 * s); P.lineTo(x + w * 0.24, top - rh); P.closePath();
        P.moveTo(x + w * 0.82, top - rh); P.lineTo(x + w * 0.84, top - rh - 7 * s); P.lineTo(x + w * 0.76, top - rh); P.closePath();
        R.moveTo(x + w * 0.18, top - rh); R.lineTo(x + w * 0.82, top - rh);
        if (r() < 0.5) { const cx = x + w * (0.3 + r() * 0.4); P.rect(cx, top - rh - 14 * s, 6 * s, 14 * s); }
      }
      x += w * (0.75 + r() * 0.35);
    }
    q.fillStyle = col; q.fill(P);
    q.strokeStyle = rim; q.lineWidth = 1.2; q.stroke(R);
  }
  // 对街的楼：翘起的檐角（尖端卷起，正好钩住日轮）、戗脊上的走兽、二楼格窗与灯笼、山墙
  function va3Eave() {
    return cache('g02_va3_eave2', 560, 520, 1, (q) => {
      q.translate(-780, -170);
      const ink = '#2a1a1a', tile = '#3a2424';
      // 檐口线：尖端 → 往右下 → 平缓
      const eave = (x) => (x < 880 ? lerp(266, 314, smooth((x - 806) / 74)) : lerp(314, 332, (x - 880) / 460));
      // 屋面
      q.beginPath(); q.moveTo(806, 262);
      for (let x = 806; x <= 1340; x += 6) q.lineTo(x, eave(x));
      q.lineTo(1340, 188); q.lineTo(1018, 190); q.closePath();
      q.fillStyle = K.lin(q, 0, 190, 0, 330, [[0, '#4a2e2a'], [1, tile]]); q.fill();
      // 瓦垄：从脊往檐口斜下
      q.save(); q.clip();
      for (let k = 0; k < 60; k++) {
        const xt = 1018 + k * 9, xb = 812 + k * 9.4;
        q.strokeStyle = 'rgba(20,10,10,0.55)'; q.lineWidth = 2.2; q.beginPath(); q.moveTo(xt, 190); q.lineTo(xb, eave(xb) + 2); q.stroke();
        q.strokeStyle = 'rgba(255,170,110,0.12)'; q.lineWidth = 1; q.beginPath(); q.moveTo(xt + 3, 190); q.lineTo(xb + 3, eave(xb + 3) + 2); q.stroke();
      }
      q.restore();
      // 正脊与戗脊（逆光下的亮边）
      q.fillStyle = ink;
      q.beginPath(); q.moveTo(1010, 180); q.lineTo(1340, 178); q.lineTo(1340, 192); q.lineTo(1016, 196); q.closePath(); q.fill();
      q.lineWidth = 9; q.strokeStyle = ink; q.lineCap = 'round';
      q.beginPath(); q.moveTo(1016, 190); q.quadraticCurveTo(900, 214, 836, 258); q.stroke();
      // 走兽：戗脊上一串小兽剪影
      for (let k = 0; k < 4; k++) {
        const u = 0.25 + k * 0.17, x = lerp(1016, 846, u), y = lerp(190, 252, u * u * 0.6 + u * 0.4) - 6;
        q.fillStyle = ink; q.beginPath(); q.ellipse(x, y - 4, 4.5, 6, -0.3, 0, TAU); q.fill(); q.beginPath(); q.arc(x - 3, y - 11, 3, 0, TAU); q.fill();
      }
      // 翘角：檐角往上卷起，像一只钩
      q.fillStyle = ink;
      q.beginPath();
      q.moveTo(880, 318); q.quadraticCurveTo(836, 300, 818, 276); q.quadraticCurveTo(804, 256, 808, 240);
      q.quadraticCurveTo(812, 230, 822, 234); q.quadraticCurveTo(814, 240, 818, 252); q.quadraticCurveTo(828, 268, 852, 282);
      q.quadraticCurveTo(870, 292, 890, 300); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(255,190,110,0.55)'; q.lineWidth = 1.4;
      q.beginPath(); q.moveTo(1340, 178); q.lineTo(1010, 180); q.quadraticCurveTo(900, 206, 832, 250); q.quadraticCurveTo(812, 236, 822, 234); q.stroke();
      // 檐下：椽头一排、楼上的木墙与格窗（窗纸透出暖光）
      q.fillStyle = '#1e1212'; q.fillRect(870, 318, 480, 14);
      q.fillStyle = 'rgba(255,170,110,0.18)'; for (let x = 884; x < 1340; x += 12) { q.beginPath(); q.arc(x, 326, 2.6, 0, TAU); q.fill(); }
      q.fillStyle = K.lin(q, 0, 330, 0, 690, [[0, '#2a1a18'], [1, '#1a100e']]); q.fillRect(872, 330, 480, 360);
      for (const [wx, ww] of [[920, 110], [1080, 120], [1250, 90]]) {
        q.fillStyle = '#b06a3a'; q.fillRect(wx, 372, ww, 82);
        q.strokeStyle = '#2a1812'; q.lineWidth = 2.4;
        for (let k = 1; k < 6; k++) { q.beginPath(); q.moveTo(wx + (k * ww) / 6, 372); q.lineTo(wx + (k * ww) / 6, 454); q.stroke(); }
        for (let k = 1; k < 4; k++) { q.beginPath(); q.moveTo(wx, 372 + k * 20.5); q.lineTo(wx + ww, 372 + k * 20.5); q.stroke(); }
        q.lineWidth = 5; q.strokeRect(wx, 372, ww, 82);
      }
      // 腰檐与一楼铺面
      q.fillStyle = '#2a1a1a'; poly(q, [[860, 486], [1350, 486], [1350, 504], [850, 506]]); q.fill();
      q.fillStyle = 'rgba(255,180,110,0.2)'; q.fillRect(858, 486, 492, 2);
      q.fillStyle = '#160e0c'; q.fillRect(872, 506, 480, 190);
      q.fillStyle = 'rgba(176,100,52,0.55)'; q.fillRect(930, 530, 150, 120); q.fillRect(1130, 530, 160, 120);
      q.fillStyle = 'rgba(40,20,14,0.7)'; for (let k = 0; k < 6; k++) { q.fillRect(930 + k * 25, 530, 3, 120); q.fillRect(1130 + k * 27, 530, 3, 120); }
      // 竖招牌
      q.fillStyle = '#3a2218'; q.fillRect(1094, 340, 26, 120); q.strokeStyle = '#c89a5a'; q.lineWidth = 1.2; q.strokeRect(1096, 342, 22, 116);
      E.util.glyphs(q, '酒', 1107, 374, 17, '#e8c890'); E.util.glyphs(q, '茶', 1107, 420, 17, '#e8c890');
      // 山墙边（朝街的一侧，受夕照）
      q.fillStyle = '#3a2420'; q.fillRect(860, 300, 14, 400);
      q.fillStyle = 'rgba(255,180,100,0.35)'; q.fillRect(860, 300, 2.5, 400);
    });
  }
  // 前景失焦：先在低分辨率的临时画布上画清楚，再整张一次性模糊进缓存（只模糊一次，便宜）
  function softCache(key, w, h, sc, blurPx, fn) {
    return cache(key, w, h, sc, (q) => {
      const S0 = (XYT.sprites && XYT.sprites.S) || 1, k = S0 * sc;
      const tmp = document.createElement('canvas'); tmp.width = Math.max(1, Math.round(w * k)); tmp.height = Math.max(1, Math.round(h * k));
      const tq = tmp.getContext('2d'); tq.scale(k, k); fn(tq);
      q.save(); q.setTransform(1, 0, 0, 1, 0, 0);
      try { q.filter = 'blur(' + Math.max(1, blurPx * k).toFixed(1) + 'px)'; } catch (e) { /* 无滤镜就不虚 */ }
      q.drawImage(tmp, 0, 0); q.filter = 'none'; q.restore();
    });
  }
  // 客栈的窗：左右窗柱带半扇格窗、上方撑起的支摘窗（前景失焦）
  function va3Post(side) {
    const w = side < 0 ? 230 : 190;
    return softCache('g02_va3_post3' + side, w, H + 140, 0.25, 11, (q) => {
      const x0 = side < 0 ? 0 : 20, pw = side < 0 ? 70 : 60, lw = w - pw - 20;
      // 格扇：暗木格子，格心透着暖光
      const lx = side < 0 ? x0 + 10 : x0 + pw;
      q.fillStyle = 'rgba(232,150,80,0.55)'; q.fillRect(lx, 40, lw, H + 40);
      q.strokeStyle = '#2a140c'; q.lineWidth = 6;
      for (let k = 0; k <= 4; k++) { q.beginPath(); q.moveTo(lx + (k * lw) / 4, 40); q.lineTo(lx + (k * lw) / 4, H + 80); q.stroke(); }
      for (let k = 0; k <= 16; k++) { q.beginPath(); q.moveTo(lx, 40 + k * 48); q.lineTo(lx + lw, 40 + k * 48); q.stroke(); }
      // 窗柱
      const px = side < 0 ? w - pw : x0;
      q.fillStyle = '#1a0e0a'; q.fillRect(px, 0, pw, H + 140);
      q.fillStyle = 'rgba(255,170,100,0.4)'; q.fillRect(side < 0 ? px + pw - 6 : px, 0, 6, H + 140);
    });
  }
  function va3Sash() {
    return softCache('g02_va3_sash3', W + 80, 150, 0.25, 10, (q) => {
      q.translate(40, 0);
      q.fillStyle = 'rgba(240,160,80,0.5)'; poly(q, [[150, 0], [1170, 0], [1170, 92], [150, 122]]); q.fill();
      q.strokeStyle = '#2a140c'; q.lineWidth = 7;
      for (let k = 0; k <= 16; k++) { const x = 150 + k * 63.75; q.beginPath(); q.moveTo(x, 0); q.lineTo(x, lerp(122, 92, (x - 150) / 1020)); q.stroke(); }
      for (let k = 0; k < 3; k++) { q.beginPath(); q.moveTo(150, 30 + k * 34); q.lineTo(1170, 22 + k * 28); q.stroke(); }
      q.lineWidth = 12; q.beginPath(); q.moveTo(150, 122); q.lineTo(1170, 92); q.stroke();
      q.fillStyle = '#1a0e0a'; q.fillRect(-40, 0, W + 80, 14);
    });
  }
  // 窗台：一块深一点的木台面（木纹、窗格斜斜投下的一格格暖光），台上一只空酒碗、旁边一圈干了的酒渍
  const BOWL3 = [470, 624, 1.9];
  function va3Sill() {
    return cache('g02_va3_sill3', W + 80, 200, 1, (q) => {
      q.translate(40, -590);
      const top = [[150, 600], [1170, 600], [1230, 654], [90, 654]];
      q.fillStyle = K.lin(q, 0, 600, 0, 654, [[0, '#7a4a2c'], [1, '#4a2a1a']]); poly(q, top); q.fill();
      q.save(); poly(q, top); q.clip();
      // 木纹：顺着台面，略有起伏
      const r = A.rng(83);
      for (let k = 0; k < 22; k++) {
        const y0 = 601 + r() * 52, ph = r() * 6, amp = 0.6 + r() * 1.4;
        q.strokeStyle = rgba(r() < 0.6 ? '#2a140a' : '#a0683e', 0.12 + r() * 0.12); q.lineWidth = 0.6 + r() * 0.9;
        q.beginPath(); for (let x = 80; x <= 1240; x += 20) { const y = y0 + Math.sin(x * 0.012 + ph) * amp + Math.sin(x * 0.05 + ph * 2) * 0.5; x === 80 ? q.moveTo(x, y) : q.lineTo(x, y); } q.stroke();
      }
      // 窗格的光影：一格一格斜着往屋里（往镜头这边、偏左）落
      q.globalCompositeOperation = 'lighter';
      for (let col = 0; col < 15; col++) {
        const xb = 230 + col * 62;
        for (let row = 0; row < 2; row++) {
          const ya = 602 + row * 26, yb = ya + 22, sh = (y) => (y - 600) * -0.75;
          const fall = Math.exp(-Math.pow((xb - 760) / 420, 2));
          q.fillStyle = rgba('#ffc070', 0.34 * fall);
          poly(q, [[xb + sh(ya), ya], [xb + 50 + sh(ya), ya], [xb + 50 + sh(yb), yb], [xb + sh(yb), yb]]); q.fill();
        }
      }
      q.globalCompositeOperation = 'source-over';
      q.restore();
      q.fillStyle = 'rgba(255,200,130,0.5)'; q.fillRect(150, 599, 1020, 2);
      // 台面前沿与下面的墙板
      q.fillStyle = '#2e1a10'; poly(q, [[88, 654], [1232, 654], [1232, 664], [88, 664]]); q.fill();
      q.fillStyle = 'rgba(255,190,120,0.14)'; q.fillRect(90, 654, 1140, 1.5);
      q.fillStyle = K.lin(q, 0, 664, 0, 790, [[0, '#24140e'], [1, '#0e0705']]); q.fillRect(-40, 664, W + 80, 130);
      // 干了的一圈酒渍
      q.strokeStyle = 'rgba(110,40,28,0.4)'; q.lineWidth = 2.2; q.beginPath(); q.ellipse(668, 640, 30, 6, -0.05, 0.3, TAU - 0.4); q.stroke();
      q.strokeStyle = 'rgba(110,40,28,0.18)'; q.lineWidth = 1; q.beginPath(); q.ellipse(672, 641, 22, 4, -0.05, 0, TAU); q.stroke();
      // 空酒碗：粗陶，碗口一线夕照（朝太阳那边亮），影子拖向屋里偏左；碗底还剩一圈干了的酒痕
      const [bx, by, s] = BOWL3;
      q.save(); q.translate(bx, by); q.scale(s, s);
      q.fillStyle = 'rgba(20,10,6,0.45)'; poly(q, [[-44, 2], [40, 2], [-12, 14], [-96, 14]]); q.fill();
      q.fillStyle = K.lin(q, -54, 0, 54, 0, [[0, '#24160e'], [0.5, '#4a2e1e'], [0.82, '#8a5a32'], [0.93, '#c08a50'], [1, '#3a2418']]);
      q.beginPath(); q.moveTo(-54, -34); q.quadraticCurveTo(-48, -2, -18, 2); q.lineTo(18, 2); q.quadraticCurveTo(48, -2, 54, -34); q.closePath(); q.fill();
      // 釉面的几道垂流
      for (let k = 0; k < 7; k++) { const x = -40 + k * 13; q.strokeStyle = 'rgba(30,16,8,0.25)'; q.lineWidth = 1; q.beginPath(); q.moveTo(x, -33); q.quadraticCurveTo(x * 0.92, -18, x * 0.5, -4); q.stroke(); }
      q.fillStyle = '#26160e'; q.fillRect(-18, 0, 36, 5);
      q.fillStyle = '#1a0e08'; q.beginPath(); q.ellipse(0, -34, 54, 9, 0, 0, TAU); q.fill();
      q.fillStyle = 'rgba(60,30,16,0.8)'; q.beginPath(); q.ellipse(0, -32, 44, 6.5, 0, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(150,70,36,0.55)'; q.lineWidth = 1; q.beginPath(); q.ellipse(0, -31, 28, 4, 0, 0, TAU); q.stroke();
      q.strokeStyle = 'rgba(255,214,150,0.95)'; q.lineWidth = 1.6; q.beginPath(); q.ellipse(0, -34, 54, 9, 0, PI * 1.05, PI * 1.98); q.stroke();
      q.strokeStyle = 'rgba(255,190,120,0.4)'; q.lineWidth = 1; q.beginPath(); q.ellipse(0, -34, 51, 7.5, 0, 0.1, PI - 0.1); q.stroke();
      q.fillStyle = 'rgba(255,214,150,0.4)'; q.beginPath(); q.ellipse(40, -17, 4, 12, 0.35, 0, TAU); q.fill();
      q.restore();
    });
  }
  // 行人剪影（延时虚影用）：几种人、两种步相
  function ghostTex(v, ph) {
    return cache('g02_va3_gh' + v + ph, 90, 130, 1, (q) => {
      F.draw(q, 'villager', 45, 124, 0.62, ph * 0.6 + v, { variant: v, pose: 'walk', facing: 1, tone: 'silhouette', ink: '#2a1612', wind: 0.3, seed: v });
    });
  }
  // 拖影：同一个剪影往后密密叠四十层（3 像素一层）、越往后越淡——延时摄影里行人拉成的一道柔虚影
  function trailTex(v) {
    return cache('g02_va3_tr2' + v, 210, 130, 0.5, (q) => {
      const img = ghostTex(v, 0);
      for (let k = 0; k < 40; k++) { q.globalAlpha = 0.11 * Math.pow((k + 1) / 40, 1.6); q.drawImage(img, k * 3, 0, 90, 130); }
    });
  }
  // 檐角卷起的钩（与贴图里同一条线）：逆光里描一道清楚的暖边
  function curlRim(g, a) {
    g.strokeStyle = rgba('#ffd28a', a); g.lineWidth = 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(862, 308); g.quadraticCurveTo(836, 300, 818, 276); g.quadraticCurveTo(804, 256, 808, 240); g.quadraticCurveTo(812, 230, 822, 234); g.stroke();
  }
  // 三排行人：远、中、近（越近越大、越快、越实）
  const ROWS3 = [{ y: 548, s: 0.42, n: 9, sp: 70, a: 0.42 }, { y: 573, s: 0.56, n: 8, sp: 110, a: 0.5 }, { y: 600, s: 0.74, n: 6, sp: 160, a: 0.6 }];

  XYT.registerShot('va3_eave', {
    name: '落日赖檐', zone: 'left', night: false, text: '#fbeedd', shadow: 'rgba(40,16,8,0.9)', accent: '#f2be45', bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tLai = charAt(c, 2, 1.03);
      // 镜头从窗内慢慢升起：窗台、窗框往下退，街景露得更多；远景几乎不动
      const rise = easeInOut(clamp((lt + 0.3) / (c.dur + 0.3)));
      const dy = (k) => lerp(-10, 40, rise) * k;
      // 延时：每拍一阵（拍头快、拍尾慢）；vel 为此刻的快慢
      const sx = surge(c, 6), f = c.b ? c.b.ph : 0, vel = 6 * Math.exp(-6 * f) / (1 - Math.exp(-6));
      const pulse = c.be ? c.be(0.45) : 0;
      const [sxn, syn, sr] = SUN3;

      g.save(); g.translate(0, dy(0.12));
      g.imageSmoothingEnabled = false;
      g.drawImage(va3Far(), -40, -20, W + 80, 780);
      g.imageSmoothingEnabled = true;
      // 远处沿街的灯，一盏盏忽明忽灭（几个钟头在几拍里过去）
      add(g, () => {
        for (let i = 0; i < 34; i++) {
          const on = h2(i * 7 + Math.floor(sx * 1.5 + h2(i, 27) * 3), 28);
          if (on < 0.45) continue;
          glow(g, -20 + h2(i, 25) * 900, 470 + h2(i, 26) * 50 - 20, 5 + 4 * h2(i, 29), '#ffc060', 0.5 * (on - 0.45) / 0.55 + 0.15);
        }
      });
      // 云影：几条又长又暗的云带，每拍呼地掠过天空，后面拖着长长的虚尾
      for (let i = 0; i < 4; i++) {
        const y = [150, 182, 328, 372][i], hh = [52, 34, 60, 46][i], len = [560, 400, 680, 480][i], spd = 300 + 200 * h2(i, 36);
        const x = ((h2(i, 37) * 2600 + sx * spd) % 2600) - 700, a = (0.35 + 0.2 * h2(i, 38));
        for (let k = 0; k < 6; k++) E.util.streak(g, x - k * (50 + vel * 46), y + k * 1.2, (len / 2) * (1 + vel * 0.12) * (1 - k * 0.06), hh / 2 * (1 - k * 0.08), k ? '#7a4050' : '#6a3848', a * (k ? 0.5 * (1 - k / 6) : 1));
      }
      // 细云：更快、更淡的一层
      for (let i = 0; i < 7; i++) {
        const y = [120, 206, 300, 350, 400, 140, 270][i], len = 200 + h2(i, 31) * 240;
        const x = ((h2(i, 32) * 1900 + sx * (220 + 140 * h2(i, 33))) % 1900) - 300;
        if (Math.abs(y - syn) < 60 && Math.abs(x - sxn) < 260) continue;
        for (let k = 0; k < 3; k++) E.util.streak(g, x - k * (30 + vel * 30), y, len * (0.6 + vel * 0.1), 4 + h2(i, 34) * 6, '#a8565a', (0.4 - k * 0.12) * (0.7 + 0.3 * h2(i, 35)));
      }
      g.restore();

      // 落日：一动不动；光晕每拍呼吸一次
      g.save(); g.translate(0, dy(0.2));
      add(g, () => glow(g, sxn, syn, 210 * (1 + 0.1 * pulse), '#ff9a40', 0.32 + 0.16 * pulse));
      E.sun(g, { x: sxn, y: syn, r: sr, color: '#ff9a3a', glow: 0.55 + 0.25 * pulse, spread: 3.6, haze: '#ffa050' });
      add(g, () => glow(g, sxn, syn, sr * 1.25, '#fff0c0', 0.42 + 0.16 * pulse));
      // 归鸟：每拍一群倏地掠过天空
      {
        g.strokeStyle = 'rgba(52,22,26,0.75)'; g.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const x = ((h2(i, 45) * 1900 + sx * (380 + 160 * h2(i, 46))) % 1900) - 300, y = 140 + h2(i, 47) * 110 + Math.sin(sx * 2 + i) * 8;
          const s2 = 3.5 + 2.5 * h2(i, 48), fl = Math.sin(t * 14 + i * 2) * 0.5;
          E.util.streak(g, x - 20 - vel * 10, y, 22 + vel * 14, 2, '#5a2a30', 0.25);
          g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - s2 * 1.6, y - s2 * (0.5 + fl)); g.quadraticCurveTo(x - s2 * 0.6, y - s2 * 0.4, x, y); g.quadraticCurveTo(x + s2 * 0.6, y - s2 * 0.4, x + s2 * 1.6, y - s2 * (0.5 + fl)); g.stroke();
        }
      }
      // 炊烟：远处屋顶升起，被延时拉成横缕；“赖”字上一缕从日轮前抹过
      {
        const q = clamp((lt - tLai + 0.42) / 0.84);
        if (q > 0 && q < 1) {
          const x = lerp(sxn - 320, sxn + 300, q), a = Math.sin(q * PI);
          for (let k = 0; k < 9; k++) E.util.streak(g, x - k * 30, syn + 6 + Math.sin(k * 1.3 + q * 4) * 6 + k * 1.5, 64 + k * 8, 11 - k * 0.7, '#6e4646', 0.6 * a * (1 - k / 10));
        }
        for (let i = 0; i < 4; i++) {
          const cx = 120 + i * 190, cy = 470 - i * 6;
          for (let k = 0; k < 6; k++) {
            const u = ((k / 6 + sx * 0.35 + h2(i, 41)) % 1);
            E.util.streak(g, cx + u * 260 + vel * 10 * u, cy - u * 80, 24 + u * 80 + vel * 14, 5 + u * 7, '#9a6464', 0.42 * Math.sin(u * PI));
          }
        }
      }
      g.drawImage(va3Eave(), 780, 170, 560, 520);
      curlRim(g, 0.9);
      // 对街的窗：灯火按延时忽明忽暗
      add(g, () => {
        const wins = [[920, 372, 110, 82], [1080, 372, 120, 82], [1250, 372, 90, 82], [930, 530, 150, 120], [1130, 530, 160, 120]];
        wins.forEach(([x, y, w2, h], i) => {
          const b = clamp(0.25 + 0.9 * noise1(sx * 1.6 + i * 3.7, 9) + 0.12 * Math.sin(t * 31 + i));
          g.fillStyle = rgba('#ffa850', 0.55 * b); g.fillRect(x, y, w2, h);
          glow(g, x + w2 / 2, y + h / 2, w2 * 0.9, '#ff9840', 0.18 * b);
        });
      });
      // 对街楼上的灯笼（暖亮，忽明忽暗）
      E.lantern(g, { x: 1040, y: 332, s: 1.15, t, color: '#d0362a', lit: 0.45 + 0.55 * noise1(sx * 2.1, 3), swing: 0.04, seed: 2, glowColor: '#ff9040' });
      E.lantern(g, { x: 1210, y: 334, s: 1.0, t, color: '#d0362a', lit: 0.45 + 0.55 * noise1(sx * 2.1 + 5, 3), swing: 0.05, seed: 5, glowColor: '#ff9040' });
      g.restore();

      // 街：三排行人的延时虚影，每拍一阵掠过；云影从街面和楼面扫过；石板上夕阳的反光闪动
      g.save(); g.translate(0, dy(0.45));
      add(g, () => {
        for (let i = 0; i < 14; i++) {
          const y = 534 + i * i * 0.9, x = sxn + (h2(i, 58) - 0.5) * (14 + i * 4), fl = 0.5 + 0.5 * Math.sin(t * 9 + i * 2.3);
          g.fillStyle = rgba('#ffe0a0', 0.35 * fl); g.fillRect(x - (6 + i * 1.5) / 2, y, 6 + i * 1.5, 1.2 + i * 0.12);
        }
      });
      ROWS3.forEach((R, r) => {
        for (let i = 0; i < R.n; i++) {
          const sd = r * 20 + i, dir = (i + r) % 2 ? -1 : 1, s = R.s * (0.9 + 0.2 * h2(sd, 52)), span = 1720;
          const x = ((((h2(sd, 53) * span + dir * sx * R.sp * (0.7 + 0.6 * h2(sd, 54))) % span) + span) % span) - 220;
          const img = ghostTex(sd % 4, Math.floor(sx * 2 + i) % 2), tr = trailTex(sd % 4);
          const L = (50 + vel * 40) * (0.6 + 0.6 * h2(sd, 55)) * s * (1 + r * 0.3), w = 90 * s, h = 130 * s, a = R.a * (0.7 + 0.3 * h2(sd, 56));
          g.save(); g.translate(x, R.y + h2(sd, 57) * 6); g.scale(dir, 1);
          g.globalAlpha = a; g.drawImage(tr, -w / 2 - L, -h + 6 * s, w + L, h);
          g.globalAlpha = a * 0.75; g.drawImage(img, -w / 2, -h + 6 * s, w, h);
          g.restore();
        }
      });
      g.globalAlpha = 1;
      // 云影：大块的暗，自左向右扫过街面与楼面
      for (let k = 0; k < 2; k++) {
        const x = ((sx * 520 + k * 1100) % 2200) - 500;
        g.fillStyle = K.lin(g, x - 240, 0, x + 240, 0, [[0, 'rgba(60,22,20,0)'], [0.5, 'rgba(60,22,20,0.35)'], [1, 'rgba(60,22,20,0)']]);
        g.fillRect(x - 240, 300, 480, 420);
      }
      g.restore();

      // 窗：窗台（空酒碗、窗格光影），两侧虚化的窗柱与撑起的支摘窗
      g.save(); g.translate(0, lerp(-10, 22, rise) * 1.2);
      g.drawImage(va3Sill(), -40, 590, W + 80, 200);
      add(g, () => { glow(g, BOWL3[0] + 30, BOWL3[1] - 40, 130, '#ffc070', 0.2 + 0.1 * pulse); glow(g, 760, 626, 300, '#ffb060', 0.12 + 0.06 * pulse); });
      g.restore();
      g.save(); g.translate(0, dy(0.9));
      g.drawImage(va3Post(-1), -60, -70, 230, H + 140);
      g.drawImage(va3Post(1), 1120, -70, 190, H + 140);
      g.drawImage(va3Sash(), -40, -20, W + 80, 150);
      g.restore();
      // 暖光里浮着几粒光尘
      add(g, () => {
        for (let i = 0; i < 26; i++) {
          const x = 200 + h2(i, 61) * 950 + Math.sin(t * 0.4 + i) * 20, y = 120 + h2(i, 62) * 480 + Math.cos(t * 0.3 + i * 2) * 16 - (t * 6) % 40;
          glow(g, x, y, 2 + h2(i, 63) * 3, '#ffe0a0', 0.25 + 0.25 * Math.sin(t * 1.5 + i));
        }
      });
      // 下一镜的贴图提前建好
      pretouch(c, [touchHills(HILLS4[0]), va4Far, va4Wall, va4Ground, () => { va4Kitchen(); va4KitIn(); va4KitFront(); }, va4Old, va4Aunt, memWash, () => boyFaceTex('A'), () => boyFaceTex('B'), () => boyFaceTex('C')]);
    },
  });

  // ======================================================================
  // 4 日挂墙头：客栈后院马头墙，黄昏。镜头从高处降下来，墙在“墙”字上正好升到落日底下，把它托住——日挂墙头；
  //   墙头坐着少年店小二的回忆虚影晃着脚，墙下婶婶在“头”字上举汤勺喊他吃饭，院角白发的他仰头看；
  //   “舍”字上左边天空浮出一方回忆：少年回头一笑（工笔眉眼）；“我”字之后虚影淡去，只剩狗尾草在摇
  // ======================================================================
  // 墙顶分段（镜头落定时的位置）：[x0, x1, 顶 y]；托住太阳的那一段居中在 x≈800
  const WALL4 = [[-60, 600, 300], [600, 960, 262], [960, 1100, 222], [1100, 1340, 300]];
  const WALL_FOOT = 652;
  // 太阳：接上一镜的画面位置（引擎的推拉换算过），整镜不动
  const SUN4 = [824, 245, 50];

  const HILLS4 = [{ kind: 'far', color: '#b88290', light: '#f8c890', litA: 0.4, y: 330, scaleY: 0.28, speed: 0, seed: 21, fog: '#f2b884', fogA: 0.5, soft: true }];
  // 墙外远景：天、远山、墙后客栈正屋的大屋顶；右上角伸进来几枝老樟树（只在 x>1180）
  function va4Far() {
    return cache('g02_va4_far2', W + 80, 560, 1, (q) => {
      q.translate(40, 0);
      q.fillStyle = K.lin(q, 0, 0, 0, 420, [[0, '#6a5a82'], [0.35, '#b8809a'], [0.7, '#f0a86c'], [1, '#fad48c']]); q.fillRect(-40, 0, W + 80, 560);
      for (let i = 0; i < 10; i++) E.util.streak(q, 60 + i * 130, 120 + Math.sin(i * 1.7) * 40, 150, 10, i % 2 ? '#e8a8a0' : '#d89098', 0.22);
      E.mountains(q, { t: 0, lightDir: 1, layers: HILLS4 });
      // 墙外远处的屋脊（镜头还高时，墙矮下去，露出这一片）
      roofline(q, 372, 0.5, '#b07888', 'rgba(255,205,150,0.5)', 31, 480, 1360);
      roofline(q, 410, 0.72, '#8e5c6c', 'rgba(255,190,130,0.5)', 33, 440, 1360);
      q.fillStyle = K.lin(q, 0, 408, 0, 560, [[0, '#7e5062'], [1, '#5a3a4a']]); q.fillRect(440, 408, 920, 160);
      for (let i = 0; i < 14; i++) { q.fillStyle = rgba('#ffc070', 0.35 + 0.3 * h2(i, 5)); q.fillRect(470 + h2(i, 6) * 860, 420 + h2(i, 7) * 90, 5, 4); }
      // 墙后的正屋：歇山大屋顶，逆光剪影，脊上亮边
      q.fillStyle = '#4e3842';
      q.beginPath(); q.moveTo(-40, 330); q.lineTo(-40, 190); q.quadraticCurveTo(80, 178, 120, 150); q.lineTo(380, 150); q.quadraticCurveTo(430, 182, 520, 186); q.quadraticCurveTo(540, 178, 548, 168); q.quadraticCurveTo(552, 186, 536, 200); q.lineTo(500, 330); q.closePath(); q.fill();
      q.fillRect(110, 138, 280, 14);
      // 屋身：平时藏在院墙后面
      q.fillStyle = K.lin(q, 0, 326, 0, 560, [[0, '#3e2c36'], [1, '#2e2028']]); q.fillRect(-40, 326, 548, 240);
      q.fillStyle = 'rgba(255,180,110,0.4)'; q.fillRect(140, 380, 70, 50); q.fillRect(330, 380, 60, 50);
      q.strokeStyle = '#2a1c22'; q.lineWidth = 3; for (const wx of [140, 330]) for (let k = 1; k < 4; k++) { q.beginPath(); q.moveTo(wx + k * 17, 380); q.lineTo(wx + k * 17, 430); q.stroke(); }
      q.beginPath(); q.moveTo(112, 138); q.quadraticCurveTo(100, 120, 92, 118); q.quadraticCurveTo(108, 112, 124, 138); q.fill();
      q.beginPath(); q.moveTo(388, 138); q.quadraticCurveTo(400, 120, 408, 118); q.quadraticCurveTo(392, 112, 376, 138); q.fill();
      q.strokeStyle = 'rgba(255,200,130,0.6)'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(110, 138); q.lineTo(390, 138); q.quadraticCurveTo(430, 176, 520, 184); q.stroke();
      q.fillStyle = 'rgba(255,190,110,0.45)'; q.fillRect(260, 230, 60, 40);
      // 樟树枝：从右上角斜伸进来，渐细；一簇簇椭圆的小叶，叶缘透一点夕照（都在 x>1190，不碰歌词）
      const r = A.rng(17);
      const leaf = (x, y, a, L) => {
        q.save(); q.translate(x, y); q.rotate(a);
        q.fillStyle = rgba(r() < 0.35 ? '#4a3444' : '#30222e', 0.92); q.beginPath(); q.moveTo(0, 0); q.quadraticCurveTo(L * 0.5, -L * 0.28, L, 0); q.quadraticCurveTo(L * 0.5, L * 0.28, 0, 0); q.fill();
        q.strokeStyle = 'rgba(255,190,130,0.35)'; q.lineWidth = 0.8; q.beginPath(); q.moveTo(L * 0.1, -L * 0.1); q.quadraticCurveTo(L * 0.5, -L * 0.3, L, 0); q.stroke();
        q.restore();
      };
      const branch = (x0, y0, x1, y1, w0, d) => {
        const cx = (x0 + x1) / 2 + (r() - 0.5) * 20, cy = (y0 + y1) / 2 + 10;
        const P = new Path2D(); taper(P, x0, y0, cx, cy, x1, y1, w0, Math.max(1, w0 * 0.35), 10); q.fillStyle = '#2a1e28'; q.fill(P);
        if (d > 0) for (let k = 0; k < 2; k++) { const u = 0.5 + k * 0.28, bx = lerp(x0, x1, u), by = lerp(y0, y1, u); branch(bx, by, Math.max(1196, bx - 24 - r() * 30), by + 18 + r() * 36, w0 * 0.5, d - 1); }
        for (let k = 0; k < (d ? 3 : 7); k++) {
          const u = d ? 0.6 + 0.4 * r() : 0.4 + 0.6 * r(), lx = lerp(x0, x1, u), ly = lerp(y0, y1, u);
          leaf(lx, ly, PI * 0.5 + (r() - 0.5) * 2.2, 11 + r() * 7);
        }
      };
      branch(1340, -20, 1206, 92, 14, 2);
      branch(1340, 52, 1222, 132, 8, 1);
    });
  }
  // 墙：太阳在墙后，朝这边的墙面整个在阴影里、偏冷；只有一级级压顶的瓦口上一线暖光。梯子靠墙；水缸
  function va4Wall() {
    return cache('g02_va4_wall2', W + 120, 520, 1, (q) => {
      q.translate(60, -200);
      const r = A.rng(5);
      const outline = () => { q.beginPath(); q.moveTo(-60, 740); for (const [a, b, y] of WALL4) { q.lineTo(a, y); q.lineTo(b, y); } q.lineTo(1340, 740); q.closePath(); };
      outline();
      q.fillStyle = K.lin(q, 0, 220, 0, 740, [[0, '#6e6a80'], [0.45, '#8a8494'], [0.8, '#77707a'], [1, '#55505c']]); q.fill();
      q.save(); outline(); q.clip();
      // 右边离太阳远，更暗一些
      q.fillStyle = K.lin(q, 960, 0, 1340, 0, [[0, 'rgba(36,32,52,0)'], [1, 'rgba(36,32,52,0.34)']]); q.fillRect(960, 200, 380, 540);
      // 墙头底下一溜被天光反照的暖（离墙脊越近越暖）
      q.fillStyle = K.lin(q, 0, 222, 0, 330, [[0, 'rgba(255,170,130,0.16)'], [1, 'rgba(255,170,130,0)']]); q.fillRect(-60, 220, 1400, 110);
      // 斑驳、雨痕、补过的白灰
      for (let k = 0; k < 40; k++) { q.fillStyle = rgba(r() < 0.6 ? '#4e4a5e' : '#b8b4c4', 0.06 + r() * 0.07); A.inkBlob(q, r() * 1340, 260 + r() * 360, 10 + r() * 50, k, 0.5); q.fill(); }
      for (let k = 0; k < 36; k++) {
        const x = r() * 1340, y = wallTopAt(x) + 10, len = 60 + r() * 220, w = 2 + r() * 8;
        q.fillStyle = K.lin(q, 0, y, 0, y + len, [[0, 'rgba(50,44,64,0.3)'], [1, 'rgba(50,44,64,0)']]); q.fillRect(x, y, w, len);
      }
      // 墙脚：青石条与青苔
      q.fillStyle = K.lin(q, 0, 604, 0, 660, [[0, '#57525a'], [1, '#3a363e']]); q.fillRect(-60, 604, 1400, 60);
      q.strokeStyle = 'rgba(20,18,26,0.5)'; q.lineWidth = 1;
      q.beginPath(); q.moveTo(-60, 630); q.lineTo(1340, 630); q.stroke();
      for (let x = -40, k = 0; x < 1340; x += 70 + r() * 30, k++) { q.beginPath(); q.moveTo(x, k % 2 ? 604 : 630); q.lineTo(x, k % 2 ? 630 : 656); q.stroke(); }
      q.fillStyle = K.lin(q, 0, 560, 0, 606, [[0, 'rgba(70,90,70,0)'], [1, 'rgba(70,90,70,0.32)']]); q.fillRect(-60, 560, 1400, 46);
      // 漏窗：墙上一方花窗，透出墙外的晚霞
      q.fillStyle = '#f0b07a'; q.fillRect(780, 380, 90, 90);
      q.save(); q.beginPath(); q.rect(780, 380, 90, 90); q.clip();
      q.strokeStyle = '#4e4856'; q.lineWidth = 4;
      for (let k = -3; k <= 3; k++) { q.beginPath(); q.moveTo(780 + 45 + k * 22 - 45, 380); q.lineTo(780 + 45 + k * 22 + 45, 470); q.stroke(); q.beginPath(); q.moveTo(780 + 45 + k * 22 + 45, 380); q.lineTo(780 + 45 + k * 22 - 45, 470); q.stroke(); }
      q.restore();
      q.lineWidth = 7; q.strokeStyle = '#6a6474'; q.strokeRect(776, 376, 98, 98);
      q.restore();
      // 马头墙压顶：每段一道黛瓦，外端起翘；瓦口一线夕照
      for (let i = 0; i < WALL4.length; i++) {
        const [a, b, y] = WALL4[i], up = (j) => j >= 0 && j < WALL4.length && WALL4[j][2] < y;
        const L = !up(i - 1) && i > 0, R = !up(i + 1) && i < WALL4.length - 1;
        q.fillStyle = 'rgba(30,24,36,0.4)'; q.fillRect(a, y + 2, b - a, 7);
        q.fillStyle = '#2a2630';
        q.beginPath(); q.moveTo(a - 8, y + 2); q.lineTo(b + 8, y + 2);
        if (R) { q.quadraticCurveTo(b + 16, y - 2, b + 20, y - 14); q.lineTo(b + 16, y - 15); q.quadraticCurveTo(b + 10, y - 9, b + 2, y - 9); } else q.lineTo(b + 8, y - 8);
        q.lineTo(a - 2, y - 9);
        if (L) { q.quadraticCurveTo(a - 10, y - 9, a - 16, y - 15); q.lineTo(a - 20, y - 14); q.quadraticCurveTo(a - 16, y - 2, a - 8, y + 2); } else q.lineTo(a - 8, y - 8);
        q.closePath(); q.fill();
        q.fillStyle = '#1c1820'; for (let x = a - 4; x < b + 6; x += 6) { q.beginPath(); q.arc(x, y + 3, 2.4, 0, PI); q.fill(); }
        q.fillStyle = 'rgba(255,196,130,0.85)'; q.fillRect(a - 4, y - 10, b - a + 8, 1.6);
        q.fillStyle = 'rgba(255,170,120,0.3)'; q.fillRect(a - 4, y - 8.4, b - a + 8, 1.2);
        // 相邻高段的山墙侧面
        if (i > 0 && WALL4[i - 1][2] > y) { q.fillStyle = 'rgba(70,62,84,0.6)'; q.fillRect(a - 2, y, 6, WALL4[i - 1][2] - y); }
        if (i < WALL4.length - 1 && WALL4[i + 1][2] > y) { q.fillStyle = 'rgba(70,62,84,0.6)'; q.fillRect(b - 4, y, 6, WALL4[i + 1][2] - y); }
      }
      // 靠墙的竹梯（他小时候就是从这儿爬上去的）
      q.strokeStyle = '#4a3a36'; q.lineWidth = 5; q.lineCap = 'round';
      q.beginPath(); q.moveTo(612, 660); q.lineTo(578, 292); q.moveTo(652, 660); q.lineTo(618, 292); q.stroke();
      q.lineWidth = 3.5; for (let k = 1; k < 10; k++) { const u = k / 10; q.beginPath(); q.moveTo(lerp(612, 578, u), lerp(660, 292, u)); q.lineTo(lerp(652, 618, u), lerp(660, 292, u)); q.stroke(); }
      q.strokeStyle = 'rgba(200,190,230,0.25)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(619, 294); q.lineTo(653, 658); q.stroke();
      // 水缸
      q.fillStyle = K.lin(q, 700, 0, 800, 0, [[0, '#2e2a32'], [0.6, '#4a4450'], [1, '#24202a']]);
      q.beginPath(); q.moveTo(704, 600); q.quadraticCurveTo(696, 650, 718, 668); q.lineTo(786, 668); q.quadraticCurveTo(808, 650, 800, 600); q.closePath(); q.fill();
      q.fillStyle = '#24202a'; q.beginPath(); q.ellipse(752, 600, 48, 9, 0, 0, TAU); q.fill();
      q.fillStyle = 'rgba(240,180,140,0.45)'; q.beginPath(); q.ellipse(752, 601, 42, 6, 0, 0, TAU); q.fill();
    });
  }
  const wallTopAt = (x) => { for (const [a, b, y] of WALL4) if (x >= a && x < b) return y; return 300; };
  // 院子地面：青石板在墙影里，偏冷；近处略暗
  function va4Ground() {
    return cache('g02_va4_ground2', W + 120, 200, 1, (q) => {
      q.translate(60, -640);
      q.fillStyle = K.lin(q, 0, 640, 0, 840, [[0, '#605a6a'], [0.4, '#4a4454'], [1, '#2a2632']]); q.fillRect(-60, 640, 1400, 200);
      q.strokeStyle = 'rgba(20,16,26,0.45)'; q.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) { const y = 650 + k * k * 5; q.beginPath(); q.moveTo(-60, y); q.lineTo(1340, y); q.stroke(); }
      for (let k = -14; k <= 14; k++) { q.beginPath(); q.moveTo(640 + k * 90, 650); q.lineTo(640 + k * 190, 840); q.stroke(); }
      q.fillStyle = 'rgba(200,190,230,0.08)'; q.fillRect(-60, 650, 1400, 3);
    });
  }
  // 灶房（左边的侧屋）：瓦檐、小窗、门框（门洞挖空）；门里分两层：后墙（火光逐帧打在上面）与灶台、大锅、蓝布门帘
  const KDOOR = [118, 470, 230, 668];
  function va4Kitchen() {
    return cache('g02_va4_kit4', 300, 560, 1, (q) => {
      q.translate(40, -180);
      const [dx0, dy0, dx1, dy1] = KDOOR;
      q.fillStyle = K.lin(q, -40, 0, 260, 0, [[0, '#3a3034'], [1, '#544650']]); q.fillRect(-40, 300, 300, 380);
      for (let k = 0; k < 12; k++) { q.fillStyle = rgba('#1e181e', 0.1); A.inkBlob(q, (k * 37) % 240 - 20, 340 + ((k * 71) % 300), 20, k, 0.5); q.fill(); }
      // 瓦檐
      q.fillStyle = '#26222a'; poly(q, [[-40, 300], [222, 300], [248, 288], [258, 270], [244, 276], [220, 284], [-40, 268]]); q.fill();
      q.strokeStyle = 'rgba(255,190,120,0.55)'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(-40, 268); q.lineTo(220, 284); q.lineTo(244, 276); q.stroke();
      q.fillStyle = '#1a161c'; for (let x = -36; x < 226; x += 7) { q.beginPath(); q.arc(x, 301, 2.6, 0, PI); q.fill(); }
      // 小窗（窗纸底色；火光逐帧加）
      q.fillStyle = '#7a4a30'; q.fillRect(30, 350, 70, 46);
      q.strokeStyle = '#221816'; q.lineWidth = 3; for (let k = 1; k < 5; k++) { q.beginPath(); q.moveTo(30 + k * 14, 350); q.lineTo(30 + k * 14, 396); q.stroke(); }
      q.lineWidth = 5; q.strokeRect(30, 350, 70, 46);
      q.globalCompositeOperation = 'destination-out'; q.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0); q.globalCompositeOperation = 'source-over';
      // 门框、门槛与门前一方石阶
      q.fillStyle = '#1a1214'; q.fillRect(dx0 - 10, dy0 - 12, dx1 - dx0 + 22, 14); q.fillRect(dx0 - 12, dy0, 12, dy1 - dy0); q.fillRect(dx1, dy0, 12, dy1 - dy0);
      q.fillStyle = 'rgba(255,190,120,0.35)'; q.fillRect(dx0 - 1.5, dy0, 1.5, dy1 - dy0); q.fillRect(dx1, dy0, 1.5, dy1 - dy0);
      q.fillStyle = '#4a4248'; q.fillRect(dx0 - 22, dy1 - 2, dx1 - dx0 + 44, 14); q.fillStyle = 'rgba(255,190,120,0.3)'; q.fillRect(dx0 - 22, dy1 - 2, dx1 - dx0 + 44, 2);
    });
  }
  function va4KitIn() {
    return cache('g02_va4_kin', 112, 198, 1, (q) => {
      const [dx0, dy0] = KDOOR;
      q.translate(-dx0, -dy0);
      // 屋里：后墙、挂着的勺子和蒜辫，火光从下往上映暖
      q.fillStyle = K.lin(q, 0, dy0, 0, 668, [[0, '#3a1c12'], [0.55, '#6a3218'], [1, '#4a2210']]); q.fillRect(dx0, dy0, 112, 198);
      q.strokeStyle = 'rgba(30,14,8,0.6)'; q.lineWidth = 1.5;
      for (const [x, L] of [[200, 34], [212, 28]]) { q.beginPath(); q.moveTo(x, dy0 + 20); q.lineTo(x, dy0 + 20 + L); q.stroke(); q.beginPath(); q.ellipse(x, dy0 + 24 + L, 4, 3, 0, 0, TAU); q.stroke(); }
      q.fillStyle = 'rgba(220,200,170,0.5)'; for (let k = 0; k < 5; k++) { q.beginPath(); q.ellipse(176, dy0 + 34 + k * 7, 4, 3.4, 0, 0, TAU); q.fill(); }
    });
  }
  function va4KitFront() {
    return cache('g02_va4_kfr', 112, 198, 1, (q) => {
      const [dx0, dy0, dx1, dy1] = KDOOR;
      q.translate(-dx0, -dy0);
      // 灶台（砖砌，灶口黑洞洞的，火光逐帧画）、大锅、木锅盖
      q.fillStyle = '#24130c'; poly(q, [[dx0 + 18, dy1], [dx1, dy1], [dx1, 600], [dx0 + 26, 600]]); q.fill();
      q.strokeStyle = 'rgba(80,40,24,0.6)'; q.lineWidth = 0.8;
      for (let y = 612; y < dy1; y += 12) { q.beginPath(); q.moveTo(dx0 + 24, y); q.lineTo(dx1, y); q.stroke(); }
      q.fillStyle = '#3a2016'; q.fillRect(dx0 + 22, 596, dx1 - dx0 - 22, 7);
      q.fillStyle = 'rgba(255,170,100,0.5)'; q.fillRect(dx0 + 22, 596, dx1 - dx0 - 22, 1.5);
      q.fillStyle = '#0c0504'; q.beginPath(); q.moveTo(176, 662); q.lineTo(176, 632); q.quadraticCurveTo(190, 618, 204, 632); q.lineTo(204, 662); q.closePath(); q.fill();
      q.fillStyle = '#140a06'; q.beginPath(); q.ellipse(184, 594, 40, 8, 0, 0, TAU); q.fill();
      q.beginPath(); q.moveTo(146, 594); q.quadraticCurveTo(184, 562, 222, 594); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(255,190,120,0.55)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(150, 590); q.quadraticCurveTo(184, 562, 218, 590); q.stroke();
      q.fillStyle = '#2a1810'; q.fillRect(180, 566, 8, 6);
      // 门帘：蓝布，左半边垂下来，下摆被掀起搭在门框上
      q.fillStyle = '#34486a';
      q.beginPath(); q.moveTo(dx0, dy0); q.lineTo(dx0 + 62, dy0); q.quadraticCurveTo(dx0 + 54, dy0 + 40, dx0 + 30, dy0 + 74); q.quadraticCurveTo(dx0 + 14, dy0 + 92, dx0, dy0 + 96); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(20,28,44,0.6)'; q.lineWidth = 1.2;
      for (let k = 1; k < 4; k++) { q.beginPath(); q.moveTo(dx0 + k * 15, dy0); q.quadraticCurveTo(dx0 + k * 13, dy0 + 40, dx0 + k * 6, dy0 + 80 - k * 6); q.stroke(); }
      q.strokeStyle = 'rgba(255,190,120,0.45)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(dx0 + 62, dy0); q.quadraticCurveTo(dx0 + 54, dy0 + 40, dx0 + 30, dy0 + 74); q.quadraticCurveTo(dx0 + 14, dy0 + 92, dx0, dy0 + 96); q.stroke();
    });
  }
  // 院角的他：白发旧衫，仰头看墙头；整个在墙影里，深墨剪影、一线冷的天光（静立，烘成一张）
  function va4Old() {
    return cache('g02_va4_old2', 260, 350, 1, (q) => {
      F.draw(q, 'xiaoyao', 130, 330, 1.42, 0.7, { stage: 'old', pose: 'stand', facing: -1, head: -0.32, wind: 0.3, windDir: -1, ink: '#2a2a36', rim: '#b8c4e8', light: [-300, -400], rimWidth: 1.4, tassel: '#3a3442' });
    });
  }
  // 婶婶的身子（不含近侧手臂）与围裙：静立，烘成一张；手臂与汤勺逐帧画
  const AUNT = { variant: 1, pose: 'stand', facing: 1, part: 'back', wind: 0.25, seed: 1, head: -0.17 };
  function va4Aunt() {
    return cache('g02_va4_aunt2', 160, 240, 1, (q) => {
      F.draw(q, 'villager', 60, 226, 1.12, 0.4, AUNT);
      const P = F.points('villager', 60, 226, 1.12, 0.4, AUNT);
      // 围裙：腰间一条带子，一片上窄下宽、略带弧度的布，下摆微翘；背后两根系带
      const wx = P.waist[0], wy = P.waist[1], kx = P.kneeN[0], ky = P.kneeN[1];
      q.fillStyle = '#d8c8ac';
      q.beginPath(); q.moveTo(wx - 4, wy); q.lineTo(wx + 15, wy); q.quadraticCurveTo(kx + 20, (wy + ky) / 2, kx + 21, ky + 10);
      q.quadraticCurveTo(kx + 8, ky + 15, kx - 6, ky + 11); q.quadraticCurveTo(wx - 6, (wy + ky) / 2 + 4, wx - 4, wy); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(130,104,78,0.6)'; q.lineWidth = 0.8;
      q.beginPath(); q.moveTo(wx + 4, wy + 6); q.quadraticCurveTo(kx + 4, (wy + ky) / 2, kx + 2, ky + 9); q.moveTo(wx + 10, wy + 6); q.quadraticCurveTo(kx + 14, (wy + ky) / 2, kx + 14, ky + 10); q.stroke();
      q.strokeStyle = '#8a6a50'; q.lineWidth = 2; q.beginPath(); q.moveTo(wx - 9, wy - 1); q.lineTo(wx + 17, wy - 1); q.stroke();
      q.lineWidth = 1.2; q.beginPath(); q.moveTo(wx - 8, wy); q.quadraticCurveTo(wx - 18, wy + 8, wx - 15, wy + 22); q.moveTo(wx - 8, wy); q.quadraticCurveTo(wx - 13, wy + 10, wx - 9, wy + 24); q.stroke();
    });
  }
  // 婶婶举汤勺的手臂：肩—肘—腕两节，袖子渐粗、袖口宽；手一举高，袖口就往肘弯那边滑下去，露出小臂
  function auntArm(q, sh, raise, wave, s) {
    const ang = lerp(1.38, -0.62, raise) + wave, L1 = 30 * s * 0.9, L2 = 28 * s * 0.9;
    const el = [sh[0] + Math.cos(ang + 0.5 * (1 - raise)) * L1, sh[1] + Math.sin(ang + 0.5 * (1 - raise)) * L1];
    const fa = ang - 0.3 * raise, hd = [el[0] + Math.cos(fa) * L2, el[1] + Math.sin(fa) * L2];
    const cu = lerp(0.82, 0.34, raise), cuff = [lerp(el[0], hd[0], cu), lerp(el[1], hd[1], cu)];
    // 小臂（露出的那截）
    q.strokeStyle = '#e2c0a2'; q.lineCap = 'round'; q.lineWidth = 4.2 * s; q.beginPath(); q.moveTo(cuff[0], cuff[1]); q.lineTo(hd[0], hd[1]); q.stroke();
    q.fillStyle = '#e8c8aa'; q.beginPath(); q.arc(hd[0], hd[1], 3.4 * s, 0, TAU); q.fill();
    // 袖子：肩宽 8、肘 7.5、袖口 11（喇叭口），袖口布垂向下方
    const n1 = ((A2, B2) => { const a = Math.atan2(B2[1] - A2[1], B2[0] - A2[0]); return [-Math.sin(a), Math.cos(a)]; });
    const [ux, uy] = n1(sh, el), [vx, vy] = n1(el, cuff);
    const w0 = 4.4 * s, w1 = 4 * s, w2 = 6 * s, drop = lerp(2, 7, raise) * s;
    q.fillStyle = '#4e3e36';
    q.beginPath();
    q.moveTo(sh[0] + ux * w0, sh[1] + uy * w0); q.lineTo(el[0] + ux * w1, el[1] + uy * w1); q.lineTo(cuff[0] + vx * w2, cuff[1] + vy * w2);
    q.quadraticCurveTo(cuff[0] - vx * w2 * 0.2, cuff[1] + drop, cuff[0] - vx * w2, cuff[1] - vy * w2);
    q.lineTo(el[0] - ux * w1, el[1] - uy * w1); q.lineTo(sh[0] - ux * w0, sh[1] - uy * w0); q.closePath(); q.fill();
    q.strokeStyle = 'rgba(30,20,16,0.5)'; q.lineWidth = 0.8; q.beginPath(); q.moveTo(lerp(el[0], cuff[0], 0.3), lerp(el[1], cuff[1], 0.3)); q.lineTo(lerp(el[0], cuff[0], 0.5) + vx * 3, lerp(el[1], cuff[1], 0.5) + vy * 3); q.stroke();
    // 汤勺
    const la = fa - 1.1 * raise + 0.4;
    q.strokeStyle = '#6a4a30'; q.lineWidth = 2.6; q.beginPath(); q.moveTo(hd[0], hd[1]); q.lineTo(hd[0] + Math.cos(la) * 34, hd[1] + Math.sin(la) * 34); q.stroke();
    q.fillStyle = '#7a5838'; q.beginPath(); q.ellipse(hd[0] + Math.cos(la) * 39, hd[1] + Math.sin(la) * 39, 8, 5.5, la, 0, TAU); q.fill();
    return hd;
  }

  // 狗尾草：一丛细茎，穗是一根下垂的毛刷——中轴两侧细密的刚毛；朝太阳那一侧描一线亮边。lit 透光程度
  function foxtail(g, x, y, n, s, t, wind, seed, lit, sun) {
    const stems = new Path2D(), bristle = new Path2D(), rims = new Path2D();
    const sd = Math.sign((sun ? sun[0] : x + 100) - x) || 1;
    for (let i = 0; i < n; i++) {
      const h = (34 + h2(seed, i) * 34) * s, lean = (h2(seed, i + 9) - 0.4) * 0.9;
      const sw = Math.sin(t * (1.6 + h2(seed, i + 3)) + i * 1.7 + seed) * 0.16 * wind + 0.12 * wind;
      const a = lean + sw, bx = x + (i - n / 2) * 2 * s, tx = x + (i - n / 2) * 3 * s + Math.sin(a) * h, ty = y - Math.cos(a) * h * 0.95;
      stems.moveTo(bx, y); stems.quadraticCurveTo(x + Math.sin(a * 0.4) * h * 0.4, y - h * 0.6, tx, ty);
      // 穗：从茎尖起，向下风一侧弯垂的一段弧；每一节两侧各一根刚毛
      const L = (13 + 7 * h2(seed, i + 5)) * s;
      let px = tx, py = ty, th = a + 0.5 + sw * 0.6;
      for (let k = 0; k <= 9; k++) {
        const v = k / 9, bl = (2.2 + 2.8 * Math.sin(v * PI * 0.9 + 0.2)) * s;
        for (const side of [-1, 1]) {
          const ba = th + side * (1.0 + 0.35 * h2(seed * 31 + i, k * 2 + side));
          bristle.moveTo(px, py); bristle.lineTo(px + Math.sin(ba) * bl, py - Math.cos(ba) * bl);
        }
        if (k) rims.lineTo(px + sd * 1.3 * s, py - 0.6 * s); else rims.moveTo(px + sd * 1.3 * s, py - 0.6 * s);
        px += Math.sin(th) * (L / 9); py -= Math.cos(th) * (L / 9); th += 0.11;
      }
    }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(58,50,44,0.85)'; g.lineWidth = 1 * s; g.stroke(stems);
    g.strokeStyle = lit > 0.7 ? 'rgba(214,176,108,0.95)' : 'rgba(176,146,96,0.9)'; g.lineWidth = 0.75 * s; g.stroke(bristle);
    if (lit > 0) add(g, () => { g.strokeStyle = rgba('#ffe2a8', 0.55 * lit); g.lineWidth = 0.9 * s; g.stroke(rims); glow(g, x, y - 46 * s, 28 * s, '#ffcf80', 0.12 * lit); });
  }
  // 红蜻蜓：分节的腹、胸、头，四片带翅脉的透明翅，扑得很快（身子朝 +x）
  function dragonfly(g, x, y, s, t, seed) {
    g.save(); g.translate(x, y); g.rotate(-0.12 + 0.08 * Math.sin(t * 2 + seed)); g.scale(s, s);
    const fl = Math.sin(t * 70 + seed);
    for (const [rx, back, L] of [[1.4, 0.12, 11.5], [-1.2, 0.32, 10.5]]) for (const side of [-1, 1]) {
      g.save(); g.translate(rx, 0); g.rotate(side * (PI / 2 + back) + side * fl * 0.22);
      g.fillStyle = 'rgba(255,244,232,0.3)'; g.beginPath(); g.ellipse(L / 2, 0, L / 2, 2.3, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(110,60,44,0.6)'; g.lineWidth = 0.35; g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.95, 0.3); g.moveTo(L * 0.3, 0); g.lineTo(L * 0.8, -1.6); g.moveTo(L * 0.45, 0); g.lineTo(L * 0.85, 1.5); g.stroke();
      g.restore();
    }
    // 腹部八节，越往后越细
    for (let k = 0; k < 8; k++) { const x2 = -4 - k * 2.6, r2 = 1.25 - k * 0.07; g.fillStyle = k % 2 ? '#a82a1a' : '#cc3a22'; g.beginPath(); g.ellipse(x2, 0, 1.6, r2, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#b8321e'; g.beginPath(); g.ellipse(0, 0, 3.2, 2.1, 0, 0, TAU); g.fill();
    g.fillStyle = '#7a1e14'; g.beginPath(); g.arc(4, 0, 1.9, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,220,180,0.6)'; g.beginPath(); g.arc(4.6, -0.6, 0.6, 0, TAU); g.fill();
    g.restore();
  }

  // ---------- 回忆特写：少年回头一笑（工笔淡彩）。三个角度：A 四分之三背面、B 侧面、C 四分之三正面（笑） ----------
  const FACE_LINE = '#7a4636', SKIN = '#f4dcc6', HAIR = '#1c1618';
  function boyBust(q, v) {
    // 肩与衣：土褐粗布短打，交领里露白衬，右肩搭一条抹布
    q.fillStyle = '#e6c8b0'; poly(q, [[-12, 34], [14, 34], [18, 74], [-16, 74]]); q.fill();
    q.fillStyle = K.lin(q, -120, 0, 120, 0, [[0, '#6a4c34'], [0.5, '#8e6c4a'], [1, '#7a5a3c']]);
    q.beginPath(); q.moveTo(-124, 170); q.quadraticCurveTo(-118, 98, -66, 80); q.quadraticCurveTo(-34, 70, -14, 64); q.lineTo(14, 64); q.quadraticCurveTo(40, 70, 68, 80); q.quadraticCurveTo(118, 98, 124, 170); q.closePath(); q.fill();
    q.strokeStyle = FACE_LINE; q.lineWidth = 1; q.stroke();
    if (v !== 'A') {
      // 交领：左襟压右襟
      q.fillStyle = '#efe6d6'; q.beginPath(); q.moveTo(-14, 64); q.lineTo(8, 110); q.lineTo(18, 64); q.closePath(); q.fill();
      q.strokeStyle = '#5a3e28'; q.lineWidth = 6; q.beginPath(); q.moveTo(-16, 64); q.quadraticCurveTo(-6, 96, 14, 128); q.stroke();
      q.lineWidth = 1; q.strokeStyle = FACE_LINE; q.beginPath(); q.moveTo(-19, 64); q.quadraticCurveTo(-9, 96, 11, 130); q.stroke();
    } else { q.strokeStyle = '#5a3e28'; q.lineWidth = 6; q.beginPath(); q.moveTo(-18, 66); q.quadraticCurveTo(0, 74, 18, 66); q.stroke(); }
    // 粗布的几道褶
    q.strokeStyle = 'rgba(60,40,26,0.45)'; q.lineWidth = 0.9;
    for (const [a, b, c2, d] of [[-90, 110, -70, 150], [-50, 96, -40, 150], [60, 100, 74, 150], [92, 112, 100, 160]]) { q.beginPath(); q.moveTo(a, b); q.quadraticCurveTo((a + c2) / 2 + 6, (b + d) / 2, c2, d); q.stroke(); }
    // 抹布：从右肩搭下来，灰白，两道蓝线
    const sx = v === 'A' ? -1 : 1;
    q.fillStyle = '#e4dccb';
    q.beginPath(); q.moveTo(sx * 30, 70); q.quadraticCurveTo(sx * 64, 66, sx * 86, 84); q.lineTo(sx * 96, 168); q.lineTo(sx * 70, 170); q.quadraticCurveTo(sx * 64, 110, sx * 34, 86); q.closePath(); q.fill();
    q.strokeStyle = FACE_LINE; q.lineWidth = 0.9; q.stroke();
    q.strokeStyle = 'rgba(70,100,140,0.55)'; q.lineWidth = 1.6;
    for (const k of [0.3, 0.42]) { q.beginPath(); q.moveTo(lerp(sx * 30, sx * 86, k), lerp(78, 80, k) + 2); q.lineTo(lerp(sx * 70, sx * 96, k) + sx * 2, 168); q.stroke(); }
  }
  // 发髻与布带：头顶偏后一个髻，布带扎住，两根带尾顺风飘
  function boyKnot(q, x, y) {
    q.fillStyle = HAIR; q.beginPath(); q.ellipse(x, y, 14, 12, 0, 0, TAU); q.fill();
    q.strokeStyle = 'rgba(120,110,120,0.45)'; q.lineWidth = 0.6;
    for (let k = 0; k < 5; k++) { q.beginPath(); q.arc(x, y + 2, 4 + k * 2, PI * 1.1, PI * 1.9); q.stroke(); }
    q.fillStyle = '#3a6a9a'; q.save(); q.translate(x, y + 8); q.rotate(-0.08); q.fillRect(-15, -4, 30, 8); q.restore();
    q.strokeStyle = 'rgba(20,40,70,0.5)'; q.lineWidth = 0.8; q.beginPath(); q.moveTo(x - 12, y + 6); q.lineTo(x + 13, y + 5); q.stroke();
    q.fillStyle = '#3a6a9a';
    for (const [dy2, ph, L] of [[4, 0, 46], [10, 1.4, 38]]) {
      q.beginPath(); q.moveTo(x + 13, y + dy2);
      for (let k = 1; k <= 8; k++) { const u = k / 8; q.lineTo(x + 13 + u * L, y + dy2 + u * 10 + Math.sin(u * 5 + ph) * 4 * u - 2.2); }
      for (let k = 8; k >= 0; k--) { const u = k / 8; q.lineTo(x + 13 + u * L, y + dy2 + u * 10 + Math.sin(u * 5 + ph) * 4 * u + 2.2 * (1 - u * 0.6)); }
      q.closePath(); q.fill();
    }
  }
  // 发丝：工笔的细线，顺着头型往发髻收
  function hairLines(q, pts, n, seed) {
    q.strokeStyle = 'rgba(150,140,150,0.28)'; q.lineWidth = 0.55;
    const r = A.rng(seed);
    for (let i = 0; i < n; i++) {
      const [x0, y0, x1, y1] = pts, u = r(), v = r();
      q.beginPath(); q.moveTo(lerp(x0, x1, u), lerp(y0, y1, v)); q.quadraticCurveTo(lerp(x0, x1, u) + (r() - 0.5) * 20, lerp(y0, y1, v) - 18, 8 + (r() - 0.5) * 10, -58); q.stroke();
    }
  }
  // 细线描的一笔（两头尖、中间粗）：沿二次曲线 (x0,y0)-(cx,cy)-(x1,y1)，最粗 w
  function nib(q, x0, y0, cx, cy, x1, y1, w, col) {
    q.fillStyle = col;
    const L = [], R = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
      const x = a * x0 + b * cx + d * x1, y = a * y0 + b * cy + d * y1;
      const tx = 2 * (1 - u) * (cx - x0) + 2 * u * (x1 - cx), ty = 2 * (1 - u) * (cy - y0) + 2 * u * (y1 - cy), tl = Math.hypot(tx, ty) || 1;
      const hw = (w / 2) * Math.pow(Math.sin(PI * Math.min(1, Math.max(0, u * 0.9 + 0.05))), 0.8);
      L.push([x - (ty / tl) * hw, y + (tx / tl) * hw]); R.push([x + (ty / tl) * hw, y - (tx / tl) * hw]);
    }
    q.beginPath(); L.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); for (let i = R.length - 1; i >= 0; i--) q.lineTo(R[i][0], R[i][1]); q.closePath(); q.fill();
  }
  function boyHead(q, v) {
    const ink = '#24160f';
    if (v === 'C') {
      // 四分之三正面，朝左下方笑：鹅蛋脸，眉梢上扬，眼睛笑成两道弯月
      // 头发全梳上去扎成髻：额前发际是一道弧，鬓角一小撮，后脑圆圆的、颈后露出发根
      q.fillStyle = HAIR; q.beginPath(); q.moveTo(-34, -16); q.quadraticCurveTo(-40, -50, -6, -60); q.quadraticCurveTo(34, -62, 44, -30); q.quadraticCurveTo(48, -4, 36, 18);
      q.lineTo(27, 16); q.lineTo(22, 3); q.quadraticCurveTo(20, -13, 16, -19); q.quadraticCurveTo(-6, -35, -34, -16); q.closePath(); q.fill();
      hairLines(q, [-30, -54, 40, 0], 34, 7);
      // 脸：额—颧—颊—下巴，近侧的下颌线连到耳下
      q.fillStyle = K.lin(q, -44, -10, 30, 30, [[0, '#fbece0'], [0.55, SKIN], [1, '#eac6ac']]);
      q.beginPath(); q.moveTo(-34, -16); q.quadraticCurveTo(-42, -6, -41, 2); q.quadraticCurveTo(-39, 10, -38, 16); q.quadraticCurveTo(-34, 36, -22, 46); q.quadraticCurveTo(-14, 52, -4, 50);
      q.quadraticCurveTo(14, 46, 25, 30); q.lineTo(22, 3); q.quadraticCurveTo(20, -13, 16, -19); q.quadraticCurveTo(-6, -35, -34, -16); q.closePath(); q.fill();
      q.strokeStyle = FACE_LINE; q.lineWidth = 0.9; q.stroke();
      // 颌下的影
      q.fillStyle = 'rgba(190,130,100,0.25)'; q.beginPath(); q.moveTo(-14, 52); q.quadraticCurveTo(8, 50, 25, 30); q.lineTo(24, 40); q.quadraticCurveTo(6, 58, -14, 52); q.fill();
      // 耳
      q.fillStyle = '#f0cfb6'; q.beginPath(); q.moveTo(26, -4); q.quadraticCurveTo(36, -8, 37, 4); q.quadraticCurveTo(37, 16, 28, 20); q.closePath(); q.fill(); q.stroke();
      q.beginPath(); q.moveTo(30, 0); q.quadraticCurveTo(34, 4, 30, 12); q.stroke();
      // 几缕碎发落在额前、鬓角
      q.strokeStyle = HAIR; q.lineCap = 'round';
      for (const [a, b, c2, d, w] of [[-14, -30, -24, -16, 0.9], [-4, -31, -8, -20, 0.7], [21, -6, 21, 8, 1.3]]) { q.lineWidth = w; q.beginPath(); q.moveTo(a, b); q.quadraticCurveTo(a - 6, (b + d) / 2, c2, d); q.stroke(); }
      // 眉：近眉长、眉梢上挑；远眉短
      nib(q, -4, -8, 8, -15, 23, -13, 2.6, '#2a1c18');
      nib(q, -38, -6, -31, -11, -22, -10, 1.8, '#2a1c18');
      // 笑眼：上眼线是一道弯月（中间粗），眼尾一挑；下眼睑一笔淡线
      nib(q, -2, 3, 8, -5, 19, 1, 2.6, ink); nib(q, 17, 1.5, 20, 0, 22, -2, 1, ink);
      nib(q, -36, 3, -31, -2, -25, 2, 1.9, ink);
      q.strokeStyle = 'rgba(150,90,70,0.4)'; q.lineWidth = 0.7;
      q.beginPath(); q.moveTo(1, 7); q.quadraticCurveTo(9, 9, 16, 6); q.moveTo(-34, 6); q.quadraticCurveTo(-30, 7.5, -27, 6); q.stroke();
      // 鼻：鼻梁一笔、鼻翼一勾
      q.strokeStyle = FACE_LINE; q.lineWidth = 0.9;
      q.beginPath(); q.moveTo(-16, -4); q.quadraticCurveTo(-21, 8, -24, 18); q.quadraticCurveTo(-21, 22, -17, 21); q.stroke();
      q.beginPath(); q.moveTo(-13, 17); q.quadraticCurveTo(-10, 21, -14, 23); q.stroke();
      // 嘴：一道上扬的笑，下唇一点淡红，嘴角的小窝
      q.fillStyle = 'rgba(226,130,120,0.55)'; q.beginPath(); q.ellipse(-17, 35.5, 6.5, 2.4, 0.05, 0, TAU); q.fill();
      nib(q, -29, 29.5, -18, 36, -6, 29, 1.8, '#8e3e36');
      nib(q, -30, 30.5, -31, 29, -30, 27, 0.9, '#8e3e36'); nib(q, -6, 29.5, -4.5, 28, -4, 26, 0.9, '#8e3e36');
      q.strokeStyle = 'rgba(170,100,80,0.35)'; q.lineWidth = 0.7; q.beginPath(); q.arc(-2, 31, 3, -0.6, 0.9); q.stroke();
      // 胭脂
      A.softBlob(q, 9, 20, 14, 0.32, '#f09a98'); A.softBlob(q, -36, 16, 7, 0.2, '#f09a98');
      boyKnot(q, 10, -68);
      // 夕照擦过耳廓、鬓角和近侧的颊边
      q.globalCompositeOperation = 'lighter';
      q.strokeStyle = 'rgba(255,214,140,0.9)'; q.lineWidth = 1.7;
      q.beginPath(); q.moveTo(37, -2); q.quadraticCurveTo(38, 10, 31, 18); q.moveTo(25, 30); q.quadraticCurveTo(15, 46, -2, 50); q.moveTo(41, -24); q.quadraticCurveTo(45, 0, 40, 26); q.stroke();
      q.globalCompositeOperation = 'source-over';
    } else if (v === 'B') {
      // 侧面，朝左
      q.fillStyle = HAIR; q.beginPath(); q.moveTo(-28, -30); q.quadraticCurveTo(-22, -60, 8, -60); q.quadraticCurveTo(42, -58, 46, -22); q.quadraticCurveTo(48, 8, 32, 24); q.lineTo(16, 22); q.lineTo(3, 4); q.quadraticCurveTo(0, -14, -6, -20); q.quadraticCurveTo(-16, -31, -28, -30); q.closePath(); q.fill();
      hairLines(q, [-20, -52, 42, 10], 30, 8);
      q.fillStyle = K.lin(q, -48, 0, 20, 0, [[0, '#fbece0'], [1, '#eac6ac']]);
      q.beginPath(); q.moveTo(-28, -30); q.quadraticCurveTo(-38, -18, -37, -7); q.lineTo(-38, -1); q.quadraticCurveTo(-44, 8, -47, 15); q.quadraticCurveTo(-44, 19, -40, 19);
      q.quadraticCurveTo(-42, 23, -40, 26); q.lineTo(-38, 29); q.quadraticCurveTo(-41, 32, -38, 36); q.quadraticCurveTo(-36, 46, -24, 51); q.quadraticCurveTo(-4, 52, 16, 36); q.lineTo(16, 22); q.lineTo(3, 4); q.quadraticCurveTo(0, -14, -6, -20); q.quadraticCurveTo(-16, -31, -28, -30); q.closePath(); q.fill();
      q.strokeStyle = FACE_LINE; q.lineWidth = 0.9; q.stroke();
      q.fillStyle = '#f0cfb6'; q.beginPath(); q.moveTo(4, -4); q.quadraticCurveTo(16, -8, 16, 6); q.quadraticCurveTo(15, 18, 5, 20); q.closePath(); q.fill(); q.stroke();
      q.beginPath(); q.moveTo(8, 0); q.quadraticCurveTo(12, 5, 8, 13); q.stroke();
      nib(q, -37, -8, -30, -14, -19, -12, 2.2, '#2a1c18');
      nib(q, -35, 2, -30, -3, -23, 1, 2.2, ink);
      q.strokeStyle = 'rgba(150,90,70,0.4)'; q.lineWidth = 0.7; q.beginPath(); q.moveTo(-33, 6); q.quadraticCurveTo(-28, 7.5, -24, 5); q.stroke();
      nib(q, -39, 28, -36, 30, -32, 26, 1.4, '#8e3e36');
      A.softBlob(q, -24, 18, 10, 0.28, '#f09a98');
      boyKnot(q, 16, -66);
      q.globalCompositeOperation = 'lighter';
      q.strokeStyle = 'rgba(255,214,140,0.9)'; q.lineWidth = 1.7; q.beginPath(); q.moveTo(15, 36); q.quadraticCurveTo(6, 47, -12, 52); q.moveTo(43, -20); q.quadraticCurveTo(46, 10, 34, 32); q.stroke();
      q.globalCompositeOperation = 'source-over';
    } else {
      // 四分之三背面：朝右上方望着落日，只看得见后脑、耳和一线被夕照描亮的颊边
      q.fillStyle = K.lin(q, 18, 0, 46, 0, [[0, '#efd2ba'], [1, '#ffe4c4']]);
      q.beginPath(); q.moveTo(26, -14); q.quadraticCurveTo(44, -2, 41, 20); q.quadraticCurveTo(36, 38, 22, 48); q.lineTo(12, 30); q.closePath(); q.fill();
      q.strokeStyle = FACE_LINE; q.lineWidth = 0.9; q.stroke();
      q.fillStyle = '#e8c6ac'; poly(q, [[-16, 30], [18, 30], [16, 48], [-14, 48]]); q.fill();
      q.fillStyle = HAIR; q.beginPath(); q.moveTo(-40, 8); q.quadraticCurveTo(-46, -44, -6, -60); q.quadraticCurveTo(32, -64, 38, -24); q.quadraticCurveTo(34, -8, 24, -6); q.quadraticCurveTo(20, 14, 20, 32); q.quadraticCurveTo(0, 42, -22, 36); q.quadraticCurveTo(-38, 26, -40, 8); q.closePath(); q.fill();
      hairLines(q, [-36, -50, 28, 30], 36, 9);
      q.fillStyle = '#f0cfb6'; q.beginPath(); q.moveTo(16, -2); q.quadraticCurveTo(26, -4, 26, 8); q.quadraticCurveTo(25, 18, 17, 20); q.closePath(); q.fill(); q.strokeStyle = FACE_LINE; q.stroke();
      boyKnot(q, 0, -68);
      q.globalCompositeOperation = 'lighter';
      q.strokeStyle = 'rgba(255,220,150,0.95)'; q.lineWidth = 2; q.beginPath(); q.moveTo(28, -12); q.quadraticCurveTo(44, -2, 41, 20); q.quadraticCurveTo(36, 38, 22, 48); q.stroke();
      q.globalCompositeOperation = 'source-over';
    }
  }
  // 一个角度的特写贴图：头肩画好，再用柔边圆罩一下（肩往下渐渐化进金色里）
  function boyFaceTex(v) {
    return cache('g02_va4_face' + v, 300, 300, 1, (q) => {
      q.save(); q.translate(150, 140);
      boyBust(q, v); boyHead(q, v);
      q.restore();
      q.globalCompositeOperation = 'destination-in';
      const gr = q.createRadialGradient(150, 140, 60, 150, 150, 150);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.62, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = gr; q.fillRect(0, 0, 300, 300);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 回忆的底：一团柔边的金色淡彩，边上一圈若有若无的淡墨晕
  function memWash() {
    return cache('g02_va4_wash', 360, 360, 0.5, (q) => {
      const gr = q.createRadialGradient(180, 180, 0, 180, 180, 180);
      gr.addColorStop(0, 'rgba(255,244,214,0.96)'); gr.addColorStop(0.5, 'rgba(255,228,170,0.9)'); gr.addColorStop(0.78, 'rgba(250,196,120,0.55)'); gr.addColorStop(1, 'rgba(240,170,100,0)');
      q.fillStyle = gr; q.fillRect(0, 0, 360, 360);
      q.strokeStyle = 'rgba(150,100,70,0.16)'; q.lineWidth = 7;
      q.beginPath(); q.arc(180, 180, 150, 0.4, 2.6); q.stroke();
      q.lineWidth = 3; q.beginPath(); q.arc(180, 180, 156, 3.4, 5.6); q.stroke();
    });
  }

  XYT.registerShot('va4_wall', {
    name: '日挂墙头', zone: 'right', night: false, text: '#fbf3e6', shadow: 'rgba(40,26,40,0.92)', accent: '#f9c96b', bloom: 0.42,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tWall = charAt(c, 2, 1.0), tHead = charAt(c, 3, 1.38), tShe = charAt(c, 4, 1.78), tWo = charAt(c, 7, 3.12);
      // 镜头：接上一镜的升起，从高处缓缓降到低机位——墙从画面下方升起来，正好在“墙”字上把太阳托住，轻轻一顿
      const down = easeInOut(clamp((lt + 0.12) / (tWall + 0.12)));
      const settle = lt > tWall ? -3 * Math.sin(Math.min(1, (lt - tWall) / 0.4) * PI) : 0;
      const D = 150 * (1 - down) + settle;
      const dy = (k) => D * k;
      const [sx, sy, sr] = SUN4;
      const bump = lt > tWall ? Math.exp(-(lt - tWall) / 0.4) : 0;
      const pulse = c.be ? c.be(0.5) : 0;
      // 虚影：“我”字之后淡去，留出最后一小段空镜
      const ghostA = 1 - smooth(clamp((lt - tWo) / 0.63));

      // 天与墙外
      g.save(); g.translate(0, dy(0.25));
      g.imageSmoothingEnabled = false;
      g.drawImage(va4Far(), -40, -30, W + 80, 560);
      g.imageSmoothingEnabled = true;
      g.restore();
      // 落日（在墙后，不动）
      add(g, () => glow(g, sx, sy, 220 * (1 + 0.08 * pulse), '#ff9a40', 0.3 + 0.12 * pulse + 0.16 * bump));
      E.sun(g, { x: sx, y: sy, r: sr, color: '#ff9238', glow: 0.55 + 0.2 * pulse + 0.12 * bump, spread: 3.4, haze: '#ffa050' });
      add(g, () => glow(g, sx, sy, sr * 1.25, '#fff0c0', 0.36 + 0.14 * pulse));

      // 光：越过墙头洒下来的几道光（只在墙顶以上的空气里）
      g.save();
      g.beginPath(); g.moveTo(-60, -60); g.lineTo(W + 60, -60);
      for (let i = WALL4.length - 1; i >= 0; i--) { const [a, b, y] = WALL4[i]; g.lineTo(b, y - 8 + dy(1)); g.lineTo(a, y - 8 + dy(1)); }
      g.closePath(); g.clip();
      V.godRays(g, c, { x: sx, y: sy, angle: PI / 2 + 0.05, spread: 2.6, n: 6, len: 640, start: 0.12, res: 0.2, color: '#ffd8a0', alpha: 0.2 + 0.08 * bump, source: false, night: false, seed: 4, beat: 0.25 });
      g.restore();

      // 墙、地面
      g.save(); g.translate(0, dy(1));
      g.imageSmoothingEnabled = false;
      g.drawImage(va4Wall(), -60, 200, W + 120, 520);
      g.imageSmoothingEnabled = true;
      // 托住太阳的那段墙脊：瓦口被日轮照得最亮
      add(g, () => { glow(g, sx, 258, 150, '#ffc880', 0.36 + 0.2 * bump); glow(g, 470, 296, 110, '#ffcf88', 0.16); });
      g.restore();
      g.save(); g.translate(0, dy(1.25));
      g.imageSmoothingEnabled = false;
      g.drawImage(va4Ground(), -60, 640, W + 120, 200);
      g.imageSmoothingEnabled = true;
      g.restore();

      // 墙头的狗尾草（逆光，毛刷穗，亮边朝太阳）
      g.save(); g.translate(0, dy(1));
      const wind = 0.6 + 0.4 * Math.sin(t * 0.7);
      foxtail(g, 440, 291, 7, 1.0, t, wind, 3, 1, SUN4);
      foxtail(g, 700, 253, 6, 0.9, t, wind, 7, 1, SUN4);
      foxtail(g, 1010, 213, 5, 0.85, t, wind, 11, 0.8, SUN4);
      foxtail(g, 1220, 291, 6, 0.9, t, wind, 13, 0.6, SUN4);
      g.restore();

      // 灶房：门里火光一跳一跳、锅上冒汽，门口地上一方门形的暖光（也是回忆，跟着一起暗下去）
      const kit = 0.25 + 0.75 * ghostA, fire = 0.75 + 0.25 * noise1(t * 7, 5) + 0.1 * Math.sin(t * 23);
      g.save(); g.translate(0, dy(1.1));
      {
        const [dx0, dy0, dx1, dy1] = KDOOR;
        g.drawImage(va4KitIn(), dx0, dy0, 112, 198);
        add(g, () => {
          g.globalAlpha = kit * fire;
          g.fillStyle = K.lin(g, 0, dy0, 0, dy1, [[0, 'rgba(255,150,80,0.12)'], [0.7, 'rgba(255,130,50,0.5)'], [1, 'rgba(255,110,40,0.3)']]); g.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
          g.globalAlpha = 1;
          glow(g, 186, 600, 70, '#ff9a40', 0.35 * kit * fire);
        });
        g.drawImage(va4KitFront(), dx0, dy0, 112, 198);
        g.drawImage(va4Kitchen(), -40, 180, 300, 560);
        add(g, () => {
          // 灶口的火、窗纸上的火光、门口地上门形的暖光
          glow(g, 190, 648, 30, '#ff7a20', 0.95 * kit * fire); glow(g, 190, 652, 11, '#ffe0a0', 0.95 * kit * fire);
          g.fillStyle = rgba('#ff9a48', 0.42 * kit * fire); g.fillRect(30, 350, 70, 46);
          g.fillStyle = K.lin(g, 0, dy1 + 10, 0, dy1 + 70, [[0, rgba('#ffb060', 0.4 * kit * fire)], [1, 'rgba(255,170,90,0)']]);
          poly(g, [[dx0, dy1 + 10], [dx1, dy1 + 10], [dx1 + 64, dy1 + 70], [dx0 + 30, dy1 + 70]]); g.fill();
        });
        // 锅上的蒸汽：从门里冒出来，出了门被晚风带向右上
        for (let k = 0; k < 9; k++) {
          const u = ((t * 0.3 + k / 9) % 1), x = 178 + u * u * 120 + Math.sin(t * 1.3 + k) * 8, y = 566 - u * 280;
          E.util.streak(g, x, y, 12 + u * 46, 9 + u * 26, '#f8eee4', 0.34 * Math.sin(u * PI) * kit);
        }
      }
      g.restore();

      // 回忆的虚影：婶婶、少年
      if (ghostA > 0.004) {
        const tw = (PI / 1.6) * surge(c, 5);
        const turn = smooth(clamp((lt - tShe) / 0.35));
        const yx = 520, yy = 300 + dy(1) - 4;
        const ax = 352, ay = WALL_FOOT + dy(1.1);
        const raise = lt < tHead ? 0 : easeOut(clamp((lt - tHead) / 0.32));
        V.util.viaScratch(g, 'g02_va4_gA', [ax - 80, ay - 236, ax + 130, ay + 12], 1, 'source-over', 0.66 * ghostA, (q) => {
          q.drawImage(va4Aunt(), ax - 60, ay - 226, 160, 240);
          const P = F.points('villager', ax, ay, 1.12, 0.4, AUNT);
          const wave = raise * Math.sin(Math.max(0, lt - tHead) * 9) * 0.22 * Math.exp(-Math.max(0, lt - tHead - 0.9) * 1.5);
          auntArm(q, P.shoulderN, raise, wave, 1.12);
          q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(255,196,120,0.36)'; q.fillRect(ax - 80, ay - 240, 220, 260); q.globalCompositeOperation = 'source-over';
        });
        V.util.viaScratch(g, 'g02_va4_gY', [yx - 120, yy - 170, yx + 110, yy + 120], 1, 'source-over', 0.66 * ghostA, (q) => {
          // 少年坐在墙头，腿垂在墙这边：身子一直朝右（望着落日），“舍”字上只是头低下来、往回偏一点；回头的笑在左边的特写里
          F.draw(q, 'xiaoyao', yx, yy, 1.3, tw, { stage: 'youth', pose: 'sit', seat: 'ledge', facing: 1, wind: 0.35, windDir: 1, seed: 5, head: -0.18 * turn, rim: '#ffe2a0', light: [SUN4[0], SUN4[1]], rimWidth: 2.2 });
          q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(255,196,120,0.34)'; q.fillRect(yx - 120, yy - 170, 230, 290); q.globalCompositeOperation = 'source-over';
        });
        // 两个虚影周身一圈暖光
        add(g, () => {
          const PY = F.points('xiaoyao', yx, yy, 1.3, tw, { stage: 'youth', pose: 'sit', seat: 'ledge', facing: 1, seed: 5 });
          for (const k of ['head', 'chest', 'pelvis', 'kneeN', 'footN']) glow(g, PY[k][0], PY[k][1], 46, '#ffd890', 0.25 * ghostA);
          glow(g, yx, yy - 100, 130, '#ffd890', 0.18 * ghostA);
          for (const [dx2, dy2, r2] of [[0, -170, 40], [6, -120, 50], [8, -60, 56], [6, -16, 50]]) glow(g, ax + dx2, ay + dy2, r2, '#ffd890', 0.22 * ghostA);
        });
      }

      // 院角的他：深墨剪影站在墙影里，仰头看着墙头（镜头降下来时从画面下方升进来）
      g.save(); g.translate(0, dy(1.4));
      g.fillStyle = 'rgba(20,16,28,0.4)'; g.beginPath(); g.ellipse(926, 686, 50, 7, 0, 0, TAU); g.fill();
      g.drawImage(va4Old(), 930 - 130, 686 - 330, 260, 350);
      g.restore();

      // 回忆特写：“舍”字上，左边空着的天上浮出一团金色，少年从望着落日到回过头来一笑；“我”字之后散去
      {
        const ia = smooth(clamp((lt - tShe + 0.22) / 0.3)) * (1 - smooth(clamp((lt - tWo) / 0.5)));
        if (ia > 0.004) {
          const cx = 300, cy = 206, u = smooth(clamp((lt - tShe) / 0.35)), zk = 1 + 0.035 * smooth(clamp((lt - tShe + 0.2) / 2.2));
          g.save(); g.translate(cx, cy); g.scale(zk, zk);
          g.globalAlpha = ia; g.drawImage(memWash(), -180, -180, 360, 360);
          const wts = u < 0.5 ? [['A', 1 - u * 2, 7], ['B', u * 2, 0]] : [['B', 2 - u * 2, 0], ['C', u * 2 - 1, -5]];
          for (const [v, w2, ox] of wts) if (w2 > 0.004) { g.globalAlpha = ia * Math.min(1, w2 * 1.25); g.drawImage(boyFaceTex(v), -150 + ox, -150 + 6, 300, 300); }
          g.globalAlpha = 1;
          g.restore();
          add(g, () => { glow(g, cx + 40, cy - 30, 120, '#fff0c8', 0.2 * ia); glow(g, cx + 70, cy - 10, 30, '#ffffff', 0.18 * ia * u); });
        }
      }

      // 两只红蜻蜓在墙前、狗尾草上悬停、一闪（避开日轮）
      for (let i = 0; i < 2; i++) {
        const ph = Math.floor(t * 0.9 + i * 0.5), f = t * 0.9 + i * 0.5 - ph, jump = smooth(clamp((f - 0.85) / 0.15));
        const zx = i ? [930, 1060] : [560, 740], zy = i ? [330, 420] : [320, 420];
        const P0 = [lerp(zx[0], zx[1], h2(ph, i + 1)), lerp(zy[0], zy[1], h2(ph, i + 3))], P1 = [lerp(zx[0], zx[1], h2(ph + 1, i + 1)), lerp(zy[0], zy[1], h2(ph + 1, i + 3))];
        dragonfly(g, lerp(P0[0], P1[0], jump) + Math.sin(t * 3 + i) * 4, lerp(P0[1], P1[1], jump) + Math.sin(t * 5 + i) * 3 + dy(1), 1.5, t, i * 7);
      }
      // 金色的浮尘
      add(g, () => {
        for (let i = 0; i < 30; i++) {
          const x = 300 + h2(i, 81) * 800 + Math.sin(t * 0.3 + i) * 30, y = 120 + h2(i, 82) * 330 + Math.cos(t * 0.25 + i) * 20 + dy(0.6);
          glow(g, x, y, 2 + h2(i, 83) * 3.5, '#ffe2a8', 0.3 + 0.3 * Math.sin(t * 1.4 + i * 1.3));
        }
      });
      // 最前面左下角一大丛失焦的狗尾草，逆光，跟着风摇（在低分辨率里画，放大即虚）
      V.util.viaScratch(g, 'g02_va4_fg', [-24, 460, 400, H + 24], 0.3, 'source-over', 0.92, (q) => {
        q.translate(0, dy(1.8));
        foxtail(q, 44, 770, 8, 3.0, t * 0.8, wind * 1.2, 21, 1, [SUN4[0], SUN4[1] - 400]);
        foxtail(q, 300, 820, 5, 2.4, t * 0.8 + 1, wind * 1.2, 23, 1, [SUN4[0], SUN4[1] - 400]);
      });
    },
  });

  // ---------- 空闲时预热本组的静态贴图（与不预热的结果完全一样，只是镜头第一帧不卡） ----------
  try {
    const jobs = () => [
      va1Outside, va1Room, va1Furniture, va1Counter,
      touchHills(HILLS2[0]), touchHills(HILLS2[1]), va2Bg, va2Refl, va2Clouds, () => plumeTex('blur'), () => kiteTex(false), () => kiteTex(true), () => { for (let k = 0; k < PR.n; k++) plumeRot('lite', k); }, () => plumeTex('near'),
      touchHills(HILLS3[0]), va3Far, va3Eave, () => va3Post(-1), () => va3Post(1), va3Sash, va3Sill, () => { for (let v = 0; v < 4; v++) { ghostTex(v, 0); ghostTex(v, 1); trailTex(v); } },
      touchHills(HILLS4[0]), va4Far, va4Wall, va4Ground, va4Kitchen, va4KitIn, va4KitFront, va4Old, va4Aunt, memWash, () => { for (const v of 'ABC') boyFaceTex(v); },
    ];
    const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 4000 }) : (f) => setTimeout(f, 150);
    let tries = 0;
    const start = () => {
      if (!(XYT.sprites && XYT.sprites.S)) { if (++tries < 120) setTimeout(start, 500); return; }
      const list = jobs(), S0 = XYT.sprites.S;
      const step = () => { if (!list.length || XYT.sprites.S !== S0) return; try { list.shift()(); } catch (e) { /* 预热失败不影响正常绘制 */ } idle(step); };
      idle(step);
    };
    setTimeout(start, 700);
  } catch (e) { /* 没有定时器的环境里跳过预热 */ }
})();
