/* 分镜镜头 第 01 组：前奏五镜（墨开山河、余杭晨雾、篙点倒影、白发归人、酒旗风起） */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, hash, h2, rng, noise1, noise2, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 通用小工具 ----------
  const shotStart = (c) => c.t - c.lt;
  // 镜头起点之后第 k 拍（k=0 为起点处或之后的第一拍）的歌曲时间
  const beatIdx0 = (c) => Math.ceil(c.grid.pos(shotStart(c) - 0.05) - 1e-6);
  const beatT = (c, k) => c.grid.time(beatIdx0(c) + k);
  // 起点之后第一个强拍的拍序号
  const downIdx0 = (c) => { let i = beatIdx0(c); for (let k = 0; k < 4 && !c.grid.isDown(i); k++) i++; return i; };
  const pulse = (x, w) => (x < 0 ? 0 : Math.exp(-x / w));
  // 书法字体就绪与否（就绪后记下，不再每帧查询）
  const fontOk = {};
  const fontKey = (txt) => {
    if (fontOk[txt]) return 'f';
    try { if (document.fonts && document.fonts.check('32px "Ma Shan Zheng"', txt)) { fontOk[txt] = 1; return 'f'; } } catch (e) { /* 无字体接口 */ }
    return 'n';
  };
  try { if (document.fonts && document.fonts.load) document.fonts.load('64px "Ma Shan Zheng"', '逍遥叹酒仙剑奇侠传胡歌').catch(() => {}); } catch (e) { /* 无字体接口 */ }
  // 每帧复用的离屏缓冲：用前清空，不跨帧保存画面
  const bufs = {};
  function buf(name, lw, lh, k) {
    const S = (XYT.sprites && XYT.sprites.S) || 1, s = S * k;
    const pw = Math.max(2, Math.ceil(lw * s)), ph = Math.max(2, Math.ceil(lh * s));
    let cv = bufs[name];
    if (!cv) cv = bufs[name] = document.createElement('canvas');
    if (cv.width < pw || cv.height < ph) { cv.width = Math.max(cv.width, pw); cv.height = Math.max(cv.height, ph); }
    const q = cv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    q.clearRect(0, 0, pw + 2, ph + 2);
    q.setTransform(s, 0, 0, s, 0, 0);
    return { cv, q, pw, ph, s };
  }
  const glow = (g, x, y, r, col, a) => A.glow(g, x, y, r, col, a);
  // 大块静态底图：按 1:1 缓存、贴的时候关掉插值（软件渲染下快好几倍，缩放只有百分之几，看不出差别）
  function blitN(g, img, x, y, w, h) {
    const sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, x, y, w, h);
    g.imageSmoothingEnabled = sm;
  }
  const add = (g, fn) => K.lighter(g, fn);

  // ---------- 宣纸 ----------
  // 洒金宣：暖白底、云状浓淡、长短纤维、细碎杂质；金箔屑另画（逐拍闪光）
  function paperTex(col) {
    return K.cache('g01paper|' + col, W + 80, H + 80, 1, (q) => {
      q.translate(40, 40);
      q.fillStyle = col; q.fillRect(-40, -40, W + 80, H + 80);
      const r = rng(1512);
      for (let i = 0; i < 70; i++) A.softBlob(q, r() * W, r() * H, 60 + r() * 160, 0.035 + r() * 0.03, r() < 0.5 ? '#d9cdb2' : '#ffffff');
      q.lineCap = 'round';
      for (let i = 0; i < 900; i++) {
        const x = r() * (W + 60) - 30, y = r() * (H + 60) - 30, a = r() * TAU, l = 8 + r() * 46;
        q.strokeStyle = `rgba(${r() < 0.5 ? '140,120,90' : '255,255,255'},${0.05 + r() * 0.09})`; q.lineWidth = 0.4 + r() * 0.8;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); q.stroke();
      }
      for (let i = 0; i < 260; i++) { q.fillStyle = `rgba(90,70,50,${0.05 + r() * 0.12})`; q.beginPath(); q.arc(r() * W, r() * H, 0.4 + r() * 1.1, 0, TAU); q.fill(); }
      // 四边略深（旧纸的边缘）
      const gr = q.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 820);
      gr.addColorStop(0, 'rgba(120,96,60,0)'); gr.addColorStop(1, 'rgba(120,96,60,0.22)');
      q.fillStyle = gr; q.fillRect(-40, -40, W + 80, H + 80);
    });
  }
  // 纸纹颗粒：每秒换 12 次的细碎噪点（只画几百个小点，不铺整张贴图）
  function grain(g, t, a) {
    const k = Math.floor(t * 12);
    g.fillStyle = `rgba(70,56,36,${0.22 * a})`;
    g.beginPath();
    for (let i = 0; i < 260; i++) { const s = 0.7 + h2(i, k * 3 + 1) * 1.3; g.rect(h2(i, k * 3) * W, h2(i, k * 3 + 2) * H, s, s); }
    g.fill();
    g.fillStyle = `rgba(255,252,244,${0.5 * a})`;
    g.beginPath();
    for (let i = 0; i < 160; i++) { const s = 0.8 + h2(i, k * 5 + 1) * 1.4; g.rect(h2(i, k * 5 + 7) * W, h2(i, k * 5 + 9) * H, s, s); }
    g.fill();
  }
  // 平滑的不规则圆（墨晕湿边、显影范围）：点数随半径增加，大圆也不出棱角
  function blobPath(g, x, y, R, seed, wob) {
    const n = Math.max(48, Math.min(220, Math.round(R * 0.35)));
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const cs = Math.cos(a), sn = Math.sin(a);
      const rr = R * (1 + wob * (noise2(cs * 1.3 + 5, sn * 1.3 + 5, seed) - 0.5) * 2 + wob * 0.35 * (noise2(cs * 4.6 + 9, sn * 4.6 + 9, seed + 1) - 0.5) * 2);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }

  // ---------- 竖排题字与朱印 ----------
  function charTex(ch, size, col, blur) {
    const fk = fontKey(ch);
    return K.cache('g01ch|' + ch + size + col + (blur || 0) + fk, size * 1.6, size * 1.6, 1, (q) => {
      if (blur && 'filter' in q) q.filter = `blur(${blur * ((XYT.sprites && XYT.sprites.S) || 1)}px)`;
      q.fillStyle = col; q.font = `${size}px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText(ch, size * 0.8, size * 0.8);
      if (blur) q.filter = 'none';
    });
  }
  // 残缺朱印（白文）：两字竖排，右“逍”左“遥”，字形拉长；印泥不匀，边缘缺口
  function sealTex(text, size, col) {
    const fk = fontKey(text);
    return K.cache('g01seal2|' + text + size + col + fk, size * 1.3, size * 1.3, 1.5, (q) => {
      const c0 = size * 0.65, r = rng(1987);
      q.translate(c0, c0);
      q.fillStyle = col;
      q.beginPath();
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const u = i / n, side = Math.min(3, Math.floor(u * 4)), f = u * 4 - side;
        const P = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
        const [ax, ay] = P[side], [bx, by] = P[side + 1];
        const j = (r() - 0.5) * size * 0.035;
        q.lineTo((ax + (bx - ax) * f) * size / 2 + j, (ay + (by - ay) * f) * size / 2 + j);
      }
      q.closePath(); q.fill();
      // 白文：字挖空（每字约占印面 0.48 宽 × 0.9 高）
      q.globalCompositeOperation = 'destination-out';
      q.font = `${size * 0.47}px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      const ch = Array.from(text);
      [[ch[0], size * 0.235], [ch[1], -size * 0.235]].forEach(([c1, x]) => { q.save(); q.translate(x, size * 0.02); q.scale(1, 1.82); q.fillText(c1, 0, 0); q.restore(); });
      // 印泥斑驳、边角残缺
      for (let i = 0; i < 80; i++) { q.globalAlpha = 0.3 + r() * 0.7; q.beginPath(); q.arc((r() - 0.5) * size, (r() - 0.5) * size, 0.4 + r() * 1.5, 0, TAU); q.fill(); }
      q.globalAlpha = 1;
      A.inkBlob(q, size * 0.52, size * 0.5, size * 0.13, 7, 0.4); q.fill();
      A.inkBlob(q, -size * 0.55, -size * 0.18, size * 0.06, 3, 0.5); q.fill();
      q.globalCompositeOperation = 'source-over';
    });
  }


  // ---------- 乌篷船（侧面，船头朝右；原点在船中水线） ----------
  // 船篷是一整段低矮的半筒：半椭圆顶、没有直墙；篾条顺着篷顶弧线走，篷脊一线天光
  function boatTex(col, canopy) {
    return K.cache('g01boat4|' + col + canopy, 320, 120, 1.5, (q) => {
      q.translate(160, 92);
      const dk = mix(col, '#000000', 0.45), lt = mix(col, '#ffffff', 0.18);
      // 船身：两头上翘，船头尖、船尾方
      q.beginPath();
      q.moveTo(-150, -30); q.lineTo(-138, -28);
      q.quadraticCurveTo(-110, 8, -20, 10); q.quadraticCurveTo(90, 10, 152, -34);
      q.lineTo(146, -28); q.quadraticCurveTo(80, -8, 0, -8); q.quadraticCurveTo(-90, -8, -134, -18); q.lineTo(-146, -22);
      q.closePath();
      q.fillStyle = K.lin(q, 0, -34, 0, 12, [[0, lt], [0.5, col], [1, dk]]); q.fill();
      q.strokeStyle = rgba('#efe2c4', 0.35); q.lineWidth = 1.4;
      q.beginPath(); q.moveTo(-140, -24); q.quadraticCurveTo(-60, -9, 0, -9); q.quadraticCurveTo(80, -9, 146, -31); q.stroke();
      q.strokeStyle = rgba('#000000', 0.25); q.lineWidth = 1;
      q.beginPath(); q.moveTo(-120, -2); q.quadraticCurveTo(0, 6, 120, -12); q.stroke();
      // 篷：从 a 到 b 的半椭圆，中间略高
      const a0 = -92, b0 = 70, hh = 31, cx = (a0 + b0) / 2, rx = (b0 - a0) / 2;
      const top = (x) => -8 - hh * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((x - cx) / rx), 2.6)), 0.42);
      const arc = (k) => { q.beginPath(); for (let i = 0; i <= 40; i++) { const x = lerp(a0 + rx * (1 - k), b0 - rx * (1 - k), i / 40); const y = -8 - (-8 - top(lerp(a0, b0, i / 40))) * k; i ? q.lineTo(x, y) : q.moveTo(x, y); } };
      q.beginPath(); q.moveTo(a0, -8);
      for (let i = 0; i <= 48; i++) { const x = lerp(a0, b0, i / 48); q.lineTo(x, top(x)); }
      q.lineTo(b0, -8); q.closePath();
      q.fillStyle = K.lin(q, 0, -8 - hh, 0, -8, [[0, mix(canopy, '#ffffff', 0.22)], [0.35, canopy], [1, mix(canopy, '#000000', 0.4)]]); q.fill();
      q.save(); q.clip();
      // 篾条：顺着篷顶的弧线一道道往下排
      const strip = (dy) => { q.beginPath(); for (let i = 0; i <= 40; i++) { const x = lerp(a0, b0, i / 40); i ? q.lineTo(x, top(x) + dy) : q.moveTo(x, top(x) + dy); } };
      q.strokeStyle = 'rgba(0,0,0,0.3)'; q.lineWidth = 1.1;
      for (let k = 1; k <= 6; k++) { strip(k * 5.5); q.stroke(); }
      q.strokeStyle = 'rgba(230,220,190,0.09)'; q.lineWidth = 0.8;
      for (let k = 1; k <= 6; k++) { strip(k * 5.5 + 2); q.stroke(); }
      // 竹箍：微微弯的竖线（略带俯视）
      q.strokeStyle = 'rgba(0,0,0,0.28)'; q.lineWidth = 1.6;
      for (let k = 1; k < 7; k++) { const x = lerp(a0, b0, k / 7); q.beginPath(); q.moveTo(x, top(x) - 2); q.quadraticCurveTo(x + (x - cx) * 0.06, (top(x) - 8) / 2, x, -8); q.stroke(); }
      q.restore();
      // 篷脊一线天光
      q.strokeStyle = 'rgba(240,232,210,0.5)'; q.lineWidth = 1.3;
      q.beginPath(); for (let i = 0; i <= 30; i++) { const x = lerp(a0 + rx * 0.35, b0 - rx * 0.35, i / 30); i ? q.lineTo(x, top(x) + 1.5) : q.moveTo(x, top(x) + 1.5); } q.stroke();
    });
  }
  function drawBoat(g, x, y, s, rot, col, canopy) {
    const img = boatTex(col, canopy);
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
    g.drawImage(img, -160, -92, 320, 120);
    g.restore();
  }

  // 马头墙：山墙朝外的白墙，墙头层层叠落，每级墨瓦压顶、檐角上翘
  function gableHouse(q, cx, base, w, h, steps, o) {
    const sh = o.stepH || 24, segW = w / (steps * 2 + 1), wall = o.wall || '#efe9dd', tile = o.tile || '#34393f';
    const tops = [];
    for (let i = 0; i <= steps * 2; i++) { const lv = steps - Math.abs(i - steps); tops.push([cx - w / 2 + i * segW, cx - w / 2 + (i + 1) * segW, base - h - lv * sh]); }
    q.beginPath(); q.moveTo(cx - w / 2, base);
    for (const [x0, x1, y] of tops) { q.lineTo(x0, y); q.lineTo(x1, y); }
    q.lineTo(cx + w / 2, base); q.closePath();
    q.fillStyle = K.lin(q, cx - w / 2, 0, cx + w / 2, 0, [[0, A.mix(wall, '#b9b2a4', 0.35)], [0.55, wall], [1, A.mix(wall, '#fff3dc', 0.5)]]); q.fill();
    q.save(); q.clip();
    // 雨痕
    const r = rng(o.seed || 1);
    for (let i = 0; i < 18; i++) { const x = cx - w / 2 + r() * w, y = base - h - r() * 20, l = 30 + r() * 90; q.fillStyle = K.lin(q, 0, y, 0, y + l, [[0, 'rgba(70,64,56,0.16)'], [1, 'rgba(70,64,56,0)']]); q.fillRect(x, y, 2 + r() * 5, l); }
    q.fillStyle = K.lin(q, 0, base - 26, 0, base, [[0, 'rgba(110,104,96,0)'], [1, 'rgba(90,88,84,0.55)']]); q.fillRect(cx - w / 2, base - 26, w, 26);
    q.restore();
    // 墙头墨瓦与上翘的檐角
    for (const [x0, x1, y] of tops) {
      q.fillStyle = tile; q.fillRect(x0 - 5, y - 9, x1 - x0 + 10, 10);
      q.fillStyle = 'rgba(0,0,0,0.25)'; q.fillRect(x0 - 5, y, x1 - x0 + 10, 3);
      q.strokeStyle = 'rgba(255,240,210,0.35)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(x0 - 5, y - 9); q.lineTo(x1 + 5, y - 9); q.stroke();
      q.strokeStyle = 'rgba(0,0,0,0.3)'; q.lineWidth = 1;
      for (let x = x0 - 2; x < x1 + 4; x += 6) { q.beginPath(); q.moveTo(x, y - 8); q.lineTo(x, y); q.stroke(); }
      for (const [ex, dir] of [[x0 - 5, -1], [x1 + 5, 1]]) { q.fillStyle = tile; q.beginPath(); q.moveTo(ex, y - 9); q.quadraticCurveTo(ex + dir * 6, y - 11, ex + dir * 9, y - 18); q.lineTo(ex + dir * 6, y - 8); q.lineTo(ex, y + 1); q.closePath(); q.fill(); }
    }
    if (o.win) { const [wx, wy, ww, wh] = o.win; q.fillStyle = '#2e2a26'; q.fillRect(wx, wy, ww, wh); q.strokeStyle = 'rgba(200,180,140,0.5)'; q.lineWidth = 1; for (let k = 1; k < 4; k++) { q.beginPath(); q.moveTo(wx + (k * ww) / 4, wy); q.lineTo(wx + (k * ww) / 4, wy + wh); q.stroke(); } q.fillStyle = '#4a4440'; q.fillRect(wx - 3, wy - 4, ww + 6, 4); }
    if (o.door) { const [dx, dw, dh] = o.door; q.fillStyle = '#2a2420'; q.fillRect(dx, base - dh, dw, dh); q.fillStyle = '#3a3430'; q.fillRect(dx - 6, base - dh - 10, dw + 12, 8); }
  }

  // ---------- 褪色酒旗（贴图 + 逐条形变） ----------
  // 贴图：x 为从旗杆到旗尾，y 为沿旗杆方向；暖白旧布、褪色的赭红镶边、淡了的“酒”字、旗尾毛边
  function flagTex() {
    const fk = fontKey('酒');
    return K.cache('g01flag|' + fk, 220, 300, 2, (q) => {
      const w = 220, h = 300, r = rng(2005);
      q.fillStyle = '#ecdcb0'; q.fillRect(0, 0, w - 14, h);
      // 旗尾毛边
      q.beginPath(); q.moveTo(w - 16, 0);
      for (let i = 0; i <= 12; i++) { const y = (i / 12) * h; q.lineTo(w - 14 + (i % 2 ? 12 : 2) + (r() - 0.5) * 3, y); }
      q.lineTo(w - 16, h); q.closePath(); q.fill();
      // 水渍与日晒的浓淡
      for (let i = 0; i < 24; i++) A.softBlob(q, r() * w, r() * h, 20 + r() * 50, 0.08 + r() * 0.08, r() < 0.5 ? '#c9a46a' : '#fff6dc');
      // 褪色镶边
      q.strokeStyle = 'rgba(190,96,42,0.75)'; q.lineWidth = 9; q.strokeRect(10, 10, w - 40, h - 20);
      q.strokeStyle = 'rgba(160,80,40,0.35)'; q.lineWidth = 2; q.strokeRect(22, 22, w - 64, h - 44);
      // “酒”字：墨色褪成赭褐
      q.globalAlpha = 0.72; q.fillStyle = '#4a2e1c'; q.font = `150px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText('酒', (w - 30) / 2, h / 2 + 4);
      q.globalAlpha = 1;
      // 几处磨薄的布和小破洞
      q.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 40; i++) { q.globalAlpha = 0.15 + r() * 0.25; q.beginPath(); q.arc(r() * w, r() * h, 2 + r() * 9, 0, TAU); q.fill(); }
      q.globalAlpha = 0.9; A.inkBlob(q, w - 40, h * 0.72, 5, 3, 0.5); q.fill(); A.inkBlob(q, w - 70, h * 0.2, 3, 8, 0.5); q.fill();
      q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    });
  }
  // 旗：hoist 沿 (x0,y0)→(x1,y1) 系在杆上；fly(u) 返回第 u 段旗面的朝向角（0 向右、PI/2 向下）；len 旗长；返回旗尾中点
  // 透光版：同一面旗提亮偏暖（逆光时叠在旗上）
  function flagLitTex() {
    const src = flagTex();
    return K.cache('g01flaglit|' + fontKey('酒'), 220, 300, 2, (q) => {
      q.drawImage(src, 0, 0, 220, 300);
      q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(255,238,196,0.62)'; q.fillRect(0, 0, 220, 300);
    });
  }
  function flagTone(kind) {
    const src = flagTex();
    return K.cache('g01flag' + kind + '|' + fontKey('酒'), 220, 300, 2, (q) => {
      q.drawImage(src, 0, 0, 220, 300);
      q.globalCompositeOperation = 'source-atop'; q.fillStyle = kind === 'dk' ? '#6a5034' : '#fff6e0'; q.fillRect(0, 0, 220, 300);
    });
  }
  // 大幅的旗：先在低分辨率缓冲里按条画好，再整块贴回（逐条斜切的贴图在软件渲染下很贵）
  function drawFlagLo(g, x0, y0, x1, y1, len, ang, o) {
    const n = o.n || 26, hx = x1 - x0, hy = y1 - y0;
    let px = 0, py = 0, bx0 = Math.min(x0, x1), by0 = Math.min(y0, y1), bx1 = Math.max(x0, x1), by1 = Math.max(y0, y1);
    for (let i = 0; i < n; i++) {
      const an = ang((i + 0.5) / n); px += Math.cos(an) * len / n; py += Math.sin(an) * len / n;
      for (const [qx, qy] of [[x0 + px, y0 + py], [x1 + px, y1 + py]]) { bx0 = Math.min(bx0, qx); by0 = Math.min(by0, qy); bx1 = Math.max(bx1, qx); by1 = Math.max(by1, qy); }
    }
    bx0 = Math.floor(bx0 - 6); by0 = Math.floor(by0 - 6); bx1 = Math.ceil(bx1 + 6); by1 = Math.ceil(by1 + 6);
    const B = buf('g01flaglo', bx1 - bx0, by1 - by0, o.res), q = B.q;
    q.translate(-bx0, -by0);
    const end = drawFlag(q, x0, y0, x1, y1, len, ang, Object.assign({}, o, { res: 0 }));
    g.drawImage(B.cv, 0, 0, B.pw, B.ph, bx0, by0, bx1 - bx0, by1 - by0);
    return end;
  }
  function drawFlag(g, x0, y0, x1, y1, len, ang, o) {
    if (o.res) return drawFlagLo(g, x0, y0, x1, y1, len, ang, o);
    const img = flagTex(), n = o.n || 26, iw = img.width, ih = img.height, lit = o.lit ? flagLitTex() : null, dk = flagTone('dk'), lt = flagTone('lt');
    const q0 = g.imageSmoothingQuality;
    g.imageSmoothingQuality = 'low';
    const hx = x1 - x0, hy = y1 - y0, m = g.getTransform();
    let px = 0, py = 0;
    const a0 = g.globalAlpha;
    // 褶的明暗：按该段的转角取值，叠一层压暗或提亮的同形贴图
    const fold = (u) => (ang(Math.min(1, u + 0.5 / n)) - ang(Math.max(0, u - 0.5 / n))) * n * 0.06;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, an = ang(u), dl = len / n;
      const ex = Math.cos(an) * dl, ey = Math.sin(an) * dl;
      // 条带：列 [i/n, (i+1)/n] 映射到以 (ex,ey) 与旗杆方向为两边的平行四边形
      const sx = (i / n) * iw, sw = iw / n + 0.8;
      g.setTransform(m.a * ex + m.c * ey, m.b * ex + m.d * ey, m.a * hx + m.c * hy, m.b * hx + m.d * hy, m.a * (x0 + px) + m.c * (y0 + py) + m.e, m.b * (x0 + px) + m.d * (y0 + py) + m.f);
      g.globalAlpha = a0;
      g.drawImage(img, sx, 0, sw, ih, 0, 0, 1.04, 1);
      const f = fold(u);
      if (f > 0.02) { g.globalAlpha = a0 * Math.min(0.3, f); g.drawImage(dk, sx, 0, sw, ih, 0, 0, 1.04, 1); }
      else if (f < -0.02) { g.globalAlpha = a0 * Math.min(0.35, -f * 0.8); g.drawImage(lt, sx, 0, sw, ih, 0, 0, 1.04, 1); }
      if (lit) { const la = o.lit(x0 + px + ex / 2 + hx / 2, y0 + py + ey / 2 + hy / 2); if (la > 0.02) { g.globalAlpha = a0 * la; g.drawImage(lit, sx, 0, sw, ih, 0, 0, 1.04, 1); } }
      px += ex; py += ey;
    }
    g.imageSmoothingQuality = q0;
    g.setTransform(m); g.globalAlpha = a0;
    return [x0 + px + hx / 2, y0 + py + hy / 2];
  }

  // ======================================================================
  // in1_ink 墨开山河：宣纸上一滴墨落下，湿边逐拍外扩，四层淡墨远山依次显影；墨团渐渐化进山里，只留一轮淡墨日；标题逐字晕开，朱印落下
  // ======================================================================
  const IN1 = { x: 430, y: 300 };
  const G1 = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  // 四层山：env 是沿 x 的高度系数（主峰压在墨滴正下方，向右层层跌落，给题字留白）
  const MTN1 = [
    { kind: 'far', color: '#d3dbe1', light: '#f4f2ec', y: 552, scaleY: 0.5, seed: 44, off: 60, mist: 556,
      env: (x) => 0.62 + 0.55 * G1(x, 640, 260) + 0.35 * G1(x, 120, 200) - 0.25 * smooth((x - 900) / 300) },
    { kind: 'far', color: '#aab9c4', light: '#e8ebea', y: 604, scaleY: 0.56, seed: 5, off: 30, mist: 610,
      env: (x) => 0.55 + 0.75 * G1(x, 330, 230) + 0.25 * G1(x, 820, 180) - 0.2 * smooth((x - 950) / 250) },
    { kind: 'mid', color: '#7d909e', light: '#c9d2d6', y: 672, scaleY: 0.6, seed: 22, off: -40, mist: 680,
      env: (x) => 0.42 + 1.0 * G1(x, 450, 190) + 0.22 * G1(x, 760, 170) - 0.12 * smooth((x - 1000) / 200) },
    { kind: 'near', color: '#4f606c', light: '#8fa0aa', y: 776, scaleY: 0.66, seed: 19, off: 220, mist: 0,
      env: (x) => 0.45 + 0.36 * G1(x, 150, 300) + 0.16 * G1(x, 1180, 170) },
  ];
  const EMAX = 1.45;
  // 每层只缓存它占到的那一条；按 env 逐列压低（1 设备像素一列），山形在主峰处最高
  const mBox = (L) => { const y0 = Math.floor(L.y - 380 * L.scaleY * EMAX * 0.88) - 6, y1 = Math.min(H + 10, L.y); return [y0, y1]; };
  function mtnLayer1(k) {
    const L = MTN1[k], [y0, y1] = mBox(L), hT = 380 * L.scaleY * EMAX;
    return K.cache('g01m1b|' + k, W + 120, y1 - y0, 0.5, (q) => {
      const S = ((XYT.sprites && XYT.sprites.S) || 1) * 0.5;
      const tc = document.createElement('canvas'); tc.width = Math.ceil((W + 120) * S); tc.height = Math.ceil((hT + 6) * S);
      const tq = tc.getContext('2d'); tq.scale(S, S); tq.translate(60, 0);
      E.mountains(tq, { t: 0, lightDir: 1, occlude: false, layers: [{ kind: L.kind, color: L.color, light: L.light, litA: 0.55, y: hT + 6, scaleY: L.scaleY * EMAX, seed: L.seed, offset: L.off, speed: 0, fog: false }] });
      // 先垫一层与山同形的纸色（山不透明，后层不透出来），再贴墨色
      q.translate(0, -y0);
      const cols = Math.ceil((W + 120) * S), hs = (hT + 6) * S;
      for (let i = 0; i < cols; i++) {
        const x = i / S - 60, f = clamp(L.env(x) / EMAX, 0.05, 1), hh = (hT + 6) * f;
        q.drawImage(tc, i, 0, 1, hs, x + 60, L.y - hh, 1 / S + 0.02, hh);
      }
      // 山脚化进纸色的雾里
      q.globalCompositeOperation = 'destination-out';
      q.fillStyle = K.lin(q, 0, L.y - 120, 0, L.y, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
      q.fillRect(0, L.y - 120, W + 120, 140);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 软边显影：低分辨率遮罩里叠几圈不规则的同心墨晕（lighter 相加，外缘约 140 px 渐隐），放大后与山层相乘
  function in1Reveal(g, k, R, dev, t) {
    const L = MTN1[k], [y0, y1] = mBox(L), h = y1 - y0, img = mtnLayer1(k);
    const cx = IN1.x, cy = IN1.y + 60;
    const dx = Math.max(cx + 60, W + 60 - cx), dy = Math.max(Math.abs(y0 - cy), Math.abs(y1 - cy));
    const mistIn = (q) => { if (L.mist) E.mist(q, { t, y: L.mist, h: 84, color: '#f3eee2', alpha: 0.8, speed: k % 2 ? -5 : 7, seed: 3 + k * 2 }); };
    if (R - 150 > Math.hypot(dx, dy)) {
      g.globalAlpha = dev; g.drawImage(img, -60, y0, W + 120, h); g.globalAlpha = 1;
      mistIn(g);
      return;
    }
    // 只处理显影圈覆盖到的那一块
    const bx0 = Math.floor(Math.max(-60, cx - R)), bx1 = Math.ceil(Math.min(W + 60, cx + R)), by0 = Math.floor(Math.max(y0, cy - R));
    if (bx1 - bx0 < 4 || y1 - by0 < 4) return;
    const bw = bx1 - bx0, bh = y1 - by0;
    const M = buf('in1mask', bw, bh, 0.2), mq = M.q;
    mq.translate(-bx0, -by0);
    mq.globalCompositeOperation = 'lighter'; mq.fillStyle = '#ffffff';
    for (let j = 0; j < 6; j++) { mq.globalAlpha = 1 / 6; blobPath(mq, cx, cy, Math.max(2, R - j * 26), 11 + k * 5, 0.11); mq.fill(); }
    const B = buf('in1lay', bw, bh, 0.5), bq = B.q, ks = img.width / (W + 120);
    bq.drawImage(img, (bx0 + 60) * ks, (by0 - y0) * ks, bw * ks, bh * ks, 0, 0, bw, bh);
    bq.save(); bq.translate(-bx0, -by0); mistIn(bq); bq.restore();
    bq.globalCompositeOperation = 'destination-in';
    bq.drawImage(M.cv, 0, 0, M.pw, M.ph, 0, 0, bw, bh);
    bq.globalCompositeOperation = 'source-over';
    g.globalAlpha = dev; g.drawImage(B.cv, 0, 0, B.pw, B.ph, bx0, by0, bw, bh); g.globalAlpha = 1;
  }
  // 湿边：断续、宽窄浓淡不一的一圈水痕
  function in1WetEdge(g, R, seed, a) {
    const cx = IN1.x, cy = IN1.y + 60, n = 20;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const nz = noise1(i * 0.7 + seed * 3.1, seed), nz2 = noise1(i * 1.3 + 40, seed + 2);
      if (nz < 0.32) continue;
      const a0 = (i / n) * TAU, a1 = a0 + (TAU / n) * (0.6 + 0.5 * nz2);
      g.beginPath();
      for (let s = 0; s <= 6; s++) {
        const an = lerp(a0, a1, s / 6), cs = Math.cos(an), sn = Math.sin(an);
        const rr = R * (1 + 0.11 * (noise2(cs * 1.3 + 5, sn * 1.3 + 5, seed) - 0.5) * 2 + 0.11 * 0.35 * (noise2(cs * 4.6 + 9, sn * 4.6 + 9, seed + 1) - 0.5) * 2) - 18;
        s ? g.lineTo(cx + cs * rr, cy + sn * rr) : g.moveTo(cx + cs * rr, cy + sn * rr);
      }
      g.strokeStyle = rgba('#7f8f9b', a * (0.03 + 0.05 * nz2) / 0.08);
      g.lineWidth = 8 + 16 * nz;
      g.stroke();
    }
  }
  // 毛细墨丝：墨团下缘沿纸纤维往下渗到山脊，细、抖、分叉
  function in1Capillary(g, k, age, t, c0) {
    const r = rng(500 + k * 17);
    const x0 = IN1.x + (k - 1.5) * 34 + (r() - 0.5) * 20, y0 = IN1.y + 92 + r() * 14;
    const len = 70 + k * 26 + r() * 30, grow = easeOut(clamp(age / 0.9)), fade = (1 - smooth((age - 1.2) / 1.0)) * (1 - smooth((t - c0) / 0.6));
    if (fade <= 0 || grow <= 0) return;
    const pts = [];
    let x = x0, y = y0, ang = PI / 2 + (r() - 0.5) * 0.7;
    const N = 18, n = Math.max(2, Math.round(N * grow));
    for (let i = 0; i <= n; i++) {
      pts.push([x, y]);
      ang += (noise1(i * 0.6 + k * 7, 91) - 0.5) * 0.9;
      ang = lerp(ang, PI / 2, 0.15);
      x += Math.cos(ang) * len / N; y += Math.sin(ang) * len / N;
    }
    const line = (w, a, col) => { g.strokeStyle = rgba(col, a); g.lineWidth = w; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    line(5, 0.07 * fade, '#55626c');
    line(2.2, 0.1 * fade, '#3a444c');
    line(0.9, 0.3 * fade, '#2c343b');
    // 一两根分叉
    for (let b = 0; b < 2; b++) {
      const i0 = Math.floor(pts.length * (0.35 + b * 0.25));
      if (i0 >= pts.length - 1) continue;
      const [bx, by] = pts[i0], sd = b ? 1 : -1, L2 = len * 0.28 * grow;
      g.strokeStyle = rgba('#2c343b', 0.28 * fade); g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + sd * L2 * 0.4, by + L2 * 0.4, bx + sd * L2 * 0.55, by + L2 * 0.9); g.stroke();
    }
    // 渗到头处一小点洇开
    const [ex, ey] = pts[pts.length - 1];
    A.softBlob(g, ex, ey, 7 + 5 * grow, 0.22 * fade, '#3a444c');
  }
  // 竖排题字：自上而下、带噪声边的遮罩里显出清晰字形；外圈一道淡淡的晕，晕开后留着
  function in1Char(g, ch, cx, cy, age) {
    const sz = 96, w = sz * 1.6;
    const sharp = charTex(ch, sz, '#1a2026', 0), halo1 = charTex(ch, sz, '#2a3036', 1.6), halo2 = charTex(ch, sz, '#2a3036', 4);
    const ha = 0.15 * smooth(age / 0.5), hs = smooth((age - 0.1) / 0.8);
    g.globalAlpha = ha * (1 - hs); g.drawImage(halo1, cx - w / 2, cy - w / 2, w, w);
    g.globalAlpha = ha * hs * 1.3; g.drawImage(halo2, cx - w / 2, cy - w / 2, w, w);
    g.globalAlpha = 1;
    const p = clamp(age / 0.3);
    if (p >= 1) { g.drawImage(sharp, cx - w / 2, cy - w / 2, w, w); return; }
    const B = buf('in1ch', w, w, 1), q = B.q;
    q.drawImage(sharp, 0, 0, w, w);
    q.globalCompositeOperation = 'destination-in';
    q.fillStyle = '#ffffff';
    const front = lerp(w * 0.12, w * 0.95, easeOut(p));
    // 三层噪声边，叠成约 16 px 的软前沿
    const M = buf('in1chm', w, w, 0.5), mq = M.q;
    mq.globalCompositeOperation = 'lighter'; mq.fillStyle = '#ffffff';
    for (let j = 0; j < 3; j++) {
      mq.globalAlpha = 1 / 3;
      mq.beginPath(); mq.moveTo(0, 0); mq.lineTo(w, 0);
      for (let s = 8; s >= 0; s--) { const x = (s / 8) * w; mq.lineTo(x, front - j * 8 + 12 * (noise1(x * 0.05 + ch.charCodeAt(0) * 0.1, 7) - 0.5) * 2); }
      mq.closePath(); mq.fill();
    }
    q.drawImage(M.cv, 0, 0, M.pw, M.ph, 0, 0, w, w);
    q.globalCompositeOperation = 'source-over';
    g.drawImage(B.cv, 0, 0, B.pw, B.ph, cx - w / 2, cy - w / 2, w, w);
  }
  XYT.registerShot('in1_ink', {
    name: '墨开山河', zone: 'right', night: false, text: '#1a2026', shadow: 'rgba(242,236,222,0.85)', accent: '#c91f37', bloom: 0.12,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      // 黑场时顺手把本组的静态贴图建好（每帧最多建一张，之后的镜头第一帧不再卡）
      if (lt < 0.62) warmSome(6);
      const d0 = downIdx0(c), tDrop = c.grid.time(d0), tTitle = c.grid.time(d0 + 4), tSeal = c.grid.time(d0 + 6);
      const sinceDrop = t - tDrop, sinceSeal = t - tSeal;
      // 朱印落下时纸面轻震一下
      const shake = sinceSeal > 0 ? 2.2 * Math.exp(-sinceSeal / 0.09) * Math.sin(sinceSeal * 90) : 0;
      g.save();
      g.translate(shake * 0.6, shake);
      // 纸：最近邻贴（满屏插值很贵；纸纹颗粒本来就每秒换 12 次，看不出）
      blitN(g, paperTex('#f2ecde'), -40, -40, W + 80, H + 80);
      // 最远一层背后洇一抹淡青的天光
      const a0 = smooth((t - c.grid.time(d0 + 1)) / 2.4);
      if (a0 > 0) { g.globalAlpha = a0; g.fillStyle = K.lin(g, 0, 380, 0, 560, [[0, 'rgba(184,200,212,0)'], [0.7, 'rgba(184,200,212,0.3)'], [1, 'rgba(184,200,212,0)']]); g.fillRect(-60, 380, W + 120, 180); g.globalAlpha = 1; }
      // 淡墨日：墨团退去后留下的一轮光滑淡影
      const sunA = smooth((sinceDrop - 1.2) / 2.6);
      if (sunA > 0) {
        g.fillStyle = K.rad(g, IN1.x, IN1.y, 0, 66, [[0, rgba('#9aa4ab', 0.3 * sunA)], [0.72, rgba('#9aa4ab', 0.24 * sunA)], [0.9, rgba('#9aa4ab', 0.1 * sunA)], [1, rgba('#9aa4ab', 0)]]);
        g.beginPath(); g.arc(IN1.x, IN1.y, 66, 0, TAU); g.fill();
      }
      // 远山：每拍一层，从墨滴处随湿边向外显影
      for (let k = 0; k < 4; k++) {
        const tk = c.grid.time(d0 + 1 + k), age = t - tk;
        if (age <= 0) continue;
        const R = 40 + 1250 * easeOut(clamp(age / 2.3)) + age * 30;
        const dev = 0.4 + 0.6 * smooth(age / 2.4);
        in1Reveal(g, k, R, dev, t);
        const ea = (1 - smooth(age / 1.9)) * smooth(age / 0.15) * (1 - smooth((R - 380) / 380));
        if (ea > 0.01) in1WetEdge(g, R, 11 + k * 5, ea * 0.08);
      }
      // 墨滴：落下前是一粒越来越大的墨珠和它的影子
      if (sinceDrop < 0 && sinceDrop > -0.6) {
        const u = 1 + sinceDrop / 0.6, r = lerp(2, 12, u * u);
        g.fillStyle = rgba('#3a3226', 0.18 * u); g.beginPath(); g.ellipse(IN1.x + 30 * (1 - u), IN1.y + 22 * (1 - u), r * 1.3, r * 1.1, 0, 0, TAU); g.fill();
        g.fillStyle = rgba('#14110e', 0.9 * smooth(u * 3)); g.beginPath(); g.arc(IN1.x, IN1.y, r, 0, TAU); g.fill();
        g.fillStyle = rgba('#ffffff', 0.35 * u); g.beginPath(); g.arc(IN1.x - r * 0.35, IN1.y - r * 0.35, r * 0.28, 0, TAU); g.fill();
      }
      if (sinceDrop >= 0) {
        // 主墨晕：随四层山显影慢慢退尽（墨“化”进山里）
        const ba = 1 - smooth((lt - 1.5) / 2.5);
        if (ba > 0.003) {
          g.save(); g.globalAlpha = ba;
          V.inkBloom(g, c, { kind: 'paper', x: IN1.x, y: IN1.y, t0: tDrop, r: 150, dur: 2.6, hold: 30, color: '#1d2228', seed: 4, alpha: 0.95 });
          g.restore();
        }
        // 毛细墨丝：每层山显影时，墨团下缘渗出一根，渗到山脊后淡去
        for (let k = 0; k < 4; k++) { const age = t - c.grid.time(d0 + 1 + k) + 0.15; if (age > 0) in1Capillary(g, k, age, t, shotStart(c) + 3.6); }
        // 溅开的墨点：软边小点，很快淡尽
        const sa = 1 - smooth((lt - 0.9) / 0.6);
        if (sa > 0) {
          const r = rng(4242);
          for (let i = 0; i < 16; i++) {
            const an = r() * TAU, dist = 34 + Math.pow(r(), 1.6) * 170, rr = (1.4 + r() * 3.4) * (1.2 - dist / 300);
            const q = easeOut(clamp(sinceDrop / 0.18));
            const px = IN1.x + Math.cos(an) * dist * q, py = IN1.y + Math.sin(an) * dist * q * 0.9;
            A.softBlob(g, px, py, rr * (1.6 + 1.2 * smooth(sinceDrop / 0.6)), 0.55 * sa, '#2a3036');
          }
        }
      }
      // 金箔屑：逐拍一闪（按亮度分两档合批画）
      const be = c.be(0.4);
      for (const hi of [0, 1]) {
        g.beginPath();
        for (let i = 0; i < 46; i++) {
          const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (0.8 + h2(i, 94)) + i), 4) + (h2(i, 96) < 0.3 ? be : 0);
          if ((tw > 0.6) !== !!hi) continue;
          const x = h2(i, 91) * W, y = h2(i, 92) * H, sz = 0.8 + h2(i, 93) * 2.2, an = h2(i, 95) * TAU, ca = Math.cos(an), sn = Math.sin(an);
          const ux = ca * sz, uy = sn * sz, vx = -sn * sz * 0.6, vy = ca * sz * 0.6;
          g.moveTo(x - ux - vx, y - uy - vy); g.lineTo(x + ux - vx, y + uy - vy); g.lineTo(x + ux + vx, y + uy + vy); g.lineTo(x - ux + vx, y - uy + vy); g.closePath();
        }
        g.fillStyle = hi ? 'rgba(232,199,110,0.8)' : 'rgba(191,154,76,0.55)'; g.fill();
      }
      // 标题“逍遥叹”：自上而下逐字晕开，每字 0.3 s
      ['逍', '遥', '叹'].forEach((ch, k) => {
        const age = t - (tTitle + k * 0.3);
        if (age > 0) in1Char(g, ch, 1080, 210 + k * 104, age);
      });
      // 落款小字：与第三个字一同淡入
      const ca2 = smooth((t - tTitle - 0.6) / 0.7);
      if (ca2 > 0) {
        g.globalAlpha = 0.72 * ca2; g.fillStyle = '#50616d'; g.font = `22px ${XYT.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        Array.from('仙剑奇侠传').forEach((ch, i) => g.fillText(ch, 996, 196 + i * 26));
        g.globalAlpha = 1;
      }
      // 朱印：1.15 → 1 落下，带 2° 斜
      if (sinceSeal > 0) {
        const q = easeIn(clamp(sinceSeal / 0.16)), s = lerp(1.15, 1, q);
        const img = sealTex('逍遥', 76, '#c91f37');
        g.save(); g.translate(1080, 548); g.rotate(-0.035); g.scale(s, s);
        g.globalAlpha = lerp(0.3, 0.92, q);
        g.drawImage(img, -img.lw / 2, -img.lh / 2, img.lw, img.lh);
        g.restore();
      }
      grain(g, t, 0.55);
      g.restore();
      // 黑场淡入
      if (lt < 0.6) { g.fillStyle = `rgba(6,6,8,${1 - smooth(lt / 0.6)})`; g.fillRect(-20, -20, W + 40, H + 40); }
    },
  });

  // ======================================================================
  // in2_yuhang 余杭晨雾：平远长卷，镜头向右横移；乌篷船滑过镜面河，雁阵掠过桥顶，第一阵风吹弯芦苇
  // ======================================================================
  const IN2 = { hz: 436, pre: 1.2, pan: 240, sunX: 1100, sunY: 138 };
  // 远景（天、日、云、远山）烘成一张，视差 0.08；中景（远排人家、两岸街屋、马头墙、石拱桥）烘成一张，视差 0.4
  function in2Sky() {
    const hz = IN2.hz;
    return K.cache('g01in2sky2', W + 60, hz + 12, 1, (q) => {
      q.translate(30, 0);
      E.sky(q, { stops: [[0, '#b7c6d2'], [0.4, '#dcdfdc'], [0.78, '#f0e6d2'], [1, '#f6e2bf']], y1: hz + 10, haze: '#f8dcaa', hazeY: hz, hazeA: 0.55, glow: { x: IN2.sunX, y: IN2.sunY, r: 640, color: '#ffd890', a: 0.5 } });
      // 右侧地平线上一团暖金
      A.softBlob(q, 1080, hz - 40, 640, 0.36, '#ffd496');
      E.sun(q, { x: IN2.sunX, y: IN2.sunY, r: 22, color: '#fff3d6', glow: 0.6, alpha: 0.85 });
      E.clouds(q, { t: 0, y: 108, color: '#fff3dc', shade: '#c0c9d2', alpha: 0.5, scale: 0.9, n: 3, seed: 6, speed: 0, spread: 50, lightX: IN2.sunX });
      E.clouds(q, { t: 0, y: 236, color: '#f8f1e2', shade: '#c7ccd0', alpha: 0.3, scale: 0.7, n: 3, seed: 19, speed: 0, spread: 30, lightX: IN2.sunX });
      E.mountains(q, { t: 0, lightDir: 1, fog: '#e9e8e2', fogA: 0.55, layers: [
        { kind: 'far', color: '#c3cfd8', light: '#f6e9d2', litA: 0.55, y: hz - 30, scaleY: 0.72, seed: 41, offset: 300, speed: 0, fogH: 110, fogY: 20 },
        { kind: 'mid', color: '#a9bac7', light: '#ecdcc0', litA: 0.5, y: hz - 18, scaleY: 0.55, seed: 14, offset: 820, speed: 0, fogH: 100, fogY: 16 },
        { kind: 'far', color: '#93a7b6', light: '#dfd2bb', litA: 0.45, y: hz - 6, scaleY: 0.4, seed: 9, offset: 1300, speed: 0, fogH: 80, fogY: 10 },
      ] });
    });
  }
  const IN2M = { y0: IN2.hz - 230, x0: -60, bx: 860 };
  function in2Mid() {
    const hz = IN2.hz, y0 = IN2M.y0;
    return K.cache('g01in2mid3', W + 220, hz + 22 - y0, 1, (q) => {
      q.translate(60, -y0);
      // 远排人家：更小、更淡，融在雾里
      E.jiangnanTown(q, { t: 0, y: hz - 14, x0: -60, x1: 1440, scale: 0.42, seed: 23, color: '#e9ecea', roof: '#6a7480', haze: '#cfd8de', hazeA: 0.45, smoke: 0, bank: false });
      q.fillStyle = K.lin(q, 0, hz - 60, 0, hz - 6, [[0, 'rgba(236,236,230,0)'], [1, 'rgba(236,236,230,0.85)']]); q.fillRect(-60, hz - 60, 1500, 56);
      // 几座高出屋面的马头墙，层层叠落，高低错开
      const gab = [[60, 0.66, 3], [300, 0.75, 7], [520, 0.6, 11], [1190, 0.7, 13], [1330, 0.62, 17]];
      for (const [gx, sc, sd] of gab) {
        gableHouse(q, gx, hz - 4, 150 * sc, 92 * sc, 2, { wall: '#eceee9', tile: '#4f5862', seed: sd, stepH: 22 * sc, win: [gx - 14 * sc, hz - 4 - 64 * sc, 22 * sc, 18 * sc] });
      }
      q.fillStyle = 'rgba(214,222,226,0.28)'; q.fillRect(-60, hz - 150, 1500, 150);
      // 两岸街屋，桥在中间偏右
      E.jiangnanTown(q, { t: 0, y: hz - 2, x0: -80, x1: 640, scale: 0.6, seed: 11, color: '#eef0ec', roof: '#47505a', haze: '#c9d4dc', hazeA: 0.08, light: '#fff0d0', lightX: 1100, smoke: 0 });
      E.jiangnanTown(q, { t: 0, y: hz - 2, x0: 1060, x1: 1460, scale: 0.6, seed: 5, color: '#eef0ec', roof: '#47505a', haze: '#c9d4dc', hazeA: 0.08, light: '#fff0d0', lightX: 1100, smoke: 0 });
      // 墙脚薄雾、屋间几团，房子若隐若现（桥一带留得清楚些）
      q.fillStyle = K.lin(q, 0, hz - 70, 0, hz, [[0, 'rgba(240,240,234,0)'], [1, 'rgba(240,240,234,0.7)']]); q.fillRect(-60, hz - 70, 1500, 72);
      const r = rng(77);
      for (let i = 0; i < 26; i++) { const x = r() * 1440 - 40; if (Math.abs(x - IN2M.bx) < 200) continue; A.softBlob(q, x, hz - 30 - r() * 70, 50 + r() * 90, 0.18 + r() * 0.16, r() < 0.3 ? '#fbf0dc' : '#eef0ec'); }
      // 拱洞里透出的对岸暗处（倒影里就成一个完整的圆）；桥后先垫一层，桥画完再压一次（盖住洞里的条石纹）
      const R = 0.86 * 115 * 0.74;
      const hole = (rr, a) => { q.globalAlpha = a; q.fillStyle = K.lin(q, 0, hz + 2 - R, 0, hz + 2, [[0, '#4d585e'], [0.65, '#606c71'], [1, '#8b9597']]); q.beginPath(); q.arc(IN2M.bx, hz + 2, rr, PI, TAU); q.fill(); q.globalAlpha = 1; };
      hole(R + 1, 1);
      E.archBridge(q, { x: IN2M.bx, y: hz + 2, s: 0.74, span: 230, color: '#989c97', haze: '#c9d4dc', hazeA: 0.06 });
      hole(R - 0.6, 0.92);
      // 洞里水面一线微光
      q.fillStyle = 'rgba(236,226,200,0.35)'; q.fillRect(IN2M.bx - R * 0.8, hz - 1, R * 1.6, 2);
    });
  }
  function in2Back(q, camX, refl) {
    // 天与远山很柔，最近邻贴看不出台阶；有清楚轮廓的中景用插值贴，慢摇时不一格一格地跳
    if (refl) q.drawImage(in2Sky(), -30 - camX * 0.08, 0, W + 60, IN2.hz + 12);
    else blitN(q, in2Sky(), -30 - camX * 0.08, 0, W + 60, IN2.hz + 12);
    const m = in2Mid();
    q.drawImage(m, IN2M.x0 - camX * 0.4, IN2M.y0, m.lw, m.lh);
  }
  // 镜面河：远景、中景的倒影各烘成一张（翻转、略糊、压水色、越近越淡），每帧按各自的视差平移、分条轻轻错开
  const IN2W = { y: IN2.hz + 4, h: H + 30 - IN2.hz - 4 };
  function in2Refl(kind) {
    return K.cache('g01in2refl2|' + kind, kind === 'sky' ? W + 60 : W + 220, IN2W.h, 1, (q) => {
      const src = kind === 'sky' ? in2Sky() : in2Mid(), w = kind === 'sky' ? W + 60 : W + 220;
      const S = (XYT.sprites && XYT.sprites.S) || 1;
      if ('filter' in q) q.filter = `blur(${(1.4 * S).toFixed(2)}px)`;
      // 以水线（世界 y = IN2W.y - 8 附近）为轴翻转
      q.save(); q.translate(0, -8); q.scale(1, -1);
      if (kind === 'sky') q.drawImage(src, 0, -IN2W.y, w, IN2.hz + 12);
      else q.drawImage(src, 0, IN2M.y0 - IN2W.y, w, src.lh);
      q.restore();
      q.filter = 'none';
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = K.lin(q, 0, 0, 0, IN2W.h, [[0, 'rgba(206,214,214,0.18)'], [1, 'rgba(120,146,158,0.4)']]); q.fillRect(0, 0, w, IN2W.h);
      q.globalCompositeOperation = 'destination-out';
      q.fillStyle = K.lin(q, 0, 0, 0, IN2W.h, [[0, 'rgba(0,0,0,0.05)'], [0.4, 'rgba(0,0,0,0.28)'], [1, 'rgba(0,0,0,0.72)']]); q.fillRect(0, 0, w, IN2W.h);
      // 远景倒影垫上水的底色（整张不透明，贴的时候不用再铺一次底）
      if (kind === 'sky') { q.globalCompositeOperation = 'destination-over'; q.fillStyle = K.lin(q, 0, 0, 0, IN2W.h, [[0, '#dbe0df'], [1, '#86a0ad']]); q.fillRect(0, 0, w, IN2W.h); }
      q.globalCompositeOperation = 'source-over';
    });
  }
  function in2Water(g, t, camX) {
    const y0 = IN2W.y, h = IN2W.h;
    const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    for (const [kind, x0, par, al] of [['sky', -30, 0.08, 1], ['mid', IN2M.x0, 0.4, 0.92]]) {
      const R = in2Refl(kind), k = R.height / h, rows = 14;
      g.globalAlpha = al;
      for (let i = 0; i < rows; i++) {
        const v0 = Math.pow(i / rows, 1.4), v1 = Math.pow((i + 1) / rows, 1.4), ya = v0 * h, yb = v1 * h;
        const dx = Math.sin(i * 1.9 - t * 1.7) * (0.4 + 2.2 * v0) + Math.sin(i * 0.7 + t * 0.8) * 1.2 * v0;
        g.drawImage(R, 0, ya * k, R.width, (yb - ya) * k + 0.5, x0 - camX * par + dx, y0 + ya, R.lw, yb - ya + 0.5);
      }
    }
    g.globalAlpha = 1; g.imageSmoothingEnabled = sm;
    // 日头下一道碎金
    const gx = IN2.sunX - camX * 0.08 - 20, spr = XYT.sprites.tint(XYT.sprites.glow, '#ffe3a8');
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const u = i / 26, yy = y0 + 4 + Math.pow(u, 1.5) * (h - 30), f = noise1(t * 1.7 + i * 0.8, 5);
      if (f < 0.4) continue;
      const sp = 70 * (0.4 + u * 2), jx = (h2(i, 32) - 0.5) * 2 * sp + Math.sin(t * 1.3 + i) * (2 + u * 8), len = 70 * (0.25 + 0.5 * h2(i, 34)) * (0.5 + u * 1.4);
      g.globalAlpha = Math.min(1, 0.7 * (1.1 - u * 0.75) * (f - 0.4) * 2.2);
      g.drawImage(spr, gx + jx - len / 2, yy - (1 + u * 2), len, 2 + u * 4);
    }
    g.restore();
    // 波光：几道柔边的细亮痕，随水流慢慢横移
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < 12; i++) {
      const u = Math.pow(h2(i, 41), 1.6), yy = y0 + 4 + u * (h - 30), len = (16 + h2(i, 42) * 80) * (0.35 + u * 1.7);
      const x = ((((h2(i, 43) * (W + 300) + t * (5 + 12 * u)) % (W + 300)) + W + 300) % (W + 300)) - 150;
      g.moveTo(x, yy); g.lineTo(x + len, yy);
    }
    g.stroke();
  }
  // 三条雾带：先画进低分辨率缓冲；桥一带减淡一半，日头一侧染暖金、另一侧偏冷
  function in2Mist(g, t, camX) {
    const hz = IN2.hz, y0 = hz - 110, h = 190;
    const B = buf('in2mist', W + 40, h, 0.2), q = B.q;
    q.translate(20, -y0);
    E.mist(q, { t, y: hz - 52, h: 90, color: '#f3efe6', alpha: 0.6, speed: 3, seed: 2 });
    E.mist(q, { t, y: hz + 4, h: 60, color: '#f3f1ea', alpha: 0.7, speed: -6, seed: 4 });
    q.globalCompositeOperation = 'source-atop';
    q.fillStyle = K.lin(q, 0, 0, W, 0, [[0, 'rgba(214,224,230,0.55)'], [0.5, 'rgba(240,236,226,0.2)'], [0.85, 'rgba(250,226,176,0.6)'], [1, 'rgba(250,226,176,0.6)']]);
    q.fillRect(-20, y0, W + 40, h);
    q.globalCompositeOperation = 'destination-out';
    const bx = IN2M.bx + IN2M.x0 + 60 - camX * 0.4;
    q.fillStyle = K.lin(q, bx - 260, 0, bx + 260, 0, [[0, 'rgba(0,0,0,0)'], [0.3, 'rgba(0,0,0,0.5)'], [0.7, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
    q.fillRect(bx - 260, y0, 520, h);
    q.globalCompositeOperation = 'source-over';
    g.drawImage(B.cv, 0, 0, B.pw, B.ph, -20, y0, W + 40, h);
  }
  // 前景芦苇：长叶弯垂、芦花下垂；风到时整株自下而上弯过去
  function reedClump(q, o) {
    const n = o.n, seed = o.seed, t = o.t;
    q.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = lerp(o.x0, o.x1, h2(i, seed)), hh = o.h * (0.55 + 0.45 * h2(i, seed + 1));
      const wv = o.wind(bx), idle = Math.sin(t * 1.1 + bx * 0.013 + i) * 0.04 + Math.sin(t * 2.3 + i * 1.7) * 0.015;
      const bend = idle + wv * (0.55 + 0.25 * h2(i, seed + 2));
      const P = (u) => [bx + Math.sin(bend) * hh * u * u * 0.9 + (h2(i, seed + 3) - 0.5) * 30 * u, o.y - hh * u * (1 - 0.18 * Math.abs(bend) * u)];
      // 叶
      q.fillStyle = o.color;
      for (let k = 0; k < 3; k++) {
        const u0 = 0.15 + k * 0.18 + 0.1 * h2(i * 3 + k, seed + 4), [lx, ly] = P(u0), sd = (h2(i * 3 + k, seed + 5) < 0.5 ? -1 : 1);
        const L = hh * (0.35 + 0.25 * h2(i * 3 + k, seed + 6)), ang = -PI / 2 + sd * (0.5 + 0.4 * h2(i * 3 + k, seed + 7)) + bend * 1.2;
        const ex = lx + Math.cos(ang) * L, ey = ly + Math.sin(ang) * L + L * 0.45, cx = lx + Math.cos(ang) * L * 0.55, cy = ly + Math.sin(ang) * L * 0.55 - 4;
        q.beginPath(); q.moveTo(lx - 3, ly); q.quadraticCurveTo(cx, cy - 4, ex, ey); q.quadraticCurveTo(cx, cy + 4, lx + 3, ly); q.closePath(); q.fill();
      }
      // 秆
      q.strokeStyle = o.color; q.lineWidth = o.w || 4;
      q.beginPath(); const p0 = P(0); q.moveTo(p0[0], p0[1]);
      for (let k = 1; k <= 6; k++) { const pk = P(k / 6); q.lineTo(pk[0], pk[1]); }
      q.stroke();
      // 芦花：一束下垂的细穗，顺风飘向一侧；逆光里透亮
      const [tx, ty] = P(1), dir = Math.sin(bend) * 0.9 + 0.35;
      q.strokeStyle = o.plume; q.lineWidth = 3; q.globalAlpha = 0.7;
      for (let k = 0; k < 6; k++) {
        const L = (34 + 20 * h2(k, i + seed)) * (o.ps || 1), sp = (k - 2.5) * 0.12;
        q.beginPath(); q.moveTo(tx, ty);
        q.quadraticCurveTo(tx + dir * L * 0.6 + sp * 20, ty - 4, tx + dir * L + sp * 30, ty + L * (0.55 - 0.3 * Math.abs(dir)) + k * 2);
        q.stroke();
      }
      q.fillStyle = o.plume; q.globalAlpha = 0.5;
      const pk = o.ps || 1; q.beginPath(); q.ellipse(tx + dir * 18 * pk, ty + 12 * pk, 10 * pk, 19 * pk, -dir * 0.8, 0, TAU); q.fill();
      q.globalAlpha = 1;
    }
  }
  function in2Reeds(g, c, camX) {
    const t = c.t, tg = c.grid.time(downIdx0(c) + 4);
    // 视差 1.2：开镜（lt=0）时高的一丛在左下角，船右边只有压在船底以下的矮苇
    const shift = -(camX - IN2.pan * IN2.pre / (c.dur + IN2.pre)) * 1.2;
    // 风前沿自左向右推进（约 520 px/s）：扫到哪一株，哪一株才弯下
    const wind = (x) => { const arr = tg + (x + 100) / 520, d = t - arr; return 0.1 + (d > 0 ? 0.85 * smooth(d / 0.4) * (0.55 + 0.45 * Math.exp(-d / 1.6)) : 0); };
    const wf = (x) => wind(x + shift);
    const qq = g.imageSmoothingQuality; g.imageSmoothingQuality = 'low';
    // 高的一丛（屏幕 x 300 以左）
    if (180 + shift > -60) {
      const B = buf('in2reeds', 340, 420, 0.2), q = B.q;
      q.translate(40, -300);
      q.fillStyle = K.lin(q, 0, 650, 0, 720, [[0, 'rgba(95,90,76,0)'], [0.6, 'rgba(95,90,76,0.5)'], [1, 'rgba(95,90,76,0.75)']]);
      q.beginPath(); q.moveTo(-40, 690); q.quadraticCurveTo(80 + shift, 650, 280 + shift, 716); q.lineTo(300 + shift, 740); q.lineTo(-40, 740); q.closePath(); q.fill();
      q.globalAlpha = 0.78;
      reedClump(q, { t, x0: 10 + shift, x1: 180 + shift, y: 726, h: 360, n: 9, seed: 17, color: '#7a7462', plume: '#f6e2b0', w: 4, wind: wf });
      reedClump(q, { t, x0: -40 + shift, x1: 130 + shift, y: 750, h: 330, n: 8, seed: 41, color: '#6b6656', plume: '#f3dca4', w: 6, wind: wf });
      q.globalAlpha = 1;
      g.drawImage(B.cv, 0, 0, B.pw, B.ph, -40, 300, 340, 420);
    }
    // 沿画面底边的一溜矮苇（都在船底以下）
    const B2 = buf('in2bank', W + 80, 150, 0.2), q2 = B2.q;
    q2.translate(40, -580);
    q2.globalAlpha = 0.6;
    for (const [a0, a1, n, hh, sd] of [[180, 330, 4, 150, 63], [560, 650, 3, 110, 71], [900, 1060, 4, 135, 77], [1300, 1420, 3, 120, 83]]) {
      reedClump(q2, { t, x0: a0 + shift, x1: a1 + shift, y: 770, h: hh, n, seed: sd, color: '#706a58', plume: '#f4dfaa', w: 3, ps: 0.6, wind: wf });
    }
    q2.globalAlpha = 1;
    g.drawImage(B2.cv, 0, 0, B2.pw, B2.ph, -40, 580, W + 80, 150);
    g.imageSmoothingQuality = qq;
  }
  // 前景柳枝：从右上角垂下几缕，失焦、逆光（视差 1.2）
  function in2Willow(g, t, camX, tg) {
    const B = buf('in2wil', 600, 320, 0.4), q = B.q;
    const ox = 1210 - camX * 1.2;
    q.translate(-680, 0);
    q.lineCap = 'round';
    // 一根斜出的枝，柳丝从枝上垂下
    q.strokeStyle = 'rgba(70,62,46,0.9)'; q.lineWidth = 5;
    q.beginPath(); q.moveTo(ox + 190, -40); q.bezierCurveTo(ox + 90, -6, ox - 20, 36, ox - 150, 22); q.stroke();
    q.lineWidth = 2.5; q.beginPath(); q.moveTo(ox - 20, 24); q.quadraticCurveTo(ox - 60, 34, ox - 110, 48); q.stroke();
    for (let i = 0; i < 14; i++) {
      const u0 = h2(i, 3), sx = lerp(ox + 120, ox - 150, u0), sy = lerp(-14, 22, u0) - 2 * Math.sin(u0 * PI) * 8;
      const len = 80 + 170 * h2(i, 4) * (0.5 + 0.5 * u0);
      const gust = smooth((t - tg - 0.9 - (sx - 300) / 520) / 0.6) * Math.exp(-Math.max(0, t - tg - 2) / 2);
      const sw = Math.sin(t * (0.9 + 0.3 * h2(i, 5)) + i) * 7 + 30 * gust * (0.6 + 0.4 * h2(i, 6));
      const ex = sx + sw, ey = sy + len, cx = sx + sw * 0.2 - 6, cy = sy + len * 0.45;
      q.strokeStyle = 'rgba(92,84,60,0.75)'; q.lineWidth = 1.3;
      q.beginPath(); q.moveTo(sx, sy); q.quadraticCurveTo(cx, cy, ex, ey); q.stroke();
      // 细叶：沿丝两侧斜挂的小柳叶，近梢渐小
      q.fillStyle = i % 3 ? 'rgba(150,132,70,0.85)' : 'rgba(206,176,92,0.85)';
      q.beginPath();
      for (let k = 2; k < 15; k++) {
        const u = k / 15, px = (1 - u) * (1 - u) * sx + 2 * u * (1 - u) * cx + u * u * ex, py = (1 - u) * (1 - u) * sy + 2 * u * (1 - u) * cy + u * u * ey;
        const sd = k % 2 ? 1 : -1, L = 13 * (1.1 - u * 0.5), an = PI / 2 - sd * 0.75 + sw * 0.004;
        const lx = px + Math.cos(an) * L, ly = py + Math.sin(an) * L, nx = -Math.sin(an) * 2.2, ny = Math.cos(an) * 2.2;
        q.moveTo(px, py); q.quadraticCurveTo((px + lx) / 2 + nx, (py + ly) / 2 + ny, lx, ly); q.quadraticCurveTo((px + lx) / 2 - nx, (py + ly) / 2 - ny, px, py);
      }
      q.fill();
    }
    g.drawImage(B.cv, 0, 0, B.pw, B.ph, 680, 0, 600, 320);
  }
  // 船头人影：整个人压成一块雾色剪影（白发留到下一镜才让倒影说出来）；人静立，烘成一张
  function in2FigTex() {
    return K.cache('g01in2fig', 90, 110, 1, (q) => {
      F.draw(q, 'xiaoyao', 45, 104, 0.45, 1.3, { stage: 'old', facing: 1, pose: 'stand', wind: 0.35, tone: 'silhouette', ink: '#5d6871', tassel: '#5d6871', whiteHair: false });
      q.globalCompositeOperation = 'source-atop'; q.fillStyle = '#66717a'; q.fillRect(0, 0, 90, 110); q.globalCompositeOperation = 'source-over';
    });
  }
  function in2Figure(g, x, y) {
    g.globalAlpha = 0.72; g.drawImage(in2FigTex(), x - 45, y - 104, 90, 110); g.globalAlpha = 1;
  }
  XYT.registerShot('in2_yuhang', {
    name: '余杭晨雾', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(242,236,222,0.85)', accent: '#c9a14a', bloom: 0.2,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = IN2.hz, ts = shotStart(c);
      const camX = IN2.pan * clamp((lt + IN2.pre) / (c.dur + IN2.pre));
      in2Back(g, camX);
      // 炊烟：两三户人家屋顶升起，被晨风带向右边
      const smk = XYT.sprites.tint(XYT.sprites.glow, '#aeb6ba');
      for (const [sx0, sy0, sd] of [[236, hz - 66, 1], [452, hz - 58, 2], [1190, hz - 62, 3]]) {
        const sx = sx0 + IN2M.x0 + 60 - camX * 0.4;
        for (let k = 0; k < 6; k++) {
          const q = ((t / 6 + k / 6 + h2(sd, 3)) % 1), rise = q * 120, r = 5 + 26 * q;
          const px = sx + rise * 0.55 + Math.sin(t * 0.7 + k + sd) * 5 * q, py = sy0 - rise;
          g.globalAlpha = 0.42 * Math.sin(q * PI) * (1 - q * 0.5);
          g.drawImage(smk, px - r * 1.4, py - r, r * 2.8, r * 2);
        }
      }
      g.globalAlpha = 1;
      // 镜面河：倒影清晰、波纹很轻；日头下一道碎金
      in2Water(g, t, camX);
      // 日头倒在水里：一道竖向的暖金光晕
      const sgx = IN2.sunX - camX * 0.08 - 20;
      g.fillStyle = K.lin(g, sgx - 130, 0, sgx + 130, 0, [[0, 'rgba(246,214,150,0)'], [0.5, 'rgba(246,214,150,0.32)'], [1, 'rgba(246,214,150,0)']]);
      g.fillRect(sgx - 130, hz + 4, 260, H - hz);
      in2Mist(g, t, camX);
      // 乌篷船：自左向右匀速滑行（屏幕上约 70 px/s）；船尾船夫撑篙，船头立着看不清的人影
      const bs = 0.9, wy = 572, par = 0.5;
      const boatW = (tt) => 330 + 70 * (tt - ts) + camAt(tt) * par;
      const camAt = (tt) => IN2.pan * clamp((tt - ts + IN2.pre) / (c.dur + IN2.pre));
      const bx = boatW(t) - camX * par, bob = Math.sin(t * 1.3) * 1.2, rot = Math.sin(t * 0.9) * 0.012;
      // 倒影
      g.save(); g.beginPath(); g.rect(-60, wy, W + 120, 140); g.clip();
      g.translate(0, 2 * wy + 4); g.scale(1, -1); g.globalAlpha = 0.32;
      drawBoat(g, bx, wy + bob, bs, -rot, '#3b2f26', '#26252a');
      g.restore();
      // 撑篙：每拍入水一次，撑住、拔起、前移
      const P = c.b.period || 0.83, bi = c.b.i, ph = clamp(c.b.since / P);
      const plant = (i) => { const ti = c.grid.time(i); return [boatW(ti) - 92 * bs - camX * par, wy + 3]; };
      const man = { x: bx - 70 * bs, y: wy - 12 * bs + bob };
      const hand = [man.x + 5, man.y - 40];
      let tip;
      if (ph < 0.6) tip = plant(bi);
      else { const u = smooth((ph - 0.6) / 0.4), a0 = plant(bi), a1 = plant(bi + 1); tip = [lerp(a0[0], a1[0] + 10, u), lerp(a0[1], a1[1], u) - Math.sin(u * PI) * 40]; }
      const dx = tip[0] - hand[0], dy = tip[1] - hand[1], dl = Math.hypot(dx, dy) || 1, ext = 34;
      g.strokeStyle = '#3a3329'; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(hand[0] - dx / dl * ext, hand[1] - dy / dl * ext); g.lineTo(tip[0], Math.min(tip[1], wy + 2)); g.stroke();
      // 船与人
      F.draw(g, 'villager', man.x, man.y, 0.45, t, { facing: 1, variant: 0, pose: 'stand', lean: 0.12, wind: 0.2, tone: 'silhouette', ink: '#3f3a33' });
      drawBoat(g, bx, wy + bob, bs, rot, '#3b2f26', '#26252a');
      in2Figure(g, bx + 74 * bs, wy - 10 * bs + bob);
      // 篙点处的涟漪
      for (let k = 0; k < 3; k++) { const ti = c.grid.time(bi - k); if (t >= ti) E.ripples(g, { x: plant(bi - k)[0], y: wy + 4, t, t0: ti, scale: 1.1, ratio: 0.22, color: '#f6f2e6', alpha: 0.55, life: 2.4 }); }
      E.mist(g, { t, y: wy + 50, h: 70, color: '#f4f2ec', alpha: 0.38, speed: 9, seed: 7 });
      // 雁阵：从右上入画，强拍时掠过桥顶
      const tg = c.grid.time(downIdx0(c) + 4), bridgeX = IN2M.bx + IN2M.x0 + 60 - camAt(tg) * 0.4;
      const gx = bridgeX - 140 * (t - tg);
      V.birds(g, c, { kind: 'v', n: 7, x: bridgeX, at: tg - ts, dir: -1, speed: 140, y: 300 - 0.00055 * (gx - bridgeX) * (gx - bridgeX), size: 0.95, color: '#3d454c', alpha: 0.8 });
      // 晨光：日头一圈淡金，随拍呼吸
      g.save(); g.globalCompositeOperation = 'screen';
      glow(g, IN2.sunX - camX * 0.08, IN2.sunY, 190, '#ffe2a0', 0.14 + 0.25 * c.be(0.5));
      g.restore();
      in2Willow(g, t, camX, tg);
      in2Reeds(g, c, camX);
    },
  });

  // ======================================================================
  // in3_reflection 篙点倒影：俯拍水面，倒影里立着白发归人；竹篙每拍点水，涟漪把倒影打碎又合拢
  // ======================================================================
  const IN3 = { ex: 690, ey: 300, fx: 880, feet: 118, s: 2.2, t0: 15.2 };
  // 水面底色：天光倒映（左上亮、右下深）、云影烘在里面（整张慢慢漂），细碎的水纹
  function in3Water() {
    return K.cache('g01in3water3', W + 120, H + 40, 1, (q) => {
      q.translate(60, 20);
      q.fillStyle = K.lin(q, -60, -20, W + 60, H + 20, [[0, '#c9d6d6'], [0.4, '#a7bfbc'], [0.75, '#86a5a1'], [1, '#6d8e8a']]); q.fillRect(-60, -20, W + 120, H + 40);
      const r = rng(303);
      // 天光：一道斜斜的淡白（芦絮、黄叶漂在这里）
      for (let i = 0; i < 9; i++) A.softBlob(q, 120 + r() * 520, 120 + r() * 520, 140 + r() * 160, 0.12 + r() * 0.06, '#eef2f0');
      // 斜照进来的一抹晨光（倒映的亮天）
      q.fillStyle = K.lin(q, 0, 0, 900, 700, [[0, 'rgba(246,236,214,0.32)'], [0.45, 'rgba(240,236,224,0.12)'], [1, 'rgba(240,236,224,0)']]); q.fillRect(-60, -20, W + 120, H + 40);
      // 倒映的云：几抹拉长的淡白
      for (let i = 0; i < 6; i++) E.util.streak(q, r() * (W + 100) - 50, 80 + r() * 560, 220 + r() * 160, 30 + r() * 30, i % 2 ? '#f6f6f2' : '#e8e8ee', 0.14, -0.08);
      // 人影背后、头的一侧压暗一片深青（白发靠它衬出来）
      A.softBlob(q, IN3.fx - 10, 520, 300, 0.42, '#557571');
      A.softBlob(q, IN3.fx + 60, 600, 260, 0.3, '#4f6d6a');
      for (let i = 0; i < 8; i++) A.softBlob(q, 700 + r() * 600, 420 + r() * 320, 120 + r() * 140, 0.1, '#5f7f7c');
      // 船身的倒影：右上一片柔和的深色，人的倒影就从这里垂下
      for (let i = 0; i < 16; i++) { const u = i / 15; A.softBlob(q, lerp(640, 1340, u) + (r() - 0.5) * 40, lerp(30, 6, u) + (r() - 0.5) * 16, 100 + r() * 50, 0.24, '#2f4144'); }
      q.lineCap = 'round';
      for (let i = 0; i < 110; i++) {
        const x = r() * (W + 100) - 50, y = r() * H, l = 20 + r() * 90;
        q.strokeStyle = `rgba(${r() < 0.6 ? '240,246,246' : '60,90,88'},${0.04 + r() * 0.06})`; q.lineWidth = 0.8 + r() * 1.2;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + l * 0.5, y + (r() - 0.5) * 6, x + l, y + (r() - 0.5) * 4); q.stroke();
      }
    });
  }
  // 篙点的时刻：起点后 4 拍（第 4 拍最重）
  function in3Hits(c) { const i0 = beatIdx0(c), out = []; for (let k = 0; k < 4; k++) out.push(c.grid.time(i0 + k)); return out; }
  const in3R = (age) => 16 + age * 165;
  // 涟漪在半径 r 处造成的径向位移（多个波包叠加；波长约 70 px）
  function in3Wave(r, t, hits) {
    let d = 0;
    for (let k = 0; k < hits.length; k++) {
      const age = t - hits[k];
      if (age <= 0) continue;
      const R = in3R(age), A0 = (k === 3 ? 16 : 9) * Math.exp(-age / (k === 3 ? 1.4 : 1.0)) * smooth(age / 0.08);
      const rho = r - R;
      if (Math.abs(rho) > 200) continue;
      d += A0 * Math.sin(rho * 0.09) * Math.exp(-(rho * rho) / (2 * 70 * 70));
    }
    return d;
  }
  // 竹篙：靠近镜头的一端粗、失焦，往水面收细；竹节疏密不匀
  function in3Pole(g, x0, y0, x1, y1, w0, w1, lift) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const quad = (k, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x0 + nx * w0 * k, y0 + ny * w0 * k); g.lineTo(x1 + nx * w1 * k, y1 + ny * w1 * k);
      g.lineTo(x1 - nx * w1 * k, y1 - ny * w1 * k); g.lineTo(x0 - nx * w0 * k, y0 - ny * w0 * k); g.closePath(); g.fill();
    };
    quad(0.7, 'rgba(70,74,60,0.12)');
    const gr = g.createLinearGradient(x0 + nx * w0 * 0.5, y0 + ny * w0 * 0.5, x0 - nx * w0 * 0.5, y0 - ny * w0 * 0.5);
    gr.addColorStop(0, '#5a5544'); gr.addColorStop(0.3, '#8f8668'); gr.addColorStop(0.55, '#7d755b'); gr.addColorStop(1, '#4a4636');
    quad(0.5, gr);
    // 竹节
    const nodes = [0.07, 0.24, 0.37, 0.55, 0.66, 0.83];
    for (let n = 0; n < nodes.length; n++) {
      const u = ((nodes[n] - lift * 0.08) % 1 + 1) % 1, px = lerp(x0, x1, u), py = lerp(y0, y1, u), w = lerp(w0, w1, u) * 0.5;
      g.strokeStyle = 'rgba(52,48,34,0.55)'; g.lineWidth = lerp(3.6, 1.4, u);
      g.beginPath(); g.moveTo(px + nx * w, py + ny * w); g.quadraticCurveTo(px + dx / L * 2, py + dy / L * 2, px - nx * w, py - ny * w); g.stroke();
      g.strokeStyle = 'rgba(200,192,160,0.25)'; g.lineWidth = lerp(1.6, 0.7, u);
      g.beginPath(); g.moveTo(px + nx * w + dx / L * 3, py + ny * w + dy / L * 3); g.lineTo(px - nx * w + dx / L * 3, py - ny * w + dy / L * 3); g.stroke();
    }
    // 迎光的一线
    g.strokeStyle = 'rgba(226,220,196,0.28)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0 + nx * w0 * 0.22, y0 + ny * w0 * 0.22); g.lineTo(x1 + nx * w1 * 0.22, y1 + ny * w1 * 0.22); g.stroke();
  }
  // 黄叶：锯齿边、叶尖微卷、深一点的叶缘
  function in3Leaf(g, x, y, sc, rot, tilt) {
    g.save(); g.translate(x + 4, y + 6); g.rotate(rot); g.scale(sc, sc * tilt);
    g.fillStyle = 'rgba(30,50,48,0.16)'; g.beginPath(); g.ellipse(0, 0, 30, 11, 0, 0, TAU); g.fill();
    g.restore();
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc * tilt);
    const P = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, a = u * TAU, cs = Math.cos(a), sn = Math.sin(a);
      // 叶形：一头圆、一头尖，边上细锯齿
      const rx = 30 * (cs > 0 ? 1 : 0.92), ry = 12 * (1 - 0.35 * Math.max(0, cs)) * (1 + 0.1 * Math.sin(a * 2));
      const tooth = 1 + (i % 2 ? 0.07 : -0.04) * (Math.abs(cs) < 0.95 ? 1 : 0);
      P.push([cs * rx * tooth, sn * ry * tooth]);
    }
    const lg = g.createLinearGradient(-30, -10, 30, 10); lg.addColorStop(0, '#b0622a'); lg.addColorStop(0.45, '#e29c45'); lg.addColorStop(1, '#f0c766');
    g.fillStyle = lg;
    g.beginPath(); P.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,62,22,0.6)'; g.lineWidth = 1.1; g.stroke();
    // 叶尖微卷：一小片翻起的亮面
    g.fillStyle = 'rgba(250,224,150,0.85)';
    g.beginPath(); g.moveTo(22, -3); g.quadraticCurveTo(34, -9, 33, 1); g.quadraticCurveTo(28, 2, 22, 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(130,70,26,0.6)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-40, 1); g.quadraticCurveTo(-4, -2, 26, -1); g.stroke();
    for (let v = -2; v <= 2; v++) { if (!v) continue; g.beginPath(); g.moveTo(-12 + v * 8, -1); g.lineTo(-2 + v * 9, v > 0 ? -8 : 8); g.stroke(); }
    g.fillStyle = 'rgba(255,240,200,0.22)'; g.beginPath(); g.ellipse(-4, -4, 16, 3, -0.08, 0, TAU); g.fill();
    g.restore();
  }
  // 芦絮：拉长的一缕白絮，带一粒深色的籽和淡淡的影
  function in3Fluff(g, x, y, sc, rot, a) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    g.fillStyle = 'rgba(30,50,48,0.08)'; g.beginPath(); g.ellipse(3, 5, 16, 4, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba('#efe8d8', 0.55 * a); g.lineWidth = 0.8; g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k < 9; k++) { const sp = (k - 4) * 0.09; g.moveTo(-6, 0); g.quadraticCurveTo(4, sp * 18, 16 + (k % 3) * 3, sp * 30 + (k % 2 ? 1 : -1)); }
    g.stroke();
    g.fillStyle = rgba('#f4efe4', 0.4 * a); g.beginPath(); g.ellipse(6, 0, 11, 3.2, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(70,58,40,0.9)'; g.beginPath(); g.ellipse(-7, 0, 2.2, 1.1, 0, 0, TAU); g.fill();
    g.restore();
  }
  // 倒影缓冲：人立在 (ox, oy)，画好后上下翻转、压水色、往头的方向渐淡
  const IN3B = { bw: 520, bh: 460, k: 0.5, ox: 230, oy: 444 };
  const in3Fo = (gust) => ({ stage: 'old', facing: -1, pose: 'stand', wind: 0.28 + 0.6 * gust, windDir: 1, ribbon: '#4c8dae', tassel: '#6d7478', night: false });
  function in3Build(r2, tt, gust) {
    const { bw, bh, k, ox, oy } = IN3B, S = IN3.s, fo = in3Fo(gust), pts = F.points('xiaoyao', ox, oy, S, tt, fo);
    const U = buf('in3up', bw, bh, k), q = U.q;
    F.draw(q, 'xiaoyao', ox, oy, S, tt, Object.assign({ part: 'back' }, fo));
    // 酒葫芦：系在胯侧，绳垂下，挂在近侧手臂后
    const gs = 0.22 * S, gx0 = pts.pelvis[0] + 6 * S, gy0 = pts.pelvis[1] + 6 * S, sw = Math.sin(tt * 1.8) * 0.06 + 0.1 * gust;
    const gx = gx0 + Math.sin(sw) * 20 * S, gy = gy0 + Math.cos(sw) * 20 * S;
    q.strokeStyle = '#8a3a2a'; q.lineWidth = 1.2 * S; q.beginPath(); q.moveTo(gx0, gy0); q.quadraticCurveTo(gx0 + 2, (gy0 + gy) / 2, gx, gy - 2); q.stroke();
    E.gourd(q, { x: gx, y: gy + 50 * gs, s: gs, t: tt, angle: sw, color: '#8a5a2c', cord: '#8a3a2a' });
    F.draw(q, 'xiaoyao', ox, oy, S, tt, Object.assign({ part: 'front' }, fo));
    r2.save(); r2.translate(0, bh); r2.scale(1, -1); r2.drawImage(U.cv, 0, 0, U.pw, U.ph, 0, 0, bw, bh); r2.restore();
    r2.globalCompositeOperation = 'source-atop';
    r2.fillStyle = K.lin(r2, 0, 0, 0, bh, [[0, 'rgba(98,128,126,0.3)'], [1, 'rgba(110,140,138,0.42)']]); r2.fillRect(0, 0, bw, bh);
    r2.globalCompositeOperation = 'destination-out';
    r2.fillStyle = K.lin(r2, 0, 0, 0, bh, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,0.42)']]); r2.fillRect(0, 0, bw, bh);
    r2.globalCompositeOperation = 'source-over';
  }
  const in3Still = () => K.cache('g01in3still', IN3B.bw, IN3B.bh, IN3B.k, (r2) => in3Build(r2, IN3.t0, 0));
  XYT.registerShot('in3_reflection', {
    name: '篙点倒影', zone: 'left', night: false, text: '#1a2026', shadow: 'rgba(233,231,239,0.85)', accent: '#e29c45', bloom: 0.18,
    draw(g, c) {
      const t = c.t, lt = c.lt, hits = in3Hits(c), ts = shotStart(c);
      const bx = 0.5 * Math.sin(t * 0.9), by = 0.5 * Math.cos(t * 0.7);
      g.save(); g.translate(bx, by);
      // 水：整张随水流极慢地漂
      blitN(g, in3Water(), -60 - 30 + lt * 9, -20, W + 120, H + 40);
      // 薄雾：几团贴着水面慢慢飘的淡白
      for (let i = 0; i < 4; i++) A.softBlob(g, ((h2(i, 81) * 1500 - lt * (8 + 4 * i)) % 1500 + 1500) % 1500 - 110, 140 + h2(i, 82) * 460, 170 + 80 * h2(i, 83), 0.1, '#f2f5f4');
      // 倒影：立着的人画进半分辨率缓冲，翻转（压上水色、往头的方向渐淡），再按 2 px 的横条随涟漪错开贴回
      const S = IN3.s, fx = IN3.fx;
      const gust = smooth((t - (hits[3] + 0.2)) / 0.45) * (1 - 0.35 * smooth((t - hits[3] - 1.6) / 1.2));
      const { bw, bh, k, ox, oy } = IN3B;
      // 风到之前人静立：翻好、压好水色的倒影烘成一张；风到之后逐帧画
      const still = gust < 0.004, tf = still ? IN3.t0 : t;
      const fo = in3Fo(still ? 0 : gust), pts = F.points('xiaoyao', ox, oy, S, tf, fo);
      let B;
      if (still) { const cv = in3Still(); B = { cv, s: cv.width / bw }; }
      else { B = buf('in3fig', bw, bh, k); in3Build(B.q, t, gust); }
      // 世界坐标：缓冲第 v 行 → 屏幕 y = top + v；涟漪只算人影中线上的位移（人影窄，整行一起错开就不出锯齿）
      const top = IN3.feet - 16, x0 = fx - ox;
      const disp = (y) => {
        const dxr = fx - IN3.ex, dyr = y - IN3.ey, r = Math.hypot(dxr, dyr) || 1, d = in3Wave(r, t, hits);
        return [(d * dxr) / r, (d * dyr) / r, Math.abs(d)];
      };
      const m = g.getTransform();
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.78;
      let run0 = -1;
      const flush = (v0, v1) => {
        const Y0 = Math.round(m.d * (top + v0) + m.f), Y1 = Math.round(m.d * (top + v1) + m.f);
        if (Y1 > Y0) g.drawImage(B.cv, 0, v0 * B.s, bw * B.s, (v1 - v0) * B.s, m.a * x0 + m.e, Y0, m.a * bw, Y1 - Y0);
      };
      for (let v = 0; v < bh; v += 2) {
        const [ddx, ddy, dd] = disp(top + v + 1);
        if (dd < 0.2) { if (run0 < 0) run0 = v; continue; }
        if (run0 >= 0) { flush(run0, v); run0 = -1; }
        const syy = clamp(v - ddy * 0.8, 0, bh - 2);
        const Y0 = Math.round(m.d * (top + v) + m.f), Y1 = Math.round(m.d * (top + v + 2) + m.f);
        if (Y1 > Y0) g.drawImage(B.cv, 0, syy * B.s, bw * B.s, 2 * B.s, m.a * (x0 + ddx) + m.e, Y0, m.a * bw, Y1 - Y0);
      }
      if (run0 >= 0) flush(run0, bh);
      g.setTransform(m); g.globalAlpha = 1;
      // 白发：在屏幕上直接画（清楚、最亮），每根发丝的点跟着同一套涟漪位移
      const flipY = (y) => top + (bh - y);
      const toS = (px, py) => { const X = x0 + px, Y = flipY(py), [ddx, ddy] = disp(Y); return [X + ddx, Y + ddy * 0.8]; };
      const hb = pts.top, hd = pts.head, back = -fo.facing;
      g.lineCap = 'round'; g.lineJoin = 'round';
      // 沿中线点列画一条两头尖的带子（法线方向加宽）
      const band = (P, wf) => {
        const L = [], R = [];
        for (let j = 0; j < P.length; j++) {
          const a = P[Math.max(0, j - 1)], b = P[Math.min(P.length - 1, j + 1)], dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1, w = wf(j / (P.length - 1)) / 2;
          L.push([P[j][0] - (dy / dl) * w, P[j][1] + (dx / dl) * w]); R.push([P[j][0] + (dy / dl) * w, P[j][1] - (dx / dl) * w]);
        }
        g.beginPath(); L.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); for (let j = R.length - 1; j >= 0; j--) g.lineTo(R[j][0], R[j][1]); g.closePath();
        return L;
      };
      // 一缕头发的中线：静时顺背垂下、微微 S 形；风到时整缕向后平飘，梢上抖动
      const lock = (i, L, spread, wob) => {
        const P = [];
        const r0 = h2(i, 11), sx = lerp(hb[0], hd[0], 0.15 + 0.55 * r0) + back * (6 + 6 * r0) * S, sy = lerp(hb[1], hd[1], 0.15 + 0.6 * r0);
        const off = (h2(i, 13) - 0.5) * spread;
        let x = sx, y = sy;
        for (let j = 0; j <= 12; j++) {
          P.push(toS(x, y));
          const u = j / 12;
          const rest = PI / 2 - back * (0.42 + 0.08 * Math.sin(u * 3 + 0.5 * Math.sin(t * 0.8)) + 0.04 * Math.sin(i * 2.1) - 0.12 * u) + off * u * 0.4;
          const blow = PI / 2 - back * (1.3 + 0.18 * u) + off * (0.5 + u) * 1.4;
          const aa = lerp(rest, blow, gust) + Math.sin(t * (1.4 + 3 * gust) - u * 4.5 + i * 1.1) * (0.04 + wob * gust) * u;
          x += (Math.cos(aa) * L) / 12; y += (Math.sin(aa) * L) / 12;
        }
        return P;
      };
      // 后层：略灰的发束，铺出体积
      g.fillStyle = 'rgba(196,202,204,0.85)';
      for (let i = 0; i < 6; i++) { band(lock(i + 20, (74 + 20 * h2(i, 31)) * S, 0.25, 0.14), (u) => (13 + 6 * h2(i, 32)) * Math.pow(1 - u, 0.8) + 1); g.fill(); }
      // 蓝发带：两条，第 4 下涟漪后约 0.2 s 被风扬起
      const knot = [hb[0] + back * 5.5 * S, hb[1] + 3 * S], rib = smooth((t - hits[3] - 0.2) / 0.5) * (1 - 0.3 * smooth((t - hits[3] - 1.8) / 1));
      for (let r = 0; r < 2; r++) {
        const L = (60 - r * 14) * S, a0 = PI / 2 - back * (0.3 + r * 0.25) - back * rib * (1.15 - r * 0.25);
        const P = [];
        let x = knot[0], y = knot[1];
        for (let j = 0; j <= 12; j++) {
          P.push(toS(x, y));
          const u = j / 12, aa = a0 - back * u * 0.3 * rib + Math.sin(t * (2 + 5 * rib) - u * 5 + r * 1.3) * (0.08 + 0.32 * rib) * u;
          x += (Math.cos(aa) * L) / 12; y += (Math.sin(aa) * L) / 12;
        }
        g.fillStyle = r ? 'rgba(63,125,156,0.95)' : 'rgba(76,141,174,0.95)';
        const edge = band(P, (u) => (7.5 - r * 1.5) * (1 - 0.55 * u)); g.fill();
        g.strokeStyle = 'rgba(196,230,244,0.5)'; g.lineWidth = 1; g.beginPath(); edge.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
      // 头顶与脑后的白发（脸一侧留出深色的侧影）
      {
        const rH = Math.hypot(hd[0] - hb[0], hd[1] - hb[1]) * 0.78, c0 = [hd[0] + back * 2 * S, hd[1] - 1 * S], P = [toS(c0[0], c0[1])];
        for (let k = 0; k <= 14; k++) { const an = lerp(-PI / 2 - back * 0.35, back > 0 ? 1.15 : PI - 1.15, k / 14); P.push(toS(c0[0] + Math.cos(an) * rH, c0[1] + Math.sin(an) * rH)); }
        g.fillStyle = 'rgba(232,236,238,0.95)'; g.beginPath(); P.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.4; g.beginPath(); P.slice(1).forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
      // 前层：亮白发束，一侧描一线冷白的光边
      for (let i = 0; i < 7; i++) {
        const P = lock(i, (62 + 26 * h2(i, 12)) * S, 0.3, 0.18);
        g.fillStyle = 'rgba(240,243,244,0.95)';
        const edge = band(P, (u) => (8 + 5 * h2(i, 33)) * Math.pow(1 - u, 0.9) + 0.8); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2;
        g.beginPath(); edge.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
      // 飘散的细发丝
      g.strokeStyle = 'rgba(246,249,250,0.7)'; g.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) { const P = lock(i + 40, (70 + 40 * h2(i, 34)) * S, 0.6, 0.3); g.beginPath(); P.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      // 倒影上几道细碎的亮水纹，轻轻晃
      g.strokeStyle = 'rgba(236,244,244,0.2)'; g.lineWidth = 1.1;
      g.beginPath();
      for (let i = 0; i < 7; i++) {
        const yy = top + 60 + h2(i, 21) * (bh - 90), len = 24 + 40 * h2(i, 22), xx = fx - 70 + h2(i, 23) * 120 + Math.sin(t * 0.9 + i) * 10;
        g.moveTo(xx, yy); g.quadraticCurveTo(xx + len / 2, yy + 2 + Math.sin(t * 2 + i) * 1.5, xx + len, yy);
      }
      g.stroke();
      // 涟漪圈：断续的弧段，粗细浓淡不一，前面一圈最亮；间距不匀，略扁
      g.lineCap = 'round';
      const RINGS = [[0, 1], [-30, 0.55], [-52, 0.3]];
      for (let kk = 0; kk < 4; kk++) {
        const age = t - hits[kk];
        if (age <= 0 || age > 3.4) continue;
        const big = kk === 3 ? 1.35 : 1, R0 = in3R(age);
        for (let j = 0; j < 3; j++) {
          const R = R0 + RINGS[j][0];
          if (R < 12) continue;
          const a = 0.5 * big * Math.exp(-age / 1.1) * RINGS[j][1] * smooth(R / 40);
          if (a < 0.01) continue;
          if (j === 0) { g.strokeStyle = rgba('#f4fbfa', a * 0.16); g.lineWidth = 12 * big; g.beginPath(); g.ellipse(IN3.ex, IN3.ey, R - 3, (R - 3) * 0.86, 0, 0, TAU); g.stroke(); }
          for (let sgm = 0; sgm < 20; sgm++) {
            const nz = noise1(sgm * 0.55 + j * 5 + kk * 11, 33), nz2 = noise1(sgm * 0.8 + j * 3 + kk * 7, 34);
            if (nz < 0.12) continue;
            const s0 = (sgm / 20) * TAU, s1 = s0 + TAU / 20 + 0.01, rj = R + (nz2 - 0.5) * 3;
            g.strokeStyle = rgba('#fbfdfd', a * (0.3 + 0.8 * nz)); g.lineWidth = (1.1 + 2.2 * nz2) * big;
            g.beginPath(); g.ellipse(IN3.ex, IN3.ey, rj, rj * 0.86, 0, s0, s1); g.stroke();
            if (j === 0) { g.strokeStyle = rgba('#38524f', a * 0.4 * nz); g.lineWidth = (2.5 + 3 * nz) * big; g.beginPath(); g.ellipse(IN3.ex, IN3.ey, rj - 8, (rj - 8) * 0.86, 0, s0, s1); g.stroke(); }
          }
        }
      }
      // 竹篙：从画外斜插下来，每拍点下，拍后半拔起；入水处溅起细碎水花
      const P = c.b.period || 0.83, ph = t < hits[0] ? 0 : clamp(c.b.since / P);
      const lift = ph < 0.55 ? 0 : smooth((ph - 0.55) / 0.3) * (1 - smooth((ph - 0.9) / 0.1));
      const sx = 520, sy0 = -60, ddx = IN3.ex - sx, ddy = IN3.ey - sy0, dl = Math.hypot(ddx, ddy), ux = ddx / dl, uy = ddy / dl;
      const tipX = IN3.ex - ux * lift * 80, tipY = IN3.ey - uy * lift * 80;
      if (lift < 0.35) {
        // 水下的一截：折射后更短更淡
        const sub = 90 * (1 - lift / 0.35);
        g.save(); g.lineCap = 'round';
        g.strokeStyle = 'rgba(60,86,82,0.2)'; g.lineWidth = 12;
        g.beginPath(); g.moveTo(IN3.ex, IN3.ey); g.lineTo(IN3.ex + ux * sub * 0.7 + 8, IN3.ey + uy * sub * 1.15); g.stroke();
        g.strokeStyle = 'rgba(130,126,96,0.22)'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(IN3.ex, IN3.ey); g.lineTo(IN3.ex + ux * sub * 0.6 + 6, IN3.ey + uy * sub); g.stroke();
        g.restore();
      }
      in3Pole(g, sx - ux * 60, sy0 - uy * 60, tipX, tipY, 40, 14, lift);
      for (const t0 of hits) {
        const age = t - t0;
        if (age < 0 || age > 0.5) continue;
        g.fillStyle = rgba('#ffffff', 0.6 * (1 - age / 0.5));
        g.beginPath();
        for (let j = 0; j < 9; j++) {
          const an = h2(j, 7) * TAU, d = 10 + age * 100 * (0.4 + h2(j, 8)), px = IN3.ex + Math.cos(an) * d, py = IN3.ey + Math.sin(an) * d * 0.86 - Math.sin(age / 0.5 * PI) * 10 * h2(j, 9);
          const rr = 2 * (1 - age);
          g.moveTo(px + rr, py); g.arc(px, py, rr, 0, TAU);
        }
        g.fill();
      }
      if (lift > 0.2) for (let j = 0; j < 3; j++) {
        const td = c.grid.time(c.b.i) + P * (0.62 + j * 0.08), age = t - td;
        if (age > 0 && age < 1.2) { const rr = 4 + age * 42; g.strokeStyle = rgba('#f4f8f8', 0.4 * (1 - age / 1.2)); g.lineWidth = 1.1; g.beginPath(); g.ellipse(IN3.ex - ux * 46 + j * 9, IN3.ey - uy * 46 + j * 5, rr, rr * 0.86, 0, 0, TAU); g.stroke(); }
      }
      // 左侧留白：两片黄叶、几缕芦絮慢慢漂；涟漪经过时跟着起伏、打转
      const bob = (x, y) => {
        const r = Math.hypot(x - IN3.ex, y - IN3.ey) || 1, d = in3Wave(r, t, hits), d2 = in3Wave(r + 6, t, hits);
        return [x + (d * (x - IN3.ex)) / r, y + (d * (y - IN3.ey)) / r, d, (d2 - d)];
      };
      for (const [fx0, fy0, sc, rot0, k2] of [[300, 420, 1.45, 0.4, 0], [462, 610, 1.15, -0.9, 1]]) {
        const [px, py, d, sl] = bob(fx0 + Math.sin(t * 0.3 + k2) * 6 + lt * 4, fy0 + Math.cos(t * 0.25 + k2) * 4);
        in3Leaf(g, px, py, sc, rot0 + t * 0.05 + d * 0.03, 1 - clamp(Math.abs(sl) * 0.12, 0, 0.25));
      }
      for (let i = 0; i < 4; i++) {
        const [px, py, d] = bob(170 + h2(i, 61) * 420 + lt * (3 + h2(i, 62) * 5), 200 + h2(i, 63) * 420);
        in3Fluff(g, px, py, 1 + 0.4 * h2(i, 64), h2(i, 65) * TAU + t * 0.06 + d * 0.02, 1);
      }
      g.restore();
    },
  });

  // ======================================================================
  // in4_return 白发归人：镜头从水中倒影竖直上摇；船头靠岸一顿，他踏上斜伸的栈道，一拍一步走向客栈，越走越远越小
  // ======================================================================
  // 世界坐标（camY=0 时即最终构图）：远岸水线 388、地平线约 380；栈道头 (430,545) → 客栈前 (860,455)；船水线 560
  const IN4 = { hz: 380, shore: 388, tilt: 520, head: [430, 545], end: [860, 455], innX: 1015, innY: 444, innS: 0.6, bankH: 50, sun: [1062, 236], wy: 560 };
  const in4PierY = (x) => lerp(IN4.head[1], IN4.end[1], (x - IN4.head[0]) / (IN4.end[0] - IN4.head[0]));
  const in4InnWL = () => IN4.innY + IN4.bankH * IN4.innS;
  function in4Sky() {
    return K.cache('g01in4sky2', W + 40, IN4.shore + 6, 1, (q) => {
      q.translate(20, 0);
      const hz = IN4.hz, [sx, sy] = IN4.sun;
      E.sky(q, { stops: [[0, '#c4ccd0'], [0.4, '#eadfc4'], [0.8, '#f3dcaa'], [1, '#f2d59e']], y1: IN4.shore + 6, haze: '#fbdca0', hazeY: hz, hazeA: 0.55, glow: { x: sx, y: sy, r: 640, color: '#ffd27a', a: 0.62 } });
      A.softBlob(q, sx, sy, 300, 0.55, '#fff1cc');
      A.softBlob(q, sx, sy, 110, 0.8, '#fffaea');
      E.clouds(q, { t: 0, y: 110, color: '#fff2d8', shade: '#c8c4bc', alpha: 0.42, n: 3, seed: 27, speed: 0, scale: 0.9, lightX: sx });
      E.mountains(q, { t: 0, lightDir: 1, fog: '#efe4cc', fogA: 0.55, layers: [
        { kind: 'far', color: '#b9c0c4', light: '#f6e2bc', litA: 0.55, y: hz - 10, scaleY: 0.5, seed: 52, offset: 600, speed: 0, fogH: 90, fogY: 12 },
        { kind: 'mid', color: '#959fa6', light: '#ead2a4', litA: 0.5, y: hz + 2, scaleY: 0.34, seed: 18, offset: 200, speed: 0, fog: false },
      ] });
      E.jiangnanTown(q, { t: 0, y: IN4.shore - 2, x0: 420, x1: 1300, scale: 0.36, seed: 61, color: '#e8e4da', roof: '#5f666e', haze: '#e8dcc2', hazeA: 0.45, smoke: 0, bank: false });
    });
  }
  // 左上：远岸几座马头墙，墙后一棵红枫
  function in4Left() {
    return K.cache('g01in4left3', 600, 360, 1, (q) => {
      q.translate(80, 30);
      const base = 322;
      E.mapleTree(q, { x: 236, y: base - 30, s: 0.55, sway: 0, t: 0, wind: 0.2, fall: 0, seed: 12, color: '#c8502c', ink: '#4a3428' });
      gableHouse(q, -10, base - 6, 220, 128, 2, { wall: '#e6e1d6', tile: '#4a4f55', seed: 3, stepH: 20 });
      gableHouse(q, 300, base - 2, 170, 110, 1, { wall: '#ebe6db', tile: '#40454b', seed: 9, stepH: 22, win: [282, base - 86, 30, 24] });
      gableHouse(q, 130, base, 240, 166, 2, { wall: '#f1ece1', tile: '#33383e', seed: 5, stepH: 26, win: [96, base - 128, 34, 28], door: [148, 40, 62] });
      // 墙脚青石驳岸
      q.fillStyle = K.lin(q, 0, base, 0, base + 8, [[0, '#77736b'], [1, '#4f4c47']]); q.fillRect(-80, base, 600, 8);
      // 远处的空气：整体压一层暖雾
      q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(240,226,196,0.16)'; q.fillRect(-80, -30, 600, 360); q.globalCompositeOperation = 'source-over';
    });
  }
  const IN4L = { x: -80, y: IN4.shore - 322 - 30 };
  // 客栈：远处静物，整栋烘成一张
  const IN4I = { x: IN4.innX - 250 * IN4.innS, y: IN4.innY - 356 * IN4.innS, w: 500 * IN4.innS, h: (356 + IN4.bankH + 10) * IN4.innS };
  function in4Inn() {
    return K.cache('g01in4inn', IN4I.w, IN4I.h, 1, (q) => {
      q.translate(-IN4I.x, -IN4I.y);
      E.inn(q, { x: IN4.innX, y: IN4.innY, s: IN4.innS, t: 0, lit: 0.18, wind: 0, flag: false, bank: true, bankH: IN4.bankH, wood: '#5a3c28', haze: '#efe2c4', hazeA: 0.12 });
    });
  }
  // 栈道：近宽远窄的木板、桩与桩的倒影
  const IN4P = { x: 370, y: 420, w: 540, h: 210 };
  function in4Pier() {
    return K.cache('g01in4pier3', IN4P.w, IN4P.h, 1, (q) => {
      q.translate(-IN4P.x, -IN4P.y);
      const [ax, ay] = IN4.head, [bx, by] = IN4.end, n = 24;
      const wid = (u) => lerp(46, 18, u), side = 10;
      // 桩：伸进水里，倒影往下渐淡
      for (let k = 0; k <= 8; k++) {
        const u = k / 8, x = lerp(ax, bx, u), y = lerp(ay, by, u), w = lerp(7, 3, u), hgt = lerp(30, 14, u);
        for (const off of [-1, 1]) {
          const px = x + off * wid(u) * 0.55, py = y + off * wid(u) * 0.35;
          q.fillStyle = '#3b2e24'; q.fillRect(px - w / 2, py, w, hgt);
          q.fillStyle = K.lin(q, 0, py + hgt, 0, py + hgt * 2.4, [[0, 'rgba(50,40,32,0.4)'], [1, 'rgba(50,40,32,0)']]);
          q.fillRect(px - w / 2, py + hgt, w, hgt * 1.4);
        }
      }
      // 桥面侧板
      q.fillStyle = '#4a3a2c';
      q.beginPath(); q.moveTo(ax - wid(0) * 0.55, ay + wid(0) * 0.35 - 2); q.lineTo(bx - wid(1) * 0.55, by + wid(1) * 0.35 - 2);
      q.lineTo(bx - wid(1) * 0.55, by + wid(1) * 0.35 + side * 0.5); q.lineTo(ax - wid(0) * 0.55, ay + wid(0) * 0.35 + side); q.closePath(); q.fill();
      q.beginPath(); q.moveTo(ax + wid(0) * 0.55, ay - wid(0) * 0.35); q.lineTo(bx + wid(1) * 0.55, by - wid(1) * 0.35);
      q.lineTo(bx - wid(1) * 0.55, by + wid(1) * 0.35); q.lineTo(ax - wid(0) * 0.55, ay + wid(0) * 0.35); q.closePath();
      q.fillStyle = K.lin(q, ax, ay, bx, by, [[0, '#9a7a58'], [1, '#c4a678']]); q.fill();
      // 木板缝
      const r = rng(17);
      for (let i = 0; i <= n; i++) {
        const u = Math.pow(i / n, 0.9), x = lerp(ax, bx, u), y = lerp(ay, by, u), w = wid(u) * 0.55;
        q.strokeStyle = `rgba(60,42,28,${0.55 - u * 0.25})`; q.lineWidth = lerp(1.6, 0.8, u);
        q.beginPath(); q.moveTo(x - w, y + w * 0.64); q.lineTo(x + w, y - w * 0.64); q.stroke();
        q.fillStyle = `rgba(255,236,200,${0.06 + r() * 0.08})`;
        q.beginPath(); q.moveTo(x - w, y + w * 0.64); q.lineTo(x + w, y - w * 0.64); q.lineTo(x + w + 6, y - w * 0.64 - 2); q.lineTo(x - w + 6, y + w * 0.64 - 2); q.closePath(); q.fill();
      }
      // 迎光的边沿
      q.strokeStyle = 'rgba(255,226,170,0.6)'; q.lineWidth = 1.4;
      q.beginPath(); q.moveTo(ax + wid(0) * 0.55, ay - wid(0) * 0.35); q.lineTo(bx + wid(1) * 0.55, by - wid(1) * 0.35); q.stroke();
      // 系船桩
      q.fillStyle = '#33281f'; q.fillRect(ax - 6, ay - 26, 9, 30); q.fillStyle = '#5a4634'; q.fillRect(ax - 7, ay - 28, 11, 4);
    });
  }
  // 水中倒影（天、远岸、左岸房子、客栈）烘成一张：静水倒影不必逐帧重画，贴的时候按条错开一点就有水波
  const IN4R = { y0: IN4.shore, h: 870 };
  function in4ReflSrc() {
    return K.cache('g01in4reflsrc3', W + 80, IN4R.h, 0.5, (q) => {
      q.translate(40, 0);
      // 倒影越往近处越是天顶的颜色（更蓝、更深）
      q.fillStyle = K.lin(q, 0, 0, 0, IN4R.h, [[0, '#efdcb2'], [0.36, '#c9cfd0'], [0.48, '#c2cbcf'], [1, '#8a9ea9']]); q.fillRect(-40, 0, W + 80, IN4R.h);
      // 以远岸水线为轴：世界 y → 贴图第 (水线 - y) 行
      q.save(); q.translate(0, IN4R.y0); q.scale(1, -1);
      q.drawImage(in4Sky(), -20, 0, W + 40, IN4.shore + 6);
      q.drawImage(in4Left(), IN4L.x, IN4L.y, 600, 360);
      q.restore();
      // 天的倒影远端（天顶）与底色之间不留硬边
      q.fillStyle = K.lin(q, 0, IN4.shore - 120, 0, IN4.shore + 30, [[0, 'rgba(196,204,208,0)'], [1, 'rgba(196,204,208,1)']]); q.fillRect(-40, IN4.shore - 120, W + 80, 150);
      // 客栈以自己的台基水线为轴，只留三成五
      const wl = in4InnWL();
      q.save(); q.globalAlpha = 0.35; q.translate(0, wl - IN4R.y0); q.scale(1, -1); q.translate(0, -wl);
      E.inn(q, { x: IN4.innX, y: IN4.innY, s: IN4.innS, t: 0, lit: 0.18, wind: 0, flag: false, bank: true, bankH: IN4.bankH, wood: '#5a3c28', haze: '#efe2c4', hazeA: 0.12 });
      q.restore();
    });
  }
  function in4Refl() {
    return K.cache('g01in4refl6', W + 80, IN4R.h, 1, (q) => {
      // 半分辨率画好的倒影放大一次、顺手糊一下（倒影本来就柔）
      if ('filter' in q) q.filter = `blur(${(1.3 * ((XYT.sprites && XYT.sprites.S) || 1)).toFixed(2)}px)`;
      q.drawImage(in4ReflSrc(), 0, 0, W + 80, IN4R.h);
      q.filter = 'none';
      // 水色：近水线处偏暖，越近越带青
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = K.lin(q, 0, 0, 0, IN4R.h, [[0, 'rgba(230,214,180,0.3)'], [0.4, 'rgba(160,170,166,0.32)'], [1, 'rgba(90,112,124,0.45)']]); q.fillRect(0, 0, W + 80, IN4R.h);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 静水：烘好的倒影分条错开 + 光路上的碎金 + 几道水纹
  function in4Water(g, t, camY) {
    const y0 = IN4R.y0, R = in4Refl(), rows = 18, k = R.height / IN4R.h;
    const vis0 = camY - 10, vis1 = camY + H + 10;
    const sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < rows; i++) {
      const v0 = Math.pow(i / rows, 1.5), v1 = Math.pow((i + 1) / rows, 1.5), ya = v0 * IN4R.h, yb = v1 * IN4R.h;
      if (y0 + yb < vis0 || y0 + ya > vis1) continue;
      const dx = Math.sin(i * 1.7 - t * 1.6) * (0.6 + 3 * v0) + Math.sin(i * 0.6 + t * 0.7) * 1.5 * v0;
      g.drawImage(R, 0, ya * k, R.width, (yb - ya) * k + 0.5, -40 + dx, y0 + ya, W + 80, yb - ya + 0.5);
    }
    g.imageSmoothingEnabled = sm;
    // 光路上的碎金：栈道与客栈之间的水面，一片明灭的短横
    g.save(); g.globalCompositeOperation = 'screen';
    const spr = XYT.sprites.tint(XYT.sprites.glow, '#ffe2a6');
    for (let i = 0; i < 14; i++) {
      const u = h2(i, 3), yy = 470 + Math.pow(h2(i, 4), 1.3) * 150, f = noise1(t * 1.8 + i * 0.9, 5);
      if (f < 0.42) continue;
      const xx = 600 + u * 360 + Math.sin(t * 1.3 + i) * 6 - (yy - 470) * 0.8, len = 18 + (yy - 470) * 0.35;
      g.globalAlpha = Math.min(1, (f - 0.42) * 1.8);
      g.drawImage(spr, xx - len / 2, yy - 2, len, 4 + (yy - 470) * 0.02);
    }
    g.restore();
    // 水纹
    g.strokeStyle = 'rgba(255,248,232,0.2)'; g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const u = Math.pow(h2(i, 41), 1.4), yy = y0 + 8 + u * 820;
      if (yy < vis0 || yy > vis1) continue;
      const len = (30 + h2(i, 42) * 90) * (0.4 + u * 1.5), x = ((h2(i, 43) * (W + 300) + t * (6 + 10 * u)) % (W + 300)) - 150;
      g.moveTo(x, yy); g.lineTo(x + len, yy);
    }
    g.stroke();
    // 远岸水线一道柔光
    g.fillStyle = K.lin(g, 0, y0 - 10, 0, y0 + 14, [[0, 'rgba(244,232,206,0)'], [0.5, 'rgba(244,232,206,0.5)'], [1, 'rgba(244,232,206,0)']]); g.fillRect(-40, y0 - 10, W + 80, 24);
  }
  // 丁达尔光：日头藏在客栈屋脊后，三束光往左下斜穿雾带，落在栈道上；光束之间压一点冷灰的暗影衬出光来
  // （光与影烘进同一张低分辨率贴图，一次普通叠加贴完）
  const IN4B = { x: 380, y: 160, w: 700, h: 470 };
  function in4Rays() {
    return K.cache('g01in4rays6', IN4B.w, IN4B.h, 0.3, (q) => {
      q.translate(-IN4B.x, -IN4B.y);
      const [sx, sy] = IN4.sun, len = 720;
      const wedge = (ang, w, stops) => {
        const gr = q.createLinearGradient(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
        stops.forEach(([o, col]) => gr.addColorStop(o, col));
        q.fillStyle = gr;
        q.beginPath(); q.moveTo(sx, sy); q.lineTo(sx + Math.cos(ang - w) * len, sy + Math.sin(ang - w) * len); q.lineTo(sx + Math.cos(ang + w) * len, sy + Math.sin(ang + w) * len); q.closePath(); q.fill();
      };
      for (const [ang, wid] of [[2.69, 0.04], [2.85, 0.05]]) for (let j = 0; j < 4; j++) wedge(ang, wid * (0.5 + j * 0.3), [[0, 'rgba(104,110,128,0)'], [0.18, 'rgba(104,110,128,0.12)'], [0.6, 'rgba(104,110,128,0.1)'], [1, 'rgba(104,110,128,0)']]);
      for (const [ang, wid, a] of [[2.62, 0.075, 0.75], [2.76, 0.11, 1], [2.93, 0.08, 0.8]]) for (let j = 0; j < 5; j++) {
        wedge(ang, wid * (0.45 + j * 0.28), [[0, 'rgba(255,232,176,0)'], [0.12, `rgba(255,232,176,${0.42 * a})`], [0.55, `rgba(255,226,164,${0.27 * a})`], [1, 'rgba(255,226,164,0)']]);
      }
    });
  }
  // 水面上漂着的几片红叶（开镜往下看水时就在画里）
  function in4Floaters(g, t, lt) {
    for (let k = 0; k < 5; k++) {
      const x = 160 + 230 * k + 60 * h2(k, 3) + lt * (6 + 4 * h2(k, 4)), y = 650 + 420 * h2(k, 5) + Math.sin(t * 0.8 + k) * 3;
      const s = 26 + 10 * h2(k, 6);
      g.save(); g.translate(x, y); g.scale(1, 0.55);
      g.fillStyle = 'rgba(40,52,58,0.12)'; g.beginPath(); g.ellipse(4, 8, s * 0.7, s * 0.5, 0, 0, TAU); g.fill();
      g.restore();
      g.save(); g.translate(x, y); g.scale(1, 0.55);
      mapleLeaf(g, 0, 0, s, h2(k, 7) * TAU + t * 0.04, 1, ['#c4422a', '#dd7a2e', '#b8361f', '#e39a3a', '#cf5a2a'][k]);
      g.restore();
    }
  }
  // 落叶：从左上的枫树飘下，每拍放一片
  function in4Leaves(g, c, t, ts) {
    const i0 = beatIdx0(c);
    for (let k = 0; k < 8; k++) {
      const t0 = c.grid.time(i0 + k), age = t - t0;
      if (age < 0) continue;
      const sz = 22 + 18 * h2(k, 5), x0 = 140 + 220 * h2(k, 6), y0 = 150 + 40 * h2(k, 7);
      const x = x0 + age * (34 + 26 * h2(k, 8)) + Math.sin(age * 1.6 + k) * 30, y = y0 + age * (52 + 20 * h2(k, 9)) + Math.sin(age * 2.3 + k) * 8;
      if (y > 760) continue;
      const flip = Math.cos(age * (2.2 + h2(k, 10)) + k * 2);
      mapleLeaf(g, x, y, sz * (0.6 + 0.4 * Math.abs(flip)), age * (1.2 + h2(k, 11)) + k, flip > 0 ? 1 : -1, ['#c4422a', '#dd7a2e', '#b8361f', '#e39a3a'][k % 4]);
    }
  }
  XYT.registerShot('in4_return', {
    name: '白发归人', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(238,222,176,0.85)', accent: '#e29c45', bloom: 0.26,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = IN4.hz, wy = IN4.wy;
      const d0 = downIdx0(c), tDock = c.grid.time(d0 + 4), ts = shotStart(c);
      // 上摇：开镜只见水里的倒影，3.2 s 内摇到正片
      const camY = IN4.tilt * (1 - easeInOut(clamp((lt - 0.2) / 3.0)));
      const sinceDock = t - tDock, mistK = 1 - 0.45 * smooth(lt / c.dur);
      g.save(); g.translate(0, -camY);
      // ---------- 天、远岸、左岸房子 ----------
      if (camY < IN4.shore + 10) {
        blitN(g, in4Sky(), -20, 0, W + 40, IN4.shore + 6);
        g.drawImage(in4Left(), IN4L.x, IN4L.y, 600, 360);
        E.mist(g, { t, y: hz - 8, h: 70, color: '#f6ead0', alpha: 0.55 * mistK, speed: 4, seed: 3 });
      }
      // ---------- 水 ----------
      in4Water(g, t, camY);
      E.mist(g, { t, y: IN4.shore + 34, h: 80, color: '#f5ecd8', alpha: 0.45 * mistK, speed: -7, seed: 5 });
      in4Floaters(g, t, lt);
      // ---------- 丁达尔光（从屋脊后射出，逐拍呼吸） ----------
      g.save();
      g.globalAlpha = clamp(0.95 * (0.75 + 0.3 * c.be(0.6)) * (0.6 + 0.4 * smooth((lt - 0.8) / 2.4)));
      g.drawImage(in4Rays(), IN4B.x, IN4B.y, IN4B.w, IN4B.h);
      g.restore();
      // ---------- 酒旗（左上，竹竿立在岸边） ----------
      const fx = 352, ftop = 96, wind = 0.7 + 0.2 * Math.sin(t * 0.7);
      if (camY < 420) {
        g.strokeStyle = '#5a4630'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(fx + 14, IN4.shore + 4); g.lineTo(fx, ftop - 8); g.stroke();
        g.strokeStyle = 'rgba(255,230,180,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fx + 16, IN4.shore + 4); g.lineTo(fx + 2, ftop - 8); g.stroke();
        drawFlag(g, fx + 1, ftop, fx + 4, ftop + 108, 50, (u) => 0.45 - 0.35 * wind + Math.sin(t * 4.2 - u * 8) * 0.5 * (0.25 + u) + u * 0.2, { n: 14 });
      }
      // ---------- 客栈 ----------
      g.drawImage(in4Inn(), IN4I.x, IN4I.y, IN4I.w, IN4I.h);
      // ---------- 船：从左滑入，强拍时船头靠上栈道头，船身一顿 ----------
      const bs = 0.92, xDock = IN4.head[0] - 150 * bs - 4, D = 230, T = tDock - ts;
      let bxp, rot = 0, jolt = 0;
      if (sinceDock < 0) { const u = clamp((t - ts) / T); bxp = xDock - D * (1 - u) * (1 - u); }
      else { jolt = Math.exp(-sinceDock / 0.55); bxp = xDock - 7 * (1 - Math.exp(-sinceDock / 0.08)) * Math.exp(-sinceDock / 0.7); rot = -0.035 * jolt * Math.sin(sinceDock * 10); }
      const bob = Math.sin(t * 1.2) * 2 + (sinceDock > 0 ? 3 * jolt * Math.sin(sinceDock * 8) : 0);
      const deckY = wy - 12 * bs + bob;
      // 他：先立在船头，靠岸后起步，一拍一步走上栈道；脚下不打滑，越远越小（按地面透视缩放）
      const stride = 1.4, v = F.walkSpeed('xiaoyao', 1, { speed: 0.706, stride }), tWalk = tDock + 0.15;
      const xa = IN4.head[0] + 12, s0 = 0.92, kS = s0 * ((IN4.head[1] - IN4.end[1]) / (IN4.end[0] - IN4.head[0])) / (IN4.head[1] - hz);
      let fxp = bxp + 96 * bs, fy = deckY, fs = s0, walking = false;
      if (t > tWalk) {
        walking = true;
        const x0w = xDock + 96 * bs, ta = tWalk + (xa - x0w) / (v * s0);
        if (t < ta) { fxp = x0w + v * s0 * (t - tWalk); fy = lerp(deckY, in4PierY(xa), smooth((fxp - x0w) / (xa - x0w))); }
        else { fs = s0 * Math.exp(-kS * v * (t - ta)); fxp = xa + (s0 - fs) / kS; fy = in4PierY(fxp); }
      }
      const fo = { stage: 'old', facing: 1, pose: walking ? 'walk' : 'stand', speed: 0.706, stride, phase: -TAU * 0.6 * tDock, wind: 0.45, windDir: -1, ribbon: '#4c8dae', tassel: '#6d7478',
        rim: '#ffd28a', light: IN4.sun, rimAlpha: 1, rimWidth: 3, lean: walking ? 0 : -0.06 * jolt * Math.sin(sinceDock * 9) };
      const man = { x: bxp - 92 * bs, y: deckY - 2 };
      // ---------- 倒影：船、两个人（画进半分辨率缓冲再翻过来） ----------
      const rx0 = Math.floor(Math.min(bxp - 150 * bs, man.x - 50)), rx1 = Math.ceil(Math.max(bxp + 152 * bs, fxp + 70)), ry0 = 350, rw = rx1 - rx0, rh = 260;
      const RB = buf('in4rf', rw, rh, 0.5), rq = RB.q;
      rq.translate(-rx0, -ry0);
      F.draw(rq, 'villager', man.x, man.y, 0.86, t, { facing: 1, variant: 0, pose: 'stand', lean: 0.1, wind: 0.3, tone: 'silhouette', ink: '#3a342c' });
      // 他的倒影以脚下的水面为轴（上了栈道就是栈道下的水面）：在缓冲里挪到对应位置，统一按船的水线翻转
      const axH = fxp >= xa ? in4PierY(fxp) + 14 : wy;
      F.draw(rq, 'xiaoyao', fxp, fy + 2 * (wy - axH), fs, t, Object.assign({}, fo, { rim: null, tone: 'silhouette', ink: '#4a5258' }));
      drawBoat(rq, bxp, wy + bob, bs, rot, '#3b2f26', '#26252a');
      g.save(); g.beginPath(); g.rect(-40, 470, W + 80, 420); g.clip();
      g.translate(0, 2 * wy + 4); g.scale(1, -1); g.globalAlpha = 0.32;
      g.drawImage(RB.cv, 0, 0, RB.pw, RB.ph, rx0, ry0, rw, rh);
      g.restore();
      // ---------- 栈道 ----------
      g.drawImage(in4Pier(), IN4P.x, IN4P.y, IN4P.w, IN4P.h);
      // ---------- 船夫与篙：撑住不动，靠岸时一记刹船 ----------
      const brake = sinceDock > -0.25 ? Math.exp(-Math.max(0, sinceDock) / 0.35) * smooth((sinceDock + 0.25) / 0.2) : 0;
      const hand = [man.x + 10, man.y - 92], tip = [man.x + 30 + 50 * brake, wy + 4];
      const pdx = tip[0] - hand[0], pdy = tip[1] - hand[1], pdl = Math.hypot(pdx, pdy);
      F.draw(g, 'villager', man.x, man.y, 0.86, t, { facing: 1, variant: 0, pose: 'stand', lean: 0.1 + 0.12 * brake, wind: 0.3, tone: 'silhouette', ink: '#3a342c' });
      g.strokeStyle = '#3a3329'; g.lineWidth = 3.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(hand[0] - pdx / pdl * 70, hand[1] - pdy / pdl * 70); g.lineTo(tip[0], tip[1]); g.stroke();
      if (sinceDock > 0) E.ripples(g, { x: tip[0], y: wy + 6, t, t0: tDock, scale: 0.8, color: '#fff6e4', alpha: 0.45, life: 2 });
      // 船尾拖出的两道浅浅的水痕，船慢下来就淡了
      const spd = sinceDock < 0 ? 2 * D * (1 - clamp((t - ts) / T)) / T : 0;
      if (spd > 4) {
        const wa = Math.min(0.5, spd / 160);
        g.strokeStyle = rgba('#fff6e2', wa); g.lineWidth = 1.6;
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(bxp - 120 * bs, wy + 4); g.quadraticCurveTo(bxp - 220 * bs, wy + 4 + sd * 6, bxp - 330 * bs, wy + 4 + sd * 16 + (sd > 0 ? 10 : 0)); g.stroke(); }
      }
      drawBoat(g, bxp, wy + bob, bs, rot, '#3b2f26', '#26252a');
      if (sinceDock > 0) E.ripples(g, { x: IN4.head[0] - 6, y: wy + 2, t, t0: tDock, scale: 1.6, color: '#fff3dc', alpha: 0.6, life: 3 });
      // ---------- 他（酒葫芦系在胯侧，挂在近侧手臂后） ----------
      const pts = F.points('xiaoyao', fxp, fy, fs, t, fo);
      F.draw(g, 'xiaoyao', fxp, fy, fs, t, Object.assign({ part: 'back' }, fo));
      const gs = 0.22 * fs, gx0 = pts.pelvis[0] + 4 * fs, gy0 = pts.pelvis[1] + 2 * fs, sw = Math.sin(t * 2.4) * 0.08 + (walking ? 0.12 * Math.sin(t * TAU * 0.6) : 0);
      const gx = gx0 + Math.sin(sw) * 16 * fs, gy = gy0 + Math.cos(sw) * 16 * fs;
      g.strokeStyle = '#8a3a2a'; g.lineWidth = 1.2 * fs; g.beginPath(); g.moveTo(gx0, gy0); g.lineTo(gx, gy - 2 * fs); g.stroke();
      E.gourd(g, { x: gx, y: gy + 50 * gs, s: gs, t, angle: sw, color: '#9a6430', cord: '#8a3a2a' });
      F.draw(g, 'xiaoyao', fxp, fy, fs, t, Object.assign({ part: 'front' }, fo));
      // 近处水面一层薄雾
      E.mist(g, { t, y: 640, h: 110, color: '#f5ecd8', alpha: 0.22 * mistK, speed: 6, seed: 9 });
      // ---------- 丁达尔光（逐拍呼吸）与光里的浮尘 ----------
      g.save(); g.globalCompositeOperation = 'screen';
      const [sx, sy] = IN4.sun;
      for (let i = 0; i < 12; i++) {
        const an = 2.62 + 0.31 * h2(i, 71), d = 160 + ((h2(i, 72) * 520 + t * (10 + 8 * h2(i, 73))) % 520);
        const px = sx + Math.cos(an) * d + Math.sin(t * 0.8 + i) * 8, py = sy + Math.sin(an) * d + Math.cos(t * 0.6 + i) * 6;
        glow(g, px, py, 3 + 4 * h2(i, 74), '#fff0c8', 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7)));
      }
      g.restore();
      in4Leaves(g, c, t, ts);
      g.restore();
    },
  });

  // ======================================================================
  // in5_banner 酒旗风起：低机位仰拍；一阵风自左向右推过——先掀旗尾，再弯竹竿，最后吹起白发与蓝发带
  // ======================================================================
  // 酒旗挂在竹竿梢上：两根绳吊一根横木，旗布从横木垂下（“酒”字正立）；日头在旗后，旗面透光
  const IN5 = { base: [-30, 800], tip: [520, 40], sun: [560, 318], calmAt: 2.32, front: -0.35, speed: 1100 };
  // 风：前沿自左向右推进（转场时已出发，约 1100 px/s），0.5 s 吹满；风停后 0.9 s 慢慢落下。G 为整体风量的积分（推云、叶、尘）
  const in5W = (x, lt) => { const a = smooth((lt - IN5.front - x / IN5.speed) / 0.5), b = 1 - smooth((lt - IN5.calmAt) / 0.9); return a * b; };
  function in5G(lt) {
    const seg = (x0, x1, y) => clamp(y - x0, 0, x1 - x0);
    return seg(-0.1, 0.4, lt) * 0.5 + seg(0.4, IN5.calmAt, lt) + seg(IN5.calmAt, IN5.calmAt + 0.9, lt) * 0.4;
  }
  function in5Sky() {
    return K.cache('g01in5sky3', W + 40, H + 40, 1, (q) => {
      q.translate(20, 20);
      q.fillStyle = K.lin(q, 0, -20, 0, H + 20, [[0, '#a7c0cd'], [0.35, '#d3dcd6'], [0.7, '#efdfb6'], [1, '#f0cf94']]); q.fillRect(-20, -20, W + 40, H + 40);
      const [sx, sy] = IN5.sun;
      A.softBlob(q, sx, sy, 760, 0.5, '#ffd99a');
      A.softBlob(q, sx, sy, 300, 0.7, '#fff0c8');
      A.softBlob(q, sx, sy, 90, 0.95, '#fffbea');
      // 右下（人头背后）压一片偏冷的蓝灰，白发靠它衬出来
      q.fillStyle = K.rad(q, 1160, 700, 40, 520, [[0, 'rgba(150,176,190,0.62)'], [0.55, 'rgba(159,180,192,0.38)'], [1, 'rgba(159,180,192,0)']]); q.fillRect(-20, -20, W + 40, H + 40);
      // 高空几缕细云
      const r = rng(55);
      for (let i = 0; i < 9; i++) { const x = 760 + r() * 520, y = 60 + r() * 220, l = 160 + r() * 260; E.util.streak(q, x, y, l, 5 + r() * 7, '#fff6e6', 0.35 + r() * 0.2, -0.08 + r() * 0.05); }
    });
  }
  // 屋檐（从下往上看）：檐底的椽子一根根排开，檐口一排椽头和瓦当，檐角上翘
  function in5Eave() {
    return K.cache('g01in5eave2', 600, 280, 1, (q) => {
      const edge = (u) => [lerp(-20, 520, u), lerp(210, 30, u) - Math.pow(u, 5) * 34];
      q.beginPath(); q.moveTo(-20, -20); q.lineTo(560, -20);
      for (let i = 40; i >= 0; i--) { const [x, y] = edge(i / 40); q.lineTo(x, y); }
      q.closePath();
      q.fillStyle = K.lin(q, 0, 0, 260, 240, [[0, '#15110e'], [1, '#2c221b']]); q.fill();
      q.save(); q.clip();
      for (let i = 0; i < 30; i++) {
        const u = (i + 0.5) / 30, [x, y] = edge(u), dx = -0.55, dy = -1;
        q.strokeStyle = 'rgba(96,72,52,0.55)'; q.lineWidth = 6;
        q.beginPath(); q.moveTo(x, y - 8); q.lineTo(x + dx * 300, y - 8 + dy * 300); q.stroke();
        q.strokeStyle = 'rgba(255,214,160,0.12)'; q.lineWidth = 1.5;
        q.beginPath(); q.moveTo(x + 2, y - 8); q.lineTo(x + 2 + dx * 300, y - 8 + dy * 300); q.stroke();
      }
      q.restore();
      for (let i = 0; i < 30; i++) { const u = (i + 0.5) / 30, [x, y] = edge(u); q.fillStyle = '#3e3024'; q.beginPath(); q.arc(x, y - 6, 4.2, 0, TAU); q.fill(); q.fillStyle = 'rgba(255,214,150,0.4)'; q.beginPath(); q.arc(x + 0.8, y - 7, 1.6, 0, TAU); q.fill(); }
      for (let i = 0; i < 38; i++) { const u = (i + 0.5) / 38, [x, y] = edge(u); q.fillStyle = '#25201c'; q.beginPath(); q.arc(x, y + 2, 7, 0, PI); q.fill(); q.strokeStyle = 'rgba(255,220,160,0.45)'; q.lineWidth = 1.1; q.beginPath(); q.arc(x, y + 2, 7, 0.25, PI - 0.25); q.stroke(); }
      q.strokeStyle = 'rgba(255,214,150,0.6)'; q.lineWidth = 1.8;
      q.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = edge(i / 40); i ? q.lineTo(x, y + 9) : q.moveTo(x, y + 9); } q.stroke();
    });
  }
  // 近处二楼的美人靠：仰拍时只露出一截暗色栏杆
  function in5Rail() {
    return K.cache('g01in5rail', 760, 180, 1, (q) => {
      const top = (x) => 92 + x * 0.1;
      q.fillStyle = '#2a201a';
      q.beginPath(); q.moveTo(0, top(0)); for (let x = 0; x <= 760; x += 20) q.lineTo(x, top(x) - Math.sin((x / 760) * PI) * 10); q.lineTo(760, 190); q.lineTo(0, 190); q.closePath(); q.fill();
      q.strokeStyle = '#3b2e24'; q.lineWidth = 5;
      for (let x = 10; x < 700; x += 22) { q.beginPath(); q.moveTo(x, top(x) - 8); q.bezierCurveTo(x + 6, top(x) - 30, x - 6, top(x) - 52, x + 2, top(x) - 70); q.stroke(); }
      q.strokeStyle = '#4a3a2c'; q.lineWidth = 9;
      q.beginPath(); for (let x = 0; x <= 720; x += 20) { const y = top(x) - 72 - Math.sin((x / 760) * PI) * 6; x ? q.lineTo(x, y) : q.moveTo(x, y); } q.stroke();
      q.strokeStyle = 'rgba(255,214,150,0.5)'; q.lineWidth = 2;
      q.beginPath(); for (let x = 0; x <= 720; x += 20) { const y = top(x) - 77 - Math.sin((x / 760) * PI) * 6; x ? q.lineTo(x, y) : q.moveTo(x, y); } q.stroke();
      q.globalCompositeOperation = 'destination-out';
      q.fillStyle = K.lin(q, 560, 0, 760, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]); q.fillRect(560, 0, 200, 180);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 枫叶：五裂，叶身饱满
  function mapleLeaf(g, x, y, s, rot, flip, col) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s * flip, s);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, 0.25);
    const lobes = [[-2.6, 0.66], [-2.08, 0.92], [-1.57, 1], [-1.06, 0.92], [-0.54, 0.66]];
    lobes.forEach(([a, L], k) => {
      const a0 = a - 0.3, a1 = a + 0.3;
      g.quadraticCurveTo(Math.cos(a0) * L * 0.55, Math.sin(a0) * L * 0.55, Math.cos(a0 + 0.1) * L * 0.85, Math.sin(a0 + 0.1) * L * 0.85);
      g.lineTo(Math.cos(a) * L, Math.sin(a) * L);
      g.lineTo(Math.cos(a1 - 0.1) * L * 0.85, Math.sin(a1 - 0.1) * L * 0.85);
      if (k < 4) g.quadraticCurveTo(Math.cos(a1) * L * 0.5, Math.sin(a1) * L * 0.5, Math.cos(a1 + 0.12) * 0.3, Math.sin(a1 + 0.12) * 0.3);
    });
    g.quadraticCurveTo(0.35, 0.2, 0, 0.25); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,24,8,0.45)'; g.lineWidth = 0.04;
    g.beginPath(); for (const [a, L] of lobes) { g.moveTo(0, 0.15); g.lineTo(Math.cos(a) * L * 0.85, Math.sin(a) * L * 0.85); } g.moveTo(0, 0.15); g.lineTo(0.02, 0.7); g.stroke();
    g.restore();
  }
  // 旗布贴图（竖挂）：暖白旧布、褪色的赭红镶边、淡了的“酒”字、下摆毛边；另一张是逆光层（布纹、字的剪影）
  const BAN = { w: 190, h: 380 };
  function bannerTex() {
    const fk = fontKey('酒');
    return K.cache('g01ban|' + fk, BAN.w, BAN.h + 20, 1.5, (q) => {
      const w = BAN.w, h = BAN.h, r = rng(2005);
      q.fillStyle = '#ecdcb0';
      q.beginPath(); q.moveTo(0, 0); q.lineTo(w, 0); q.lineTo(w, h - 10);
      // 下摆毛边
      for (let i = 12; i >= 0; i--) { const x = (i / 12) * w; q.lineTo(x, h - 8 + (i % 2 ? 10 : 0) + (r() - 0.5) * 4); }
      q.closePath(); q.fill();
      q.save(); q.clip();
      for (let i = 0; i < 24; i++) A.softBlob(q, r() * w, r() * h, 20 + r() * 50, 0.08 + r() * 0.08, r() < 0.5 ? '#c9a46a' : '#fff6dc');
      // 褪色镶边
      q.strokeStyle = 'rgba(190,96,42,0.72)'; q.lineWidth = 9; q.strokeRect(10, 10, w - 20, h - 34);
      q.strokeStyle = 'rgba(160,80,40,0.32)'; q.lineWidth = 2; q.strokeRect(22, 22, w - 44, h - 58);
      // “酒”字：墨色褪成赭褐
      q.globalAlpha = 0.68; q.fillStyle = '#4a2e1c'; q.font = `${w * 0.74}px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText('酒', w / 2, h * 0.47);
      q.globalAlpha = 1;
      // 磨薄的布、小破洞
      q.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 40; i++) { q.globalAlpha = 0.12 + r() * 0.22; q.beginPath(); q.arc(r() * w, r() * h, 2 + r() * 8, 0, TAU); q.fill(); }
      q.globalAlpha = 0.9; A.inkBlob(q, w - 34, h * 0.74, 5, 3, 0.5); q.fill(); A.inkBlob(q, 40, h * 0.2, 3, 8, 0.5); q.fill();
      q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
      q.restore();
    });
  }
  function bannerBackTex() {
    const fk = fontKey('酒');
    return K.cache('g01banb2|' + fk, BAN.w, BAN.h + 20, 1.5, (q) => {
      const w = BAN.w, h = BAN.h;
      // 逆光时透出来的布纹
      const r = rng(31);
      q.lineWidth = 0.6;
      for (let x = 2; x < w; x += 2.5 + r() * 2) { q.strokeStyle = `rgba(150,96,46,${0.04 + r() * 0.07})`; q.beginPath(); q.moveTo(x, 0); q.lineTo(x + (r() - 0.5) * 2, h - 6); q.stroke(); }
      for (let y = 2; y < h - 6; y += 2.5 + r() * 2) { q.strokeStyle = `rgba(150,96,46,${0.03 + r() * 0.05})`; q.beginPath(); q.moveTo(0, y); q.lineTo(w, y + (r() - 0.5) * 2); q.stroke(); }
      // 镶边与字：逆光里变成深色剪影
      q.strokeStyle = 'rgba(120,52,20,0.55)'; q.lineWidth = 9; q.strokeRect(10, 10, w - 20, h - 34);
      q.fillStyle = 'rgba(52,28,14,0.85)'; q.font = `${w * 0.74}px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText('酒', w / 2, h * 0.47);
    });
  }
  // 旗布网格：NU 格横向 × NV 格纵向；每格按三个角做仿射贴图（略放大一点盖住接缝）
  const NU = 5, NV = 8;
  function in5Mesh(t, lt, bat) {
    const P = [];
    const [c0, c1] = bat;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU, col = [];
      let x = lerp(c0[0], c1[0], u), y = lerp(c0[1], c1[1], u);
      col.push([x, y]);
      for (let j = 0; j < NV; j++) {
        const v = (j + 0.5) / NV;
        // 旗尾先起：越靠下摆，风到得越早；横向带一点扭（靠外侧的一边先扬）
        const w = in5W(x, lt + 0.22 * v - 0.08 * (1 - u));
        const lift = 1.22 * w * (0.55 + 0.45 * v), flap = Math.sin(t * (2.2 + 7 * w) - v * 6.5 + u * 1.4) * (0.04 + 0.26 * w) * (0.25 + v);
        const idle = Math.sin(t * 1.3 + v * 2.2) * 0.05 * (1 - w) + Math.sin(t * 0.7) * 0.03;
        const a = lift + flap + idle - 0.05 * (u - 0.5) * w;
        const dl = BAN.h / NV * (1 - 0.06 * w * Math.abs(Math.sin(t * 5 - v * 6)));
        x += Math.sin(a) * dl; y += Math.cos(a) * dl;
        col.push([x, y]);
      }
      P.push(col);
    }
    return P;
  }
  function in5Banner(g, t, lt, bat, litK) {
    const P = in5Mesh(t, lt, bat);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const col of P) for (const [x, y] of col) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.floor(x0 - 12); y0 = Math.floor(y0 - 12); x1 = Math.ceil(x1 + 14); y1 = Math.ceil(y1 + 22);
    const B = buf('in5ban', x1 - x0, y1 - y0, 0.5), q = B.q;
    q.translate(-x0, -y0);
    const tex = bannerTex(), back = bannerBackTex(), m = q.getTransform();
    const cells = (img, al) => {
      const iw = img.width, ih = img.height * (BAN.h / (BAN.h + 20));
      q.globalAlpha = al;
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        const [ax, ay] = P[i][j], [bx, by] = P[i + 1][j], [cx, cy] = P[i][j + 1];
        const ux = bx - ax, uy = by - ay, vx = cx - ax, vy = cy - ay;
        q.setTransform(m.a * ux + m.c * uy, m.b * ux + m.d * uy, m.a * vx + m.c * vy, m.b * vx + m.d * vy, m.a * ax + m.c * ay + m.e, m.b * ax + m.d * ay + m.f);
        const ex = j === NV - 1 ? 20 / BAN.h * NV : 0;
        q.drawImage(img, (i / NU) * iw, (j / NV) * ih, iw / NU, ih / NV * (1 + ex), -0.01, -0.01, 1.05, 1.05 * (1 + ex));
      }
      q.setTransform(m); q.globalAlpha = 1;
    };
    cells(tex, 1);
    // 褶的明暗：沿旗身方向一道渐变（按每段转角的变化取明暗）
    const mid = (j) => [(P[0][j][0] + P[NU][j][0]) / 2, (P[0][j][1] + P[NU][j][1]) / 2];
    const [sx0, sy0] = mid(0), [sx1, sy1] = mid(NV);
    q.globalCompositeOperation = 'source-atop';
    const fg = q.createLinearGradient(sx0, sy0, sx1, sy1);
    for (let j = 0; j <= NV; j++) {
      const a = mid(Math.max(0, j - 1)), b = mid(j), c = mid(Math.min(NV, j + 1));
      const k = ((c[0] - b[0]) * (b[1] - a[1]) - (c[1] - b[1]) * (b[0] - a[0])) / (BAN.h / NV) / (BAN.h / NV);
      fg.addColorStop(j / NV, k > 0 ? `rgba(80,52,30,${Math.min(0.32, k * 2.2)})` : `rgba(255,246,222,${Math.min(0.3, -k * 2)})`);
    }
    q.fillStyle = fg; q.fillRect(x0, y0, x1 - x0, y1 - y0);
    // 日头在旗后：靠近日头的布透出暖光
    const [sx, sy] = IN5.sun;
    q.fillStyle = K.rad(q, sx, sy, 0, 260, [[0, `rgba(255,232,182,${0.8 * litK})`], [0.5, `rgba(255,226,170,${0.42 * litK})`], [1, 'rgba(255,226,170,0)']]);
    q.fillRect(x0, y0, x1 - x0, y1 - y0);
    q.globalCompositeOperation = 'source-over';
    // 逆光层：布纹与“酒”字的剪影，离日头越近越显
    let near = 0;
    for (let j = 1; j < NV; j += 2) { const [mx, my] = mid(j); near = Math.max(near, Math.exp(-((mx - sx) * (mx - sx) + (my - sy) * (my - sy)) / (2 * 170 * 170))); }
    if (near * litK > 0.04) cells(back, clamp(near * litK * 1.1));
    g.drawImage(B.cv, 0, 0, B.pw, B.ph, x0, y0, x1 - x0, y1 - y0);
    return P;
  }
  // 白发人的过肩镜头（静的部分烘成贴图）：灰布长衫的肩线与素白领口、颈、侧脸（耳与下颌的轮廓）、
  // 后脑梳向发髻的白发（细发丝）、背上斜出的剑柄。光从左上（日头）来，左侧边缘一线暖光
  const IN5H = { tie: [1134, 540] };
  function in5Body() {
    return K.cache('g01in5body4', 460, 300, 1, (q) => {
      q.translate(-840, -440);
      q.lineCap = 'round'; q.lineJoin = 'round';
      // 剑：从右肩后斜出
      q.strokeStyle = '#2a2622'; q.lineWidth = 11;
      q.beginPath(); q.moveTo(1196, 724); q.lineTo(1258, 566); q.stroke();
      q.fillStyle = '#5a4a34'; q.save(); q.translate(1240, 612); q.rotate(-1.19); q.fillRect(-4, -20, 8, 40); q.restore();
      q.strokeStyle = '#3a3029'; q.lineWidth = 8; q.beginPath(); q.moveTo(1242, 608); q.lineTo(1266, 546); q.stroke();
      q.strokeStyle = 'rgba(255,214,150,0.4)'; q.lineWidth = 1.6; q.beginPath(); q.moveTo(1239, 606); q.lineTo(1263, 544); q.stroke();
      // 从背后看：后脑全是白发，只在左下露出一线下颌与耳廓的边（逆光的暖边）
      const [hx, hy] = [1130, 562], hrx = 56, hry = 66;
      const skin = '#4a423d';
      q.fillStyle = skin;
      q.beginPath(); q.moveTo(1098, 700); q.bezierCurveTo(1104, 664, 1104, 640, 1102, 612); q.lineTo(1160, 612); q.bezierCurveTo(1158, 640, 1160, 668, 1166, 700); q.closePath(); q.fill();
      // 下颌一线
      q.beginPath(); q.moveTo(1078, 578); q.bezierCurveTo(1072, 600, 1080, 626, 1100, 642); q.lineTo(1112, 628); q.bezierCurveTo(1094, 612, 1090, 596, 1092, 578); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(255,207,150,0.9)'; q.lineWidth = 2;
      q.beginPath(); q.moveTo(1078, 580); q.bezierCurveTo(1072, 600, 1080, 626, 1100, 642); q.stroke();
      // 耳廓：只露出一点边
      q.fillStyle = '#5a4b40'; q.beginPath(); q.ellipse(1077, 572, 6, 11, 0.3, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(255,207,150,0.85)'; q.lineWidth = 1.6; q.beginPath(); q.ellipse(1077, 572, 6, 11, 0.3, 2.0, 4.6); q.stroke();
      // 后脑的白发：发丝顺着头骨的弧度梳向脑后正中的发髻
      const capPath = () => { q.beginPath(); q.ellipse(hx, hy, hrx, hry, -0.12, 0, TAU); };
      capPath();
      q.fillStyle = K.lin(q, hx - 50, hy - 60, hx + 50, hy + 66, [[0, '#f6f1e7'], [0.55, '#dcd8cf'], [1, '#a9a59c']]); q.fill();
      q.save(); capPath(); q.clip();
      const [tx, ty] = IN5H.tie, r = rng(77);
      // 上半：从发际（头顶与两侧）梳向发髻，控制点沿径向外鼓；下半：发髻以下自然垂下
      for (let i = 0; i < 30; i++) {
        const an = lerp(PI * 0.92, PI * 2.08, i / 29) + (r() - 0.5) * 0.06, ex = hx + Math.cos(an) * hrx * 1.04, ey = hy + Math.sin(an) * hry * 1.04;
        const mx = (ex + tx) / 2, my = (ey + ty) / 2, dl = Math.hypot(mx - hx, my - hy) || 1, bulge = 8 + r() * 8;
        q.strokeStyle = r() < 0.55 ? `rgba(255,252,246,${0.25 + r() * 0.35})` : `rgba(140,136,128,${0.16 + r() * 0.2})`; q.lineWidth = 0.8 + r() * 1.1;
        q.beginPath(); q.moveTo(ex, ey); q.quadraticCurveTo(mx + (mx - hx) / dl * bulge, my + (my - hy) / dl * bulge, tx, ty); q.stroke();
      }
      for (let i = 0; i < 22; i++) {
        const x0 = lerp(hx - hrx * 0.95, hx + hrx * 0.95, i / 21) + (r() - 0.5) * 4, y0 = ty + 6 + Math.abs(x0 - tx) * 0.2;
        q.strokeStyle = r() < 0.5 ? `rgba(255,252,246,${0.2 + r() * 0.3})` : `rgba(130,126,118,${0.18 + r() * 0.2})`; q.lineWidth = 0.8 + r();
        q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo(x0 + (x0 - hx) * 0.18, y0 + 50, x0 + (x0 - hx) * 0.1, hy + hry + 10); q.stroke();
      }
      q.restore();
      q.strokeStyle = 'rgba(255,217,160,0.9)'; q.lineWidth = 2.4;
      q.beginPath(); q.ellipse(hx, hy, hrx, hry, -0.12, PI * 0.85, PI * 1.6); q.stroke();
      // 鬓边几根散出的发丝
      q.strokeStyle = 'rgba(250,246,238,0.7)'; q.lineWidth = 1;
      for (let i = 0; i < 5; i++) { const y0 = 560 + i * 9; q.beginPath(); q.moveTo(1078 + i * 2, y0); q.quadraticCurveTo(1070 - i, y0 + 16, 1074 - i * 2, y0 + 34 + i * 3); q.stroke(); }
      // 肩：旧灰长衫，左肩线一道暖色轮廓光，领口一线素白中衣
      q.fillStyle = K.lin(q, 900, 640, 1280, 740, [[0, '#626b70'], [1, '#2b2f32']]);
      q.beginPath(); q.moveTo(880, 740); q.bezierCurveTo(930, 694, 1000, 676, 1060, 680); q.lineTo(1176, 680); q.bezierCurveTo(1226, 684, 1272, 698, 1310, 712); q.lineTo(1310, 740); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(255,214,150,0.8)'; q.lineWidth = 2.6;
      q.beginPath(); q.moveTo(882, 738); q.bezierCurveTo(932, 692, 1000, 674, 1060, 678); q.stroke();
      q.fillStyle = '#d8d4ca';
      q.beginPath(); q.moveTo(1062, 680); q.quadraticCurveTo(1098, 700, 1110, 740); q.lineTo(1122, 740); q.quadraticCurveTo(1110, 698, 1078, 678); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(20,22,24,0.35)'; q.lineWidth = 2;
      for (const [a2, b2] of [[960, 706], [1010, 696], [1230, 700]]) { q.beginPath(); q.moveTo(a2, b2); q.quadraticCurveTo(a2 + 10, b2 + 20, a2 + 4, 740); q.stroke(); }
    });
  }
  // 头发：发髻下垂的一把与颈后散落的几缕，都用细发丝叠出来；静时垂在背上偏左（约 1.9 rad），风到时扬向右上
  function in5Hair(g, t, lt) {
    const wh = in5W(1100, lt), wr = in5W(1100, lt - 0.2);
    g.lineCap = 'round';
    const line = (P) => { g.beginPath(); P.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
    // 一缕：中线 + 沿法线错开的若干细发丝；下层一条半透明的带子打底
    const lock = (k, root, L, wdt, aRest, aWind, w, cols) => {
      const P = [], N = 12;
      let x = root[0], y = root[1];
      const a0 = lerp(aRest, aWind, w);
      for (let j = 0; j <= N; j++) {
        const u = j / N; P.push([x, y]);
        const aa = a0 + u * lerp(0.25, -0.12, w) + Math.sin(t * (1.6 + 5 * w) - u * 5 + k) * (0.05 + 0.3 * w) * u + Math.sin(u * 4 + k) * 0.06;
        x += (Math.cos(aa) * L) / N; y += (Math.sin(aa) * L) / N;
      }
      const nrm = (j) => { const a = P[Math.max(0, j - 1)], b = P[Math.min(N, j + 1)], dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1; return [-dy / dl, dx / dl]; };
      const off = (f) => P.map(([px, py], j) => { const [nx, ny] = nrm(j), ww = wdt * Math.pow(1 - j / (N + 2), 0.7) * (1 + 0.5 * (j / N)) / 2; return [px + nx * ww * f, py + ny * ww * f]; });
      // 打底
      const Lp = off(-1), Rp = off(1);
      g.fillStyle = cols[0]; g.beginPath(); Lp.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); for (let j = N; j >= 0; j--) g.lineTo(Rp[j][0], Rp[j][1]); g.closePath(); g.fill();
      // 发丝
      for (let s2 = 0; s2 < 4; s2++) { const f = -0.75 + (s2 / 3) * 1.5 + (h2(k, s2) - 0.5) * 0.3; g.strokeStyle = s2 % 2 ? cols[1] : cols[2]; g.lineWidth = 0.7 + h2(k, s2 + 9) * 0.8; line(off(f)); }
      // 顶上一线暖光
      g.strokeStyle = 'rgba(255,217,160,0.75)'; g.lineWidth = 1.2; line(off(w > 0.5 ? -0.95 : -0.95));
    };
    const [tx, ty] = IN5H.tie;
    // 颈后散落的头发（在发髻那一把下面）
    for (let k = 0; k < 5; k++) lock(k + 20, [1096 + k * 16, 600 + h2(k, 2) * 14], 150 + 70 * h2(k, 3), 22 + 8 * h2(k, 4), 1.66 + (h2(k, 5) - 0.5) * 0.3, 0.1 + (h2(k, 5) - 0.5) * 0.6, in5W(1100, lt - 0.05 * k) * 0.7,
      ['rgba(169,165,156,0.75)', 'rgba(214,210,202,0.8)', 'rgba(244,241,234,0.85)']);
    // 发髻下垂的一把（主发束）
    for (let k = 0; k < 3; k++) lock(k, [tx - 6 + k * 7, ty + 6], 250 + 60 * h2(k, 6), 26 - k * 5, 1.85 + k * 0.06, -0.5 + k * 0.08, wh,
      ['rgba(190,186,177,0.85)', 'rgba(236,233,226,0.9)', 'rgba(252,250,246,0.95)']);
    // 飘散的细丝
    g.strokeStyle = 'rgba(248,246,240,0.65)'; g.lineWidth = 0.9;
    for (let k = 0; k < 9; k++) {
      let x = tx + (h2(k, 51) - 0.5) * 50, y = ty + 10 + h2(k, 52) * 60;
      const a0 = lerp(1.8 + (h2(k, 53) - 0.5) * 0.6, -0.6 + (h2(k, 53) - 0.5) * 0.7, wh), L = 150 + h2(k, 55) * 200;
      g.beginPath(); g.moveTo(x, y);
      for (let j = 1; j <= 10; j++) { const u = j / 10, aa = a0 + Math.sin(t * (2.5 + 6 * wh) - u * 5 + k * 1.3) * (0.06 + 0.3 * wh) * u; x += (Math.cos(aa) * L) / 10; y += (Math.sin(aa) * L) / 10; g.lineTo(x, y); }
      g.stroke();
    }
    // 蓝发带：束发处一圈，两条带尾比头发晚一点扬起
    g.save(); g.translate(tx, ty); g.rotate(lerp(0.5, -0.3, wh));
    g.fillStyle = '#3f7d9c'; g.beginPath(); g.ellipse(0, 0, 13, 8, 0, 0, TAU); g.fill();
    g.fillStyle = '#4c8dae'; g.fillRect(-13, -4, 26, 8);
    g.restore();
    for (let k = 0; k < 2; k++) {
      const L = 230 - k * 60, Pp = [];
      let x = tx + 6 + k * 6, y = ty + 4;
      const a0 = lerp(1.6 + k * 0.25, -0.3 + k * 0.22, wr);
      for (let j = 0; j <= 14; j++) {
        const u = j / 14; Pp.push([x, y]);
        const aa = a0 + u * lerp(0.35, -0.2, wr) + Math.sin(t * (3 + 6 * wr) - u * 6 + k * 1.4) * (0.08 + 0.38 * wr) * u;
        x += (Math.cos(aa) * L) / 14; y += (Math.sin(aa) * L) / 14;
      }
      const Lp = [], Rp = [];
      for (let j = 0; j <= 14; j++) {
        const a = Pp[Math.max(0, j - 1)], b = Pp[Math.min(14, j + 1)], dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1, w = 8 * (1 - j / 20) / 2;
        Lp.push([Pp[j][0] - (dy / dl) * w, Pp[j][1] + (dx / dl) * w]); Rp.push([Pp[j][0] + (dy / dl) * w, Pp[j][1] - (dx / dl) * w]);
      }
      g.fillStyle = k ? '#3f7d9c' : '#4c8dae';
      g.beginPath(); Lp.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); for (let j = 14; j >= 0; j--) g.lineTo(Rp[j][0], Rp[j][1]); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(200,232,246,0.5)'; g.lineWidth = 1; g.beginPath(); Rp.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    }
  }
  XYT.registerShot('in5_banner', {
    name: '酒旗风起', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(238,222,176,0.85)', accent: '#ca6924', bloom: 0.32,
    draw(g, c) {
      const t = c.t, lt = c.lt, G = in5G(lt), [sunX, sunY] = IN5.sun;
      blitN(g, in5Sky(), -20, -20, W + 40, H + 40);
      g.save(); g.translate(-40 + t * 5 + G * 120, 0);
      E.clouds(g, { t: 0, y: 440, color: '#fff2da', shade: '#d6c8b4', alpha: 0.34, n: 2, seed: 8, speed: 0, scale: 0.9, spread: 60, lightX: sunX });
      g.restore();
      // 竹竿：风到之后才弯（比旗尾晚），带一点回弹
      const wp = in5W(200, lt - 0.3), wob = Math.sin(t * 5.5) * 0.22 * wp;
      const [bx, by] = IN5.base, [tx0, ty0] = IN5.tip, pa0 = Math.atan2(ty0 - by, tx0 - bx), px = Math.cos(pa0 + PI / 2), py = Math.sin(pa0 + PI / 2);
      const dTip = 46 * wp + 12 * wob, tx = tx0 + px * dTip, ty = ty0 + py * dTip;
      const cx = (bx + tx0) / 2 + px * dTip * 0.3, cy = (by + ty0) / 2 + py * dTip * 0.3;
      // 横木：两根绳吊在竿梢下，风来时往右摆、略斜
      const wb = in5W(420, lt - 0.12), swing = 0.08 * Math.sin(t * 1.4) * (1 - wb) + 0.16 * wb + 0.06 * Math.sin(t * 4.5) * wb;
      const hang = [tx - 8 + Math.sin(swing) * 70, ty + Math.cos(swing) * 70], ba = -swing * 0.6;
      const bat = [[hang[0] - Math.cos(ba) * 95, hang[1] - Math.sin(ba) * 95], [hang[0] + Math.cos(ba) * 95, hang[1] + Math.sin(ba) * 95]];
      // 旗后的日光：旗被吹开、露出日头时更亮
      const reveal = in5W(560, lt - 0.1);
      g.save(); g.globalCompositeOperation = 'screen';
      glow(g, sunX, sunY, 260, '#fff0c0', 0.22 + 0.32 * reveal);
      g.restore();
      // 旗布（日头在后，透光）
      const inset = 6, bat2 = [[lerp(bat[0][0], bat[1][0], inset / 190), lerp(bat[0][1], bat[1][1], inset / 190)], [lerp(bat[1][0], bat[0][0], inset / 190), lerp(bat[1][1], bat[0][1], inset / 190)]];
      in5Banner(g, t, lt, bat2, 1);
      // 横木与吊绳、竿梢的两道绑绳
      g.strokeStyle = 'rgba(70,50,32,0.85)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(bat[0][0] + 6, bat[0][1]); g.lineTo(tx - 4, ty + 2); g.lineTo(bat[1][0] - 6, bat[1][1]); g.stroke();
      g.strokeStyle = '#4a3422'; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(bat[0][0] - 6, bat[0][1]); g.lineTo(bat[1][0] + 6, bat[1][1]); g.stroke();
      g.strokeStyle = 'rgba(255,220,160,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(bat[0][0] - 4, bat[0][1] - 3); g.lineTo(bat[1][0] + 4, bat[1][1] - 3); g.stroke();
      // 竹竿（画在旗前）：竹节、迎光一线
      g.strokeStyle = '#655437'; g.lineWidth = 20;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke();
      g.strokeStyle = 'rgba(255,226,170,0.5)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(bx + 7, by + 2); g.quadraticCurveTo(cx + 7, cy + 2, tx + 5, ty + 2); g.stroke();
      const poleAt = (u) => [(1 - u) * (1 - u) * bx + 2 * u * (1 - u) * cx + u * u * tx, (1 - u) * (1 - u) * by + 2 * u * (1 - u) * cy + u * u * ty];
      g.strokeStyle = 'rgba(55,42,26,0.85)'; g.lineWidth = 22;
      for (const u of [0.18, 0.37, 0.58, 0.76]) { const [x, y] = poleAt(u), [x2, y2] = poleAt(u + 0.005); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); }
      g.strokeStyle = '#8a3a22'; g.lineWidth = 3;
      for (const u of [0.955, 0.975]) { const [x, y] = poleAt(u), [x2, y2] = poleAt(u + 0.012); g.beginPath(); g.moveTo(x - py * 11, y + px * 11); g.lineTo(x2 + py * 11, y2 - px * 11); g.stroke(); }
      blitN(g, in5Eave(), -10, -10, 600, 280);
      blitN(g, in5Rail(), -20, 560, 760, 180);
      // 两片枫叶随风掠过
      for (let k = 0; k < 2; k++) {
        const d = G - 0.05 - k * 0.3;
        if (d <= 0 || d > 1.9) continue;
        const x = -60 + d * 880 + Math.sin(t * 3 + k) * 24, y = (k ? 560 : 360) - d * (k ? 200 : 120) + Math.sin(t * 4.2 + k * 2) * 30;
        mapleLeaf(g, x, y, k ? 36 : 42, t * (3 + k) + k, Math.cos(t * 5 + k * 2) > 0 ? 1 : -1, k ? '#c4422a' : '#dd8a2e');
      }
      // 风里的细尘，逆光里一闪一闪
      g.fillStyle = '#fff4d8';
      for (let i = 0; i < 40; i++) {
        const x = ((h2(i, 31) * (W + 200) + G * (520 + 420 * h2(i, 32)) + t * 8) % (W + 200)) - 100, y = h2(i, 33) * H + Math.sin(t * 2 + i) * 14;
        const r = 0.8 + 2 * h2(i, 34); g.globalAlpha = (0.2 + 0.55 * in5W(x, lt)) * (0.6 + 0.4 * Math.sin(t * 6 + i)); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      // 右下：白发人的过肩剪影；肩与头先画，头发与发带随风
      const body = in5Body();
      g.drawImage(body, 840, 440, 460, 300);
      in5Hair(g, t, lt);
    },
  });

  // ---------- 预热 ----------
  // 把本组的静态底图先建好（只是缓存，免得切到某一镜的第一帧卡一下）。按镜头先后排；
  // 带字的贴图要等书法字体就绪（没就绪返回 false，稍后再试）
  const fontReady = (txt) => fontKey(txt) === 'f';
  const WARM = [
    () => paperTex('#f2ecde'), () => mtnLayer1(0), () => mtnLayer1(1), () => mtnLayer1(2), () => mtnLayer1(3),
    () => { if (!fontReady('逍遥叹')) return false; for (const ch of '逍遥叹') { charTex(ch, 96, '#1a2026', 0); charTex(ch, 96, '#2a3036', 1.6); charTex(ch, 96, '#2a3036', 4); } },
    () => { if (!fontReady('逍遥')) return false; sealTex('逍遥', 76, '#c91f37'); },
    () => in2Sky(), () => in2Mid(), () => in2Refl('sky'), () => in2Refl('mid'), () => in2FigTex(), () => boatTex('#3b2f26', '#26252a'),
    () => in3Water(), () => in3Still(),
    () => in4Sky(), () => in4Left(), () => in4Pier(), () => in4Inn(), () => in4ReflSrc(), () => in4Refl(), () => in4Rays(),
    () => { if (!fontReady('酒')) return false; flagTex(); flagTone('dk'); flagTone('lt'); },
    () => in5Sky(), () => in5Eave(), () => in5Rail(), () => in5Body(),
    () => { if (!fontReady('酒')) return false; bannerTex(); bannerBackTex(); },
  ];
  // 一帧里最多建一张：已建好的只是查一次缓存，几乎不花时间
  function warmSome(ms) {
    for (const w of WARM) {
      const t0 = performance.now();
      try { w(); } catch (e) { /* 预热失败不影响正常绘制 */ }
      if (performance.now() - t0 > ms) return;
    }
  }
  // 页面空闲时逐张建（播放中空闲回调来得少，超时设短一点，保证在第二镜之前大多建好）
  function warmStep(i, tries) {
    if (i >= WARM.length) return;
    if (!XYT.sprites) { setTimeout(() => warmStep(i, tries), 400); return; }
    let ok = true;
    try { ok = WARM[i]() !== false; } catch (e) { /* 预热失败不影响正常绘制 */ }
    if (!ok && (tries || 0) < 8) { setTimeout(() => warmStep(i, (tries || 0) + 1), 700); return; }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => warmStep(i + 1, 0), { timeout: 1200 });
    else setTimeout(() => warmStep(i + 1, 0), 60);
  }
  if (typeof window !== 'undefined' && typeof setTimeout === 'function') setTimeout(() => warmStep(0, 0), 800);
})();
