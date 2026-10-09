/* 分镜镜头 第 13 组：雪上题名、湖灯送人、十年孤灯、天地皆红 */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 公用 ----------
  // 本句第 k 个字相对镜头起点的时间；没有逐字时间时用分镜给的值
  const rel = (c, k, fb) => { const v = c.charT ? c.charT(k) : null; return v == null ? fb : v - (c.t - c.lt); };
  const ramp = (x, a, b) => clamp((x - a) / (b - a));
  const bell = (x, a, b) => Math.sin(PI * ramp(x, a, b));
  const beatE = (c, d) => (c.be ? c.be(d) : 0);
  const glow = (g, x, y, r, col, a) => { if (a > 0.004) A.glow(g, x, y, r, col, Math.min(1, a)); };
  const add = (g, fn) => K.lighter(g, fn);
  // 题字用的书法字体：先请求本组要用的字；就绪与否放进缓存键（没加载好先用替代字形，加载好后自动重建）
  const GL13 = '不见散逍遥客栈酒囍';
  try { if (document.fonts && document.fonts.load) document.fonts.load('64px "Ma Shan Zheng"', GL13).catch(() => {}); } catch (e) { /* 无字体接口 */ }
  let FONT13 = false;
  const fk = () => { if (FONT13) return 'f'; try { if (document.fonts && document.fonts.check('32px "Ma Shan Zheng"', GL13)) { FONT13 = true; return 'f'; } } catch (e) { /* 无字体接口 */ } return 'n'; };
  // 闪切：切点后一小段白闪
  function flash(g, age, col, k) {
    if (age < 0 || age > 0.22) return;
    g.fillStyle = rgba(col || '#ffffff', (k ?? 0.55) * (1 - age / 0.22) * (1 - age / 0.22));
    g.fillRect(-60, -60, W + 120, H + 120);
  }
  // 回忆插入的工笔画框：四边一圈纸色，内描一道金线
  function memoryFrame(g, age, col) {
    const k = easeOut(clamp(age / 0.35));
    g.save();
    g.strokeStyle = rgba(col || '#f4ead6', 0.95 * k); g.lineWidth = 48;
    g.strokeRect(-6, -6, W + 12, H + 12);
    g.strokeStyle = rgba('#b8962e', 0.85 * k); g.lineWidth = 1.8;
    g.strokeRect(22, 22, W - 44, H - 44);
    g.strokeStyle = rgba('#8a6a2a', 0.25 * k); g.lineWidth = 1;
    g.strokeRect(18, 18, W - 36, H - 36);
    g.restore();
  }

  // 剑：hx,hy 握处，tx,ty 剑尖；红穗随风
  function jian(g, hx, hy, tx, ty, t, o = {}) {
    const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const s = o.s || 1, w = 3.1 * s, wind = o.wind ?? 0.5, wd = o.windDir ?? -1;
    const bx = hx + ux * 8 * s, by = hy + uy * 8 * s;
    const gr = g.createLinearGradient(bx + nx * w, by + ny * w, bx - nx * w, by - ny * w);
    gr.addColorStop(0, o.light || '#f4f8fc'); gr.addColorStop(0.5, '#aab6c4'); gr.addColorStop(1, '#5c6878');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(bx + nx * w, by + ny * w); g.lineTo(tx - ux * 10 * s + nx * w * 0.7, ty - uy * 10 * s + ny * w * 0.7); g.lineTo(tx, ty);
    g.lineTo(tx - ux * 10 * s - nx * w * 0.7, ty - uy * 10 * s - ny * w * 0.7); g.lineTo(bx - nx * w, by - ny * w); g.closePath(); g.fill();
    g.strokeStyle = rgba('#ffffff', 0.7); g.lineWidth = 0.8 * s;
    g.beginPath(); g.moveTo(bx + nx * w * 0.2, by + ny * w * 0.2); g.lineTo(tx - ux * 12 * s, ty - uy * 12 * s); g.stroke();
    g.strokeStyle = '#2a2420'; g.lineCap = 'round';
    g.lineWidth = 3.6 * s; g.beginPath(); g.moveTo(bx + nx * 9 * s, by + ny * 9 * s); g.lineTo(bx - nx * 9 * s, by - ny * 9 * s); g.stroke();
    g.strokeStyle = '#b89a5a'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(bx + nx * 8 * s, by + ny * 8 * s); g.lineTo(bx - nx * 8 * s, by - ny * 8 * s); g.stroke();
    const px = hx - ux * 22 * s, py = hy - uy * 22 * s;
    g.strokeStyle = '#1c1816'; g.lineWidth = 3.4 * s; g.beginPath(); g.moveTo(bx, by); g.lineTo(px, py); g.stroke();
    g.fillStyle = '#b89a5a'; g.beginPath(); g.arc(px, py, 2.6 * s, 0, TAU); g.fill();
    if (o.tassel === false) return;
    // 剑穗：从剑首垂下，随风甩
    const sw = Math.sin(t * 3.1) * 0.5 + Math.sin(t * 5.3 + 1) * 0.3;
    const ex = px + wd * (12 + 22 * wind) * s + sw * 4 * s, ey = py + (28 - 10 * wind) * s;
    g.strokeStyle = o.tassel || '#c83c23'; g.lineWidth = 1.5 * s;
    g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + wd * 6 * s, py + 14 * s, ex, ey); g.stroke();
    g.lineWidth = 0.9 * s;
    for (let k = -2; k <= 2; k++) {
      g.beginPath(); g.moveTo(ex, ey);
      g.quadraticCurveTo(ex + wd * (6 + 6 * wind) * s + k * 1.4 * s, ey + 7 * s, ex + wd * (10 + 14 * wind) * s + k * 2 * s + sw * 3 * s, ey + (16 - 6 * wind) * s);
      g.stroke();
    }
    g.fillStyle = o.tassel || '#c83c23'; g.beginPath(); g.arc(ex, ey, 2.2 * s, 0, TAU); g.fill();
  }

  // 墨色大氅：身后一片下风鼓起的布，边缘淡开；front 为搭在肩上的披肩
  function cloak(g, P, s, t, o = {}) {
    const wk = Math.min(1, o.wind ?? 0.5), wd = o.windDir ?? -1, col = o.color || '#15171c', ph = o.phase || 0;
    const sN = P.shoulderN, sF = P.shoulderF, ft = P.footN, ff = P.footF;
    const nk = [(sN[0] + sF[0]) / 2, Math.min(sN[1], sF[1]) - 5 * s];
    const groundY = Math.max(ft[1], ff[1]);
    const hemY = lerp(P.pelvis[1], groundY, o.len ?? 0.86);
    const cx = (P.pelvis[0] * 0.6 + P.chest[0] * 0.4);
    const w1 = Math.sin(t * 2.3 + ph), w2 = Math.sin(t * 3.7 + ph + 1.3), w3 = Math.sin(t * 1.6 + ph + 2.1);
    const flare = (22 + 46 * wk + 6 * w1 * wk) * s, up = (3 + 20 * wk + 4 * w2 * wk) * s;
    if (!o.front) {
      const ex = cx + wd * (16 * s + flare), ey = hemY - up;
      const path = () => {
        g.beginPath();
        g.moveTo(nk[0] - wd * 12 * s, nk[1] + 2 * s);
        g.bezierCurveTo(cx - wd * 20 * s, lerp(nk[1], hemY, 0.35), cx - wd * (22 + 3 * w3) * s, lerp(nk[1], hemY, 0.75), cx - wd * (16 + 4 * w3) * s, hemY);
        const n = 4;
        for (let i = 1; i <= n; i++) {
          const u = i / n, x = lerp(cx - wd * 16 * s, ex, u), y = lerp(hemY, ey, u * u) + Math.sin(t * 4.1 + ph + u * 6) * (1.5 + 4 * wk) * s * u;
          g.quadraticCurveTo(lerp(cx - wd * 16 * s, ex, u - 0.5 / n), y + (4 + 2 * w2) * s, x, y);
        }
        g.bezierCurveTo(ex + wd * (8 + 5 * w1) * s, lerp(ey, nk[1], 0.4), nk[0] + wd * (34 + 14 * wk + 5 * w2) * s, nk[1] + 34 * s, nk[0] + wd * 9 * s, nk[1]);
        g.closePath();
      };
      // 墨色由身侧往下风边缘淡开
      g.fillStyle = K.lin(g, cx, 0, ex + wd * 10 * s, 0, [[0, col], [0.55, col], [1, rgba(mix(col, '#3a4456', 0.6), 0.86)]]);
      path(); g.fill();
      g.save(); path(); g.clip();
      g.strokeStyle = rgba(o.fold || '#6a7488', 0.28); g.lineWidth = 1.1 * s;
      for (let k = 0; k < 4; k++) {
        const u = 0.22 + k * 0.2;
        g.beginPath(); g.moveTo(nk[0] + wd * (6 + k * 3) * s, nk[1] + 18 * s);
        g.quadraticCurveTo(cx + wd * (8 + 40 * u) * s, lerp(nk[1], hemY, 0.6), lerp(cx - wd * 16 * s, ex, u), lerp(hemY, ey, u * u) - 2 * s);
        g.stroke();
      }
      g.restore();
      if (o.rim) {
        g.strokeStyle = rgba(o.rim, 0.55); g.lineWidth = 1.5 * s;
        g.beginPath(); g.moveTo(nk[0] + wd * 9 * s, nk[1]);
        g.bezierCurveTo(nk[0] + wd * (34 + 14 * wk + 5 * w2) * s, nk[1] + 34 * s, ex + wd * (8 + 5 * w1) * s, lerp(ey, nk[1], 0.4), ex, ey);
        g.stroke();
      }
    } else {
      const sh = 28 * s;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(nk[0] - wd * 10 * s, nk[1] - 2 * s);
      g.quadraticCurveTo(sN[0] + (sN[0] - nk[0]) * 0.45, sN[1] - 4 * s, sN[0] + (sN[0] - nk[0]) * 0.55 + wd * 3 * s * w1, sN[1] + sh);
      g.quadraticCurveTo(nk[0], nk[1] + sh * 1.25, sF[0] + (sF[0] - nk[0]) * 0.5 + wd * (6 + 8 * wk) * s, sF[1] + sh * 0.9 - 5 * wk * s);
      g.quadraticCurveTo(sF[0] + (sF[0] - nk[0]) * 0.3, sF[1] - 6 * s, nk[0] + wd * 8 * s, nk[1] - 2 * s);
      g.closePath(); g.fill();
      if (o.rim) { g.strokeStyle = rgba(o.rim, 0.55); g.lineWidth = 1.3 * s; g.beginPath(); g.moveTo(nk[0] - wd * 10 * s, nk[1] - 2 * s); g.quadraticCurveTo(sN[0] + (sN[0] - nk[0]) * 0.45, sN[1] - 4 * s, sN[0] + (sN[0] - nk[0]) * 0.55, sN[1] + sh); g.stroke(); }
    }
  }
  // 让人物头顶落在 topY：返回脚底 y
  function footFor(who, x, topY, s, t, o) { const P = F.points(who, x, 0, s, t, o); return topY - P.top[1]; }
  // 静坐不动的人物先画进贴图（t 固定），逐帧只贴一张：w×h 的局部画布，脚底在 (fx, fy)
  function figSprite(key, who, s, o, w, h, fx, fy) { return K.cache('g13-fig-' + key, w, h, 1, (q) => F.draw(q, who, fx, fy, s, 0, o)); }
  // 白发老逍遥 + 墨色大氅（副歌三的统一造型）
  function elder(g, x, y, s, t, o = {}) {
    const fo = Object.assign({ stage: 'old', tone: 'color', ink: '#1b1e25', whiteHair: true, hairLoose: true, prop: 'none' }, o);
    const P = F.points('xiaoyao', x, y, s, t, fo);
    const co = { wind: o.cloakWind ?? o.wind ?? 0.5, windDir: o.windDir ?? -1, rim: o.cloakRim, color: o.cloakColor, phase: o.seed || 0, len: o.cloakLen };
    if (o.cloak !== false) cloak(g, P, s, t, co);
    F.draw(g, 'xiaoyao', x, y, s, t, fo);
    if (o.cloak !== false && o.cape !== false) cloak(g, P, s, t, Object.assign({ front: true }, co));
    return P;
  }

  // =====================================================================
  // 第45句 c3_snowcursive 雪上题名：剑尖写雪 → 风抹笔画 → 空坡独立 → 回忆：擂台上的月如大笑
  // =====================================================================
  // 草书：在“雪面坐标”(u 0..1000 横, v 0..300 由远到近) 里生成连绵的圈带笔势，再按镜头投影
  let CURS = null;
  function cursive() {
    if (CURS) return CURS;
    const r = A.rng(9127), S = [];
    const boxes = [[90, 14, 300, 128], [320, 10, 540, 132], [150, 150, 440, 288], [470, 144, 800, 292]];
    boxes.forEach((b, gi) => {
      const ns = gi === 3 ? 3 : gi === 2 ? 3 : 2, bw = b[2] - b[0], bh = b[3] - b[1];
      for (let k = 0; k < ns; k++) {
        const N = 72, v0 = b[1] + bh * (k / ns) * 0.62, hh = bh * (0.42 + 0.3 * r());
        const cx = b[0] + bw * (0.32 + 0.36 * r()), ax = bw * (0.2 + 0.18 * r()), drift = bw * (r() - 0.5) * 0.7;
        const f1 = 0.6 + r() * 0.9, f2 = 1.6 + r() * 1.6, p1 = r() * TAU, p2 = r() * TAU, ay = hh * (0.12 + 0.18 * r());
        const pts = [];
        for (let i = 0; i < N; i++) {
          const q = i / (N - 1);
          pts.push([cx + ax * Math.sin(TAU * f1 * q + p1) * (0.7 + 0.3 * q) + drift * (q - 0.5), clamp(v0 + hh * q + ay * Math.sin(TAU * f2 * q + p2), 2, 298)]);
        }
        // 最后一笔拖出长尾，扫到他脚边
        if (gi === 3 && k === ns - 1) {
          const e = pts[pts.length - 1];
          for (let i = 1; i <= 26; i++) { const q = i / 26; pts.push([lerp(e[0], 905, q), lerp(e[1], 296, Math.pow(q, 0.6)) - Math.sin(PI * q) * 16]); }
        }
        // 提按：向下（往近处）走的笔重、回锋轻；起笔按、收笔出锋
        const wd = pts.map((p, i) => {
          const a = pts[Math.max(0, i - 1)], bq = pts[Math.min(pts.length - 1, i + 1)], dv = bq[1] - a[1], dl = Math.hypot(bq[0] - a[0], dv) || 1;
          const q = i / (pts.length - 1), env = Math.min(1, q * 8 + 0.35) * Math.pow(1 - q, 0.45);
          return (0.4 + 0.85 * clamp(0.5 + 0.6 * dv / dl)) * env * (0.85 + 0.3 * A.noise1(i * 0.2, gi * 5 + k));
        });
        let cu = 0;
        for (const p of pts) cu += p[0];
        S.push({ pts, wd, gi, cu: cu / pts.length, er: h2(S.length, 77) });
      }
    });
    CURS = S;
    return S;
  }
  // 写字时间表：第一个名字开镜前已写好；之后每个字头起一笔，最后一笔长尾跨进中景
  function strokeTimes(c) {
    const S = cursive(), n = S.length, T = [];
    const k0 = [rel(c, 0, 0.24), rel(c, 1, 0.54), rel(c, 2, 1.04), rel(c, 3, 1.24)];
    const live = [k0[0], k0[1], k0[2], k0[3] + 0.02, 1.66];
    const ends = [k0[1] - 0.04, k0[2] - 0.05, k0[3] - 0.03, 1.6, 2.5];
    const nPre = n - live.length;
    for (let i = 0; i < n; i++) T.push(i < nPre ? [-10 + i, -9.5 + i] : [live[i - nPre], ends[i - nPre]]);
    return T;
  }
  function tipUV(c, T, lt) {
    const S = cursive();
    let cur = S.length - 1;
    for (let i = 0; i < S.length; i++) if (T[i][1] >= 0 && lt < T[i][1] + 0.12) { cur = i; break; }
    const [t0, t1] = T[cur], pts = S[cur].pts;
    if (lt < t0) {
      // 笔画之间剑尖抬起、移到下一笔起点
      const prev = cur > 0 ? S[cur - 1].pts : pts, from = prev[prev.length - 1], to = pts[0];
      const tp = cur > 0 ? T[cur - 1][1] : t0 - 0.3, u = easeInOut(ramp(lt, tp, t0));
      return { uv: [lerp(from[0], to[0], u), lerp(from[1], to[1], u)], lift: Math.sin(PI * u), writing: false };
    }
    const f = easeInOut(ramp(lt, t0, t1)), j = Math.min(pts.length - 1, Math.floor(f * (pts.length - 1)));
    return { uv: pts[j], lift: 0, writing: lt < t1 };
  }
  // 雪粉：剑尖划过处翻起，按出生时刻算位置，无状态
  function powder(g, c, T, lt, prj, sc) {
    for (let k = 0; k < 40; k++) {
      const age = ((k + 0.37) / 40) * 0.75, tb = lt - age;
      const tp = tipUV(c, T, tb);
      if (!tp.writing) continue;
      const [x0, y0] = prj(tp.uv[0], tp.uv[1]);
      for (let j = 0; j < 3; j++) {
        const hh = h2(k * 3 + j, Math.floor(tb * 40)), ang = -PI / 2 + (hh - 0.5) * 2.8, sp = (50 + 110 * h2(k * 3 + j, 9)) * sc;
        const x = x0 + Math.cos(ang) * sp * age - 40 * age * sc, y = y0 + Math.sin(ang) * sp * age + 220 * age * age * sc;
        g.fillStyle = rgba('#ffffff', (1 - age / 0.75) * 0.9);
        g.beginPath(); g.arc(x, y, (0.9 + 1.8 * h2(j, k)) * sc * (1 - age * 0.8), 0, TAU); g.fill();
      }
    }
  }
  // 吹雪：风头从右往左，贴地的雪尘细线与一团团雪雾
  function blowSnow(g, lt, t0, y0, y1, k, dur, dir = -1) {
    const D = dur || 2.2, life = ramp(lt, t0 - 0.05, t0 + 0.25) * (1 - ramp(lt, t0 + D, t0 + D + 1.2));
    if (life <= 0) return;
    const front = lerp(1500, -300, (lt - t0) / 1.6), fr = dir < 0 ? front : W - front;
    g.lineCap = 'round';
    for (let band = 0; band < 3; band++) {
      g.strokeStyle = rgba('#ffffff', (0.22 + band * 0.18) * life); g.lineWidth = (0.7 + band * 0.6) * k;
      g.beginPath();
      for (let i = 0; i < 40; i++) {
        const id = band * 40 + i, v = h2(id, 51), y = lerp(y0, y1, Math.pow(h2(id, 52), 0.7)) + Math.sin(lt * 3 + id) * 6 * k;
        const sp = (700 + 900 * v) * k, x = ((h2(id, 53) * 1700 + dir * (lt - t0) * sp) % 1700 + 1700) % 1700 - 200;
        if (dir < 0 ? x < fr - 80 : x > fr + 80) continue;
        const len = (24 + 70 * v) * k * (1 + band * 0.5);
        g.moveTo(x, y); g.lineTo(x - dir * len, y - len * 0.04);
      }
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = fr - dir * (120 + i * 160) + Math.sin(lt * 2 + i) * 30, y = y1 - 30 * k - h2(i, 61) * (y1 - y0) * 0.5;
      if (x > W + 200 || x < -200) continue;
      glow(g, x, y, (90 + 80 * h2(i, 62)) * k, '#ffffff', 0.3 * life * (0.6 + 0.4 * h2(i, 63)));
    }
  }
  // 雪面闪光：随机几点一闪一闪
  function twinkle(g, t, y0, y1, n, seed) {
    add(g, () => {
      for (let i = 0; i < n; i++) {
        const v = h2(i, seed), x = h2(i, seed + 1) * W, y = lerp(y0, y1, Math.pow(v, 0.8));
        const a = Math.pow(Math.max(0, Math.sin(t * (1.3 + 2.5 * h2(i, seed + 2)) + i * 1.9)), 8);
        if (a > 0.05) { glow(g, x, y, 4 + 8 * v, '#ffffff', a * 0.9); glow(g, x, y, 16 + 20 * v, '#dbe8ff', a * 0.25); }
      }
    });
  }
  // 光：黎明前，天脚在右边泛暖；屏幕上光从右边低低地来
  const LX = 0.94, LY = -0.34;
  // 近景：镜头跟着笔锋；中景：俯拍坡面，字斜着铺开（左上远、右下近）；远景：字在他身前的雪脊坡面上
  const projA = (u, v, uc, vc) => { const k = 1 + 0.42 * (v - vc) / 150; return [600 + (u - uc) * 1.55 * k, 420 + (v - vc) * 1.7 * k]; };
  const projB = (u, v) => [230 + 0.58 * u - 0.42 * v, 280 + 0.2 * u + 0.62 * v];
  const scB = (u, v) => 6.4 * (0.78 + 0.3 * (u / 1000) + 0.24 * (v / 300));
  // 远景的刀脊：左下缓缓升到 (560,432) 的脊顶，右边是雪檐与断崖，下面云海
  const RDROP = [[560, 432], [590, 445], [630, 472], [680, 522], [740, 604], [800, 702], [850, 800]];
  const ridgeC = (x) => {
    if (x <= 560) return 432 + 178 * Math.pow((560 - x) / 620, 1.15) + 3 * (A.noise1(x * 0.03, 3) - 0.5);
    for (let i = 1; i < RDROP.length; i++) if (x <= RDROP[i][0]) return lerp(RDROP[i - 1][1], RDROP[i][1], (x - RDROP[i - 1][0]) / (RDROP[i][0] - RDROP[i - 1][0]));
    return 800;
  };
  const projC = (u, v) => { const x = 196 + u * 0.36; return [x, ridgeC(x) + 30 + v * 0.26]; };

  // 一笔雪槽：受光的坡面上被剑划开的一道沟。槽壁背光一侧深、迎光一侧浅；背光那边翻起一道白雪埂，埂内沿一线暖光；fill 为被风雪填平的程度
  function groove(g, P, Wd, a, b, al, sc, fill, crumbs) {
    const n = P.length; if (n < 2 || b - a < 0.003 || al < 0.01) return;
    const i0 = Math.floor(a * (n - 1)), i1 = Math.min(n - 1, Math.ceil(b * (n - 1)));
    if (i1 - i0 < 1) return;
    const L = [], R = [], Q = [], shrink = 1 - 0.6 * fill;
    for (let i = i0; i <= i1; i++) {
      const p = P[i], pa = P[Math.max(0, i - 1)], pb = P[Math.min(n - 1, i + 1)];
      let tx = pb[0] - pa[0], ty = pb[1] - pa[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const e = Math.min(1, (i - i0) / 3, (i1 - i) / 2) * 0.75 + 0.25;
      const w = Wd[i] * sc * e * shrink;
      L.push([p[0] - ty * w, p[1] + tx * w]); R.push([p[0] + ty * w, p[1] - tx * w]); Q.push([p[0], p[1], w]);
    }
    const shape = (dx, dy, k) => {
      g.beginPath();
      for (let i = 0; i < L.length; i++) { const q = Q[i]; g.lineTo(q[0] + (L[i][0] - q[0]) * k + dx * q[2], q[1] + (L[i][1] - q[1]) * k + dy * q[2]); }
      for (let i = R.length - 1; i >= 0; i--) { const q = Q[i]; g.lineTo(q[0] + (R[i][0] - q[0]) * k + dx * q[2], q[1] + (R[i][1] - q[1]) * k + dy * q[2]); }
      g.closePath();
    };
    g.fillStyle = rgba('#f8fafd', 0.92 * al); shape(-LX * 0.72, -LY * 0.72, 1.18); g.fill();
    g.fillStyle = rgba('#ffe4cc', 0.6 * al); shape(-LX * 0.42, -LY * 0.42, 0.9); g.fill();
    g.fillStyle = rgba('#a7b6d0', al); shape(0, 0, 1); g.fill();
    g.fillStyle = rgba('#6f82a8', 0.85 * al); shape(LX * 0.3, LY * 0.3, 0.72); g.fill();
    g.fillStyle = rgba('#c9d5e8', 0.8 * al); shape(-LX * 0.4, -LY * 0.4, 0.45); g.fill();
    // 埂外沿一圈碎雪（哑光的小块）
    if (crumbs) {
      g.fillStyle = rgba('#ffffff', 0.9 * al);
      for (let i = 0; i < Q.length; i += 2) { const q = Q[i], hh = h2(i, 41); if (hh < 0.35) continue; const d = 1.3 + 0.6 * hh, sz = q[2] * (0.12 + 0.16 * hh); g.fillRect(q[0] - LX * q[2] * d + (hh - 0.6) * q[2], q[1] - LY * q[2] * d + (h2(i, 42) - 0.5) * q[2], sz, sz * 0.8); }
      g.fillStyle = rgba('#8a9cbc', 0.5 * al);
      for (let i = 1; i < Q.length; i += 3) { const q = Q[i], hh = h2(i, 43); const d = 1.5 + 0.5 * hh, sz = q[2] * (0.08 + 0.1 * hh); g.fillRect(q[0] - LX * q[2] * d + (hh - 0.5) * q[2], q[1] - LY * q[2] * d + q[2] * 0.3, sz, sz * 0.6); }
    }
    if (fill > 0) { g.fillStyle = rgba('#e9eef6', Math.min(1, 1.1 * fill) * al); shape(0, 0, 1.3); g.fill(); }
  }
  // 风从左边来：越靠左（u 小）越先被抹平；最后那道拖到他脚边的长尾，在“愁”字收尽
  let ORDER = null;
  function erodeRank() {
    if (ORDER) return ORDER;
    const S = cursive(), idx = S.map((s, i) => i).sort((a, b) => S[a].cu - S[b].cu);
    ORDER = []; idx.forEach((i, k) => { ORDER[i] = k; });
    return ORDER;
  }
  function strokeState(c, i, T, lt) {
    const S = cursive(), n = S.length, [t0, t1] = T[i];
    const f = t1 < 0 ? 1 : easeInOut(ramp(lt, t0, t1));
    const tg = rel(c, 5, 2.62), tEnd = rel(c, 10, 4.9), kC = rel(c, 8, 4.0), k = erodeRank()[i];
    let st, en;
    if (k === n - 1) { st = kC + 0.15; en = tEnd; }
    else if (k === n - 2) { st = kC - 0.35; en = kC + 0.45; }
    else { const q = k / (n - 3); st = tg + 0.02 + q * 1.1; en = st + 0.34 + 0.22 * q; }
    return [0, f, 1, smooth(ramp(lt, st, en))];
  }
  function drawWriting(g, c, T, lt, prj, scf, o = {}) {
    const S = cursive();
    for (let i = 0; i < S.length; i++) {
      const [a, b, al, e] = strokeState(c, i, T, lt);
      if (b <= a || e >= 0.995) continue;
      const P = S[i].pts.map((p) => prj(p[0], p[1]));
      const sc = scf(S[i].cu, S[i].pts[0][1]);
      groove(g, P, S[i].wd, a, b, al, sc, e, o.crumbs);
      // 被风抹平时，一溜雪粉盖上来
      if (e > 0.02 && e < 0.98 && o.puff) {
        const k = Math.sin(PI * e) * o.puff, m = P.length;
        for (let j = 0; j < 6; j++) { const p = P[Math.floor(((j + 0.5) / 6) * (m - 1) * b)]; glow(g, p[0] + (8 - 22 * e) * sc / 6, p[1] - sc * 0.6, sc * 5.5, '#ffffff', 0.55 * k); }
      }
    }
  }

  // ---------- ① 近景：雪面、剑、手 ----------
  const snowA = () => K.cache('g13-snowA2', 1440, 860, 0.5, (q) => {
    // 由左冷到右暖；坡面有风吹出的细纹
    q.fillStyle = K.lin(q, 0, 0, 1440, 0, [[0, '#a6b4d0'], [0.45, '#d4dcea'], [0.8, '#ecdcd4'], [1, '#f4d6c4']]); q.fillRect(0, 0, 1440, 860);
    q.fillStyle = K.lin(q, 0, 0, 0, 860, [[0, 'rgba(70,86,130,0.22)'], [0.4, 'rgba(70,86,130,0)'], [1, 'rgba(255,250,246,0.18)']]); q.fillRect(0, 0, 1440, 860);
    const r = A.rng(31);
    for (let i = 0; i < 26; i++) A.softBlob(q, r() * 1440, r() * 860, 140 + r() * 260, 0.18, i % 3 ? '#93a4c4' : '#ffffff');
    for (let i = 0; i < 160; i++) {
      const y = r() * 860, x = r() * 1440, len = 50 + r() * 190 * (0.4 + y / 860), warm = x > 900;
      q.strokeStyle = rgba(i % 4 ? (warm ? '#c8a8a4' : '#8a9cbc') : '#ffffff', 0.12 + 0.12 * r()); q.lineWidth = 0.8 + 1.6 * (y / 860);
      q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + len * 0.5, y - 3 - r() * 4, x + len, y + r() * 2); q.stroke();
    }
    q.globalCompositeOperation = 'lighter'; A.glow(q, 1440, 300, 700, '#ffc8a8', 0.2); q.globalCompositeOperation = 'source-over';
  });
  // 前景失焦的雪壳：大、亮、糊
  const crustA = () => K.cache('g13-crustA', 1500, 260, 0.5, (q) => {
    if ('filter' in q) q.filter = 'blur(12px)';
    const r = A.rng(44);
    q.fillStyle = 'rgba(120,138,180,0.55)'; q.fillRect(0, 210, 1500, 60);
    for (let i = 0; i < 14; i++) { const x = r() * 1500, y = 120 + r() * 80, rx = 120 + r() * 200; q.fillStyle = 'rgba(110,128,176,0.6)'; q.beginPath(); q.ellipse(x + 14, y + 26, rx, rx * 0.45, 0, 0, TAU); q.fill(); q.fillStyle = i % 3 ? 'rgba(255,255,255,1)' : 'rgba(255,238,226,1)'; q.beginPath(); q.ellipse(x, y, rx, rx * 0.42, 0, 0, TAU); q.fill(); }
    q.filter = 'none';
  });
  // 老人的手：从墨色大袖、白里衣袖口里伸出，攥着剑柄（a 为剑身方向角）
  function oldHand(g, hx, hy, a, s, t) {
    g.save(); g.translate(hx, hy); g.rotate(a); g.scale(s, s);
    // 大袖：小臂裹在墨色袖里，往画外渐宽，袖口软软地翻着；袖边被风吹得起伏
    const fl = Math.sin(t * 2.6) * 6, fl2 = Math.sin(t * 3.4 + 1) * 4;
    g.fillStyle = '#16181e';
    g.beginPath(); g.moveTo(-36, -36); g.bezierCurveTo(-52, -90, -70 + fl2, -170, -96 + fl, -320); g.lineTo(150, -320); g.bezierCurveTo(110 + fl2, -190, 70, -100, 42, -36); g.quadraticCurveTo(4, -50, -36, -36); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(96,106,128,0.4)'; g.lineWidth = 2.2; g.lineCap = 'round';
    for (const [x0, x1, b0] of [[-18, -40, 0.3], [6, 10, 0.5], [26, 70, 0.4]]) { g.beginPath(); g.moveTo(x0, -52); g.bezierCurveTo(x0 + (x1 - x0) * 0.3 - 10, -120, x1 - 6 + fl2 * b0, -200, x1 + fl * b0, -320); g.stroke(); }
    g.strokeStyle = 'rgba(255,214,190,0.5)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(42, -38); g.bezierCurveTo(70, -100, 110 + fl2, -190, 150, -320); g.stroke();
    g.fillStyle = '#e8ecf0'; g.beginPath(); g.moveTo(-30, -44); g.quadraticCurveTo(2, -54, 36, -44); g.lineTo(30, -26); g.quadraticCurveTo(0, -34, -26, -26); g.closePath(); g.fill();
    g.fillStyle = 'rgba(160,170,190,0.6)'; g.fillRect(-26, -30, 54, 3);
    // 手背与四指：枯瘦，指节突起，几道青筋
    g.fillStyle = K.lin(g, -22, 0, 26, 0, [[0, '#b89a86'], [0.6, '#d8bea8'], [1, '#f0d4bc']]);
    g.beginPath(); g.moveTo(-22, -28); g.quadraticCurveTo(-28, -2, -18, 22); g.quadraticCurveTo(0, 30, 22, 22); g.quadraticCurveTo(30, 0, 24, -28); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(96,70,60,0.6)'; g.lineWidth = 1.3;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-20, -6 + k * 9); g.quadraticCurveTo(0, -2 + k * 9, 24, -6 + k * 9); g.stroke(); }
    g.strokeStyle = 'rgba(110,120,150,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-10, -26); g.quadraticCurveTo(-6, -14, -12, -4); g.moveTo(6, -26); g.quadraticCurveTo(10, -16, 6, -6); g.stroke();
    g.fillStyle = 'rgba(120,80,60,0.35)'; g.beginPath(); g.arc(8, -18, 2.2, 0, TAU); g.arc(-6, -14, 1.6, 0, TAU); g.fill();
    // 拇指压在柄上
    g.fillStyle = '#d6bca6'; g.beginPath(); g.ellipse(-20, 14, 9, 6, 0.6, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,226,206,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(24, -26); g.quadraticCurveTo(30, 0, 22, 20); g.stroke();
    g.restore();
  }
  // 近景的剑：刃宽约 14 像素，护手、缠柄、剑首、红穗都在画里；tx,ty 剑尖，ang 剑身方向（剑尖指向的反方向）
  function swordCU(g, tx, ty, t, wind) {
    const ux = 0.7, uy = -0.714, L = 392;
    const gx = tx + ux * L, gy = ty + uy * L, nx = -uy, ny = ux;
    // 刃：哑光的钢，迎光一侧亮、背光一侧暗，中间一道浅浅的脊
    g.fillStyle = K.lin(g, gx + nx * 7, gy + ny * 7, gx - nx * 7, gy - ny * 7, [[0, '#7c8898'], [0.48, '#c8d0da'], [0.52, '#a8b2c0'], [1, '#e8eef4']]);
    g.beginPath(); g.moveTo(gx + nx * 7, gy + ny * 7); g.lineTo(tx + ux * 30 + nx * 4.5, ty + uy * 30 + ny * 4.5); g.lineTo(tx, ty); g.lineTo(tx + ux * 30 - nx * 4.5, ty + uy * 30 - ny * 4.5); g.lineTo(gx - nx * 7, gy - ny * 7); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,70,86,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(gx, gy); g.lineTo(tx + ux * 36, ty + uy * 36); g.stroke();
    // 护手
    g.strokeStyle = '#3a2c1e'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(gx + nx * 24, gy + ny * 24); g.lineTo(gx - nx * 24, gy - ny * 24); g.stroke();
    g.strokeStyle = '#b8955a'; g.lineWidth = 3; g.beginPath(); g.moveTo(gx + nx * 22, gy + ny * 22 - 2); g.lineTo(gx - nx * 22, gy - ny * 22 - 2); g.stroke();
    // 缠柄与剑首
    const px = gx + ux * 84, py = gy + uy * 84;
    g.strokeStyle = '#1e1a18'; g.lineWidth = 9; g.beginPath(); g.moveTo(gx + ux * 6, gy + uy * 6); g.lineTo(px, py); g.stroke();
    g.strokeStyle = 'rgba(160,130,90,0.5)'; g.lineWidth = 1.2;
    for (let k = 1; k < 8; k++) { const u = 6 + k * 10; g.beginPath(); g.moveTo(gx + ux * u + nx * 4, gy + uy * u + ny * 4); g.lineTo(gx + ux * (u + 6) - nx * 4, gy + uy * (u + 6) - ny * 4); g.stroke(); }
    g.fillStyle = '#b8955a'; g.beginPath(); g.ellipse(px, py, 8, 6, Math.atan2(uy, ux), 0, TAU); g.fill();
    oldHand(g, gx + ux * 40, gy + uy * 40, Math.atan2(uy, ux) - PI / 2 + PI, 1.05, t);
    // 红穗：剑首垂下，四股顺着剑身往左下甩（让开右边的字）
    const sw = Math.sin(t * 3.1) * 0.6 + Math.sin(t * 5.3 + 1) * 0.3;
    const kx = px - 8, ky = py + 14;
    g.strokeStyle = '#a8241c'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(px, py); g.lineTo(kx, ky); g.stroke();
    g.fillStyle = '#c83c23'; g.beginPath(); g.arc(kx, ky, 6, 0, TAU); g.fill();
    g.fillStyle = '#e8b04a'; g.fillRect(kx - 5, ky + 5, 10, 3);
    for (let k = 0; k < 4; k++) {
      const ph = k * 0.9, L2 = 110 + 14 * k, ex = kx - (40 + 50 * wind) - k * 9 + sw * 16 + Math.sin(t * 4 + ph) * 6, ey = ky + L2 * (1 - 0.3 * wind);
      g.strokeStyle = k % 2 ? '#c83c23' : '#b02a1e'; g.lineWidth = 3.2 - k * 0.4;
      g.beginPath(); g.moveTo(kx - 2 + k * 1.5, ky + 8); g.bezierCurveTo(kx - 4 - k * 3, ky + L2 * 0.35, ex + 24 + Math.sin(t * 3.6 + ph) * 10, ey - L2 * 0.3, ex, ey); g.stroke();
    }
    return { gx, gy };
  }

  // ---------- ② 中景：俯拍一面斜坡，天脚只露一线 ----------
  const bgB = () => K.cache('g13-bgB2', 1360, 780, 1, (q) => {
    q.translate(40, 30);
    // 天：顶上冷蓝，右边天脚一抹暖
    q.fillStyle = K.lin(q, 0, -30, 0, 160, [[0, '#2e3f6e'], [0.6, '#6a7aa2'], [1, '#c8c6d4']]); q.fillRect(-40, -30, 1360, 190);
    q.save(); q.translate(1100, 156); q.scale(2.6, 0.32); A.softBlob(q, 0, 0, 420, 0.95, '#f3c9b0'); A.softBlob(q, 120, 0, 260, 0.9, '#f7e1c4'); q.restore();
    q.globalCompositeOperation = 'lighter'; A.glow(q, 1240, 150, 380, '#ffc8a0', 0.3); q.globalCompositeOperation = 'source-over';
    // 天边一线远岭
    q.fillStyle = '#8a92b4'; q.beginPath(); q.moveTo(-40, 160); for (let x = -40; x <= 1320; x += 20) q.lineTo(x, 150 - 10 * Math.abs(Math.sin(x * 0.006)) - 6 * A.noise1(x * 0.02, 2)); q.lineTo(1320, 160); q.closePath(); q.fill();
    // 坡面：远处冷、近处亮，右边受光偏暖
    q.fillStyle = K.lin(q, 0, 150, 0, 760, [[0, '#bcc6dc'], [0.35, '#d6dcea'], [1, '#eef1f7']]); q.fillRect(-40, 150, 1360, 620);
    q.fillStyle = K.lin(q, 0, 0, 1320, 0, [[0, 'rgba(100,116,160,0.18)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(247,214,190,0.35)']]); q.fillRect(-40, 150, 1360, 620);
    // 风吹出的雪纹：斜着一道道，亮边在右上、影在左下
    const r = A.rng(17);
    for (let i = 0; i < 70; i++) {
      const y = 170 + Math.pow(r(), 0.8) * 590, x = -60 + r() * 1400, len = (60 + r() * 220) * (0.4 + (y - 150) / 600), dip = len * 0.28;
      q.strokeStyle = rgba('#8494b8', 0.16 + 0.1 * r()); q.lineWidth = 0.8 + 1.8 * (y - 150) / 600;
      q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + len * 0.5, y + dip * 0.3 - 4, x + len, y + dip); q.stroke();
      q.strokeStyle = rgba('#ffffff', 0.3); q.lineWidth *= 0.7; q.beginPath(); q.moveTo(x + 2, y - 2); q.quadraticCurveTo(x + len * 0.5 + 2, y + dip * 0.3 - 6, x + len + 2, y + dip - 2); q.stroke();
    }
    // 他一路走来的脚印：从右上坡顶下来
    for (let k = 0; k < 18; k++) {
      const u = k / 17, x = lerp(1000, 790, u) + Math.sin(u * 5) * 20 + (k % 2 ? 9 : -9) * (0.5 + u), y = lerp(176, 610, Math.pow(u, 1.3)), s2 = 0.5 + u;
      q.fillStyle = 'rgba(90,108,150,0.42)'; q.beginPath(); q.ellipse(x, y, 6 * s2, 2.6 * s2, -0.3, 0, TAU); q.fill();
      q.fillStyle = 'rgba(255,255,255,0.7)'; q.beginPath(); q.ellipse(x - 1.5 * s2, y - 2 * s2, 5.5 * s2, 1.3 * s2, -0.3, PI, TAU); q.fill();
    }
    // 雪里冒出的几块黑石
    for (const [x, y, rr] of [[70, 230, 16], [140, 250, 9], [40, 420, 26], [1210, 690, 30]]) { q.fillStyle = '#343c4c'; A.inkBlob(q, x, y, rr, x, 0.3); q.fill(); q.fillStyle = '#f2f5fa'; q.beginPath(); q.ellipse(x - 2, y - rr * 0.35, rr * 0.95, rr * 0.4, -0.1, PI, TAU); q.fill(); }
  });
  // 一阵风：一堵雪墙从左边压过来，几片雪幕、几十道雪线，镜头被推得一晃
  function gustWall(g, lt, t0, y0, y1, k) {
    const age = lt - t0; if (age < -0.06 || age > 2.6) return;
    const front = lerp(-220, 1800, age / 1.05), life = ramp(age, -0.06, 0.1) * (1 - ramp(age, 1.3, 2.6));
    // 雪墙脚下贴地一溜淡影，让白的雪幕在白坡上看得出来
    g.save(); g.translate(front - 280, (y0 + y1) / 2 + 40); g.scale(2.4, 0.75); glow(g, 0, 0, 260, '#5a6e9e', 0.2 * life); g.restore();
    for (let i = 0; i < 4; i++) { const x = front - 120 - i * 230 + Math.sin(lt * 2 + i) * 30, y = lerp(y0, y1, 0.2 + 0.6 * h2(i, 71)); if (x < -320 || x > W + 320) continue; glow(g, x, y, (150 + 100 * h2(i, 72)) * k, '#ffffff', 0.55 * life); }
    g.lineCap = 'round';
    for (let band = 0; band < 2; band++) {
      g.strokeStyle = rgba('#ffffff', (0.6 + 0.2 * band) * life); g.lineWidth = (1 + band * 1.2) * k;
      g.beginPath();
      for (let i = 0; i < 38; i++) {
        const id = band * 40 + i, v = h2(id, 81), x = front - 30 - h2(id, 82) * 1150 + Math.sin(lt * 9 + id) * 12, y = lerp(y0, y1, Math.pow(h2(id, 83), 0.8)) + Math.sin(lt * 3 + id) * 8;
        if (x < -100 || x > W + 140) continue;
        const len = (50 + 120 * v) * k; g.moveTo(x, y); g.lineTo(x - len, y + len * 0.06);
      }
      g.stroke();
    }
  }

  // ---------- ③ 远景：刀脊、雪檐、云海、天脚的暖 ----------
  const bgC = () => K.cache('g13-bgC3', 1360, 780, 1, (q) => {
    q.translate(40, 30);
    E.sky(q, { stops: [[0, '#2e3f6e'], [0.45, '#56658e'], [0.8, '#aaa8c2'], [1, '#e8c8b8']], y0: -30, y1: 440 });
    q.save(); q.translate(1120, 410); q.scale(2.2, 0.42); A.softBlob(q, 0, 0, 420, 0.9, '#f3c9b0'); A.softBlob(q, 80, 10, 260, 0.9, '#f7e1c4'); q.restore();
    q.globalCompositeOperation = 'lighter'; A.glow(q, 1180, 420, 420, '#ffcaa4', 0.28); q.globalCompositeOperation = 'source-over';
    // 云海上冒头的远峰，右脸受光
    E.mountains(q, { t: 0, lightDir: 1, layers: [
      { kind: 'far', color: '#9a9cbc', light: '#ffe2cc', litA: 0.65, y: 462, scaleY: 0.5, speed: 0, seed: 23, fog: '#e8dcdc', fogA: 0.5 },
    ] });
    E.cloudSea(q, { t: 0, y: 480, color: '#f6ece6', shade: '#8a94b4', speed: 0, rows: 4, seed: 6, lightX: 1200 });
    q.fillStyle = K.lin(q, 0, 440, 0, 520, [[0, 'rgba(236,226,226,0)'], [0.45, 'rgba(236,226,226,0.92)'], [0.7, 'rgba(232,226,232,0.75)'], [1, 'rgba(232,226,232,0)']]); q.fillRect(-40, 440, 1360, 80);
    E.mist(q, { t: 0, y: 490, h: 70, color: '#ece2e2', alpha: 0.6, speed: 0, seed: 4 });
    const sky = (x) => ridgeC(x);
    const outline = () => { q.beginPath(); q.moveTo(-60, 800); for (let x = -60; x <= 850; x += 6) q.lineTo(x, sky(x)); q.lineTo(850, 800); q.closePath(); };
    // 刀脊的面：近脊处受光偏暖，往下转冷；右边陡面背着我们，蓝紫
    q.fillStyle = K.lin(q, 0, 430, 0, 760, [[0, '#f4f0f2'], [0.3, '#d2d8e8'], [1, '#98a6c4']]); outline(); q.fill();
    q.save(); outline(); q.clip();
    q.fillStyle = K.lin(q, 0, 0, 600, 0, [[0, 'rgba(110,126,170,0.32)'], [1, 'rgba(255,236,224,0.2)']]); q.fillRect(-60, 400, 920, 400);
    // 脊背：从脊顶斜着往右下的一道棱，棱右是背光的陡面
    const spine = (y) => 560 + (y - 432) * 0.42 + 8 * Math.sin(y * 0.03);
    const shadeFace = () => { q.beginPath(); q.moveTo(spine(432), 432); for (let y = 440; y <= 800; y += 12) q.lineTo(spine(y), y); q.lineTo(900, 800); q.lineTo(900, 420); q.closePath(); };
    q.fillStyle = K.lin(q, 560, 0, 900, 0, [[0, 'rgba(118,128,178,0.72)'], [1, 'rgba(86,94,148,0.8)']]); shadeFace(); q.fill();
    q.strokeStyle = 'rgba(255,240,232,0.55)'; q.lineWidth = 2.5; q.beginPath(); for (let y = 434; y <= 800; y += 12) q.lineTo(spine(y) - 2, y); q.stroke();
    // 雪槽：从脊线往下，一道暗一道亮，越往下越淡
    const r = A.rng(8);
    for (let i = 0; i < 13; i++) {
      const x0 = -20 + i * 44 + r() * 20, y0 = sky(x0) + 3, L = 90 + r() * 220, bend = -30 - r() * 50, wd = 4 + r() * 8;
      for (let k = 0; k < 3; k++) {
        const u0 = k / 3, u1 = (k + 1) / 3, P = (u) => [x0 + bend * u * u, y0 + L * u];
        const [ax, ay] = P(u0), [bx, by] = P(u1);
        q.strokeStyle = rgba('#5a6a9c', (0.2 - k * 0.06) * (0.7 + 0.6 * r())); q.lineWidth = wd * (1 - k * 0.2); q.lineCap = 'round';
        q.beginPath(); q.moveTo(ax, ay); q.lineTo(bx, by); q.stroke();
        q.strokeStyle = rgba('#ffffff', 0.4 - k * 0.12); q.lineWidth = 1.4; q.beginPath(); q.moveTo(ax + wd * 0.6, ay + 1); q.lineTo(bx + wd * 0.6, by); q.stroke();
      }
    }
    for (let i = 0; i < 6; i++) { const y0 = 450 + i * 28, x = spine(y0) + 14 + r() * 20; q.strokeStyle = 'rgba(60,64,120,0.28)'; q.lineWidth = 4 + r() * 5; q.beginPath(); q.moveTo(x, y0); q.lineTo(x + 30 + r() * 40, y0 + 90 + r() * 90); q.stroke(); }
    for (const [x, dy, rr] of [[80, 150, 22], [250, 110, 15], [380, 170, 24], [20, 250, 30], [660, 90, 18]]) { const y = sky(x) + dy; q.fillStyle = '#323a4a'; A.inkBlob(q, x, y, rr, x + 3, 0.35); q.fill(); q.fillStyle = '#f4f6fa'; q.beginPath(); q.ellipse(x - 2, y - rr * 0.4, rr, rr * 0.38, -0.3, PI, TAU); q.fill(); }
    q.restore();
    // 脊线：受光一线
    q.strokeStyle = 'rgba(255,240,228,0.95)'; q.lineWidth = 2; q.lineCap = 'round'; q.beginPath(); for (let x = -60; x <= 600; x += 6) q.lineTo(x, sky(x) + 0.5); q.stroke();
    // 雪檐：脊顶往下风（右）翻出一道唇，唇下一抹蓝影
    q.fillStyle = 'rgba(80,90,150,0.5)'; q.beginPath(); q.moveTo(566, 438); q.quadraticCurveTo(606, 452, 618, 476); q.quadraticCurveTo(596, 460, 572, 452); q.closePath(); q.fill();
    q.fillStyle = '#faf6f4'; q.beginPath(); q.moveTo(540, 433); q.quadraticCurveTo(592, 426, 626, 440); q.quadraticCurveTo(636, 448, 624, 452); q.quadraticCurveTo(596, 444, 566, 446); q.closePath(); q.fill();
    q.strokeStyle = 'rgba(255,232,214,0.9)'; q.lineWidth = 1.6; q.beginPath(); q.moveTo(544, 433); q.quadraticCurveTo(592, 426, 626, 440); q.stroke();
  });
  // 脊顶被风扬起的雪烟：往右（下风）飘过雪檐，散在云海上空
  function crestPlume(g, t, k) {
    for (let i = 0; i < 14; i++) {
      const ph = ((t * (0.28 + 0.12 * h2(i, 91)) + h2(i, 92)) % 1), x = 572 + ph * 560, y = 428 - ph * 46 - 16 * h2(i, 93) + Math.sin(t * 2 + i) * 6;
      glow(g, x, y, (36 + 80 * ph) * k, '#ffffff', 0.36 * Math.sin(PI * ph) * k);
    }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i < 26; i++) { const ph = ((t * (0.9 + 0.6 * h2(i, 94)) + h2(i, 95)) % 1), x = 566 + ph * 520, y = 426 - ph * 34 - 18 * h2(i, 96); g.moveTo(x, y); g.lineTo(x - 26 - 30 * h2(i, 97), y + 2); }
    g.stroke();
  }

  XYT.registerShot('c3_snowcursive', {
    name: '雪上题名', zone: 'right', night: false, text: '#1a2026', shadow: 'rgba(236,242,248,0.92)', accent: '#c83c23', bloom: 0.3,
    draw(g, c) {
      const lt = c.lt, t = c.t;
      const kB = rel(c, 4, 2.28), kC = rel(c, 8, 4.0), kM = 5.28, tEnd = rel(c, 10, 4.9);
      const T = strokeTimes(c);
      const gust = rel(c, 5, 2.62);
      const wind = 0.35 + 0.65 * bell(lt, gust - 0.1, gust + 2.2) + 0.15 * beatE(c, 0.4);
      if (lt < kB) {
        // ① 近景：剑尖在雪上走草书，雪粉翻起；镜头跟着笔锋慢移
        const uc = lerp(300, 640, smooth((lt + 0.2) / 2.5)), vc = 220;
        const prj = (u, v) => projA(u, v, uc, vc);
        const sw = Math.sin(t * 0.9) * 5;
        g.drawImage(snowA(), -80 - (uc - 300) * 0.3 + sw * 0.3, -70, 1440, 860);
        drawWriting(g, c, T, lt, prj, (u, v) => 13.5 * (0.85 + 0.3 * (v - vc) / 150), { crumbs: true });
        const tp = tipUV(c, T, lt), [tx0, ty0] = prj(tp.uv[0], tp.uv[1]);
        const tx = tx0, ty = ty0 - tp.lift * 46;
        powder(g, c, T, lt, prj, 1.7);
        // 剑与手的影子：光从右边来，影子往左下拖
        g.strokeStyle = 'rgba(60,78,120,0.22)'; g.lineWidth = 9; g.lineCap = 'round';
        g.beginPath(); g.moveTo(tx, ty0 + 2); g.lineTo(tx - 300, ty0 + 130); g.stroke();
        swordCU(g, tx, ty, t, wind);
        // 剑尖点雪的一星冷光
        add(g, () => { glow(g, tx, ty, 30, '#e8f2ff', tp.writing ? 0.5 : 0.15); glow(g, tx, ty, 9, '#ffffff', tp.writing ? 0.8 : 0.2); });
        g.drawImage(crustA(), -120 + (uc - 300) * 0.5 - 40, 556, 1500, 260);
        V.snow(g, c, { n: 70, size: [2, 16], fall: 40, wind: -30 - 40 * wind, alpha: 0.8, seed: 5 });
      } else if (lt < kC) {
        // ② 中景俯拍：他立在斜铺的字旁，剑尖点着最后一笔的尾；“情”字一堵雪墙压过来，笔画一道道被填平
        const ga = lt - gust, shake = ga > 0 ? 3.5 * Math.exp(-ga / 0.35) * Math.sin(ga * 55) : 0;
        g.save(); g.translate(Math.round(Math.sin(t * 0.8) * 2 + shake), Math.round(shake * 0.6));
        g.drawImage(bgB(), -40, -30, 1360, 780);
        twinkle(g, t, 200, 720, 26, 3);
        V.snow(g, c, { n: 50, size: [1, 4], fall: 30, wind: 40 + 160 * bell(lt, gust, gust + 2), alpha: 0.7, seed: 18, layer: 'back' });
        drawWriting(g, c, T, lt, projB, scB, { puff: 1 });
        const tp = tipUV(c, T, lt), [tx, ty] = projB(tp.uv[0], tp.uv[1]);
        powder(g, c, T, lt, projB, 0.75);
        const fx = 770, fy = 650, s = 1.62;
        // 长长的冷影拖向左下
        g.fillStyle = K.lin(g, fx, fy, fx - 400, fy + 110, [[0, 'rgba(60,80,130,0.35)'], [1, 'rgba(60,80,130,0)']]);
        g.beginPath(); g.moveTo(fx - 20, fy + 2); g.lineTo(fx + 22, fy + 4); g.lineTo(fx - 380, fy + 130); g.lineTo(fx - 430, fy + 100); g.closePath(); g.fill();
        const fo = { pose: 'stand', facing: -1, wind: 0.65 + 0.3 * wind, cloakWind: 0.4 + 0.3 * wind, cloakLen: 0.78, windDir: 1, rim: '#ffe6d2', light: [1300, 150], cloakRim: '#ffd8c4', seed: 3 };
        const P = elder(g, fx, fy, s, t, fo);
        const hn = P.handN;
        jian(g, hn[0], hn[1], tx, Math.max(ty, hn[1] + 60), t, { s: 1.5, wind, windDir: 1 });
        add(g, () => glow(g, tx, ty, 18, '#eef6ff', 0.35));
        gustWall(g, lt, gust, 260, 700, 1);
        blowSnow(g, lt, gust + 0.5, 420, 720, 1, 1.6, 1);
        V.snow(g, c, { n: 60, size: [3, 12], fall: 50, wind: 60 + 260 * bell(lt, gust, gust + 2), alpha: 0.8, seed: 8, layer: 'front' });
        g.restore();
      } else if (lt < kM) {
        // ③ 远景：刀脊上一个人握剑而立，雪烟从脊顶往左扬；身前坡上最后几笔在“愁”字散尽
        g.drawImage(bgC(), -40, -30, 1360, 780);
        E.mist(g, { t, y: 560, h: 120, color: '#f2ece8', alpha: 0.35, speed: -12, seed: 9 });
        V.birds(g, c, { kind: 'flock', n: 4, x: 860, y: 250, speed: 22, size: 0.5, color: '#3a4458', alpha: 0.4, seed: 4 });
        drawWriting(g, c, T, lt, projC, () => 5, { puff: 1 });
        // 最后一笔收尽：一团雪粉扬起
        const pa = lt - tEnd;
        if (pa > -0.1 && pa < 1.2) { const k = Math.sin(PI * clamp((pa + 0.1) / 1.3)), [px0, py0] = projC(760, 250); for (let j = 0; j < 6; j++) glow(g, px0 - 60 + j * 26 + pa * (40 + 24 * j), py0 - pa * (24 + 8 * j) - j * 4, 26 + 34 * pa + 6 * j, '#ffffff', 0.55 * k); }
        const fx = 560, fy = 433, s = 0.62;
        g.fillStyle = K.lin(g, fx, fy, fx - 200, fy + 40, [[0, 'rgba(60,80,130,0.35)'], [1, 'rgba(60,80,130,0)']]);
        g.beginPath(); g.moveTo(fx - 8, fy + 1); g.lineTo(fx + 8, fy + 2); g.lineTo(fx - 190, fy + 52); g.lineTo(fx - 210, fy + 40); g.closePath(); g.fill();
        const P = elder(g, fx, fy, s, t, { pose: 'stand', facing: -1, wind: 0.9, cloakWind: 0.7, cloakLen: 0.82, windDir: 1, rim: '#fff0e4', light: [1200, 400], seed: 3, cloakRim: '#ffe8d8' });
        jian(g, P.handN[0], P.handN[1], P.handN[0] - 14, fy - 1, t, { s: 0.6, wind: 0.85, windDir: 1 });
        crestPlume(g, t, 1);
        V.snow(g, c, { n: 110, size: [1, 6], fall: 34, wind: 90, alpha: 0.75, seed: 12 });
      } else {
        // ④ 回忆：晴天擂台，红衣月如收鞭仰头大笑（工笔重彩）
        memArena(g, c, lt - kM);
      }
      if (lt >= kB && lt < kB + 0.3) flash(g, lt - kB, '#f4f8ff', 0.3);
      if (lt >= kC && lt < kC + 0.3) flash(g, lt - kC, '#f4f8ff', 0.25);
      // 后面几个场景的贴图在前面分帧预备
      if (lt > 0.5) bgB(); if (lt > 1.0) bgC(); if (lt > 3.0) arenaBg(); if (lt > 3.4) arenaStage();
    },
  });

  // ---------- ④ 回忆：比武招亲的擂台（与前面那场擂台同一处：青金彩幔、乌木柱、锣架、台下看客、远处塔影）----------
  const arenaBg = () => K.cache('g13-arenaBg2', 1360, 780, 1, (q) => {
    q.translate(40, 30);
    q.fillStyle = K.lin(q, 0, -30, 0, 600, [[0, '#4f8fbf'], [0.45, '#9cc6dc'], [0.85, '#e4f0ee'], [1, '#f3f9f1']]); q.fillRect(-40, -30, 1360, 640);
    E.sun(q, { x: 160, y: 60, r: 30, color: '#fffbe8', glow: 0.75, spread: 6 });
    E.clouds(q, { t: 0, y: 150, color: '#ffffff', shade: '#9fb8cc', alpha: 0.85, scale: 1.0, n: 4, seed: 31, speed: 0, lightX: 160, style: 'cumulus' });
    E.mountains(q, { t: 0, lightDir: -1, layers: [
      { kind: 'far', color: '#a9bccb', light: '#f6f2e4', litA: 0.5, y: 520, scaleY: 0.32, seed: 8, offset: 300, speed: 0, fog: '#e8f0ee', fogA: 0.5 },
      { kind: 'mid', color: '#88a49e', light: '#eef0dc', litA: 0.5, y: 552, scaleY: 0.3, seed: 12, offset: 120, speed: 0, fog: '#e6eeea', fogA: 0.45 },
    ] });
    // 远塔
    const px = 930, pb = 540;
    for (let k = 0; k < 7; k++) {
      const w = 40 - k * 4, y0 = pb - k * 30;
      q.fillStyle = rgba('#7c8c94', 0.75); q.fillRect(px - w / 2, y0 - 22, w, 22);
      q.fillStyle = rgba('#56646c', 0.8); q.beginPath(); q.moveTo(px - w / 2 - 12, y0 - 20); q.quadraticCurveTo(px, y0 - 30, px + w / 2 + 12, y0 - 20); q.lineTo(px + w / 2 + 2, y0 - 26); q.lineTo(px - w / 2 - 2, y0 - 26); q.closePath(); q.fill();
    }
    q.fillRect(px - 1.5, pb - 240, 3, 34);
    E.jiangnanTown(q, { t: 0, y: 590, scale: 0.85, color: '#f1ece0', roof: '#3d4248', haze: '#d8e2e2', seed: 9, hazeA: 0.12, bank: false, light: '#fff4d8', lightX: 160 });
    E.willow(q, { x: 40, y: 610, s: 0.95, t: 0, wind: 0.4, color: '#8aa84e', seed: 5 });
    q.fillStyle = K.lin(q, 0, 550, 0, 620, [[0, 'rgba(240,246,240,0)'], [1, 'rgba(240,246,240,0.5)']]); q.fillRect(-40, 550, 1360, 90);
  });
  const AF = 600, GONG = [790, 352];
  const arenaStage = () => K.cache('g13-arenaStage', 1360, 780, 1, (q) => {
    q.translate(40, 30);
    const wood = '#493131', gold = '#eacd76', teal = '#5e8a84', cream = '#f3ecd6', [gx, gy] = GONG;
    // 锣架
    q.fillStyle = K.lin(q, gx - 70, 0, gx + 70, 0, [[0, '#3a2626'], [1, '#5a3c34']]);
    q.fillRect(gx - 74, gy - 74, 9, AF - gy + 74); q.fillRect(gx + 65, gy - 74, 9, AF - gy + 74);
    q.fillRect(gx - 86, gy - 82, 172, 10); q.fillStyle = gold; q.fillRect(gx - 86, gy - 82, 172, 2);
    q.strokeStyle = '#2a1c18'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(gx - 30, gy - 72); q.lineTo(gx - 12, gy - 46); q.moveTo(gx + 30, gy - 72); q.lineTo(gx + 12, gy - 46); q.stroke();
    // 两根乌木柱（左在画边，右让出歌词栏）
    for (const px of [60, 1250]) {
      q.fillStyle = K.lin(q, px - 15, 0, px + 15, 0, [[0, '#6a4840'], [0.35, '#4a302c'], [1, '#2a1a18']]); q.fillRect(px - 15, -30, 30, AF + 34);
      q.fillStyle = gold; q.fillRect(px - 16, 112, 32, 5); q.fillRect(px - 16, 420, 32, 5);
      q.fillStyle = '#8a8478'; q.fillRect(px - 22, AF - 10, 44, 12);
    }
    // 顶梁与青金米三色彩幔
    q.fillStyle = K.lin(q, 0, -30, 0, 34, [[0, '#2e1e1c'], [1, wood]]); q.fillRect(-40, -30, 1360, 64);
    q.fillStyle = gold; q.fillRect(-40, 30, 1360, 3);
    const sw = (x0, x1, y0, dep, col) => { q.fillStyle = col; q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo((x0 + x1) / 2, y0 + dep * 2, x1, y0); q.lineTo(x1, y0 - 4); q.quadraticCurveTo((x0 + x1) / 2, y0 + dep * 1.2, x0, y0 - 4); q.closePath(); q.fill(); };
    for (let k = -1; k < 11; k++) { const x0 = 20 + k * 130; sw(x0, x0 + 130, 34, 26, k % 2 ? teal : '#7aa39a'); sw(x0 + 10, x0 + 120, 34, 14, k % 2 ? gold : cream); q.fillStyle = gold; q.beginPath(); q.arc(x0, 38, 4, 0, TAU); q.fill(); q.fillStyle = '#c84a30'; q.fillRect(x0 - 2, 66, 4, 8); q.strokeStyle = '#c9a858'; q.lineWidth = 1.4; q.beginPath(); q.moveTo(x0, 40); q.lineTo(x0, 66); q.stroke(); }
    // 台面与台裙
    q.fillStyle = K.lin(q, 0, AF - 8, 0, AF + 14, [[0, '#8a6a52'], [1, '#3a2622']]); q.fillRect(-40, AF - 6, 1360, 20);
    q.fillStyle = 'rgba(255,240,210,0.5)'; q.fillRect(-40, AF - 6, 1360, 1.5);
    q.fillStyle = K.lin(q, 0, AF + 14, 0, 760, [[0, '#4a6f6a'], [1, '#2e4644']]); q.fillRect(-40, AF + 14, 1360, 760 - AF);
    q.fillStyle = gold; q.fillRect(-40, AF + 14, 1360, 4);
    for (let k = 0; k < 16; k++) { const x0 = -40 + k * 90; q.fillStyle = k % 2 ? cream : '#e6d7a8'; q.beginPath(); q.moveTo(x0, AF + 18); q.quadraticCurveTo(x0 + 45, AF + 64, x0 + 90, AF + 18); q.closePath(); q.fill(); q.strokeStyle = gold; q.lineWidth = 1.2; q.stroke(); }
  });
  // 台下看客：头肩剪影，随拍起伏
  function crowd(g, c, t) {
    const cols = ['#3c4a66', '#6e5634', '#4a5e58', '#5a3e36', '#4b4b5a', '#7a6a4a'];
    for (let k = 0; k < 15; k++) {
      const x = 20 + k * 90 + (h2(k, 3) - 0.5) * 30, bob = Math.max(0, Math.sin(t * 6 + k * 1.3)) * 6 * (0.5 + beatE(c, 0.3)), y = 690 + h2(k, 4) * 24 - bob, s = 0.95 + 0.25 * h2(k, 5), arm = h2(k, 6) < 0.3 ? (h2(k, 7) < 0.5 ? 1 : -1) : 0;
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = cols[k % 6]; g.beginPath(); g.moveTo(-48, 80); g.quadraticCurveTo(-46, 4, -18, -6); g.lineTo(18, -6); g.quadraticCurveTo(46, 4, 48, 80); g.closePath(); g.fill();
      if (arm) { g.strokeStyle = cols[k % 6]; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.moveTo(30 * arm, 4); g.quadraticCurveTo(48 * arm, -30, 40 * arm, -62 - bob); g.stroke(); g.fillStyle = '#d8b894'; g.beginPath(); g.arc(40 * arm, -66 - bob, 7, 0, TAU); g.fill(); }
      g.fillStyle = '#26262c'; g.fillRect(-8, -16, 16, 14); g.beginPath(); g.ellipse(0, -30, 15, 17, 0, 0, TAU); g.fill();
      const hk = k % 4; if (hk === 0) { g.beginPath(); g.moveTo(-34, -32); g.lineTo(0, -60); g.lineTo(34, -32); g.quadraticCurveTo(0, -38, -34, -32); g.fill(); } else if (hk === 1) { g.beginPath(); g.ellipse(0, -48, 8, 7, 0, 0, TAU); g.fill(); } else if (hk === 2) { g.fillRect(-14, -50, 28, 10); }
      g.strokeStyle = 'rgba(255,244,214,0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(0, -30, 15, PI * 1.05, PI * 1.6); g.stroke();
      g.restore();
    }
  }
  // 鞭：暗红皮鞭，先是甩出去的一道 S 弧，一拍一拍往回收，盘成几圈握在手里，只留一截垂着晃
  function whipS(g, hx, hy, t, coil) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    // 手里盘起的圈
    const nl = coil * 2.4;
    for (let k = 0; k < Math.ceil(nl); k++) {
      const f = clamp(nl - k), rx = 22 + 3 * k, ry = 30 + 4 * k;
      g.strokeStyle = k % 2 ? '#6e1a18' : '#5a1414'; g.lineWidth = 4.6;
      g.beginPath(); g.ellipse(hx + 4 + k * 2, hy + 22 + k * 3, rx, ry, 0.35, -PI / 2, -PI / 2 + TAU * f); g.stroke();
      g.strokeStyle = 'rgba(220,110,90,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(hx + 4 + k * 2, hy + 21 + k * 3, rx, ry, 0.35, -PI * 0.9, -PI * 0.9 + TAU * f * 0.5); g.stroke();
    }
    // 没收完的那一截：从手里甩出，越收越短、越垂
    const n = 20, Lf = lerp(340, 70, coil), P = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = lerp(-0.7, 1.35, coil) + Math.sin(u * lerp(3.2, 5, coil) - t * lerp(7, 4, coil)) * lerp(0.55, 0.25, coil) * u, L = Lf * u;
      P.push([hx + Math.cos(a) * L + 30 * u * (1 - coil), hy + Math.sin(a) * L]);
    }
    for (let i = 0; i < n; i++) { g.strokeStyle = i % 4 < 2 ? '#5a1414' : '#6e1a18'; g.lineWidth = lerp(5, 1.6, i / n); g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[i + 1][0], P[i + 1][1]); g.stroke(); }
    g.strokeStyle = 'rgba(220,110,90,0.5)'; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i <= n * 0.7; i++) (i ? g.lineTo(P[i][0], P[i][1] - 1.5) : g.moveTo(P[i][0], P[i][1] - 1.5)); g.stroke();
    const e = P[n]; g.fillStyle = '#d42a24'; g.beginPath(); g.ellipse(e[0], e[1], 7, 4, 0.6, 0, TAU); g.fill();
    g.strokeStyle = '#d42a24'; g.lineWidth = 1.2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(e[0] + 6 + k * 2, e[1] + 12 + Math.abs(k) * 2); g.stroke(); }
  }
  function memArena(g, c, age) {
    const t = c.t, dx = Math.round(lerp(-14, 0, easeOut(clamp(age / 1.4))));
    g.save(); g.translate(dx, 0);
    g.drawImage(arenaBg(), -40, -30, 1360, 780);
    g.drawImage(arenaStage(), -40, -30, 1360, 780);
    // 锣：每拍一亮
    const [gx, gy] = GONG, gb = beatE(c, 0.22);
    g.save(); g.translate(gx, gy); g.rotate(0.05 * Math.sin(t * 2.2) + 0.08 * gb);
    g.fillStyle = K.rad(g, -14, -14, 4, 52, [[0, '#fff1b0'], [0.5, '#e8b84c'], [1, '#9a6a1e']]); g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,80,20,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.stroke();
    g.restore();
    add(g, () => glow(g, gx, gy, 90, '#fff2c0', 0.25 * gb));
    // 柱上的红绸随风
    for (const [px, ph] of [[60, 0]]) { g.strokeStyle = '#d0302a'; g.lineCap = 'round'; for (let k = 0; k < 2; k++) { g.lineWidth = 7 - k * 2; g.beginPath(); g.moveTo(px, 120); for (let i = 1; i <= 10; i++) { const u = i / 10; g.lineTo(px + (px < 600 ? 1 : -1) * u * 120 + Math.sin(u * 5 - t * 5 + ph + k) * 14 * u, 120 + u * 120 + k * 10); } g.stroke(); } }
    // 月如：台上收鞭，仰头大笑，马尾甩起
    const fx = 470, fy = AF, s = 2.35, shk = Math.sin(t * 44) * 1.2;
    const fo = { pose: 'stand', facing: 1, head: -0.38, lean: -0.13, wind: 0.85, windDir: -1, prop: 'none', rim: '#fff2d0', light: [1100, 40], night: false };
    F.draw(g, 'yueru', fx, fy + shk, s, t, fo);
    const P = F.points('yueru', fx, fy + shk, s, t, fo);
    // 笑开的口：侧脸迎光的一线，到口处折进去
    const m = P.mouth, hd = P.head;
    g.fillStyle = '#1a0a0c'; g.beginPath(); g.moveTo(m[0] - 4, m[1] - 1); g.lineTo(m[0] + 11, m[1] - 8); g.lineTo(m[0] + 9, m[1] + 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,236,200,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hd[0] + 10, hd[1] - 22); g.quadraticCurveTo(hd[0] + 20, hd[1] - 10, m[0] + 8, m[1] - 6); g.moveTo(m[0] + 7, m[1] + 4); g.quadraticCurveTo(m[0] + 4, m[1] + 14, m[0] - 6, m[1] + 18); g.stroke();
    whipS(g, P.handN[0], P.handN[1], t, easeInOut(clamp(age / 0.95)));
    crowd(g, c, t);
    g.restore();
    V.petals(g, c, { kind: 'peach', n: 22, wind: 60, alpha: 0.85, seed: 14 });
    V.bokeh(g, c, { n: 5, colors: ['#fff2c8', '#ffd0b0'], alpha: 0.22, size: [30, 80] });
    memoryFrame(g, age, '#f6ecd8');
    flash(g, age, '#fff8e8', 0.75);
  }
  // =====================================================================
  // 第46句 c3_riverlanterns 湖灯送人：四盏河灯入水 → 灯光照鬓边白发 → 白灯停在石像脚下、红灯远去 → 回忆：晴湖边灵儿回眸
  // =====================================================================
  const LCOL = { white: '#fff3dc', red: '#ff7a3a', gourd: '#ffb24a', fly: '#ffd27a' };
  // 河灯：white 白莲灯（灵儿）、red 红纸灯（月如）、gourd 葫芦灯（酒剑仙）、fly 蝶纹灯（彩依与晋元）
  function riverLantern(g, x, y, s, kind, t, lit, seed) {
    const f = 0.85 + 0.15 * A.noise1(t * 6 + seed * 3, seed), L = lit * f, gc = LCOL[kind], gk = kind === 'white' ? 0.55 : 1, R0 = 70 * Math.min(s, 1.4);
    // 水面上的倒影光与光晕（近处的大灯光晕不再跟着放大，免得糊成一团白）
    add(g, () => {
      glow(g, x, y + 2 * s, R0, gc, 0.32 * L * gk);
      g.save(); g.translate(x, y + 16 * s); g.scale(0.35, 1.6); glow(g, 0, 0, 34 * s, gc, 0.42 * L); g.restore();
    });
    g.save(); g.translate(x, y); g.scale(s, s);
    g.rotate(0.06 * Math.sin(t * 1.4 + seed));
    // 底座：一片圆叶
    g.fillStyle = '#1e3430'; g.beginPath(); g.ellipse(0, 2, 22, 6, 0, 0, TAU); g.fill();
    if (kind === 'white') {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * PI, px = Math.cos(a) * 15, back = k % 2;
        g.fillStyle = back ? '#e8dfe6' : '#fffaf4';
        g.beginPath(); g.moveTo(px * 0.6, 0); g.quadraticCurveTo(px * 1.25, -10, px * 0.85, -20 - (back ? 2 : 0)); g.quadraticCurveTo(px * 0.4, -10, px * 0.25, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(240,150,170,0.6)'; g.beginPath(); g.arc(px * 0.85, -19, 1.6, 0, TAU); g.fill();
      }
      g.fillStyle = rgba('#fff0c8', 0.9 * L); g.beginPath(); g.ellipse(0, -8, 7, 6, 0, 0, TAU); g.fill();
    } else if (kind === 'red') {
      g.fillStyle = K.lin(g, -12, 0, 12, 0, [[0, '#8a1a14'], [0.5, mix('#d8342a', '#ffb070', 0.4 * L)], [1, '#7a1410']]);
      g.beginPath(); g.moveTo(-12, 0); g.lineTo(-10, -24); g.lineTo(10, -24); g.lineTo(12, 0); g.closePath(); g.fill();
      g.fillStyle = '#3a1410'; g.fillRect(-13, -26, 26, 3); g.fillRect(-13, -2, 26, 3);
      g.strokeStyle = 'rgba(60,10,8,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 0); g.stroke();
    } else if (kind === 'gourd') {
      g.fillStyle = K.rad(g, -2, -9, 1, 16, [[0, mix('#ffd890', '#ffffff', 0.4 * L)], [0.6, '#e8902e'], [1, '#9a4a14']]);
      g.beginPath(); g.ellipse(0, -9, 12, 10, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(0, -24, 7, 6.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#5a2a10'; g.fillRect(-1.5, -33, 3, 4);
      g.strokeStyle = '#c8302a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-6, -18); g.quadraticCurveTo(0, -15, 6, -18); g.stroke();
    } else {
      g.fillStyle = K.lin(g, -12, 0, 12, 0, [[0, '#c89a50'], [0.5, mix('#f6dca0', '#fffaf0', 0.5 * L)], [1, '#b8884a']]);
      g.beginPath(); g.moveTo(-11, 0); g.lineTo(-13, -12); g.lineTo(-9, -25); g.lineTo(9, -25); g.lineTo(13, -12); g.lineTo(11, 0); g.closePath(); g.fill();
      // 纸上画的两只蝶
      for (const [bx, by, sc] of [[-3, -14, 1], [5, -8, 0.7]]) {
        g.fillStyle = 'rgba(200,80,110,0.75)';
        g.beginPath(); g.ellipse(bx - 2.5 * sc, by - 1.5 * sc, 2.6 * sc, 2 * sc, -0.5, 0, TAU); g.ellipse(bx + 2.5 * sc, by - 1.5 * sc, 2.6 * sc, 2 * sc, 0.5, 0, TAU); g.fill();
      }
      g.fillStyle = '#4a3020'; g.fillRect(-10, -27, 20, 2.5);
    }
    g.restore();
  }
  // 巫后石像：双手合于胸前的女子像，风化的青灰石色，迎着河灯的一侧（左）一线暖光；肩头、台面薄雪（缓存）
  const statueTex = () => K.cache('g13-wuhou4', 300, 420, 1, (q) => {
    const fo = { pose: 'pray', facing: -1, wind: 0, tone: 'silhouette', ink: '#6a7488', alpha: 1, feibai: false };
    // 先画一层暖色，再把石色的像往右挪两像素压上去，左缘留下一线暖光
    // 轻纱的衣料画出来是半透明的，叠几遍让石像实心
    for (let k = 0; k < 5; k++) F.draw(q, 'linger', 147, 352, 1.65, 0, Object.assign({}, fo, { ink: '#e8a070' }));
    q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(240,170,110,0.9)'; q.fillRect(0, 0, 300, 420); q.globalCompositeOperation = 'source-over';
    const st = K.cache('g13-wuhouStone3', 300, 420, 1, (p) => {
      for (let k = 0; k < 5; k++) F.draw(p, 'linger', 150, 352, 1.65, 0, fo);
      p.globalCompositeOperation = 'source-atop';
      p.fillStyle = K.lin(p, 70, 0, 230, 0, [[0, '#76808f'], [0.5, '#5e6878'], [1, '#454d5e']]); p.fillRect(0, 0, 300, 420);
      const r = A.rng(55);
      for (let i = 0; i < 80; i++) { p.fillStyle = rgba(r() < 0.6 ? '#20263a' : '#9aa4b8', 0.08 + r() * 0.14); p.beginPath(); p.ellipse(r() * 300, r() * 360, 3 + r() * 14, 2 + r() * 8, r() * 3, 0, TAU); p.fill(); }
      p.strokeStyle = 'rgba(24,28,40,0.4)'; p.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const x = 100 + r() * 100, y = 80 + r() * 260; p.beginPath(); p.moveTo(x, y); p.lineTo(x + (r() - 0.5) * 14, y + 10 + r() * 26); p.stroke(); }
      p.fillStyle = K.lin(p, 0, 0, 0, 360, [[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(20,24,36,0)'], [1, 'rgba(20,24,36,0.4)']]); p.fillRect(0, 0, 300, 420);
      p.globalCompositeOperation = 'source-over';
    });
    q.drawImage(st, 0, 0, 300, 420);
    // 石台与薄雪
    q.fillStyle = K.lin(q, 0, 350, 0, 420, [[0, '#4a5264'], [1, '#22283a']]);
    q.beginPath(); q.moveTo(96, 350); q.lineTo(204, 350); q.lineTo(218, 384); q.lineTo(82, 384); q.closePath(); q.fill();
    q.fillStyle = 'rgba(230,236,248,0.9)';
    q.beginPath(); q.ellipse(150, 351, 56, 3, 0, PI, TAU); q.fill();
    q.beginPath(); q.ellipse(132, 140, 18, 4, -0.2, PI, TAU); q.fill(); q.beginPath(); q.ellipse(168, 142, 14, 3, 0.2, PI, TAU); q.fill();
  });
  // 湖中一块湿黑的礁石，石像立在上面；画石像、礁石，也画它们在水里的倒影（以礁石的水线为轴，几条错开的水纹）
  const isletTex = () => K.cache('g13-islet2', 420, 120, 1, (q) => {
    const r = A.rng(71), top = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24, x = 20 + u * 380, env = Math.pow(Math.sin(PI * u), 0.7); top.push([x, 104 - env * (50 + 26 * A.noise1(u * 6, 3)) - (r() - 0.5) * 8]); }
    q.fillStyle = '#121826'; q.beginPath(); q.moveTo(10, 106); top.forEach((p) => q.lineTo(p[0], p[1])); q.lineTo(410, 106); q.closePath(); q.fill();
    // 湿石的冷光、迎灯一侧的暖光、几块残雪
    q.strokeStyle = 'rgba(150,180,230,0.5)'; q.lineWidth = 1.6; q.beginPath(); top.slice(6, 14).forEach((p, i) => (i ? q.lineTo(p[0], p[1] + 1) : q.moveTo(p[0], p[1] + 1))); q.stroke();
    q.strokeStyle = 'rgba(255,170,110,0.5)'; q.lineWidth = 2; q.beginPath(); top.slice(0, 7).forEach((p, i) => (i ? q.lineTo(p[0], p[1] + 1) : q.moveTo(p[0], p[1] + 1))); q.stroke();
    for (const k of [5, 9, 13, 17]) { const p = top[k]; q.fillStyle = 'rgba(226,234,248,0.85)'; q.beginPath(); q.ellipse(p[0], p[1] + 2, 16 + r() * 14, 3.5, (r() - 0.5) * 0.4, PI, TAU); q.fill(); }
    for (let i = 0; i < 6; i++) { q.strokeStyle = 'rgba(0,0,0,0.5)'; q.lineWidth = 1.2; const x = 60 + r() * 300; q.beginPath(); q.moveTo(x, 104); q.lineTo(x + (r() - 0.5) * 20, 70 + r() * 20); q.stroke(); }
    q.fillStyle = 'rgba(140,170,220,0.3)'; q.fillRect(10, 102, 400, 3);
  });
  function wuhou(g, t, x, y, s, refl) {
    const st = statueTex(), il = isletTex(), sw = 300 * s, sh = 420 * s, iw = 420 * s * 0.62, ih = 120 * s * 0.62;
    const draw = (q) => { q.drawImage(st, x - sw / 2, y - 30 * s * 0.62 - 384 * s, sw, sh); q.drawImage(il, x - iw / 2, y - 104 * s * 0.62, iw, ih); };
    if (refl) {
      // 倒影：翻过来、压暗、按条错开
      g.save(); g.globalAlpha = 0.42;
      const top = y + 2, H2 = 420 * s * 0.9, rows = 7;
      for (let i = 0; i < rows; i++) {
        const v0 = i / rows, v1 = (i + 1) / rows, dx = Math.sin(i * 1.7 - t * 1.8) * (1 + 4 * v0);
        g.save(); g.beginPath(); g.rect(x - iw, top + v0 * H2, iw * 2, (v1 - v0) * H2 + 1); g.clip();
        g.translate(dx, 2 * y + 4); g.scale(1, -1); draw(g); g.restore();
      }
      g.restore();
    }
    draw(g);
    // 一层薄雾横过膝下
    g.save(); g.translate(x, y - 130 * s); g.scale(2.4, 0.3); glow(g, 0, 0, 110 * s, '#9cb0d8', 0.22); g.restore();
  }
  // 苍山：远山覆雪的一层（缓存）
  const lakeBg = () => K.cache('g13-lakeBg', 1360, 520, 0.75, (q) => {
    q.translate(40, 30);
    E.sky(q, { top: '#0f1a36', mid: '#2e4e7e', bottom: '#6e86b0', y0: -30, y1: 460, midAt: 0.6, haze: '#a8b8d8', hazeY: 440, hazeH: 120, hazeA: 0.45 });
    E.stars(q, { t: 0, n: 70, seed: 6, maxY: 260, alpha: 0.7, twinkle: 0 });
    E.mountains(q, { t: 0, lightDir: -1, layers: [
      { kind: 'far', color: '#5a6e98', light: '#dfe8f6', litA: 0.65, y: 420, scaleY: 0.62, speed: 0, seed: 21, fog: '#6c82aa', fogA: 0.45, rim: '#eef4ff', rimA: 0.5 },
      { kind: 'mid', color: '#3a4c70', light: '#b8c8e4', litA: 0.45, y: 446, scaleY: 0.36, speed: 0, seed: 8, fog: '#5a6c92', fogA: 0.4 },
    ] });
  });
  // 水平视角的湖：天低、山矮、水面占了大半（第三段），左边压暗给歌词
  const lakeLow = () => K.cache('g13-lakeLow', 1360, 420, 1, (q) => {
    q.translate(40, 30);
    E.sky(q, { top: '#0c1630', mid: '#26446e', bottom: '#5e78a4', y0: -30, y1: 340, midAt: 0.6, haze: '#9aaed4', hazeY: 320, hazeH: 90, hazeA: 0.45 });
    E.stars(q, { t: 0, n: 60, seed: 9, maxY: 240, alpha: 0.65, twinkle: 0 });
    E.mountains(q, { t: 0, lightDir: -1, layers: [
      { kind: 'far', color: '#4e6290', light: '#d8e4f4', litA: 0.6, y: 316, scaleY: 0.42, speed: 0, seed: 33, fog: '#64789e', fogA: 0.45, rim: '#eef4ff', rimA: 0.45 },
      { kind: 'mid', color: '#33456a', light: '#a8bcdc', litA: 0.4, y: 332, scaleY: 0.22, speed: 0, seed: 12, fog: '#52648a', fogA: 0.4 },
    ] });
    q.fillStyle = K.lin(q, 0, 0, 320, 0, [[0, 'rgba(10,16,34,0.42)'], [1, 'rgba(10,16,34,0)']]); q.fillRect(-40, -30, 360, 400);
  });
  // 近岸：覆雪的黑石滩（缓存）
  const shoreA = () => K.cache('g13-shoreA', 760, 260, 1, (q) => {
    q.fillStyle = K.lin(q, 0, 40, 0, 260, [[0, '#1e2638'], [1, '#0a0e18']]);
    q.beginPath(); q.moveTo(0, 260); q.lineTo(0, 50); q.quadraticCurveTo(180, 30, 330, 70); q.quadraticCurveTo(470, 100, 560, 150); q.quadraticCurveTo(640, 196, 700, 260); q.closePath(); q.fill();
    const r = A.rng(12);
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 70 + r() * 30, y = 70 + i * 16 + r() * 30, R = 26 + r() * 30;
      q.fillStyle = '#121828'; A.inkBlob(q, x, y + R * 0.4, R, i + 3, 0.3); q.fill();
      q.fillStyle = 'rgba(226,234,248,0.9)'; q.beginPath(); q.ellipse(x - 2, y + R * 0.05, R * 0.95, R * 0.32, -0.05, PI, TAU); q.fill();
      q.fillStyle = 'rgba(160,180,220,0.35)'; q.beginPath(); q.ellipse(x - 2, y + R * 0.08, R * 0.9, R * 0.12, 0, 0, PI); q.fill();
    }
    q.fillStyle = 'rgba(226,234,248,0.85)';
    q.beginPath(); q.moveTo(0, 52); q.quadraticCurveTo(180, 32, 330, 72); q.quadraticCurveTo(200, 60, 0, 70); q.closePath(); q.fill();
    q.strokeStyle = 'rgba(255,180,120,0.35)'; q.lineWidth = 2;
    q.beginPath(); q.moveTo(330, 72); q.quadraticCurveTo(470, 102, 560, 152); q.quadraticCurveTo(640, 198, 700, 260); q.stroke();
  });
  // 河灯行程：u 0..1 离岸后越漂越顺（先慢后快），白灯在“殁”字漂到石像脚下；bob 随水上下起伏
  function lanternPlan(c) {
    const e = [rel(c, 0, 0.2), rel(c, 1, 0.58), rel(c, 2, 0.96), rel(c, 3, 1.46)], tEnd = rel(c, 10, 4.74);
    const dr = (lt, a, b) => Math.pow(ramp(lt, a, b), 1.3);
    return [
      { kind: 'white', e: e[0], u: (lt) => dr(lt, e[0], tEnd) },
      { kind: 'red', e: e[1], u: (lt) => dr(lt, e[1], e[1] + 6.2) },
      { kind: 'gourd', e: e[2], u: (lt) => dr(lt, e[2], e[2] + 7) },
      { kind: 'fly', e: e[3], u: (lt) => dr(lt, e[3], e[3] + 6.5) },
    ];
  }
  const bobY = (t, i) => 2 * Math.sin(t * TAU * 0.8 + i * 1.7);
  // 雪：蓝调里细细的，湖上的风往岸上吹（往左）
  function lakeSnow(g, c, n, seed, layer) { V.snow(g, c, { n, size: [1.2, 9], fall: 28, wind: -16, alpha: 0.75, seed, layer, color: '#eef4ff' }); }
  // 放灯的那只手：每个字前从胸前探到水面，停一停，字头上松手；几盏连着放时手只抬起一半
  function handPlan(LP, lt) {
    let k = 0, hold = -1, ha = 0;
    LP.forEach((L, i) => {
      const e = L.e, b = lt < e ? easeInOut(ramp(lt, e - 0.3, e - 0.08)) : 1 - easeInOut(ramp(lt, e, e + 0.26));
      if (b > k) k = b;
      if (lt >= e - 0.36 && lt < e) { hold = i; ha = smooth(ramp(lt, e - 0.36, e - 0.2)); }
    });
    return { k, hold, ha };
  }
  function kneelArm(g, P, s, tx, ty, t) {
    const sh = [P.shoulderN[0] + 2 * s, P.shoulderN[1] + 6 * s], L1 = Math.hypot(P.elbowN[0] - P.shoulderN[0], P.elbowN[1] - P.shoulderN[1]) * 1.05, L2 = Math.hypot(P.handN[0] - P.elbowN[0], P.handN[1] - P.elbowN[1]) * 1.15;
    let dx = tx - sh[0], dy = ty - sh[1]; const d = Math.min(L1 + L2 - 1, Math.hypot(dx, dy)) || 1, a0 = Math.atan2(dy, dx);
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), a1 = a0 - Math.acos(cosA);
    const el = [sh[0] + Math.cos(a1) * L1, sh[1] + Math.sin(a1) * L1], hd = [sh[0] + Math.cos(a0) * d, sh[1] + Math.sin(a0) * d];
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#22262e'; g.lineWidth = 11 * s; g.beginPath(); g.moveTo(sh[0], sh[1]); g.lineTo(el[0], el[1]); g.stroke();
    // 小臂：宽袖往下垂，袖口一圈浅色里衣
    const fx = hd[0] - el[0], fy = hd[1] - el[1], fl = Math.hypot(fx, fy) || 1, nx = -fy / fl, ny = fx / fl, dn = ny > 0 ? 1 : -1;
    g.fillStyle = '#2a2f38';
    g.beginPath(); g.moveTo(el[0] - nx * 5 * s, el[1] - ny * 5 * s); g.lineTo(el[0] + nx * 5 * s, el[1] + ny * 5 * s);
    g.quadraticCurveTo(hd[0] + nx * dn * 14 * s + Math.sin(t * 2.4) * 2, hd[1] + ny * dn * 14 * s + 10 * s, hd[0] + nx * 8 * s - fx / fl * 6 * s, hd[1] + ny * 8 * s + 12 * s);
    g.lineTo(hd[0] - nx * 6 * s - fx / fl * 6 * s, hd[1] - ny * 6 * s); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,170,110,0.55)'; g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(el[0] + nx * 5 * s, el[1] + ny * 5 * s); g.quadraticCurveTo(hd[0] + nx * dn * 14 * s, hd[1] + ny * dn * 14 * s + 10 * s, hd[0] + nx * 8 * s, hd[1] + ny * 8 * s + 12 * s); g.stroke();
    g.strokeStyle = '#cfd4dc'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(hd[0] - nx * 6 * s - fx / fl * 5 * s, hd[1] - ny * 6 * s); g.lineTo(hd[0] + nx * 7 * s - fx / fl * 5 * s, hd[1] + ny * 7 * s + 2 * s); g.stroke();
    g.fillStyle = '#c8aa92'; g.beginPath(); g.ellipse(hd[0] + fx / fl * 3 * s, hd[1] + fy / fl * 3 * s, 4.6 * s, 3.6 * s, Math.atan2(fy, fx), 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,190,130,0.7)'; g.lineWidth = 1 * s; g.beginPath(); g.ellipse(hd[0] + fx / fl * 3 * s, hd[1] + fy / fl * 3 * s, 4.6 * s, 3.6 * s, Math.atan2(fy, fx), -1.2, 0.8); g.stroke();
    return hd;
  }

  XYT.registerShot('c3_riverlanterns', {
    name: '湖灯送人', zone: 'left', night: true, text: '#e9f1f6', shadow: 'rgba(10,16,34,0.92)', accent: '#ff8936', bloom: 0.5,
    draw(g, c) {
      const lt = c.lt, t = c.t;
      const kB = rel(c, 4, 2.22), kC = rel(c, 8, 3.9), kM = 5.2, tEnd = rel(c, 10, 4.74);
      const LP = lanternPlan(c);
      if (lt < kB) {
        // ① 中景：他跪在岸边，伸手把一盏盏灯放进水里；湖中近处一块礁石上立着巫后石像
        const hz = 452, pan = Math.round(6 * smooth(lt / 2.2));
        g.save(); g.translate(-pan, 0);
        g.drawImage(lakeBg(), -40, -30, 1360, 520);
        E.water(g, { y: hz, t, top: '#34497a', bottom: '#0a1224', reflectFn: (q) => q.drawImage(lakeBg(), -40, -30, 1360, 520), reflect: 0.5, wobble: 2.2, lines: 26, lineColor: '#c8d8f8', mist: '#8a9cc4' });
        E.mist(g, { t, y: hz + 6, h: 56, color: '#8a9ec8', alpha: 0.32, speed: -5 });
        wuhou(g, t, 960, 522, 0.6, true);
        lakeSnow(g, c, 60, 31, 'back');
        // 河灯：从他手里入水，往右、往石像那边漂
        const ends = { white: [916, 526], red: [1190, 468], gourd: [780, 488], fly: [660, 474] };
        const prjA = (L, u, i) => { const end = ends[L.kind], x = lerp(512 + 6 * i, end[0], Math.pow(u, 0.85)), y = lerp(624, end[1], Math.pow(u, 0.6)); return [x, y + bobY(t, i) * (1 - u * 0.6), lerp(1.5, L.kind === 'white' ? 0.55 : 0.42, Math.pow(u, 0.5))]; };
        // 他：跪着，近手另画（伸手放灯）
        const kneelX = 360, kneelY = 652, fs = 1.55;
        const hp = handPlan(LP, lt), fo = { pose: 'kneel', facing: 1, wind: 0.4, windDir: -1, rim: '#ffb070', light: [520, 600], cloakRim: '#ffc890', seed: 2, hairLoose: true, head: 0.22, rimWidth: 1, part: 'back', cloakWind: 0.3, cloakLen: 0.8 };
        const P = F.points('xiaoyao', kneelX, kneelY, fs, t, Object.assign({ stage: 'old' }, fo));
        const items = [];
        LP.forEach((L, i) => { if (lt >= L.e) { const [x, y, s] = prjA(L, L.u(lt), i); items.push({ L, x, y, s, i, lit: 1 }); } });
        items.sort((a, b) => a.y - b.y);
        for (const it of items) {
          E.ripples(g, { x: it.x, y: it.y + 3 * it.s, t, t0: c.t - lt + it.L.e, life: 2.2, scale: 1.1 * it.s, color: LCOL[it.L.kind], alpha: 0.5 });
          riverLantern(g, it.x, it.y, it.s, it.L.kind, t, it.lit, it.i);
        }
        g.drawImage(shoreA(), -60, 520, 760, 260);
        elder(g, kneelX, kneelY, fs, t, fo);
        const nxt = hp.hold >= 0 ? hp.hold : LP.findIndex((L) => lt < L.e), wi = nxt < 0 ? 3 : nxt;
        const chest = [P.chest[0] + 24, P.chest[1] + 18], wt = [512 + 6 * wi, 618];
        const hx = lerp(chest[0], wt[0], hp.k), hy = lerp(chest[1], wt[1], hp.k) - Math.sin(PI * hp.k) * 18;
        // 手里那盏灯（还没放下的）：拿到手里时才点亮
        if (hp.hold >= 0) { g.globalAlpha = hp.ha; riverLantern(g, hx + 2, hy + 4, 1.5, LP[hp.hold].kind, t, hp.ha, hp.hold); g.globalAlpha = 1; }
        kneelArm(g, P, fs, hx, hy, t);
        add(g, () => glow(g, 500, 610, 170, '#ff9a4a', 0.2 + 0.08 * beatE(c, 0.3)));
        E.reeds(g, { t, x0: -40, x1: 200, y: 740, h: 260, n: 14, color: '#0c1220', plume: '#c8d2ea', wind: -0.35, seed: 12 });
        lakeSnow(g, c, 50, 33, 'front');
        g.restore();
      } else if (lt < kC) {
        // ② 近景：灯光照上他的侧脸，鬓边白发一缕缕被湖风掀起
        closeProfile(g, c, lt, kB);
      } else if (lt < kM) {
        // ③ 贴着水面的机位：石像居中高耸，白灯从近处漂进她的倒影，“殁”字停在她脚下；红灯独自往右漂远、灯火渐熄
        const hz = 330, la = lt - kC;
        g.drawImage(lakeLow(), -40, -30, 1360, 420);
        E.water(g, { y: hz, t, top: '#2c4270', bottom: '#060c1c', reflectFn: (q) => q.drawImage(lakeLow(), -40, -30, 1360, 420), reflect: 0.55, wobble: 2.4, lines: 34, lineColor: '#c8d8f8', mist: '#7a8cb8', reflectScale: 0.6 });
        E.mist(g, { t, y: hz + 4, h: 40, color: '#8a9ec8', alpha: 0.3, speed: -4 });
        wuhou(g, t, 640, 372, 0.84, true);
        lakeSnow(g, c, 60, 41, 'back');
        // 远处两盏：葫芦灯在左、蝶纹灯在左前，蝶纹灯里飞出几只光蝶
        const gq = Math.pow(ramp(lt, kC, kC + 3), 0.9), fq = Math.pow(ramp(lt, kC, kC + 3), 0.9);
        const gourd = [lerp(360, 300, gq), 392 + bobY(t, 2)], fly = [lerp(470, 430, fq), 436 + bobY(t, 3)];
        riverLantern(g, gourd[0], gourd[1], 0.7, 'gourd', t, 1, 2);
        riverLantern(g, fly[0], fly[1], 0.95, 'fly', t, 1, 3);
        V.butterflies(g, c, { n: 5, from: { x: fly[0], y: fly[1] - 14, at: rel(c, 9, 4.32) - 0.1, dur: 1.4, stagger: 0.4, w: 20, h: 16 }, area: [fly[0] - 200, 120, fly[0] + 180, fly[1] - 60], size: [14, 22], glow: 0.35, trail: 0.4, colors: [['#fff2c0', '#f2a6bc'], ['#f8e0a0', '#e88aa8']], seed: 23 });
        // 红灯：独自穿过右半边空着的水面，“殁”字灯火一暗
        const rq = ramp(lt, kC - 0.2, kM), rx = lerp(900, 1150, rq), ry = lerp(404, 372, rq) + bobY(t, 1), rLit = 1 - 0.9 * smooth(ramp(lt, tEnd - 0.08, tEnd + 0.45));
        riverLantern(g, rx, ry, lerp(1.0, 0.75, rq), 'red', t, rLit, 1);
        if (rLit < 0.95) add(g, () => glow(g, rx, ry - 8, 30, '#ffb080', 0.4 * (1 - rLit) * clamp(1 - (lt - tEnd) / 0.6)));
        // 白灯：近处大，漂向她的倒影，停在礁石脚下
        const wq = Math.pow(ramp(lt, kC - 0.1, tEnd), 0.85), wx = lerp(470, 628, wq), wy = lerp(650, 384, Math.pow(wq, 0.8)) + bobY(t, 0) * (1 - wq), ws = lerp(2.4, 0.62, Math.pow(wq, 0.7));
        riverLantern(g, wx, wy, ws, 'white', t, 1, 0);
        E.ripples(g, { x: 628, y: 388, t, t0: c.t - lt + tEnd, life: 2.4, scale: 1.1, color: '#fff3dc', alpha: 0.6 });
        add(g, () => glow(g, 628, 372, 150, '#fff0d0', 0.22 * smooth(ramp(lt, tEnd - 0.2, tEnd + 0.4))));
        // 他在左下角，只露出跪着的肩背与白发，望着灯漂远
        g.fillStyle = K.lin(g, 0, 640, 0, 720, [[0, '#121826'], [1, '#05070e']]);
        g.beginPath(); g.moveTo(-60, 760); g.lineTo(-60, 660); g.quadraticCurveTo(140, 640, 300, 680); g.quadraticCurveTo(360, 700, 380, 760); g.closePath(); g.fill();
        g.fillStyle = 'rgba(214,224,240,0.6)'; g.beginPath(); g.moveTo(-60, 662); g.quadraticCurveTo(140, 642, 300, 682); g.quadraticCurveTo(140, 656, -60, 674); g.closePath(); g.fill();
        elder(g, 96, 836, 2.3, t, { pose: 'kneel', facing: 1, wind: 0.4, windDir: -1, tone: 'silhouette', ink: '#0a0c12', rim: '#ffb878', light: [628, 380], head: 0.18, seed: 2, cloakRim: '#ffc890', cloakWind: 0.3, cloakLen: 0.8 });
        E.reeds(g, { t, x0: 200, x1: 340, y: 740, h: 200, n: 8, color: '#0a0e18', plume: '#aab4d0', wind: -0.3, seed: 19 });
        lakeSnow(g, c, 50, 43, 'front');
      } else {
        // ④ 回忆：晴天湖边，灵儿回眸，淡紫发带扬起（工笔重彩）
        memLake(g, c, lt - kM);
      }
      if (lt >= kB && lt < kB + 0.3) flash(g, lt - kB, '#ffd8a8', 0.22);
      if (lt >= kC && lt < kC + 0.3) flash(g, lt - kC, '#d8e4ff', 0.2);
      if (lt > 0.6) lakeLow(); if (lt > 1.2) lakeDay();
    },
  });

  // 侧脸近景：面朝右，暖光从右下的河灯打上来
  function closeProfile(g, c, lt, k0) {
    const t = c.t, la = lt - k0;
    const z = 1 + 0.035 * smooth(la / 1.7);
    // 背景：失焦的湖面与灯影
    g.fillStyle = K.lin(g, 0, 0, 0, H, [[0, '#0e1830'], [0.55, '#22365e'], [1, '#0a1020']]); g.fillRect(-60, -60, W + 120, H + 120);
    add(g, () => {
      const bk = [[900, 520, 120, '#ff9a4a', 0.35], [1080, 470, 70, '#fff0d0', 0.3], [1180, 560, 90, '#ffb24a', 0.28], [760, 600, 60, '#ff7a3a', 0.25], [980, 420, 40, '#ffd27a', 0.22]];
      for (const [x, y, r, col, a] of bk) { glow(g, x + Math.sin(t * 0.4 + x) * 8, y, r, col, a); glow(g, x, y, r * 0.35, '#ffffff', a * 0.5); }
      glow(g, 300, 470, 300, '#4a6aa8', 0.25);
    });
    V.bokeh(g, c, { n: 12, colors: ['#ffb070', '#fff0d0', '#9fb8e8'], alpha: 0.28, size: [30, 110], area: [500, 250, 1280, 720], seed: 4 });
    g.save(); g.translate(720, 420); g.scale(z, z); g.translate(-720, -420);
    profileHead(g, t, lt, c);
    g.restore();
    V.snow(g, c, { n: 70, size: [2, 16], fall: 30, wind: 20, alpha: 0.8, seed: 51, color: '#f2f6ff' });
  }
  // 一缕发丝：从 (x0,y0) 出发，方向由 (dx,dy) 给出，波浪随 t 走
  function strand(g, x0, y0, dx, dy, len, amp, ph, t, n) {
    const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    g.beginPath(); g.moveTo(x0, y0);
    for (let i = 1; i <= (n || 10); i++) {
      const q = i / (n || 10), w = Math.sin(q * 5 + ph - t * 3.2) * amp * q;
      g.lineTo(x0 + ux * len * q - uy * w, y0 + uy * len * q + ux * w + q * q * len * 0.12);
    }
    g.stroke();
  }
  // 老人侧脸（逆光近景）：脸近乎剪影，河灯的暖光勾出额、鼻、唇、颔一线；白发挽髻，鬓边几缕在第 k 个字头被风吹起
  function profileHead(g, t, lt, c) {
    const ox = 700, oy = 330, S = 1.22;
    g.save(); g.translate(ox, oy); g.rotate(0.06); g.scale(S, S);
    const prof = (q) => {
      q.moveTo(66, -124);
      q.quadraticCurveTo(84, -92, 85, -64); q.quadraticCurveTo(92, -56, 90, -48); q.quadraticCurveTo(87, -40, 92, -30);
      q.quadraticCurveTo(105, -6, 107, 5); q.quadraticCurveTo(103, 12, 93, 13); q.quadraticCurveTo(96, 20, 95, 26); q.quadraticCurveTo(90, 30, 93, 34);
      q.quadraticCurveTo(94, 42, 88, 46); q.quadraticCurveTo(90, 60, 84, 72); q.quadraticCurveTo(70, 86, 48, 88);
    };
    // 头顶压低、脖子收短（领子立到下颌）
    const face = () => {
      g.beginPath(); g.moveTo(-44, -132); g.bezierCurveTo(4, -152, 54, -142, 66, -124);
      prof(g); g.quadraticCurveTo(30, 98, 30, 120); g.lineTo(-26, 120); g.bezierCurveTo(-34, 60, -82, -30, -44, -132); g.closePath();
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    // 脑后垂下的长发：被湖上来的风吹向后（左）
    for (let k = 0; k < 18; k++) {
      const x0 = -52 + k * 1.2, y0 = -120 + k * 7, ph = h2(k, 4) * 6;
      g.strokeStyle = rgba(k % 3 ? '#9aa2b2' : '#d8dce4', 0.35 + 0.35 * h2(k, 5)); g.lineWidth = 1.6 + 2.2 * h2(k, 6);
      strand(g, x0, y0, -0.8 - 0.3 * h2(k, 9), 0.75, 160 + 80 * h2(k, 7), 8 + 10 * h2(k, 8), ph, t * 0.6, 14);
    }
    // 肩与大氅：领子立到下颌，领缘迎光一线暖
    g.fillStyle = '#0d1016';
    g.beginPath(); g.moveTo(-280, 340); g.quadraticCurveTo(-250, 196, -150, 146); g.quadraticCurveTo(-96, 116, -56, 100); g.quadraticCurveTo(10, 86, 70, 98); g.quadraticCurveTo(108, 150, 124, 220); g.quadraticCurveTo(134, 290, 150, 340); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(70,80,100,0.5)'; g.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[-120, 170, -170, 340], [-40, 130, -60, 340], [40, 140, 50, 340]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 12, (y0 + y1) / 2, x1, y1); g.stroke(); }
    g.fillStyle = '#1e222c'; g.beginPath(); g.moveTo(-58, 102); g.quadraticCurveTo(6, 82, 70, 96); g.quadraticCurveTo(76, 114, 64, 124); g.quadraticCurveTo(4, 106, -54, 124); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,176,110,0.65)'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(70, 98); g.quadraticCurveTo(108, 150, 124, 220); g.quadraticCurveTo(134, 290, 150, 340); g.stroke();
    g.strokeStyle = 'rgba(255,200,150,0.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-50, 102); g.quadraticCurveTo(8, 84, 70, 96); g.stroke();
    // 脸：几乎是剪影，只在迎光一侧透出一点暖
    g.fillStyle = K.lin(g, -60, 0, 108, 30, [[0, '#0e121c'], [0.62, '#1c1c26'], [0.88, '#4a3430'], [1, '#8a5a42']]);
    face(); g.fill();
    g.save(); face(); g.clip();
    add(g, () => { glow(g, 160, 60, 140, '#ff8a40', 0.42 + 0.12 * beatE(c, 0.3)); glow(g, 108, 0, 40, '#ffc890', 0.3); });
    g.fillStyle = '#20181c'; g.beginPath(); g.ellipse(-6, -22, 12, 21, 0.15, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,160,110,0.45)'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(-6, -22, 12, 21, 0.15, -1.3, 1.2); g.stroke();
    g.strokeStyle = 'rgba(8,6,8,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(66, -40); g.quadraticCurveTo(75, -35, 84, -38); g.stroke();
    g.strokeStyle = 'rgba(255,170,120,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(68, -34); g.quadraticCurveTo(75, -31, 82, -33); g.stroke();
    g.strokeStyle = 'rgba(255,170,120,0.18)';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(62, -40 + k * 4); g.lineTo(52, -44 + k * 6); g.stroke(); }
    g.beginPath(); g.moveTo(86, 14); g.quadraticCurveTo(77, 30, 80, 48); g.stroke();
    add(g, () => glow(g, 81, -36, 5, '#ffe2b8', 0.6 + 0.3 * Math.sin(t * 2.6)));
    g.strokeStyle = 'rgba(232,226,220,0.5)'; g.lineWidth = 0.9;
    for (let k = 0; k < 22; k++) { const u = k / 21, x = lerp(92, 44, u), y = lerp(24, 86, Math.pow(u, 0.8)) + (k % 2) * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2 - 4 * h2(k, 9), y + 6 + 8 * h2(k, 10)); g.stroke(); }
    g.restore();
    // 白眉
    g.strokeStyle = 'rgba(244,236,228,0.92)'; g.lineWidth = 1.2;
    for (let k = 0; k < 10; k++) { g.beginPath(); g.moveTo(58 + k * 3, -50 + Math.abs(k - 4) * 0.4); g.quadraticCurveTo(66 + k * 3, -57, 75 + k * 3.4, -52 + (k > 6 ? 4 : 0)); g.stroke(); }
    // 轮廓光
    g.strokeStyle = 'rgba(255,200,146,0.95)'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(66, -124); prof(g); g.stroke();
    add(g, () => { g.strokeStyle = 'rgba(255,150,80,0.35)'; g.lineWidth = 7; g.beginPath(); g.moveTo(66, -124); prof(g); g.stroke(); });
    // 头发：暗底上一根根白发梳向脑后的小髻，发丝之间透出暗底（不是一片白）
    const hair = () => {
      g.beginPath(); g.moveTo(66, -126); g.bezierCurveTo(52, -150, 2, -158, -44, -136); g.bezierCurveTo(-80, -112, -82, -56, -62, 10);
      g.quadraticCurveTo(-38, -8, -22, -40); g.quadraticCurveTo(-6, -78, 22, -98); g.quadraticCurveTo(46, -110, 66, -126); g.closePath();
    };
    g.fillStyle = K.lin(g, -70, -150, 60, -60, [[0, '#30343e'], [0.6, '#4a4e5a'], [1, '#6a5a52']]);
    hair(); g.fill();
    g.save(); hair(); g.clip();
    for (let k = 0; k < 64; k++) {
      const u = k / 63, v = h2(k, 21);
      const hx = lerp(70, -64, Math.pow(u, 0.85)) + (v - 0.5) * 8, hy = lerp(-128, 6, Math.pow(u, 1.1)) + (h2(k, 24) - 0.5) * 10;
      g.strokeStyle = rgba(v < 0.4 ? '#eef0f4' : v < 0.8 ? '#a8aebc' : '#ffd8b4', 0.25 + 0.4 * h2(k, 22)); g.lineWidth = 0.6 + 0.9 * h2(k, 23);
      g.beginPath(); g.moveTo(hx, hy); g.bezierCurveTo(hx - 12, hy - 20 - 14 * (1 - u), -6 - 22 * u, -146 + 30 * u, -24 + 6 * v, -150 + 5 * v); g.stroke();
    }
    g.restore();
    // 小发髻与蓝发带
    g.fillStyle = K.lin(g, -40, -166, 0, -138, [[0, '#7a808c'], [1, '#e4e6ea']]);
    g.beginPath(); g.ellipse(-24, -150, 17, 11, -0.35, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(250,246,240,0.6)'; g.lineWidth = 0.9;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(-24, -150, 15 - k * 3.5, 9 - k * 2, -0.35, 0.2 + k * 0.2, 2.9); g.stroke(); }
    g.save(); g.translate(-18, -138); g.rotate(-0.35); g.fillStyle = '#3e5a7a'; g.fillRect(-12, -2.5, 24, 5); g.restore();
    g.strokeStyle = '#3e5a7a'; g.lineWidth = 2.6;
    strand(g, -30, -136, -1, 0.3, 120, 10, 1, t * 1.2, 10);
    g.lineWidth = 2; strand(g, -26, -134, -1, 0.55, 96, 8, 2.4, t * 1.2, 10);
    // 鬓边白发：四缕，各在一个字头被湖风掀起，往上、往后飘（与脑后的发、发带同向）
    const ks = [rel(c, 4, 2.22), rel(c, 5, 2.68), rel(c, 6, 3.09), rel(c, 7, 3.5)];
    for (let k = 0; k < 4; k++) {
      const up = easeOut(ramp(lt, ks[k] - 0.05, ks[k] + 0.6));
      for (let j = 0; j < 6; j++) {
        const id = k * 6 + j, x0 = 30 + k * 8 + j * 1.4, y0 = -104 + k * 10 + j * 2.2;
        const dx = lerp(0.12, -1, up), dy = lerp(1, -0.6 - 0.25 * h2(id, 6), up);
        g.strokeStyle = rgba(up > 0.3 && j % 2 ? '#ffd6ae' : '#f2ece6', 0.5 + 0.4 * h2(id, 7)); g.lineWidth = 0.8 + 0.8 * h2(id, 8);
        strand(g, x0, y0, dx, dy, (70 + 70 * h2(id, 5)) * lerp(0.8, 1.25, up), lerp(3, 12, up), h2(id, 3) * 6, t * (0.8 + 0.4 * h2(id, 2)), 14);
      }
    }
    g.restore();
  }

  // 回忆：晴天湖边的灵儿
  const lakeDay = () => K.cache('g13-lakeDay2', 1360, 780, 1, (q) => {
    q.translate(40, 30);
    E.sky(q, { top: '#2c7cc4', mid: '#8ccaf0', bottom: '#e8f6f8', y0: -30, y1: 430, midAt: 0.55 });
    E.clouds(q, { t: 0, y: 120, color: '#ffffff', shade: '#b0cce4', alpha: 0.95, scale: 1, n: 4, seed: 41, speed: 0, style: 'cumulus', lightX: 900 });
    E.mountains(q, { t: 0, lightDir: 1, layers: [
      { kind: 'far', color: '#6a98c0', light: '#ffffff', litA: 0.75, y: 400, scaleY: 0.6, speed: 0, seed: 21, fog: '#cfe6f2', fogA: 0.35, rim: '#ffffff', rimA: 0.6 },
      { kind: 'mid', color: '#3f7a8a', light: '#bfe8d8', litA: 0.5, y: 432, scaleY: 0.3, speed: 0, seed: 8, fog: '#a8d8e0', fogA: 0.3 },
    ] });
  });
  function memLake(g, c, age) {
    const t = c.t, hz = 432;
    const dx = Math.round(lerp(-16, 0, easeOut(clamp(age / 1.4))));
    g.save(); g.translate(dx, 0);
    const back = (q) => q.drawImage(lakeDay(), -40, -30, 1360, 780);
    back(g);
    E.water(g, { y: hz, t, top: '#5ac0c8', bottom: '#1a6a8a', reflectFn: back, reflect: 0.45, wobble: 2.5, lines: 40, lineColor: '#ffffff', lineA: 0.35, glint: { x: 1000, color: '#ffffff', w: 50, a: 0.55 }, mist: '#e0f4f4' });
    // 岸：开着白花的草坡
    g.fillStyle = K.lin(g, 0, 560, 0, 720, [[0, '#8ab86a'], [1, '#4a7a3e']]);
    g.beginPath(); g.moveTo(400, 760); g.quadraticCurveTo(700, 580, 1340, 600); g.lineTo(1340, 760); g.closePath(); g.fill();
    for (let i = 0; i < 40; i++) { const x = 560 + h2(i, 3) * 760, y = 640 + h2(i, 4) * 90 - (x - 560) * 0.03; g.fillStyle = i % 4 ? '#ffffff' : '#f6c8d8'; g.beginPath(); g.arc(x, y, 2.4 + 2 * h2(i, 5), 0, TAU); g.fill(); }
    // 灵儿：背过身往左走了两步，又回过头来（四分之三背影，头扭过肩），发带被风扬起打着卷
    const fx = 860, fy = 742, s = 2.5;
    const fo = { pose: 'lookBack', facing: -1, wind: 0.85, windDir: 1, rim: '#fff4dc', light: [1180, 80], night: false, ribbon: '#b9a2e8', head: -0.06 };
    F.draw(g, 'linger', fx, fy, s, t, fo);
    const P = F.points('linger', fx, fy, s, t, fo);
    // 回过头的侧脸：迎光一线、一点腮红，一缕发丝扫过脸颊
    const m = P.mouth, hd = P.head;
    g.strokeStyle = 'rgba(255,236,214,0.95)'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hd[0] + 6, hd[1] - 22); g.quadraticCurveTo(m[0] + 10, hd[1] - 8, m[0] + 7, m[1] - 2); g.quadraticCurveTo(m[0] + 4, m[1] + 8, m[0] - 4, m[1] + 12); g.stroke();
    glow(g, m[0] - 4, m[1] - 8, 12, '#f4a0a8', 0.35);
    g.strokeStyle = 'rgba(30,20,30,0.85)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(hd[0] - 4, hd[1] - 26); g.quadraticCurveTo(m[0] + 12 + Math.sin(t * 3) * 3, hd[1] - 4, m[0] + 18 + Math.sin(t * 3) * 5, m[1] + 16); g.stroke();
    V.ribbons(g, c, { anchor: [hd[0] - 10, hd[1] - 10], angle: PI * 0.02, len: 320, n: 2, amp: 60, width: 9, colors: ['#c4aef0', '#d8c8f6'], droop: 0.3, glow: 0.2, alpha: 0.9, seed: 7 });
    g.restore();
    // 左边一抹青绿的暗，白字立得住
    g.fillStyle = K.lin(g, 0, 0, 420, 0, [[0, 'rgba(20,60,80,0.45)'], [1, 'rgba(20,60,80,0)']]); g.fillRect(-10, -10, 430, H + 20);
    V.petals(g, c, { kind: 'peach', n: 20, wind: 50, alpha: 0.8, seed: 22 });
    V.bokeh(g, c, { n: 8, colors: ['#ffffff', '#fff2d0'], alpha: 0.22, size: [30, 90] });
    memoryFrame(g, age, '#f6f0e4');
    flash(g, age, '#ffffff', 0.7);
  }

  // =====================================================================
  // 第47句 c3_lastlamp 十年孤灯：残灯与窗框上刻的两个“正”字 → 李家客栈雪夜外景，天边金线亮起 → 屋里反打，灯在“瘦”字熄，墙上的影子跟着没了 → 回忆：一对红烛同时点亮 → 天亮，窗黑，路口没人
  // =====================================================================
  // 屋顶积雪：沿瓦坡盖一层厚雪，檐下挂冰凌（参数与 E.util.roof 一致）
  function snowRoof(q, cx, y, w, h, o = {}) {
    const hw = w / 2, ov = w * 0.05, lift = h * (o.curl ?? 0.32), rk = o.ridge ?? 0.62, top = y - h;
    const Lx = cx - hw - ov, Rx = cx + hw + ov, r = A.rng(Math.round(cx + y));
    q.fillStyle = K.lin(q, 0, top - 8, 0, y, [[0, '#f4f7fb'], [0.7, '#dbe3ee'], [1, '#b8c6da']]);
    q.beginPath();
    q.moveTo(Lx - 2, y - lift - 4);
    q.quadraticCurveTo(cx - hw * 0.78, y - h * 0.36, cx - hw * rk, top - 6);
    q.lineTo(cx + hw * rk, top - 6);
    q.quadraticCurveTo(cx + hw * 0.78, y - h * 0.36, Rx + 2, y - lift - 4);
    const n = 26;
    for (let i = n; i >= 0; i--) { const u = i / n, x = lerp(Lx + 4, Rx - 4, u), edge = y - h * (o.cover ?? 0.3) - Math.abs(u - 0.5) * h * 0.2 + (r() - 0.5) * 5; q.lineTo(x, edge); }
    q.closePath(); q.fill();
    q.fillStyle = 'rgba(214,228,246,0.85)';
    for (let i = 0; i < (o.icicles ?? 14); i++) { const x = lerp(cx - hw * 0.7, cx + hw * 0.7, r()), len = 4 + r() * 16 * (o.ice ?? 1); q.beginPath(); q.moveTo(x - 2, y + h * 0.04); q.lineTo(x + 2, y + h * 0.04); q.lineTo(x, y + h * 0.04 + len); q.closePath(); q.fill(); }
  }
  // 天边金线：k 0..1 亮度，snap 一下子亮起的那一道细线（指数衰减）
  function dawnLine(g, k, y, x0, x1, snap) {
    if (k <= 0.01 && !(snap > 0.01)) return;
    add(g, () => {
      if (k > 0.01) {
        g.fillStyle = K.lin(g, 0, y - 120, 0, y + 6, [[0, 'rgba(255,170,90,0)'], [0.75, rgba('#ff9a4a', 0.38 * k)], [1, rgba('#ffd890', 0.7 * k)]]);
        g.fillRect(x0, y - 120, x1 - x0, 126);
        glow(g, lerp(x0, x1, 0.62), y, 280 * (0.6 + 0.4 * k), '#ffc070', 0.32 * k);
      }
      const bar = E.util.softBar(), a = Math.min(1, 0.85 * k + (snap || 0));
      g.globalAlpha = a; g.drawImage(bar, x0 - 40, y - 3, x1 - x0 + 80, 7);
      g.fillStyle = rgba('#fff2c0', Math.min(1, 0.8 * k + (snap || 0))); g.fillRect(x0, y - 1, x1 - x0, 2);
      g.globalAlpha = 1;
      if (snap > 0.01) { glow(g, lerp(x0, x1, 0.8), y, 80, '#fff6d8', 0.5 * snap); glow(g, lerp(x0, x1, 0.8), y, 300, '#ffd090', 0.25 * snap); }
    });
  }
  // 残灯：铜盏里只剩一层油底、灯芯焦黑，火苗只有平常四成大，忽高忽低，拍上几乎要灭，随即一蹿
  function lampFlame(c, lt) {
    const sb = c.b ? c.b.since : 1, dip = sb < 0.07 ? sb / 0.07 : 1, surge = sb >= 0.07 ? Math.exp(-(sb - 0.07) / 0.28) : 0;
    return (0.22 + 0.38 * dip + 0.45 * surge * (c.b ? c.b.str ?? 1 : 1)) * (0.85 + 0.15 * A.noise1(c.t * 11, 4));
  }
  function oilLamp(g, c, x, y, s, f, out, o = {}) {
    g.fillStyle = '#3a2818'; g.fillRect(x - 3 * s, y, 6 * s, 16 * s);
    g.beginPath(); g.ellipse(x, y + 16 * s, 14 * s, 4 * s, 0, 0, TAU); g.fill();
    g.fillStyle = K.lin(g, x - 18 * s, 0, x + 18 * s, 0, [[0, '#4a3018'], [0.4, '#9a7038'], [1, '#3a2410']]);
    g.beginPath(); g.moveTo(x - 18 * s, y - 2 * s); g.quadraticCurveTo(x, y + 10 * s, x + 18 * s, y - 2 * s); g.closePath(); g.fill();
    // 盏底一层焦黑的残油
    g.fillStyle = '#1a0e06'; g.beginPath(); g.ellipse(x, y - 1 * s, 13 * s, 2 * s, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(200,140,60,0.35)'; g.beginPath(); g.ellipse(x - 3 * s, y - 1.4 * s, 4 * s, 0.8 * s, 0, 0, TAU); g.fill();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 1.2 * s; g.beginPath(); g.ellipse(x, y - 2 * s, 18 * s, 3 * s, 0, 0, TAU); g.stroke();
    // 焦黑卷曲的灯芯
    g.strokeStyle = '#0a0604'; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(x + 6 * s, y - 2 * s); g.quadraticCurveTo(x + 9 * s, y - 5 * s, x + 10 * s, y - 8 * s); g.quadraticCurveTo(x + 11 * s, y - 10 * s, x + 9 * s, y - 11 * s); g.stroke();
    const live = 1 - out;
    if (live > 0.02) V.flame(g, c, { x: x + 10 * s, y: y - 9 * s, s: s * 0.32 * f * live, burn: 0.25, wind: 0.05, glow: (o.glow ?? 1) * live * (0.5 + 0.5 * f), beat: 0, seed: 77, color: '#ff8a30' });
    if (live > 0.02) add(g, () => glow(g, x + 10 * s, y - 9 * s, 3 * s, '#ffd090', 0.7 * live));
    if (out > 0) {
      add(g, () => glow(g, x + 9 * s, y - 11 * s, 3 * s, '#ff5a1a', 0.85 * clamp(1 - (o.since || 0) / 0.9)));
      V.smoke(g, c, { kind: 'incense', x: x + 9 * s, y: y - 11 * s, h: (o.smokeH ?? 220) * s, n: 1, alpha: 0.6 * clamp((o.since || 0) / 0.12) * clamp(1 - (o.since || 0) / 4), wind: 0.25, color: '#c8ccd8', seed: 9 });
    }
  }

  // ---------- ① 极近景：窗台上的残灯、窗柱上刻的两个“正”字、窗后他失焦的手与脸、窗台上落雪 ----------
  // 两个“正”字共十笔，刻在窗柱上（局部坐标，柱面朝镜头）
  const ZHENG = (() => {
    const S = [];
    for (const [ox, oy] of [[0, 0], [4, 150]]) {
      S.push([ox - 30, oy - 54, ox + 30, oy - 57]);
      S.push([ox + 1, oy - 54, ox - 1, oy + 52]);
      S.push([ox + 2, oy - 2, ox + 26, oy - 4]);
      S.push([ox - 20, oy + 6, ox - 21, oy + 52]);
      S.push([ox - 36, oy + 54, ox + 36, oy + 51]);
    }
    return S;
  })();
  function notch(g, x0, y0, x1, y1, lit, t) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w = 5.5;
    // 刀刻的 V 形槽：中间深、两头尖；下唇受灯光一线暖。没被照到的几乎看不见
    g.fillStyle = rgba('#0c0604', 0.12 + 0.88 * Math.min(1, lit * 1.3));
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + nx * w, (y0 + y1) / 2 + ny * w, x1, y1); g.quadraticCurveTo((x0 + x1) / 2 - nx * w, (y0 + y1) / 2 - ny * w, x0, y0); g.closePath(); g.fill();
    const lx = Math.abs(ny) > Math.abs(nx) ? (ny > 0 ? 1 : -1) : (nx > 0 ? 1 : -1);
    g.strokeStyle = rgba('#ffb070', 0.9 * lit); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x0 + nx * 1.5 * lx, y0 + ny * 1.5 * lx); g.quadraticCurveTo((x0 + x1) / 2 + nx * (w + 1.5) * lx, (y0 + y1) / 2 + ny * (w + 1.5) * lx, x1 + nx * 1.5 * lx, y1 + ny * 1.5 * lx); g.stroke();
    g.strokeStyle = rgba('#3a2216', 0.6 * lit); g.lineWidth = 1; g.beginPath(); g.moveTo(x0 - nx * 2 * lx, y0 - ny * 2 * lx); g.lineTo(x1 - nx * 2 * lx, y1 - ny * 2 * lx); g.stroke();
  }
  // 窗后失焦的他：消瘦的手托着下巴，脸半边被灯照暖（预先糊好）
  const blurMan = () => K.cache('g13-blurMan', 520, 520, 0.5, (q) => {
    if ('filter' in q) q.filter = 'blur(9px)';
    q.fillStyle = '#20160f'; q.beginPath(); q.moveTo(40, 520); q.quadraticCurveTo(60, 330, 200, 300); q.quadraticCurveTo(330, 290, 400, 380); q.quadraticCurveTo(440, 450, 460, 520); q.closePath(); q.fill();
    // 头：瘦，颧骨高，白发披下
    q.fillStyle = '#3a281e'; q.beginPath(); q.ellipse(250, 200, 74, 96, 0.08, 0, TAU); q.fill();
    q.fillStyle = 'rgba(214,150,96,0.75)'; q.beginPath(); q.ellipse(296, 214, 34, 78, 0.12, -1.4, 1.5); q.fill();
    q.fillStyle = 'rgba(232,226,218,0.9)'; q.beginPath(); q.moveTo(170, 140); q.quadraticCurveTo(250, 80, 330, 130); q.quadraticCurveTo(300, 110, 250, 112); q.quadraticCurveTo(200, 120, 176, 200); q.quadraticCurveTo(160, 300, 150, 380); q.quadraticCurveTo(140, 280, 170, 140); q.fill();
    q.fillStyle = 'rgba(232,226,218,0.7)'; q.beginPath(); q.moveTo(326, 140); q.quadraticCurveTo(350, 220, 340, 320); q.quadraticCurveTo(326, 230, 316, 160); q.closePath(); q.fill();
    // 手：托着下巴，指节突起
    q.fillStyle = '#7a5640'; q.beginPath(); q.ellipse(270, 300, 50, 30, -0.2, 0, TAU); q.fill();
    q.fillStyle = 'rgba(220,160,110,0.8)'; q.beginPath(); q.ellipse(290, 296, 28, 18, -0.2, -1.6, 1.2); q.fill();
    q.strokeStyle = '#3a2418'; q.lineWidth = 16; q.lineCap = 'round'; q.beginPath(); q.moveTo(250, 320); q.quadraticCurveTo(230, 400, 260, 500); q.stroke();
    q.filter = 'none';
  });
  const ecuBack = () => K.cache('g13-ecuBack' + fk(), 1280, 720, 0.5, (q) => {
    // 屋里：暗暖；窗纸一扇半开，透着灯
    q.fillStyle = K.lin(q, 0, 0, 0, 720, [[0, '#140c08'], [0.6, '#2a1a10'], [1, '#160c08']]); q.fillRect(0, 0, 1280, 720);
    if ('filter' in q) q.filter = 'blur(6px)';
    E.util.lattice(q, 60, 40, 240, 560, '#2a1a12', '#8a5a34');
    q.fillStyle = 'rgba(80,50,30,0.5)'; q.fillRect(640, 60, 140, 260);
    E.util.glyphs(q, '逍遥', 710, 190, 54, 'rgba(30,16,10,0.6)', { vertical: true });
    q.filter = 'none';
  });
  function windowClose(g, c, lt) {
    const t = c.t, z = 1 + 0.03 * smooth(lt / 2.1);
    g.save(); g.translate(600, 460); g.scale(z, z); g.translate(-600, -460);
    g.drawImage(ecuBack(), 0, 0, W, H);
    const f = lampFlame(c, lt);
    const lx = 590, ly = 556, ls = 3.4;
    add(g, () => { glow(g, lx + 34, ly - 40, 420 * (0.6 + 0.4 * f), '#ff8a3a', 0.2 + 0.18 * f); glow(g, lx + 34, ly - 30, 140, '#ffc070', 0.18 * f); });
    // 窗后的他（失焦）
    g.globalAlpha = 0.9; g.drawImage(blurMan(), 210, 120, 520, 520); g.globalAlpha = 1;
    add(g, () => glow(g, 520, 330, 160, '#ff9a50', 0.12 * f));
    // 窗台（里沿）与灯
    g.fillStyle = K.lin(g, 0, 570, 0, 610, [[0, '#4a3020'], [1, '#22140c']]); g.fillRect(-40, 572, W + 80, 40);
    g.fillStyle = rgba('#ffb070', 0.25 + 0.3 * f); g.fillRect(-40, 572, W + 80, 2);
    oilLamp(g, c, lx, ly, ls, f, 0, { glow: 1 });
    // 右边窗柱：两个“正”字，十道刀痕；拍点上火苗一蹿，照亮两三道
    const px = 960, pw = 130;
    g.fillStyle = K.lin(g, px - pw / 2, 0, px + pw / 2, 0, [[0, '#2a1a0e'], [0.4, '#40281a'], [1, '#1a100a']]); g.fillRect(px - pw / 2, -40, pw, 680);
    add(g, () => { g.fillStyle = K.lin(g, px - pw / 2, 0, px + pw / 2, 0, [[0, rgba('#ff9a50', 0.22 * f)], [1, 'rgba(255,154,80,0)']]); g.fillRect(px - pw / 2, 60, pw, 440); });
    g.strokeStyle = 'rgba(20,10,4,0.5)'; g.lineWidth = 1; for (let k = 0; k < 9; k++) { const xx = px - pw / 2 + 8 + k * 14 + Math.sin(k * 2.3) * 3; g.beginPath(); g.moveTo(xx, -40); g.quadraticCurveTo(xx + 3, 300, xx - 2, 640); g.stroke(); }
    g.fillStyle = 'rgba(160,180,220,0.18)'; g.fillRect(px + pw / 2 - 10, -40, 10, 680);
    // 哪几道已被照亮：烛残未觉这几拍里，每拍亮两三道
    const t0 = c.t - lt, beats = [];
    if (c.grid) { for (let k = c.b.i - 12; k <= c.b.i + 12; k++) { const bt = c.grid.time(k) - t0; if (bt > 0.15 && bt < 1.75) beats.push(bt); } }
    if (!beats.length) beats.push(0.26, 0.7, 1.1, 1.5);
    const per = Math.ceil(10 / beats.length);
    add(g, () => glow(g, px, 330, 220, '#ff9a50', 0.1 + 0.16 * f));
    ZHENG.forEach(([x0, y0, x1, y1], i) => {
      const bt = beats[Math.min(beats.length - 1, Math.floor(i / per))], on = smooth(ramp(lt, bt - 0.02, bt + 0.12)), hit = lt >= bt ? Math.exp(-(lt - bt) / 0.3) : 0;
      notch(g, px + x0 * 0.9, 210 + y0 * 0.95, px + x1 * 0.9, 210 + y1 * 0.95, clamp(on * (0.45 + 0.55 * f) + 0.5 * hit), t);
    });
    // 窗台外沿的积雪，雪片落上来
    g.fillStyle = '#d8e0ee'; g.beginPath(); g.moveTo(-40, 664); g.quadraticCurveTo(300, 622, 640, 632); g.quadraticCurveTo(980, 640, W + 40, 620); g.lineTo(W + 40, H + 40); g.lineTo(-40, H + 40); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,214,170,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-40, 664); g.quadraticCurveTo(300, 622, 640, 632); g.quadraticCurveTo(980, 640, W + 40, 620); g.stroke();
    for (let i = 0; i < 26; i++) { const x = h2(i, 51) * W, y = 650 + h2(i, 52) * 60, a = Math.pow(Math.max(0, Math.sin(t * (1.5 + 2 * h2(i, 53)) + i * 2)), 8); if (a > 0.05) glow(g, x, y, 4 + 5 * h2(i, 54), '#ffffff', a * 0.8); }
    g.fillStyle = K.lin(g, 0, 620, 0, 720, [[0, 'rgba(255,170,100,0.3)'], [0.4, 'rgba(160,180,220,0)'], [1, 'rgba(90,110,160,0.35)']]); g.fillRect(-40, 620, W + 80, 140);
    for (let i = 0; i < 18; i++) { const x = 40 + h2(i, 41) * 1200, land = 630 + (h2(i, 42) - 0.5) * 16, per2 = 2.4 + h2(i, 43) * 2, ph = ((t / per2 + h2(i, 44)) % 1), y = lerp(-20, land, Math.min(1, ph * 1.4)), a = ph < 0.72 ? 0.85 : 0.85 * (1 - (ph - 0.72) / 0.28); g.fillStyle = rgba('#ffffff', a); g.beginPath(); g.arc(x + Math.sin(t + i) * 8, y, 2 + 2.5 * h2(i, 45), 0, TAU); g.fill(); }
    g.restore();
    V.snow(g, c, { n: 70, size: [2, 16], fall: 36, wind: 10, alpha: 0.75, seed: 61, color: '#eef4ff', layer: 'front' });
    add(g, () => { for (let i = 0; i < 12; i++) { const x = 480 + h2(i, 81) * 360, y = ((h2(i, 82) * 500 + t * 36 * (0.6 + h2(i, 83))) % 500) + 120; glow(g, x + Math.sin(t + i) * 10, y, 5 + 6 * h2(i, 84), '#ffc890', 0.4 * f * clamp(1 - Math.abs(x - 620) / 260)); } });
  }

  // ---------- ② / ⑤ 外景：李家客栈（与开头同一座：深木铺面、二层格扇窗、石台基临水），压了雪；水结了冰，渡口的乌篷船冻住；右边雪中的路口 ----------
  const INN = { x: 420, y: 512, s: 1.0, hz: 392 };
  // 亮的那扇窗（二层第五扇）
  const INNWIN = { x: INN.x + (-152 + 4 * 51) * INN.s, y: INN.y - 236 * INN.s, w: 45 * INN.s, h: 56 * INN.s };
  const innWideBg = () => K.cache('g13-innWide' + fk(), 1280, 720, 1, (q) => {
    E.sky(q, { stops: [[0, '#0a1430'], [0.5, '#22406e'], [0.86, '#5a6e98'], [1, '#7a86a8']], y0: 0, y1: INN.hz + 4 });
    E.stars(q, { t: 0, n: 50, seed: 17, maxY: 250, alpha: 0.55, twinkle: 0 });
    E.mountains(q, { t: 0, lightDir: 1, layers: [{ kind: 'far', color: '#46567c', light: '#8a9cc4', litA: 0.4, y: INN.hz, scaleY: 0.2, speed: 0, seed: 31, fog: '#5a6a90', fogA: 0.4 }] });
    E.pines(q, { xs: [720, 760, 1200, 1236], y: INN.hz + 10, s: 0.12, seed: 7, color: '#2a3654', ink: '#1a2238', alpha: 0.7 });
    // 雪野：远处冷，近处亮一点
    q.fillStyle = K.lin(q, 0, INN.hz, 0, 600, [[0, '#7a88aa'], [1, '#a4b0cc']]); q.fillRect(0, INN.hz, 1280, 230);
    // 路口：两道浅浅的雪槽，边上一线蓝影、一线亮；路上没有脚印
    const road = (pts, w) => {
      const side = (k) => pts.map(([x, y, s2]) => [x, y + k * w * s2]);
      const a = side(-1), b = side(1);
      q.fillStyle = 'rgba(86,100,146,0.5)'; q.beginPath(); a.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); for (let i = b.length - 1; i >= 0; i--) q.lineTo(b[i][0], b[i][1]); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(70,84,128,0.55)'; q.lineWidth = 1.6; q.beginPath(); a.forEach((p, i) => (i ? q.lineTo(p[0], p[1] + 1) : q.moveTo(p[0], p[1] + 1))); q.stroke();
      q.strokeStyle = 'rgba(232,238,250,0.7)'; q.lineWidth = 1.4; q.beginPath(); b.forEach((p, i) => (i ? q.lineTo(p[0], p[1] - 1) : q.moveTo(p[0], p[1] - 1))); q.stroke();
    };
    const rA = [], rB = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16; rA.push([lerp(690, 1300, u), lerp(468, 522, u) + Math.sin(u * 3) * 6, lerp(7, 13, u)]); rB.push([lerp(1010, 1170, u), lerp(INN.hz + 6, 600, Math.pow(u, 1.2)), lerp(2, 16, u)]); }
    road(rA, 1); road(rB, 1);
    // 路标：木柱两块指路牌，压着雪
    q.fillStyle = '#2a2420'; q.fillRect(1068, 430, 7, 74);
    q.save(); q.translate(1072, 444); q.rotate(-0.12); q.fillStyle = '#4a3a2c'; q.fillRect(-3, -7, 64, 13); q.beginPath(); q.moveTo(61, -7); q.lineTo(71, -1); q.lineTo(61, 6); q.fill(); q.fillStyle = '#eef3f9'; q.fillRect(-3, -10, 64, 3); q.restore();
    q.save(); q.translate(1072, 466); q.rotate(0.16); q.fillStyle = '#433428'; q.fillRect(-60, -6, 62, 12); q.beginPath(); q.moveTo(-60, -6); q.lineTo(-68, 0); q.lineTo(-60, 6); q.fill(); q.fillStyle = '#eef3f9'; q.fillRect(-60, -9, 62, 3); q.restore();
    q.fillStyle = '#eef3f9'; q.beginPath(); q.ellipse(1071, 430, 6, 3, 0, PI, TAU); q.fill();
    q.fillStyle = 'rgba(60,74,110,0.35)'; q.beginPath(); q.ellipse(1060, 505, 40, 5, 0, 0, TAU); q.fill();
    // 一棵覆雪的枯树
    const r = A.rng(4);
    const br = (x, y, a, len, w, d) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      q.strokeStyle = '#141820'; q.lineWidth = w; q.lineCap = 'round'; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo((x + ex) / 2 + (r() - 0.5) * 20, (y + ey) / 2, ex, ey); q.stroke();
      if (w > 2) { q.strokeStyle = 'rgba(236,242,250,0.8)'; q.lineWidth = w * 0.35; q.beginPath(); q.moveTo(x, y - w * 0.4); q.lineTo(ex, ey - w * 0.4); q.stroke(); }
      if (d > 0) for (let k = 0; k < 2 + (r() < 0.5 ? 1 : 0); k++) br(ex, ey, a + (r() - 0.5) * 1.3, len * (0.55 + r() * 0.2), w * 0.62, d - 1);
    };
    br(1220, 560, -1.62, 90, 9, 4);
    // 客栈：深木铺面，压暗成夜色；屋顶、腰檐、美人靠上积雪，檐下冰凌
    const { x, y, s } = INN;
    E.inn(q, { x, y, s, t: 0, lit: 0, wind: 0.08, flag: '酒', flagSide: 1, bank: true, bankH: 64, wood: '#5a3c28', haze: '#1a2444', hazeA: 0.32 });
    snowRoof(q, x, y - 246 * s, 440 * s, 66 * s, { curl: 0.62, ridge: 0.6, cover: 0.42, icicles: 20 });
    snowRoof(q, x, y - 122 * s, 420 * s, 28 * s, { curl: 0.85, ridge: 0.98, cover: 0.2, icicles: 18, ice: 0.7 });
    q.fillStyle = '#e6edf6'; q.beginPath(); q.moveTo(x - 178 * s, y - 180 * s); q.quadraticCurveTo(x, y - 190 * s, x + 178 * s, y - 180 * s); q.lineTo(x + 178 * s, y - 176 * s); q.quadraticCurveTo(x, y - 184 * s, x - 178 * s, y - 176 * s); q.closePath(); q.fill();
    q.fillStyle = '#e6edf6'; q.fillRect(x - 230 * s, y - 4, 460 * s, 5);
    // 酒旗竿顶一顶雪，旗上沿一道雪
    const px = x + 236 * s, top = y - 340 * s;
    q.fillStyle = '#eef3f9'; q.beginPath(); q.ellipse(px, top - 1, 5 * s, 3 * s, 0, PI, TAU); q.fill(); q.fillRect(px - 58 * s, top + 1 * s, 58 * s, 3 * s);
    // 冻住的河：冰面淡蓝灰，几道裂纹、几片积雪；渡口与冻在冰里的乌篷船
    q.fillStyle = K.lin(q, 0, y + 60, 0, 720, [[0, '#8e9cbc'], [0.4, '#a8b6d0'], [1, '#c4cede']]); q.fillRect(0, y + 60 * s, 1280, 720);
    q.fillStyle = 'rgba(236,242,250,0.85)';
    for (let i = 0; i < 9; i++) { const xx = r() * 1280, yy = y + 90 + r() * 140, rx = 60 + r() * 160; q.beginPath(); q.ellipse(xx, yy, rx, rx * 0.08, 0, 0, TAU); q.fill(); }
    q.strokeStyle = 'rgba(70,86,130,0.4)'; q.lineWidth = 1;
    for (let i = 0; i < 10; i++) { let xx = r() * 1280, yy = y + 80 + r() * 140; q.beginPath(); q.moveTo(xx, yy); for (let k = 0; k < 5; k++) { xx += 20 + r() * 40; yy += (r() - 0.5) * 14; q.lineTo(xx, yy); } q.stroke(); }
    E.dock(q, { x: x + 180, y: y + 104, s: 0.9, t: 0, side: 1, len: 300, wood: '#4a3628', boat: true, boatX: x + 420, boatY: 24, boatColor: '#3a2c22', lit: 0 });
    q.fillStyle = 'rgba(236,242,250,0.95)'; q.fillRect(x + 180, y + 104 - 18 * 0.9 - 6, 300 * 0.9, 3.5);
    q.beginPath(); q.ellipse(x + 420, y + 104 + 24 * 0.9 - 60, 100, 9, 0, PI, TAU); q.fill();
  });
  function innWide(g, c, lt, o) {
    const t = c.t;
    g.drawImage(innWideBg(), 0, 0, W, H);
    // 天色随金线变亮
    const sun = o.sun;
    if (sun > 0) add(g, () => { g.fillStyle = K.lin(g, 0, 160, 0, INN.hz, [[0, 'rgba(255,160,90,0)'], [1, rgba('#ff9a5a', 0.18 * Math.min(1, sun))]]); g.fillRect(0, 160, W, INN.hz - 160); });
    dawnLine(g, Math.min(1.3, sun), INN.hz, 660, 1280, o.snap);
    // 窗灯：残灯一跳一跳；“日”字那一下是它最后一蹿
    const { x: wx, y: wy, w: ww, h: wh } = INNWIN, cx = wx + ww / 2, cy = wy + wh / 2;
    if (o.lamp > 0) {
      const f = lampFlame(c, lt) * (1 + 1.6 * o.flare);
      g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
      g.fillStyle = K.lin(g, 0, wy, 0, wy + wh, [[0, mix('#c86a28', '#ffd090', Math.min(1, f * 0.6))], [1, '#8a3a14']]); g.fillRect(wx, wy, ww, wh);
      // 窗后坐着的瘦影，面朝路口
      const fo = { stage: 'old', pose: 'sit', seat: 'ledge', facing: 1, tone: 'silhouette', ink: '#2a160e', whiteHair: true, prop: 'none', wind: 0.02, head: -0.05 };
      F.draw(g, 'xiaoyao', wx + 16, footFor('xiaoyao', wx + 16, wy + 12, 0.24, t, fo), 0.24, t, fo);
      g.restore();
      g.strokeStyle = '#2a1a10'; g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(wx + (ww * k) / 4, wy); g.lineTo(wx + (ww * k) / 4, wy + wh); g.stroke(); } g.beginPath(); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
      add(g, () => { glow(g, cx, cy, 70 * (0.6 + 0.5 * f), '#ff9a40', 0.45 * Math.min(1.2, f)); glow(g, cx, cy, 20, '#ffe0a0', 0.5 * Math.min(1, f)); glow(g, cx, INN.y + 140, 60 * f, '#ff8a3a', 0.12); });
      // 冰面上一道窗灯的倒影
      add(g, () => { g.save(); g.translate(cx, INN.y + 170); g.scale(0.25, 1.6); glow(g, 0, 0, 50, '#ff9a50', 0.22 * f); g.restore(); });
    } else {
      g.fillStyle = '#121420'; g.fillRect(wx, wy, ww, wh);
      g.strokeStyle = '#2a1a10'; g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(wx + (ww * k) / 4, wy); g.lineTo(wx + (ww * k) / 4, wy + wh); g.stroke(); }
      V.smoke(g, c, { kind: 'incense', x: cx + 6, y: cy, h: 160, n: 1, alpha: 0.35 * clamp(1 - (o.since || 0) / 3), wind: 0.3, color: '#b8c0d0', seed: 3 });
    }
    V.snow(g, c, { n: 130, size: [1, 9], fall: 34, wind: 12, alpha: 0.8, seed: 63, color: '#eef4ff' });
  }

  // ---------- ③ 屋里反打：他坐在窗边，面朝窗外的路口；灯在“瘦”字熄，墙上那个瘦长的影子跟着没了 ----------
  const roomBack = () => K.cache('g13-room' + fk(), 1280, 720, 1, (q) => {
    q.fillStyle = '#140d0a'; q.fillRect(0, 0, 1280, 720);
    // 左墙：旧木板，一幅褪色的字
    q.fillStyle = K.lin(q, 0, 0, 560, 0, [[0, '#1e1410'], [1, '#2a1c14']]); q.fillRect(0, 0, 560, 720);
    for (let k = 0; k < 6; k++) { q.fillStyle = rgba(k % 2 ? '#3a2818' : '#22160e', 0.4); q.fillRect(k * 96, 0, 3, 720); }
    q.fillStyle = 'rgba(120,96,70,0.22)'; q.fillRect(70, 90, 120, 260);
    E.util.glyphs(q, '不见不散', 130, 220, 46, 'rgba(30,18,10,0.6)', { vertical: true });
  });
  function innside(g, c, lt, tOut, sun) {
    const t = c.t, out = smooth(ramp(lt, tOut - 0.06, tOut + 0.12)), since = lt - tOut;
    const f = lampFlame(c, lt) * lerp(1, 0.55, ramp(lt, 3.74, tOut)) * (1 + 0.8 * Math.max(0, Math.sin((lt - tOut + 0.5) * 30)) * ramp(lt, tOut - 0.45, tOut));
    g.drawImage(roomBack(), 0, 0, W, H);
    // 窗：望出去是雪中的路口与天边
    const wx = 560, wy = 110, ww = 640, wh = 440;
    g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
    const bg = innWideBg(), bs = bg.width / 1280;
    g.drawImage(bg, 680 * bs, 140 * bs, 600 * bs, 412 * bs, wx, wy, ww, wh);
    g.fillStyle = 'rgba(16,26,56,0.3)'; g.fillRect(wx, wy, ww, wh);
    dawnLine(g, Math.min(1.4, sun + 0.3), wy + (INN.hz - 140) * wh / 412, wx, wx + ww, 0);
    V.snow(g, c, { n: 80, size: [1, 7], fall: 30, wind: 10, alpha: 0.75, seed: 65, color: '#eef4ff' });
    add(g, () => glow(g, wx + ww / 2, wy + wh * 0.6, 420, '#ffd0a0', 0.04 + 0.12 * out));
    g.restore();
    g.fillStyle = '#1a100a'; g.fillRect(wx - 26, wy - 26, ww + 52, 26); g.fillRect(wx - 26, wy, 26, wh); g.fillRect(wx + ww, wy, 26, wh); g.fillRect(wx + ww / 2 - 6, wy, 12, wh); g.fillRect(wx - 46, wy + wh, ww + 92, 40);
    g.fillStyle = rgba('#c8d4ec', 0.14 + 0.2 * out); g.fillRect(wx - 46, wy + wh, ww + 92, 3);
    // 他：坐在窗边，侧脸朝窗外；灯在面前，影子投在左墙上（灯灭影没）
    const fx = 470, fy = 600, fs = 2.0;
    const fo = { stage: 'old', pose: 'sit', seat: 'ledge', facing: 1, tone: 'color', ink: '#1b1e25', whiteHair: true, hairLoose: true, prop: 'none', wind: 0.04, head: -0.04, part: 'back' };
    const lx = 640, ly = wy + wh - 4;
    if (out < 1) {
      // 墙上的影子：放大、拉长、糊开，随火苗晃
      const sh = K.cache('g13-wallShadow', 600, 700, 0.5, (q) => {
        if ('filter' in q) q.filter = 'blur(8px)';
        F.draw(q, 'xiaoyao', 300, 640, fs, 0, Object.assign({}, fo, { tone: 'silhouette', ink: '#000000', part: 'all', rim: null }));
        q.filter = 'none';
      });
      const sw = 1.0 + 0.05 * (f - 0.5);
      g.globalAlpha = 0.62 * (1 - out) * (0.7 + 0.3 * Math.min(1, f));
      g.drawImage(sh, fx - 300 - 150, fy - 640 * 1.45 * sw + 60, 600 * 1.25, 700 * 1.45 * sw);
      g.globalAlpha = 1;
    }
    const rimC = out < 0.5 ? '#ffb070' : '#c8d4ec', lightP = out < 0.5 ? [lx, ly] : [wx + ww / 2, wy + wh / 2];
    const P = F.points('xiaoyao', fx, fy, fs, t, fo);
    F.draw(g, 'xiaoyao', fx, fy, fs, t, Object.assign({}, fo, { rim: rimC, light: lightP, rimWidth: 1.3 }));
    // 近手：手肘支在窗台上，手托着下巴
    kneelArm(g, P, fs, P.mouth[0] + 2, P.mouth[1] + 14, t);
    // 灯
    oilLamp(g, c, lx, ly, 3.0, f, out, { since, smokeH: 260 });
    add(g, () => { glow(g, lx + 30, ly - 26, 300 * (0.5 + 0.5 * f), '#ff8a3a', 0.3 * (1 - out)); });
    g.fillStyle = rgba('#05070e', 0.28 * out); g.fillRect(0, 0, W, H);
    if (out > 0) V.godRays(g, c, { x: 880, y: 140, angle: 2.1, spread: 0.5, n: 6, len: 760, start: 0.1, color: '#d8c8b8', alpha: 0.14 * out, source: false, motes: 30, moteColor: '#e8e0d8' });
  }

  // ---------- ④ 回忆：成亲那夜，一对红烛同时点亮，囍字映红 ----------
  const weddingBack = () => K.cache('g13-wedBack2', 1360, 780, 0.5, (q) => {
    q.translate(40, 30);
    q.fillStyle = K.lin(q, 0, 0, 0, 720, [[0, '#3a0808'], [0.5, '#6a1010'], [1, '#2a0606']]); q.fillRect(-40, -30, 1360, 790);
    q.save(); q.globalAlpha = 0.35; q.fillStyle = '#c8202a'; q.translate(640, 260); q.rotate(PI / 4); q.fillRect(-130, -130, 260, 260); q.restore();
    for (let i = 0; i < 10; i++) A.softBlob(q, 100 + i * 120, 150 + (i % 3) * 120, 120, 0.15, '#ff6040');
  });
  function memCandles(g, c, age) {
    const t = c.t, lit = smooth(ramp(age, 0.12, 0.42)), z = 1.04 - 0.03 * easeOut(clamp(age / 1));
    g.save(); g.translate(640, 400); g.scale(z, z); g.translate(-640, -400);
    g.drawImage(weddingBack(), -40, -30, 1360, 780);
    // 囍：烛一亮，跟着映红映亮
    E.util.glyphs(g, '囍', 640, 268, 220, rgba('#f0b450', 0.32 + 0.3 * lit));
    add(g, () => { glow(g, 640, 268, 200, '#ffb040', 0.25 * lit); glow(g, 640, 300, 320, '#ff5a30', 0.15 + 0.35 * lit); });
    g.fillStyle = K.lin(g, 0, 560, 0, 720, [[0, '#5a1a10'], [1, '#2a0a06']]); g.fillRect(-60, 560, W + 120, 200);
    g.fillStyle = 'rgba(255,180,90,0.25)'; g.fillRect(-60, 560, W + 120, 2);
    for (const cx of [470, 810]) {
      // 金烛台
      g.fillStyle = K.lin(g, cx - 40, 0, cx + 40, 0, [[0, '#7a5218'], [0.45, '#f0c060'], [1, '#6a4410']]);
      g.beginPath(); g.ellipse(cx, 560, 52, 12, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(cx - 10, 560); g.quadraticCurveTo(cx - 5, 520, cx - 8, 482); g.lineTo(cx + 8, 482); g.quadraticCurveTo(cx + 5, 520, cx + 10, 560); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(cx, 482, 34, 8, 0, 0, TAU); g.fill();
      // 红烛：上细下粗，顶上一圈烛泪
      g.fillStyle = K.lin(g, cx - 20, 0, cx + 20, 0, [[0, '#6a0810'], [0.4, '#e02a2a'], [0.7, '#c01a22'], [1, '#5a0610']]);
      g.beginPath(); g.moveTo(cx - 20, 480); g.lineTo(cx - 16, 292); g.quadraticCurveTo(cx, 286, cx + 16, 292); g.lineTo(cx + 20, 480); g.closePath(); g.fill();
      g.strokeStyle = '#f2be45'; g.lineWidth = 2.2;
      g.beginPath(); for (let k = 0; k <= 40; k++) { const u = k / 40, yy = 304 + u * 166, xx = cx + Math.sin(u * TAU * 2.2 + (cx > 640 ? PI : 0)) * (12 + 3 * u); k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke();
      g.fillStyle = '#ffd870'; for (let k = 0; k < 9; k++) { const u = (k + 0.5) / 9, yy = 304 + u * 166, xx = cx + Math.sin(u * TAU * 2.2 + (cx > 640 ? PI : 0)) * (12 + 3 * u); g.beginPath(); g.arc(xx, yy, 2.2, 0, TAU); g.fill(); }
      E.util.glyphs(g, '囍', cx, 446, 22, '#f2be45');
      // 烛泪：亮的时候透着光
      for (const [dx, len] of [[-12, 26], [6, 40], [13, 18]]) {
        g.fillStyle = mix('#ff5a46', '#ffb080', lit * 0.6);
        g.beginPath(); g.moveTo(cx + dx - 3, 292); g.quadraticCurveTo(cx + dx - 3.5, 292 + len, cx + dx, 292 + len + 4); g.quadraticCurveTo(cx + dx + 3.5, 292 + len, cx + dx + 3, 292); g.fill();
        if (lit > 0) add(g, () => glow(g, cx + dx, 292 + len, 7, '#ffb070', 0.6 * lit));
      }
      g.fillStyle = '#ff4a3a'; g.beginPath(); g.ellipse(cx, 291, 16, 4.5, 0, 0, TAU); g.fill();
      g.strokeStyle = '#1a0a06'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, 290); g.lineTo(cx + 1, 278); g.stroke();
      if (age > 0.08 && age < 0.4) add(g, () => glow(g, cx + 1, 278, 30 * (1 - ramp(age, 0.08, 0.4)) + 8, '#fff0c0', 0.9));
      if (lit > 0) V.flame(g, c, { x: cx + 1, y: 280, s: 1.9 * lit, burn: 1, wind: 0.03, seed: cx, glow: 1.2 * lit });
    }
    if (lit > 0) add(g, () => { for (const cx of [470, 810]) { g.save(); g.translate(cx, 610); g.scale(0.3, 1.4); glow(g, 0, 0, 60, '#ffb060', 0.5 * lit); g.restore(); } });
    V.bokeh(g, c, { n: 12, colors: ['#ffb060', '#ff6040', '#ffe0a0'], alpha: 0.3 * lit + 0.1, size: [30, 110], seed: 8 });
    g.restore();
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? -60 : W + 60, x1 = sd < 0 ? 150 : W - 150;
      g.fillStyle = K.lin(g, x0, 0, x1, 0, [[0, '#4a0408'], [0.6, 'rgba(150,14,24,0.9)'], [1, 'rgba(150,14,24,0)']]);
      g.beginPath(); g.moveTo(x0, -60); g.quadraticCurveTo(x1 + sd * -10, 200, lerp(x0, x1, 0.6), 420); g.quadraticCurveTo(lerp(x0, x1, 0.4), 600, x0, H + 60); g.closePath(); g.fill();
    }
    memoryFrame(g, age, '#e8c8a0');
    flash(g, age, '#ffe0c0', 0.5);
  }

  XYT.registerShot('c3_lastlamp', {
    name: '十年孤灯', zone: 'top', night: true, text: '#e9f1f6', shadow: 'rgba(8,12,28,0.92)', accent: '#ff8936', bloom: 0.42,
    draw(g, c) {
      const lt = c.lt;
      const kB = rel(c, 4, 2.08), kC = rel(c, 8, 3.74), kM = 5.14, kE = 6.14;
      const tSun = rel(c, 5, 2.66), tOut = rel(c, 10, 4.76);
      // 金线：“日”字一下子亮起一道细线，随后天边的光慢慢铺开到 3.3 秒前后
      const sun = smooth(ramp(lt, tSun, tSun + 0.65)), snap = lt >= tSun ? Math.exp(-(lt - tSun) / 0.35) : 0;
      if (lt < kB) {
        windowClose(g, c, lt);
        if (lt > 0.5) innWideBg(); if (lt > 1.0) roomBack(); if (lt > 1.4) weddingBack();
      } else if (lt < kC) innWide(g, c, lt, { sun, snap, flare: snap, lamp: 1 });
      else if (lt < kM) innside(g, c, lt, tOut, sun);
      else if (lt < kE) memCandles(g, c, lt - kM);
      else innWide(g, c, lt, { sun: 1 + 0.6 * ramp(lt, kE, kE + 0.6), snap: 0, flare: 0, lamp: 0, since: lt - tOut });
      if (lt >= kB && lt < kB + 0.3) flash(g, lt - kB, '#c8d4f0', 0.18);
      if (lt >= kE && lt < kE + 0.3) flash(g, lt - kE, '#ffe8c8', 0.25);
    },
  });

  // =====================================================================
  // 第48句 c3_allred 天地皆红：老人眼睛特写（泪干血盈，角膜映雪）→ 红日跃出、红梅齐放、大雪 → 红盖头掠过日轮、成亲闪回、雪化喜瓣，红从日轮晕开铺满天地
  // =====================================================================
  const AR = { sx: 900, sy: 262, sr: 64, hz: 486 };

  // ---------- ① 眼睛极近特写（工笔淡彩）----------
  // 老人的右眼：上睑松垂盖住虹膜一截，外眼角下坠；眉压得低、寿眉垂过眼角
  const eyeSkin = () => K.cache('g13-eyeSkin2', 1400, 840, 0.5, (q) => {
    q.translate(60, 60);
    q.fillStyle = K.lin(q, 0, -60, 0, 780, [[0, '#b4968a'], [0.45, '#d2b4a4'], [1, '#bc9886']]); q.fillRect(-60, -60, 1400, 840);
    // 眼窝：一片冷灰紫的凹；眉骨受光
    q.fillStyle = K.rad(q, 780, 370, 60, 440, [[0, 'rgba(92,68,82,0.42)'], [0.55, 'rgba(110,84,96,0.18)'], [1, 'rgba(110,84,96,0)']]); q.fillRect(-60, -60, 1400, 840);
    A.softBlob(q, 760, 150, 320, 0.22, '#f0dccc');
    A.softBlob(q, 920, 660, 280, 0.2, '#d48070');
    const r = A.rng(5);
    for (let i = 0; i < 44; i++) A.softBlob(q, r() * 1400 - 60, r() * 840 - 60, 40 + r() * 120, 0.06, i % 2 ? '#8a6a6a' : '#f0dcd0');
    // 老人斑
    for (const [x, y, rr] of [[1160, 150, 30], [1206, 262, 18], [1130, 590, 24], [430, 620, 20], [1240, 440, 16]]) { A.softBlob(q, x, y, rr * 1.8, 0.2, '#8a5a3e'); A.softBlob(q, x + 3, y + 2, rr * 0.9, 0.14, '#6a4028'); }
    for (let i = 0; i < 1000; i++) { q.fillStyle = rgba(i % 2 ? '#8a6a60' : '#f4e4da', 0.08); q.fillRect(r() * 1400 - 60, r() * 840 - 60, 1.5, 1.5); }
    // 左侧压暗，给白字让底
    q.fillStyle = K.lin(q, -60, 0, 330, 0, [[0, 'rgba(60,40,40,0.46)'], [0.75, 'rgba(60,40,40,0.3)'], [1, 'rgba(60,40,40,0)']]); q.fillRect(-60, -60, 390, 840);
  });
  const EYE = { ix: 768, iy: 394, R: 95 };
  const lidU = (q) => { q.moveTo(530, 392); q.bezierCurveTo(612, 318, 850, 300, 1012, 404); };
  const lidL = (q) => q.bezierCurveTo(902, 458, 652, 462, 530, 392);
  // 角膜上映着的一扇窗：窗外在下雪（只在窗形里）
  function corneaWindow(g, t) {
    const P = [[700, 347], [750, 343], [754, 385], [704, 389]];
    const shape = () => { g.beginPath(); g.moveTo(P[0][0], P[0][1]); g.quadraticCurveTo(725, 341, P[1][0], P[1][1]); g.quadraticCurveTo(757, 364, P[2][0], P[2][1]); g.quadraticCurveTo(729, 391, P[3][0], P[3][1]); g.quadraticCurveTo(697, 368, P[0][0], P[0][1]); g.closePath(); };
    g.save(); shape(); g.clip();
    g.fillStyle = K.lin(g, 0, 343, 0, 390, [[0, 'rgba(120,140,178,0.85)'], [0.7, 'rgba(176,192,220,0.85)'], [1, 'rgba(236,242,250,0.9)']]); g.fillRect(696, 340, 64, 52);
    for (let k = 0; k < 18; k++) {
      const x = 700 + h2(k, 21) * 56 + Math.sin(t * 1.3 + k) * 2, y = 341 + ((h2(k, 22) * 50 + t * (14 + 12 * h2(k, 23))) % 50);
      g.fillStyle = rgba('#ffffff', 0.75 + 0.25 * h2(k, 25)); g.beginPath(); g.arc(x, y, 0.7 + 1.2 * h2(k, 24), 0, TAU); g.fill();
    }
    // 窗棂
    g.strokeStyle = 'rgba(30,28,44,0.35)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(727, 340); g.lineTo(729, 392); g.moveTo(696, 367); g.lineTo(758, 364); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; shape(); g.stroke();
  }
  // 不动的部分烘成一张：皮肤、眼袋与细纹、鱼尾纹、皮褶上方的老纹、白眉
  const eyeStatic = () => K.cache('g13-eyeStatic', 1400, 840, 1, (q) => {
    q.drawImage(eyeSkin(), 0, 0, 1400, 840);
    q.translate(60, 60); q.lineCap = 'round'; q.lineJoin = 'round';
    q.fillStyle = K.lin(q, 0, 440, 0, 540, [[0, 'rgba(96,62,66,0.26)'], [1, 'rgba(96,62,66,0)']]);
    q.beginPath(); q.moveTo(548, 404); q.bezierCurveTo(652, 470, 900, 466, 1010, 408); q.bezierCurveTo(940, 530, 640, 540, 548, 404); q.fill();
    for (let k = 0; k < 3; k++) { q.strokeStyle = rgba('#5a3a38', 0.32 - k * 0.06); q.lineWidth = 1.4 - k * 0.2; q.beginPath(); q.moveTo(586 + k * 26, 470 + k * 30); q.bezierCurveTo(680 + k * 10, 520 + k * 34, 880, 516 + k * 32, 990 - k * 10, 456 + k * 28); q.stroke(); }
    q.strokeStyle = 'rgba(80,52,50,0.24)'; q.lineWidth = 1.3;
    q.beginPath(); q.moveTo(584, 318); q.bezierCurveTo(664, 232, 872, 220, 1030, 344); q.stroke();
    q.beginPath(); q.moveTo(650, 262); q.bezierCurveTo(746, 222, 858, 222, 956, 266); q.stroke();
    for (let k = 0; k < 11; k++) {
      const a = -0.6 + k * 0.125 + (h2(k, 3) - 0.5) * 0.1, L = 44 + 96 * h2(k, 4), x0 = 1054 + 30 * h2(k, 5), y0 = 392 + (k - 5) * 7 + (h2(k, 12) - 0.5) * 8, bend = (h2(k, 13) - 0.5) * 18;
      q.strokeStyle = rgba('#5a3836', 0.16 + 0.16 * h2(k, 6)); q.lineWidth = 0.8 + 0.7 * h2(k, 7);
      q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo(x0 + Math.cos(a) * L * 0.5 - Math.sin(a) * bend, y0 + Math.sin(a) * L * 0.5 + Math.cos(a) * bend, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L + 8 * (k / 10)); q.stroke();
    }
    q.strokeStyle = 'rgba(90,60,56,0.14)'; q.lineWidth = 0.8;
    for (let k = 0; k < 18; k++) { const x = 1060 + h2(k, 8) * 130, y = 350 + h2(k, 9) * 110; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + 6, y + (h2(k, 14) - 0.5) * 6, x + 10 + 10 * h2(k, 10), y + (h2(k, 11) - 0.5) * 8); q.stroke(); }
    // 白眉：压得低，一根根长眉；外端的寿眉长长地垂过眼角
    for (let k = 0; k < 150; k++) {
      const u = h2(k, 41), bx = lerp(470, 1060, u), by = 236 - Math.sin(PI * Math.min(1, u * 1.08)) * 46 + 14 * u + (h2(k, 42) - 0.5) * 22, sw = (h2(k, 47) - 0.5) * 6;
      const L = 36 + 48 * h2(k, 43) + 46 * u, droop = u > 0.72 ? (u - 0.72) * 3.2 : 0;
      q.strokeStyle = rgba(h2(k, 44) < 0.72 ? '#f2eee8' : '#a8a29c', 0.55 + 0.4 * h2(k, 45)); q.lineWidth = 0.9 + 1.3 * h2(k, 46);
      q.beginPath(); q.moveTo(bx, by); q.quadraticCurveTo(bx + L * 0.5, by - 12 + sw * 0.4 + droop * 20, bx + L * (1 + droop * 0.6) + sw, by + 2 + L * 0.3 * u + droop * L * 1.1 + sw * 0.5); q.stroke();
    }
  });
  const FOLD = (q) => { q.moveTo(540, 380); q.bezierCurveTo(632, 290, 884, 270, 1070, 428); };
  function eyeClose(g, c, lt) {
    const t = c.t;
    const kBlood = rel(c, 3, 1.36), kFull = rel(c, 4, 1.92), kRim = rel(c, 5, 2.24), kFall = rel(c, 6, 2.54);
    const blood = 0.25 * smooth(ramp(lt, kBlood - 0.1, kBlood + 0.4)) + 0.35 * smooth(ramp(lt, kFull - 0.1, kFull + 0.4)) + 0.4 * smooth(ramp(lt, kRim - 0.1, kRim + 0.3));
    const well = smooth(ramp(lt, kFull - 0.2, kFall));
    const z = 1.0 + 0.05 * smooth(lt / 2.9), cx = 770, cy = 380;
    g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
    g.drawImage(eyeStatic(), -60, -60, W + 120, H + 120);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // 眼睛只画在上睑皮褶以下：外角被松垂的皮盖住
    g.save(); g.beginPath(); g.moveTo(420, 820); g.lineTo(420, 380); g.lineTo(540, 380); g.bezierCurveTo(632, 290, 884, 270, 1070, 428); g.lineTo(1240, 428); g.lineTo(1240, 820); g.closePath(); g.clip();
    // 眼里（只画在眼睑之间）
    g.save(); g.beginPath(); lidU(g); lidL(g); g.closePath(); g.clip();
    g.fillStyle = K.rad(g, 770, 386, 40, 280, [[0, mix('#eadfcc', '#f0c4b8', blood * 0.5)], [0.55, mix('#d4c2b0', '#dc9c90', blood * 0.6)], [1, mix('#8e7470', '#a44c48', blood * 0.7)]]);
    g.fillRect(500, 290, 540, 190);
    // 血丝：从两角往里爬，分叉（一条路径画完）
    if (blood > 0.02) {
      g.strokeStyle = rgba('#b82a28', 0.6 * blood); g.lineWidth = 1; g.beginPath();
      for (let k = 0; k < 22; k++) {
        const side = k < 11 ? -1 : 1, a0 = (h2(k, 3) - 0.5) * 1.4, sx = side < 0 ? 534 : 1006, sy = 396 + a0 * 30;
        const len = (70 + 110 * h2(k, 4)) * Math.min(1, blood * 1.5), ex = sx - side * len, ey = sy + (h2(k, 7) - 0.5) * 46;
        g.moveTo(sx, sy); g.bezierCurveTo(sx - side * len * 0.35, sy + (h2(k, 5) - 0.5) * 20, sx - side * len * 0.7, sy + (h2(k, 6) - 0.5) * 30, ex, ey);
        if (len > 60) { g.moveTo(sx - side * len * 0.55, sy + (h2(k, 6) - 0.5) * 22); g.lineTo(sx - side * len * 0.8, sy + (h2(k, 9) - 0.5) * 60); }
      }
      g.stroke();
    }
    // 虹膜：灰褐，边上一圈老年环；瞳孔里一层浅浅的灰雾
    const { ix, iy, R } = EYE, jx = ix + 4 * Math.sin(t * 0.7);
    g.fillStyle = K.rad(g, jx, iy, 8, R, [[0, '#2a2018'], [0.42, '#5c4a3a'], [0.74, '#76654f'], [0.88, '#4a3c30'], [1, '#2a2220']]);
    g.beginPath(); g.arc(jx, iy, R, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(150,124,96,0.32)'; g.lineWidth = 1; g.beginPath();
    for (let k = 0; k < 70; k++) { const a = (k / 70) * TAU + h2(k, 9) * 0.05, r0 = 40 + 8 * h2(k, 10), r1 = R * (0.8 + 0.12 * h2(k, 11)); g.moveTo(jx + Math.cos(a) * r0, iy + Math.sin(a) * r0); g.lineTo(jx + Math.cos(a + 0.04) * r1, iy + Math.sin(a + 0.04) * r1); }
    g.stroke();
    g.strokeStyle = 'rgba(196,198,200,0.26)'; g.lineWidth = 6; g.beginPath(); g.arc(jx, iy, R - 4, 0, TAU); g.stroke();
    g.fillStyle = '#0a0808'; g.beginPath(); g.arc(jx, iy, 36, 0, TAU); g.fill();
    g.fillStyle = 'rgba(150,160,176,0.16)'; g.beginPath(); g.arc(jx + 3, iy + 4, 26, 0, TAU); g.fill();
    g.fillStyle = K.lin(g, 0, 300, 0, 362, [[0, 'rgba(50,30,30,0.62)'], [1, 'rgba(50,30,30,0)']]); g.fillRect(500, 290, 540, 72);
    corneaWindow(g, t);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(jx + 44, iy + 34, 4.5, 0, TAU); g.fill();
    if (well > 0) {
      g.fillStyle = K.lin(g, 0, 410, 0, 462, [[0, rgba('#dfefff', 0)], [1, rgba('#f2f8ff', 0.82 * well)]]);
      g.beginPath(); g.moveTo(548, 398); g.bezierCurveTo(652, 458 - 20 * well, 900, 452 - 20 * well, 1002, 400); g.lineTo(1006, 410); g.bezierCurveTo(902, 462, 652, 466, 548, 404); g.closePath(); g.fill();
      add(g, () => { for (let k = 0; k < 6; k++) glow(g, 600 + k * 74, 442 - Math.sin(PI * (k + 0.5) / 6) * 8 - 12 * well, 9 + 6 * well, '#ffffff', 0.5 * well); });
    }
    g.restore();
    // 睑缘：上睑浓墨一道；下睑外翻、泛红
    g.strokeStyle = '#2a1a18'; g.lineWidth = 4.6; g.beginPath(); lidU(g); g.stroke();
    g.strokeStyle = 'rgba(120,80,76,0.6)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(534, 386); g.bezierCurveTo(614, 310, 852, 292, 1010, 396); g.stroke();
    g.strokeStyle = rgba('#b4504e', 0.4 + 0.35 * blood); g.lineWidth = 4; g.beginPath(); g.moveTo(1010, 406); g.bezierCurveTo(902, 462, 652, 466, 532, 396); g.stroke();
    g.strokeStyle = 'rgba(70,44,40,0.55)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(1012, 410); g.bezierCurveTo(902, 468, 652, 472, 532, 400); g.stroke();
    g.fillStyle = 'rgba(214,130,130,0.6)'; g.beginPath(); g.ellipse(540, 393, 9, 6, 0.2, 0, TAU); g.fill();
    // 睫毛：稀、短、灰白，向下垂
    g.lineWidth = 1.2;
    for (const col of ['#d8d2cc', '#7a7068']) {
      g.strokeStyle = rgba(col, 0.7); g.beginPath();
      for (let k = 0; k < 24; k++) {
        if (h2(k, 30) < 0.25 || (h2(k, 31) < 0.5) !== (col === '#d8d2cc')) continue;
        const u = 0.12 + (k / 23) * 0.84, bx = (1 - u) ** 3 * 530 + 3 * (1 - u) ** 2 * u * 612 + 3 * (1 - u) * u * u * 850 + u ** 3 * 1012, by = (1 - u) ** 3 * 392 + 3 * (1 - u) ** 2 * u * 318 + 3 * (1 - u) * u * u * 300 + u ** 3 * 404;
        g.moveTo(bx, by); g.quadraticCurveTo(bx + 8 + 6 * u, by + 2, bx + 14 + 10 * u, by + 10 + 6 * h2(k, 32));
      }
      g.stroke();
    }
    g.restore();
    add(g, () => glow(g, 920, 640, 300, '#d86a5a', 0.1 + 0.22 * blood));
    // 褶下的影落在眼睑和眼球上，褶缘一道细墨，褶上受光一线
    g.strokeStyle = 'rgba(60,34,36,0.2)'; g.lineWidth = 14; g.beginPath(); g.moveTo(552, 388); g.bezierCurveTo(640, 302, 884, 284, 1060, 438); g.stroke();
    g.strokeStyle = 'rgba(60,34,36,0.28)'; g.lineWidth = 5; g.beginPath(); g.moveTo(548, 384); g.bezierCurveTo(636, 296, 884, 278, 1066, 432); g.stroke();
    g.strokeStyle = 'rgba(70,42,42,0.62)'; g.lineWidth = 1.7; g.beginPath(); FOLD(g); g.stroke();
    g.strokeStyle = 'rgba(255,236,224,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(600, 330); g.bezierCurveTo(680, 276, 860, 262, 1000, 352); g.stroke();
    // 鬓边飘进的白发
    for (let k = 0; k < 6; k++) { const x0 = 1190 + k * 14, sw = Math.sin(t * 1.6 + k) * 14; g.strokeStyle = rgba('#f0ece8', 0.28 + 0.25 * h2(k, 51)); g.lineWidth = 1 + h2(k, 52); g.beginPath(); g.moveTo(x0, -20); g.bezierCurveTo(x0 - 60 + sw, 140, x0 + 10 + sw, 320, x0 - 90 + sw * 1.5, 560 + k * 20); g.stroke(); }
    // 泪：“涌”字滚落，划出一道湿痕
    V.tear(g, c, { x: 880, y: 450, at: kFall - 0.72, s: 7, len: 150, angle: 0.08, dur: 0.24, color: '#e8f4ff', night: false });
    g.restore();
    g.globalAlpha = 0.8; g.drawImage(XYT.sprites.vignette, -60, -60, W + 120, H + 120); g.globalAlpha = 1;
    V.snow(g, c, { n: 26, size: [6, 24], fall: 46, wind: -12, alpha: 0.45, seed: 91, layer: 'front' });
  }

  // ---------- ② 远景：红日、梅林、大雪 ----------
  const arSky = (warm) => K.cache('g13-arSky' + (warm ? 'W' : 'C'), W, H, 1, (q) => {
    if (warm) E.sky(q, { stops: [[0, '#2a1440'], [0.3, '#6a2a52'], [0.62, '#d45a4a'], [0.86, '#ffa870'], [1, '#ffd6a4']], y0: 0, y1: 520 });
    else E.sky(q, { stops: [[0, '#0c1232'], [0.45, '#343a6c'], [0.85, '#8a7096'], [1, '#b8889a']], y0: 0, y1: 520 });
    E.clouds(q, { t: 0, y: 96, color: warm ? '#c46a70' : '#4c4e80', shade: warm ? '#5a2450' : '#24264e', alpha: 0.42, scale: 1.1, n: 3, seed: 61, speed: 0, style: 'wash', lightX: AR.sx });
    q.globalCompositeOperation = 'lighter';
    if (warm) { A.glow(q, AR.sx, AR.sy, 470, '#ff6a3a', 0.42); A.glow(q, AR.sx, AR.sy + 60, 600, '#ff9a5a', 0.22); A.glow(q, AR.sx, AR.sy, 200, '#ffc890', 0.36); }
    else A.glow(q, AR.sx, AR.hz + 20, 420, '#c86a7a', 0.3);
    q.globalCompositeOperation = 'source-over';
    // 左边压一层暗，白字立得住
    q.fillStyle = K.lin(q, 0, 0, 440, 0, [[0, warm ? 'rgba(46,10,34,0.4)' : 'rgba(10,12,34,0.3)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, 440, 520);
  });
  // 横贯日面的几道薄云（以日心为贴图中心 500,150）：软边的淡墨云带，下沿一线金
  const arBands = () => K.cache('g13-arBands2', 1000, 300, 1, (q) => {
    const band = (cx, cy, L, h, col, lit, seed) => {
      const n = 32, top = [], bot = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = cx - L / 2 + L * u, env = Math.pow(Math.sin(PI * u), 0.9) * (0.7 + 0.6 * A.noise1(u * 3, seed + 1)), wv = (A.noise1(u * 4, seed) - 0.5) * h * 1.4;
        top.push([x, cy - h * env * 0.55 + wv]); bot.push([x, cy + h * env * 0.45 + wv * 0.6]);
      }
      const path = () => { q.beginPath(); top.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); for (let i = n; i >= 0; i--) q.lineTo(bot[i][0], bot[i][1]); q.closePath(); };
      if ('filter' in q) q.filter = 'blur(3px)';
      q.fillStyle = col; path(); q.fill();
      if ('filter' in q) q.filter = 'blur(1px)';
      q.strokeStyle = lit; q.lineWidth = 1.6; q.lineCap = 'round'; q.beginPath(); for (let i = 6; i <= n - 6; i++) (i > 6 ? q.lineTo(bot[i][0], bot[i][1] - 1) : q.moveTo(bot[i][0], bot[i][1] - 1)); q.stroke();
      q.filter = 'none';
    };
    band(470, 128, 520, 20, 'rgba(96,38,68,0.82)', 'rgba(255,196,120,0.75)', 3);
    band(560, 184, 420, 13, 'rgba(110,44,72,0.78)', 'rgba(255,206,136,0.7)', 7);
    band(390, 92, 380, 10, 'rgba(90,36,72,0.55)', 'rgba(255,176,116,0.45)', 11);
  });
  function sunDisc(g, x, y, r, gold) {
    // 平涂的一轮红日：中心略亮、边上一圈薄光，不画高光也不画日芒
    g.fillStyle = K.rad(g, x, y, 0, r, [[0, mix('#ff7040', '#ffe0a0', gold)], [0.75, mix('#f44a2c', '#ffb050', gold)], [1, mix('#e63826', '#ff8a30', gold)]]);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // 地面：远山、近岭、雪原（冷 / 暖两版）
  function arGround(q, warm) {
    E.mountains(q, { t: 0, lightDir: 1, layers: [
      { kind: 'far', color: warm ? '#9a6a8c' : '#545684', light: warm ? '#ffcaa8' : '#a0a2cc', litA: 0.6, y: 476, scaleY: 0.44, speed: 0, seed: 5, fog: warm ? '#f0a690' : '#74769e', fogA: 0.45 },
      { kind: 'mid', color: warm ? '#6a4264' : '#383a5e', light: warm ? '#ffb898' : '#8a8cb4', litA: 0.5, y: AR.hz + 8, scaleY: 0.3, speed: 0, seed: 14, fog: warm ? '#e09088' : '#56587e', fogA: 0.4, rim: warm ? '#ffe2c4' : '#c4c6e4', rimA: 0.6 },
    ] });
    E.snowfield(q, { t: 0, y: AR.hz + 14, color: warm ? '#f8e6dc' : '#c4c8de', shade: warm ? '#b08498' : '#646894', seed: 21, drift: 0, sparkle: 0 });
    if (warm) { q.globalCompositeOperation = 'lighter'; A.glow(q, AR.sx, AR.hz + 40, 520, '#ff9a6a', 0.22); q.globalCompositeOperation = 'source-over'; }
  }
  // 梅树：枝作“女”字折，干粗而虬，上有几根直挺的徒长枝；雪只积在枝的上沿
  const GROVE = [
    // 右前的老梅：短而粗的干，一枝横斜着伸到日下，几枝往上撑满右上角
    { x: 1196, y: 772, s: 1.05, seed: 3, lean: -0.16, h: 176, w: 50, main: [[-PI * 0.9, 290, 0.42, 3, 6], [-PI * 0.57, 300, 0.4, 3, 5], [-PI * 0.46, 320, 0.36, 3, 5], [-PI * 0.3, 200, 0.3, 2, 4]] },
    { x: 660, y: 704, s: 0.74, seed: 8, lean: 0.1, h: 170, w: 24, limbs: 3, spread: 1.4 },
    { x: 140, y: 742, s: 0.46, seed: 12, lean: 0.3, h: 120, w: 22, limbs: 3, spread: 1.2 },
    { x: 372, y: 562, s: 0.32, seed: 17, lean: -0.12, h: 150, w: 20, limbs: 3, spread: 1.3 },
    { x: 818, y: 548, s: 0.27, seed: 21, lean: 0.14, h: 150, w: 20, limbs: 3, spread: 1.3 },
    { x: 1004, y: 556, s: 0.3, seed: 25, lean: -0.2, h: 150, w: 20, limbs: 3, spread: 1.3 },
  ];
  let PLUM2 = null;
  function plumGen() {
    if (PLUM2) return PLUM2;
    PLUM2 = GROVE.map((T) => {
      const r = A.rng(T.seed * 97 + 5), segs = [], fl = [], shoots = [];
      const limb = (x, y, a, len, w, d, n) => {
        let cx = x, cy = y, ang = a, side = r() < 0.5 ? -1 : 1;
        for (let i = 0; i < n; i++) {
          const L = (len / n) * (0.7 + 0.6 * r());
          ang += side * (0.24 + 0.44 * r()); side = -side;
          ang = lerp(ang, -PI / 2, 0.12);
          const nx = cx + Math.cos(ang) * L, ny = cy + Math.sin(ang) * L;
          const w0 = w * (1 - (i / n) * 0.5), w1 = w * (1 - ((i + 1) / n) * 0.5);
          segs.push([cx, cy, nx, ny, w0, w1, 0]);
          if (w1 < 8) { const nf = Math.max(1, Math.round(L / 9)); for (let k = 0; k < nf; k++) { const u = (k + r()) / nf; fl.push([lerp(cx, nx, u) + (r() - 0.5) * 8, lerp(cy, ny, u) + (r() - 0.5) * 8, r(), r()]); } }
          if (d > 0 && r() < 0.72) limb(nx, ny, ang + side * (0.55 + 0.55 * r()), len * (0.42 + 0.22 * r()), w1 * 0.6, d - 1, Math.max(2, n - 1));
          if (d <= 1 && r() < 0.2) {
            const sl = 40 + r() * 80, sa = -PI / 2 + (r() - 0.5) * 0.36;
            shoots.push([nx, ny, sa, sl, Math.max(1.3, w1 * 0.45)]);
            for (let k = 1; k <= 4; k++) fl.push([nx + Math.cos(sa) * sl * k / 4.4 + (k % 2 ? 4 : -4), ny + Math.sin(sa) * sl * k / 4.4, r(), r()]);
          }
          cx = nx; cy = ny;
        }
        fl.push([cx, cy, r(), r()]);
      };
      // 主干：粗、短、扭，几节急折
      let tx = 0, ty = 0, ta = -PI / 2 + T.lean;
      for (let i = 0; i < 3; i++) {
        const L = (T.h / 3) * (0.8 + 0.4 * r());
        ta += (i % 2 ? 1 : -1) * (0.22 + 0.26 * r());
        const nx = tx + Math.cos(ta) * L, ny = ty + Math.sin(ta) * L;
        segs.push([tx, ty, nx, ny, T.w * (1 - i * 0.13), T.w * (1 - (i + 1) * 0.13), 1]);
        if (i > 0) limb(nx, ny, ta + (i % 2 ? -1 : 1) * (0.75 + 0.35 * r()), T.h * 0.85, T.w * 0.42, 2, 4);
        tx = nx; ty = ny;
      }
      if (T.main) for (const [a, L, wf, d, n] of T.main) limb(tx, ty, a, L, T.w * wf, d, n);
      else for (let k = 0; k < T.limbs; k++) limb(tx, ty, -PI / 2 + T.lean * 0.8 + (k / Math.max(1, T.limbs - 1) - 0.5) * T.spread + (r() - 0.5) * 0.3, T.h * (1.0 + 0.45 * r()), T.w * 0.52, 3, 4);
      return { T, segs, fl, shoots };
    });
    return PLUM2;
  }
  // 梅花贴图：正面五瓣（三种红）、侧面杯形、花苞
  const bloTex = (k) => K.cache('g13-blo2' + k, 40, 40, 1, (q) => {
    q.translate(20, 20);
    if (k < 3) {
      const col = ['#c8102e', '#dc2436', '#a80c24'][k];
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - PI / 2; q.fillStyle = K.rad(q, Math.cos(a) * 9, Math.sin(a) * 9, 1, 9, [[0, mix(col, '#ff9a9a', 0.3)], [1, col]]); q.beginPath(); q.arc(Math.cos(a) * 8, Math.sin(a) * 8, 7.6, 0, TAU); q.fill(); }
      q.fillStyle = '#5a0614'; q.beginPath(); q.arc(0, 0, 3.2, 0, TAU); q.fill();
      q.strokeStyle = '#f2c050'; q.lineWidth = 0.7;
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; q.beginPath(); q.moveTo(0, 0); q.lineTo(Math.cos(a) * 6.5, Math.sin(a) * 6.5); q.stroke(); q.fillStyle = '#ffd86a'; q.beginPath(); q.arc(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 1, 0, TAU); q.fill(); }
    } else if (k === 3) {
      q.fillStyle = '#4a1a14'; q.beginPath(); q.ellipse(0, 7, 6, 4, 0, 0, TAU); q.fill();
      for (const [dx, a] of [[-6, -0.5], [6, 0.5], [0, 0]]) { q.fillStyle = K.rad(q, dx, -2, 1, 10, [[0, '#e83a48'], [1, '#a00c22']]); q.beginPath(); q.ellipse(dx, -1, 7, 10, a, 0, TAU); q.fill(); }
      q.strokeStyle = '#f2c050'; q.lineWidth = 0.8; for (let i = -2; i <= 2; i++) { q.beginPath(); q.moveTo(0, 2); q.lineTo(i * 2.5, -11); q.stroke(); }
    } else {
      q.fillStyle = '#3a1410'; q.beginPath(); q.ellipse(0, 5, 4, 3, 0, 0, TAU); q.fill();
      q.fillStyle = K.rad(q, -1, -2, 0.5, 7, [[0, '#e04050'], [1, '#8a0a1c']]); q.beginPath(); q.ellipse(0, 0, 5.5, 6.5, 0, 0, TAU); q.fill();
    }
  });
  // 画一棵梅：stage 0 只有花苞，1 半开，2 盛开；warm 决定积雪受光的颜色
  function drawPlum(q, P, stage, warm) {
    const { T } = P, r = A.rng(T.seed * 13 + stage);
    q.save(); q.translate(T.x, T.y); q.scale(T.s, T.s); q.lineCap = 'round'; q.lineJoin = 'round';
    const ink = '#1a1012', snow = warm ? '#fff0e8' : '#e6eaf6', snowSh = warm ? 'rgba(200,140,150,0.6)' : 'rgba(120,128,170,0.55)';
    // 主干：一笔笔叠，带干笔皴、节疤与苔点
    for (const [x0, y0, x1, y1, w0, w1, tr] of P.segs) {
      const w = (w0 + w1) / 2;
      q.strokeStyle = ink; q.lineWidth = w; q.beginPath(); q.moveTo(x0, y0); q.lineTo(x1, y1); q.stroke();
      if (tr) {
        const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        q.fillStyle = ink;
        q.beginPath(); for (let k = 0; k <= 8; k++) { const u = k / 8, ww = lerp(w0, w1, u) * 0.5 * (1 + 0.18 * (A.noise1(u * 4 + T.seed, 3) - 0.5)); q.lineTo(lerp(x0, x1, u) + nx * ww * 1.1, lerp(y0, y1, u) + ny * ww * 1.1); }
        for (let k = 8; k >= 0; k--) { const u = k / 8, ww = lerp(w0, w1, u) * 0.5 * (1 + 0.18 * (A.noise1(u * 4 + T.seed, 5) - 0.5)); q.lineTo(lerp(x0, x1, u) - nx * ww * 1.05, lerp(y0, y1, u) - ny * ww * 1.05); }
        q.closePath(); q.fill();
        q.strokeStyle = 'rgba(120,100,104,0.42)'; q.lineWidth = 1.6; q.setLineDash([10, 6, 4, 8]);
        for (let k = -1; k <= 1; k++) { const o = k * w * 0.26; q.beginPath(); q.moveTo(x0 + nx * o, y0 + ny * o); q.lineTo(x1 + nx * o * 0.8, y1 + ny * o * 0.8); q.stroke(); }
        q.setLineDash([]);
        q.fillStyle = '#0a0606'; q.beginPath(); q.ellipse(lerp(x0, x1, 0.6) + nx * w * 0.1, lerp(y0, y1, 0.6), w * 0.18, w * 0.12, Math.atan2(dy, dx), 0, TAU); q.fill();
      }
      if (w > 4.5 && r() < 0.5) { q.fillStyle = '#060404'; for (let k = 0; k < 3; k++) { const u = r(); q.beginPath(); q.arc(lerp(x0, x1, u) + (r() - 0.5) * w, lerp(y0, y1, u) - w * 0.45, 1.2 + r() * 1.6, 0, TAU); q.fill(); } }
    }
    // 徒长枝：细长直挺
    for (const [x, y, a, L, w] of P.shoots) {
      const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L, nx = -Math.sin(a), ny = Math.cos(a);
      q.fillStyle = ink; q.beginPath(); q.moveTo(x + nx * w, y + ny * w); q.lineTo(ex, ey); q.lineTo(x - nx * w, y - ny * w); q.closePath(); q.fill();
    }
    // 雪：只积在枝的上沿，越平的枝积得越多
    for (const [x0, y0, x1, y1, w0, w1] of P.segs) {
      const w = (w0 + w1) / 2, a = Math.atan2(y1 - y0, x1 - x0), flat = Math.abs(Math.cos(a));
      if (w < 2 || flat < 0.3) continue;
      const sw = Math.max(1.1, w * 0.3 * flat), off = w * 0.5 - sw * 0.35;
      q.strokeStyle = snowSh; q.lineWidth = sw * 0.6; q.beginPath(); q.moveTo(x0, y0 - off + sw * 0.4); q.lineTo(x1, y1 - off + sw * 0.4); q.stroke();
      q.strokeStyle = snow; q.lineWidth = sw; q.beginPath(); q.moveTo(x0 + (x1 - x0) * 0.08, y0 - off); q.lineTo(x1 - (x1 - x0) * 0.08, y1 - off); q.stroke();
      if (w > 6 && r() < 0.5) { q.fillStyle = snow; q.beginPath(); q.ellipse(x1, y1 - w * 0.5, w * 0.45, w * 0.22, a, PI, TAU); q.fill(); }
    }
    // 花：日轮前只留光枝（梅枝映日），花朵按屏幕大小定
    for (const [x, y, v, v2] of P.fl) {
      if (Math.hypot(T.x + x * T.s - AR.sx, T.y + y * T.s - AR.sy) < AR.sr + 34) continue;
      const rot = v2 * TAU, px = Math.max(4.5, (10 + 7 * v2) * T.s) / T.s;
      if (stage === 0) { if (v < 0.55) { const sz = px * 0.55; q.save(); q.translate(x, y); q.rotate(rot); q.drawImage(bloTex(4), -sz / 2, -sz / 2, sz, sz); q.restore(); } continue; }
      let k = -1, sz = px;
      if (stage === 1) { if (v < 0.42) { k = Math.floor(v2 * 3); sz *= 0.8; } else if (v < 0.82) { k = 4; sz = px * 0.6; } }
      else { if (v < 0.78) k = Math.floor(v2 * 3); else if (v < 0.9) k = 3; else { k = 4; sz = px * 0.6; } }
      if (k < 0) continue;
      q.save(); q.translate(x, y); q.rotate(k === 3 ? (v2 - 0.5) * 1.4 : rot); q.drawImage(bloTex(k), -sz / 2, -sz / 2, sz, sz); q.restore();
    }
    q.restore();
    // 盛开时树下雪上落了几点花瓣
    if (stage === 2) for (let i = 0; i < 26; i++) { q.fillStyle = rgba(i % 3 ? '#c8102e' : '#e0304a', 0.75); q.beginPath(); q.ellipse(T.x + (r() - 0.5) * 300 * T.s, T.y - 4 * T.s + (r() - 0.3) * 40 * T.s, 3.2 * T.s + 1, 1.6 * T.s + 0.6, r() * 3, 0, TAU); q.fill(); }
  }
  // 前景（地面 + 梅林）三个阶段：A 冷、光枝；B 半暖、半开；C 暖、盛开
  const arFront = (stage) => K.cache('g13-arFront' + stage, W, H, 1, (q) => {
    if (stage === 0) arGround(q, false);
    else if (stage === 2) arGround(q, true);
    else { arGround(q, false); q.globalAlpha = 0.55; q.drawImage(K.cache('g13-arGroundW', W, H, 1, (p) => arGround(p, true)), 0, 0, W, H); q.globalAlpha = 1; }
    // 左上角留给歌词：梅枝不进 x<260、y<480
    q.save(); q.beginPath(); q.rect(-10, -10, W + 20, H + 20); q.rect(260, -10, -270, 490); q.clip('evenodd');
    for (const P of plumGen()) drawPlum(q, P, stage, stage > 0);
    q.restore();
  });
  // 日出、花开都定住以后，背景合成一张
  const arFinal = () => K.cache('g13-arFinal', W, H, 1, (q) => {
    q.drawImage(arSky(true), 0, 0, W, H);
    q.globalCompositeOperation = 'lighter'; A.glow(q, AR.sx, AR.sy, 260, '#ff8a50', 0.35); q.globalCompositeOperation = 'source-over';
    sunDisc(q, AR.sx, AR.sy, AR.sr, 0);
    q.drawImage(arBands(), AR.sx - 500, AR.sy - 150, 1000, 300);
    q.drawImage(arFront(2), 0, 0, W, H);
  });
  // 开花那一下：挑六十来朵在原位“一胀”
  let POPS = null;
  function popList() {
    if (POPS) return POPS;
    POPS = [];
    plumGen().slice(0, 2).forEach((P, ti) => P.fl.forEach(([x, y, v, v2], i) => { const wx = P.T.x + x * P.T.s, wy = P.T.y + y * P.T.s; if (v < 0.78 && i % (ti ? 5 : 7) === 0 && POPS.length < 64 && Math.hypot(wx - AR.sx, wy - AR.sy) > AR.sr + 34) POPS.push([wx, wy, Math.max(4.5, (10 + 7 * v2) * P.T.s), Math.floor(v2 * 3), h2(i, ti + 70)]); }));
    return POPS;
  }
  // 墨晕的红：边界不规则（大小两层起伏），边上一圈墨更浓，外沿一圈淡淡的洇；直接按多边形填，不贴大图
  const RHO = (() => { const n = 120, out = []; for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; out.push([Math.cos(a), Math.sin(a), 0.84 + 0.2 * (A.noise2(Math.cos(a) * 1.6 + 4, Math.sin(a) * 1.6 + 4, 3) - 0.5) + 0.1 * (A.noise2(Math.cos(a) * 5 + 9, Math.sin(a) * 5 + 9, 5) - 0.5)]); } return out; })();
  function redFront(g, R, rot) {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const path = (k) => { g.beginPath(); for (const [cx, cy, rr] of RHO) { const x = cx * cr - cy * sr, y = cx * sr + cy * cr; g.lineTo(AR.sx + x * rr * R * k, AR.sy + y * rr * R * k); } g.closePath(); };
    g.fillStyle = '#be002f'; path(1); g.fill();
    g.lineJoin = 'round'; g.lineCap = 'round';
    // 外沿洇开的淡红与几缕触须
    g.strokeStyle = 'rgba(224,110,130,0.2)'; g.lineWidth = Math.max(10, R * 0.11); path(1.04); g.stroke();
    g.strokeStyle = 'rgba(176,10,44,0.6)';
    for (let i = 0; i < 16; i++) { const j = Math.floor(h2(i, 801) * (RHO.length - 1)), [cx, cy, rr] = RHO[j], x = cx * cr - cy * sr, y = cx * sr + cy * cr, r0 = rr * R, L = R * (0.04 + 0.06 * h2(i, 802)), b = (h2(i, 803) - 0.5) * 0.4;
      g.lineWidth = Math.max(1.5, R * 0.006 * (1 + h2(i, 804))); g.beginPath(); g.moveTo(AR.sx + x * r0, AR.sy + y * r0); g.quadraticCurveTo(AR.sx + x * (r0 + L * 0.6) - y * L * b, AR.sy + y * (r0 + L * 0.6) + x * L * b, AR.sx + x * (r0 + L), AR.sy + y * (r0 + L)); g.stroke(); }
    g.strokeStyle = 'rgba(210,60,90,0.45)'; g.lineWidth = Math.max(6, R * 0.05); path(1.02); g.stroke();
    g.strokeStyle = 'rgba(110,0,24,0.7)'; g.lineWidth = Math.max(3, R * 0.012); path(0.99); g.stroke();
    g.strokeStyle = 'rgba(150,0,30,0.32)'; g.lineWidth = Math.max(6, R * 0.04); path(0.955); g.stroke();
  }
  // 红从日心铺开：返回贴图半径（日心坐标系）；>=1600 视为铺满
  const redReach = (lt, tRed) => 1640 * Math.pow(ramp(lt, tRed, tRed + 0.6), 0.8);
  // 喜瓣：大红带金边
  // 喜瓣：梅瓣的形（圆，尖上一个小凹），深浅三种红，边上一线逆光的粉，根上一点金
  const petalTexR = (k) => K.cache('g13-xipetal3' + k, 36, 36, 1, (q) => {
    q.translate(18, 18);
    const col = ['#e0142e', '#f22a3c', '#c00a26'][k];
    const shape = () => { q.beginPath(); q.moveTo(0, 15); q.bezierCurveTo(-13, 13, -16, -6, -7, -13); q.quadraticCurveTo(-3, -15, 0, -11); q.quadraticCurveTo(3, -15, 7, -13); q.bezierCurveTo(16, -6, 13, 13, 0, 15); q.closePath(); };
    q.fillStyle = K.rad(q, 0, 2, 1, 16, [[0, mix(col, '#ff8a8a', 0.35)], [0.7, col], [1, mix(col, '#6a0010', 0.3)]]); shape(); q.fill();
    q.strokeStyle = 'rgba(255,186,176,0.8)'; q.lineWidth = 1.2; shape(); q.stroke();
    q.strokeStyle = 'rgba(120,0,20,0.35)'; q.lineWidth = 0.8;
    for (const dx of [-5, 0, 5]) { q.beginPath(); q.moveTo(0, 13); q.quadraticCurveTo(dx * 0.6, 2, dx, -9); q.stroke(); }
    q.fillStyle = 'rgba(255,214,110,0.85)'; q.beginPath(); q.ellipse(0, 12, 3, 2, 0, 0, TAU); q.fill();
  });
  // 一拍一阵风：拍点上往左推一下，之后停住（单调累加，无状态）
  function gustAt(c, tq) {
    let k = c.b.i;
    for (let j = 0; j < 12 && k > 0 && c.grid.time(k) > tq; j++) k--;
    const s = tq - c.grid.time(k);
    return k + easeOut(clamp(s / 0.4));
  }
  // 大雪：远、中、近三层；红漫到哪片雪，哪片雪就化成喜瓣（mode 'snow' 画雪，'petal' 画瓣）
  const NFL = 250;
  function flakeAt(i, tq, G) {
    const z = h2(i, 501), near = z > 0.82, mid = z > 0.45;
    const vy = near ? 170 + 70 * h2(i, 506) : mid ? 60 + 36 * h2(i, 506) : 34 + 16 * h2(i, 506);
    const vx = -(14 + 50 * z), gx = -G * (5 + 24 * z);
    const x = ((h2(i, 504) * (W + 160) + vx * tq + gx + Math.sin(tq * (0.6 + h2(i, 505)) + i) * (4 + 14 * z)) % (W + 160) + W + 160) % (W + 160) - 80;
    const y = ((h2(i, 503) * (H + 60) + vy * tq) % (H + 60) + H + 60) % (H + 60) - 30;
    return [x, y, z];
  }
  // 每片雪被红漫到的时刻（只与本帧的 c 有关，一帧里算一次给两种画法共用）
  function flakeTc(c, lt, tRed) {
    const tR = c.t - lt + tRed, GR = gustAt(c, tR), out = new Float64Array(NFL);
    for (let i = 0; i < NFL; i++) { const [x0, y0] = flakeAt(i, tR, GR); out[i] = tR + 0.6 * Math.pow(clamp(Math.hypot(x0 - AR.sx, y0 - AR.sy) / 1380), 1.25) + 0.05 * h2(i, 507); }
    return out;
  }
  function arFlakes(g, c, lt, tRed, mode, TC) {
    const t = c.t, t0 = c.t - lt, tR = t0 + tRed, G = gustAt(c, t), spr = XYT.sprites.glow;
    const m = mode === 'petal' ? V.util.Mx(g) : null;
    for (let i = 0; i < NFL; i++) {
      const tc = TC ? TC[i] : 1e9;
      if (mode === 'snow') {
        if (t >= tc) continue;
        const [x, y, z] = flakeAt(i, t, G);
        if (z > 0.82) { const w = 7 + 9 * h2(i, 508), L = w * 1.7; g.globalAlpha = 0.55; g.drawImage(spr, x - w / 2, y - L / 2, w, L); }
        else { const rr = z > 0.45 ? 2.6 + 3 * h2(i, 508) : 1.2 + 1.4 * h2(i, 508); g.globalAlpha = z > 0.45 ? 0.82 : 0.6; g.drawImage(spr, x - rr, y - rr, rr * 2, rr * 2); }
      } else {
        if (t < tc) continue;
        const [xc, yc, z] = flakeAt(i, tc, gustAt(c, tc)), a = t - tc;
        const x = xc - (24 + 50 * z) * a + Math.sin(t * (0.9 + h2(i, 511)) + i) * (6 + 16 * z), y = yc + (26 + 56 * z) * a;
        const pop = clamp(a / 0.2), sz = lerp(12, 34, z) * (0.5 + 0.5 * easeOut(pop)) * (1 + 0.25 * Math.sin(PI * pop));
        g.globalAlpha = 0.75 + 0.25 * z;
        V.util.putR(g, m, petalTexR(i % 3), x, y, sz, sz, t * (1 + h2(i, 512)) + i, Math.cos(t * 2.2 * (0.6 + h2(i, 513)) + i));
        V.util.reset(g, m);
        if (pop < 1) { g.globalAlpha = 0.7 * (1 - pop); g.drawImage(XYT.sprites.tint(spr, '#ffd890'), x - sz * 0.6, y - sz * 0.6, sz * 1.2, sz * 1.2); }
      }
    }
    // 另有一百来片：红的前沿走过时，从梅枝、从空中绽出
    if (mode === 'petal') {
      for (let i = 0; i < 90; i++) {
        const x0 = 180 + h2(i, 601) * 1120, y0 = 40 + h2(i, 602) * 600, d = Math.hypot(x0 - AR.sx, y0 - AR.sy), tc = tR + 0.6 * Math.pow(clamp(d / 1380), 1.25) + 0.08 * h2(i, 603);
        if (t < tc) continue;
        const z = 0.3 + 0.7 * h2(i, 604), a = t - tc, x = x0 - (40 + 60 * z) * a + Math.sin(t * 1.1 + i) * 10 * z, y = y0 + (20 + 40 * z) * a - 30 * a * Math.exp(-a * 2);
        const pop = clamp(a / 0.25), sz = lerp(14, 30, z) * easeOut(pop);
        g.globalAlpha = 0.85;
        V.util.putR(g, m, petalTexR((i + 1) % 3), x, y, sz, sz, t * (0.8 + h2(i, 605)) + i * 2, Math.cos(t * 2 * (0.6 + h2(i, 606)) + i));
        V.util.reset(g, m);
      }
    }
    g.globalAlpha = 1;
  }
  // 红盖头：一方大红绸在风里翻飞——四角各自起落（轮廓不成方块），波纹从前缘往后缘走，中间一道折痕；金边、后缘流苏、角上金坠
  function veilCloth(g, t, cx, cy, S, rot) {
    const N = 12;
    const cor = [[-0.5, -0.5, 0.0], [0.5, -0.5, 1.7], [0.5, 0.5, 3.1], [-0.5, 0.5, 4.6]].map(([u, v, ph]) => [u * S + Math.cos(t * 1.9 + ph) * 0.2 * S, v * S * 0.7 + Math.sin(t * 2.3 + ph * 1.3) * 0.26 * S]);
    const pt = (u, v) => {
      const a = u + 0.5, b = v + 0.5;
      const x = (1 - a) * (1 - b) * cor[0][0] + a * (1 - b) * cor[1][0] + a * b * cor[2][0] + (1 - a) * b * cor[3][0];
      const y = (1 - a) * (1 - b) * cor[0][1] + a * (1 - b) * cor[1][1] + a * b * cor[2][1] + (1 - a) * b * cor[3][1];
      const cb = Math.cos(PI * b), ca = Math.cos(PI * a);
      return [x - (a - 0.5) * Math.sin(PI * b) * ca * ca * 0.16 * S, y + Math.sin(a * 6 - t * 6.4 + b * 1.6) * 0.07 * S * (0.3 + a) - Math.sin(PI * a) * Math.sin(PI * b) * 0.12 * S + Math.sin(PI * a) * cb * cb * (0.07 + 0.03 * Math.sin(t * 3 + a * 4)) * S];
    };
    g.save(); g.translate(cx, cy); g.rotate(rot);
    const edge = [];
    for (let i = 0; i <= N; i++) edge.push(pt(i / N - 0.5, -0.5));
    for (let j = 1; j <= N; j++) edge.push(pt(0.5, j / N - 0.5));
    for (let i = N - 1; i >= 0; i--) edge.push(pt(i / N - 0.5, 0.5));
    for (let j = N - 1; j >= 1; j--) edge.push(pt(-0.5, j / N - 0.5));
    const shape = () => { g.beginPath(); edge.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
    const p0 = pt(-0.5, 0), p1 = pt(0.5, 0), gr = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
    for (let k = 0; k <= 14; k++) { const a = k / 14, sl = Math.cos(a * 6 - t * 6.4) * (0.3 + a); gr.addColorStop(a, sl < 0 ? mix('#c8102e', '#ff5a3a', clamp(-sl * 0.75)) : mix('#c8102e', '#50040e', clamp(sl * 0.65))); }
    g.fillStyle = gr; shape(); g.fill();
    // 一道斜的折痕：亮一线、暗一片
    const f0 = pt(-0.3, -0.5), f1 = pt(0.25, 0.5), fm = pt(0, 0);
    g.save(); shape(); g.clip();
    g.strokeStyle = 'rgba(70,0,14,0.35)'; g.lineWidth = S * 0.12; g.beginPath(); g.moveTo(f0[0], f0[1]); g.quadraticCurveTo(fm[0] + S * 0.06, fm[1], f1[0], f1[1]); g.stroke();
    g.strokeStyle = 'rgba(255,130,100,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(f0[0] - 6, f0[1]); g.quadraticCurveTo(fm[0] - S * 0.02, fm[1], f1[0] - 6, f1[1]); g.stroke();
    // 几朵金线团花
    g.fillStyle = 'rgba(242,190,69,0.55)';
    for (const [u, v] of [[-0.22, -0.18], [0.2, 0.16], [0.18, -0.26], [-0.2, 0.24]]) { const p = pt(u, v); g.beginPath(); g.arc(p[0], p[1], S * 0.025, 0, TAU); g.fill(); }
    g.restore();
    g.strokeStyle = '#f2be45'; g.lineWidth = 2.4; g.lineJoin = 'round'; shape(); g.stroke();
    g.restore();
    // 后缘的流苏、角上金坠（屏幕向下垂）
    g.strokeStyle = 'rgba(242,190,69,0.85)'; g.lineWidth = 1.1; g.lineCap = 'round';
    const cr = Math.cos(rot), sr = Math.sin(rot), W2 = (p) => [cx + p[0] * cr - p[1] * sr, cy + p[0] * sr + p[1] * cr];
    for (let i = 0; i <= N * 2; i++) { const v = i / (N * 2) - 0.5, p = W2(pt(0.5, v)), sw = Math.sin(t * 3 + i) * 3; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + 6 + sw, p[1] + 11); g.stroke(); }
    for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) { const p = W2(pt(u, v)), sw = Math.sin(t * 2.6 + u * 3) * 4; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + sw, p[1] + 18); g.stroke(); g.fillStyle = '#ffd060'; g.beginPath(); g.arc(p[0] + sw, p[1] + 20, 2.8, 0, TAU); g.fill(); }
  }
  // 盖头的路：左上天外飘下，“都”字掠过日轮，“成”字前飘到右上远去（让开成亲的两人）
  function veilPos(lt, tDu, tCheng) {
    const K0 = [[tDu - 0.35, -120, -150], [tDu, 560, 90], [tDu + 0.34, AR.sx - 10, AR.sy - 6], [tCheng - 0.02, 1150, 168], [tCheng + 0.4, 1460, 30]];
    if (lt <= K0[0][0] || lt >= K0[4][0]) return null;
    let k = 0; while (k < 3 && lt > K0[k + 1][0]) k++;
    const a = K0[k], b = K0[k + 1], u = ramp(lt, a[0], b[0]), e = k === 0 ? easeOut(u) : k === 3 ? easeIn(u) : easeInOut(u) * 0.5 + u * 0.5;
    return [lerp(a[1], b[1], e), lerp(a[2], b[2], e), k + u];
  }
  // 成亲那夜的两人：婚服红金，相对而立，中间牵一条红绸、一朵绸花；灵儿戴凤冠（缓存）
  const weddingPair = () => K.cache('g13-weddingPair3', 460, 380, 1, (q) => {
    const base = { wind: 0.25, rim: '#ffd890', light: [520, 60], night: true };
    const xo = { stage: 'wedding', pose: 'stand', facing: 1, head: 0.08 }, lo = { pose: 'stand', facing: -1, tone: 'silhouette', ink: '#b0182a', head: 0.2 };
    F.draw(q, 'xiaoyao', 194, 360, 1.5, 0, Object.assign(xo, base));
    F.draw(q, 'linger', 268, 360, 1.5, 0, Object.assign(lo, base));
    const PX = F.points('xiaoyao', 194, 360, 1.5, 0, xo), PL = F.points('linger', 268, 360, 1.5, 0, lo);
    // 牵红：一条红绸从他手里垂到她手里，当中一朵大红绸花
    const a = PX.handN, b = PL.handN, mx = (a[0] + b[0]) / 2, my = Math.max(a[1], b[1]) + 34;
    q.strokeStyle = '#d0202a'; q.lineWidth = 3.2; q.lineCap = 'round';
    q.beginPath(); q.moveTo(a[0], a[1]); q.quadraticCurveTo(lerp(a[0], mx, 0.5), my, mx, my - 6); q.quadraticCurveTo(lerp(mx, b[0], 0.5), my, b[0], b[1]); q.stroke();
    q.fillStyle = K.rad(q, mx - 2, my - 9, 1, 11, [[0, '#ff6a4a'], [1, '#b0101e']]); q.beginPath(); q.arc(mx, my - 6, 10, 0, TAU); q.fill();
    q.strokeStyle = 'rgba(255,214,120,0.8)'; q.lineWidth = 1; for (let k = 0; k < 5; k++) { const an = (k / 5) * TAU; q.beginPath(); q.arc(mx + Math.cos(an) * 4, my - 6 + Math.sin(an) * 4, 4.5, an - 1, an + 1); q.stroke(); }
    // 凤冠：金色冠顶、两侧垂珠
    const hx = PL.top[0] + 2, hy = PL.top[1] + 5;
    q.fillStyle = '#e8b04a'; q.beginPath(); q.moveTo(hx - 14, hy + 7); q.quadraticCurveTo(hx - 13, hy - 10, hx, hy - 15); q.quadraticCurveTo(hx + 13, hy - 10, hx + 14, hy + 7); q.closePath(); q.fill();
    q.fillStyle = '#ffe28a'; for (let k = -2; k <= 2; k++) { q.beginPath(); q.arc(hx + k * 5, hy - 6 - (2 - Math.abs(k)) * 2.5, 1.8, 0, TAU); q.fill(); }
    q.strokeStyle = 'rgba(255,220,130,0.85)'; q.lineWidth = 0.9;
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const x = hx + sd * (12 + k * 2.5); q.beginPath(); q.moveTo(x, hy + 4); q.lineTo(x, hy + 16 + k * 3); q.stroke(); q.fillStyle = '#ffd870'; q.beginPath(); q.arc(x, hy + 17 + k * 3, 1.3, 0, TAU); q.fill(); }
  });
  function plumWide(g, c, lt, k0) {
    const t = c.t, tSun = rel(c, 8, 3.44), tFen = rel(c, 9, 3.82), tDu = rel(c, 11, 4.92), tCheng = rel(c, 12, 5.56), tRed = rel(c, 13, 6.0);
    const rise = easeOut(ramp(lt, tSun - 0.06, tSun + 0.55)), warm = smooth(ramp(lt, tSun - 0.1, tSun + 0.7));
    const bloom = ramp(lt, tSun + 0.02, tSun + 0.62);
    const sunY = lerp(AR.hz + 76, AR.sy, rise), burst = lt >= tSun ? Math.exp(-(lt - tSun) / 0.45) : 0;
    const settled = lt > tSun + 0.72;
    // 背景
    if (settled) g.drawImage(arFinal(), 0, 0, W, H);
    else {
      if (warm < 1) g.drawImage(arSky(false), 0, 0, W, H);
      if (warm > 0) { g.globalAlpha = warm; g.drawImage(arSky(true), 0, 0, W, H); g.globalAlpha = 1; }
      // 日出前天边一抹红在呼吸
      add(g, () => glow(g, AR.sx, AR.hz + 10, 300 + 60 * Math.sin(t * 1.6), '#ff7a6a', (0.18 + 0.2 * smooth(ramp(lt, k0, tSun))) * (1 - rise)));
      if (rise > 0) {
        add(g, () => glow(g, AR.sx, sunY, 260, '#ff8a50', 0.35 * rise));
        sunDisc(g, AR.sx, sunY, AR.sr, 0);
      }
      g.globalAlpha = 0.4 + 0.6 * warm; g.drawImage(arBands(), AR.sx - 500, AR.sy - 150, 1000, 300); g.globalAlpha = 1;
      if (bloom <= 0) g.drawImage(arFront(0), 0, 0, W, H);
      else if (bloom < 0.5) { g.drawImage(arFront(0), 0, 0, W, H); g.globalAlpha = smooth(bloom / 0.5); g.drawImage(arFront(1), 0, 0, W, H); g.globalAlpha = 1; }
      else { g.drawImage(arFront(1), 0, 0, W, H); g.globalAlpha = smooth((bloom - 0.5) / 0.5); g.drawImage(arFront(2), 0, 0, W, H); g.globalAlpha = 1; }
      // 花一朵朵胀开
      if (bloom > 0 && bloom < 1) for (const [x, y, sz, k, hh] of popList()) {
        const b = clamp((bloom - hh * 0.45) / 0.4); if (b <= 0 || b >= 1) continue;
        const s2 = sz * (easeOut(b) * 1.45 - 0.45 * b * b); g.globalAlpha = 1 - 0.5 * b; g.drawImage(bloTex(k), x - s2 / 2, y - s2 / 2, s2, s2);
      }
      g.globalAlpha = 1;
    }
    // 日轮的光随拍呼吸；跃出那一下一阵亮
    if (rise > 0) add(g, () => { glow(g, AR.sx, sunY, 150 + 40 * beatE(c, 0.4), '#ffd0a0', 0.25 + 0.15 * beatE(c, 0.4)); if (burst > 0.01) { glow(g, AR.sx, sunY, 500 * (1 - 0.4 * burst), '#ffe0b0', 0.55 * burst); glow(g, AR.sx, sunY, 140, '#ffffff', 0.5 * burst); } });
    // 他：墨色大氅立在梅林前，面向日出；长长的影子拖向左下（人物层慢慢拉远）
    const fs = lerp(1.0, 0.84, smooth(ramp(lt, k0, k0 + 5.2))), fx = 420, fy = 654, wind = 0.55 + 0.25 * beatE(c, 0.5);
    g.fillStyle = K.lin(g, fx, fy, fx - 300 * fs, fy + 70 * fs, [[0, rgba(warm > 0.5 ? '#5a2a50' : '#2a2c50', 0.42)], [1, 'rgba(60,30,60,0)']]);
    g.beginPath(); g.moveTo(fx - 16 * fs, fy); g.lineTo(fx + 18 * fs, fy + 2); g.lineTo(fx - 300 * fs, fy + 76 * fs); g.lineTo(fx - 330 * fs, fy + 62 * fs); g.closePath(); g.fill();
    elder(g, fx, fy, fs, t, { pose: 'stand', facing: 1, wind, windDir: -1, rim: warm > 0.3 ? '#ffb48a' : '#b8bce0', light: [AR.sx, AR.sy], rimAlpha: 0.9, seed: 5, head: -0.06, cloakRim: warm > 0.3 ? '#ff9a80' : '#9aa0c8', cloakLen: 0.9 });
    // 红盖头：“都”字从天上掠过日轮
    const vp = veilPos(lt, tDu, tCheng);
    if (vp) {
      const [vx, vy, ph] = vp, S = 150 + 10 * Math.sin(t * 1.3);
      veilCloth(g, t, vx, vy + Math.sin(t * 1.7) * 8, S, -0.3 + ph * 0.2 + Math.sin(t * 1.2) * 0.12);
      const d = Math.hypot(vx - AR.sx, vy - AR.sy);
      if (d < 170) add(g, () => glow(g, AR.sx, AR.sy, 110, '#ffb070', 0.5 * (1 - d / 170)));
    }
    // 成亲那夜的两人：“成”字在日边天上叠化半秒
    const ghost = bell(lt, tCheng - 0.08, tCheng + 0.55);
    if (ghost > 0.01) {
      add(g, () => { glow(g, 760, 250, 240, '#ffb060', 0.35 * ghost); glow(g, 760, 240, 100, '#fff0c8', 0.25 * ghost); });
      g.globalAlpha = 0.92 * ghost; g.drawImage(weddingPair(), 740 - 230, 390 - 360 - 6 * ghost, 460, 380); g.globalAlpha = 1;
    }
    // 雪（还没化的）
    const TC = lt > tRed - 0.05 ? flakeTc(c, lt, tRed) : null;
    arFlakes(g, c, lt, tRed, 'snow', TC);
    // 天地皆红：红从日心像墨一样晕开，一路染满
    const R = redReach(lt, tRed);
    if (R > 1) {
      const ma = lerp(0.72, 0.86, ramp(lt, tRed, tRed + 0.7));
      g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = ma;
      if (R < 1630) redFront(g, R, 0.4 * ramp(lt, tRed, tRed + 0.6));
      else { g.fillStyle = '#be002f'; g.fillRect(-10, -10, W + 20, H + 20); }
      g.restore();
      // 金：日轮转成金红，日晕与几点金光
      const gk = smooth(ramp(lt, tRed + 0.05, tRed + 0.7));
      add(g, () => { glow(g, AR.sx, AR.sy, 420, '#ff9a30', 0.3 * gk); glow(g, AR.sx, AR.sy, 170, '#ffd070', 0.45 * gk); });
      g.globalAlpha = gk; sunDisc(g, AR.sx, AR.sy, AR.sr, 1); g.drawImage(arBands(), AR.sx - 500, AR.sy - 150, 1000, 300); g.globalAlpha = 1;
      if (gk > 0) add(g, () => { for (let i = 0; i < 26; i++) { const x = 260 + h2(i, 701) * 1000, y = 60 + h2(i, 702) * 600, f = Math.pow(Math.max(0, Math.sin(t * (1.5 + 2 * h2(i, 703)) + i * 2.1)), 6); if (f > 0.05) glow(g, x, y, 10 + 14 * h2(i, 704), '#ffd27a', gk * f * 0.8); } });
      arFlakes(g, c, lt, tRed, 'petal', TC);
    }
  }

  XYT.registerShot('c3_allred', {
    name: '天地皆红', zone: 'left', night: false, text: '#f6efe6', shadow: 'rgba(40,6,10,0.92)', accent: '#f2be45', bloom: 0.45,
    draw(g, c) {
      const lt = c.lt, kB = rel(c, 7, 2.94);
      if (lt < kB) {
        eyeClose(g, c, lt);
        // 远景的贴图在特写里分几帧预先备好，切过去时不卡
        if (lt > 0.6) arSky(false); if (lt > 0.9) arFront(0); if (lt > 1.2) arSky(true); if (lt > 1.5) arFront(1); if (lt > 1.8) arFront(2); if (lt > 2.1) arFinal(); if (lt > 2.3) weddingPair();
      } else plumWide(g, c, lt, kB);
      if (lt >= kB && lt < kB + 0.3) flash(g, lt - kB, '#ffffff', 0.4);
    },
  });
})();
