/* 第三版镜头组 fg6：d4_hilldrunk, e1_stormpeak, e3_temple */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, h2, rgba, mix, noise1, rng } = A;

  // ---------------- 公用 ----------------
  // 第 off 句第 k 字唱出的时刻（相对镜头起点）；取不到时用分镜表里的秒数
  const charAt = (c, k, off, fb) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? fb[k] : v - (c.t - c.lt);
  };
  // 柔光点贴图（按颜色缓存）
  function glowTex(col) {
    return K.cache('fg6_glow_' + col, 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.16, rgba(col, 0.6)); gr.addColorStop(0.42, rgba(col, 0.18)); gr.addColorStop(0.7, rgba(col, 0.05)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  function softTex(col) {
    return K.cache('fg6_soft_' + col, 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.45, rgba(col, 0.62)); gr.addColorStop(0.78, rgba(col, 0.18)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  const putGlow = (g, tex, x, y, r) => g.drawImage(tex, x - r, y - r, 2 * r, 2 * r);
  const pmod = (a, m) => ((a % m) + m) % m;
  // 把低分辨率贴图放大成与输出分辨率一致的缓存：之后整像素贴图最省（缩放或小数位贴图要慢约十倍）
  const up = (key, w, h, src) => K.cache(key + '@1', w, h, 1, (g) => g.drawImage(src(), 0, 0, w, h));
  // 平滑折线 → 路径（二次曲线过中点）
  function smoothTo(p, pts, start) {
    if (start) p.moveTo(pts[0][0], pts[0][1]); else p.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    p.lineTo(l[0], l[1]);
    return p;
  }
  // 折线插值：pts 按 x 递增
  function polyY(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; const u = (x - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], u * u * (3 - 2 * u)); }
    }
    return pts[pts.length - 1][1];
  }
  // 中点位移法生成闪电主干与分枝（只用确定的随机数）
  function boltPaths(seed, x0, y0, x1, y1, o) {
    const r = rng(seed);
    const main = [[x0, y0], [x1, y1]];
    const dev = o.dev || 0.22;
    let pts = main;
    for (let lv = 0; lv < 7; lv++) {
      const np = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
        const d = (r() - 0.5) * 2 * dev * len;
        np.push([(a[0] + b[0]) / 2 + nx * d, (a[1] + b[1]) / 2 + ny * d]);
        np.push(b);
      }
      pts = np;
    }
    const out = [{ pts, w: 1 }];
    const nb = o.branches || 4;
    for (let k = 0; k < nb; k++) {
      const i0 = Math.floor((0.12 + r() * 0.55) * (pts.length - 1));
      const a = pts[i0];
      const dir = (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.5);
      const len = (0.18 + r() * 0.22) * Math.hypot(x1 - x0, y1 - y0);
      let bx = a[0] + Math.sin(dir) * len, by = a[1] + Math.cos(dir) * len * 0.9;
      if (o.maxX != null) bx = Math.min(bx, o.maxX);
      let bp = [a, [bx, by]];
      for (let lv = 0; lv < 5; lv++) {
        const np = [bp[0]];
        for (let i = 1; i < bp.length; i++) {
          const p = bp[i - 1], q = bp[i];
          const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
          const nx = -(q[1] - p[1]) / (l || 1), ny = (q[0] - p[0]) / (l || 1);
          const d = (r() - 0.5) * 2 * 0.25 * l;
          np.push([(p[0] + q[0]) / 2 + nx * d, (p[1] + q[1]) / 2 + ny * d]);
          np.push(q);
        }
        bp = np;
      }
      out.push({ pts: bp, w: 0.45 + r() * 0.2 });
    }
    return out;
  }
  // 闪电贴图：外层蓝白柔光 + 中层 + 白芯（建缓存时画好，播放时只改透明度）
  function boltTex(key, segs, box, fadeTop, ws, pal) {
    const sw = ws || 1;
    const P = pal || ['#7d96d8', '#b8c9f4', '#eef3ff', '#ffffff'];
    const [bx, by, bw, bh] = box;
    return K.cache(key, bw, bh, 1, (g) => {
      g.translate(-bx, -by);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const pass = (col, lw, a, blur) => {
        g.filter = blur ? 'blur(' + blur + 'px)' : 'none';
        for (const sgm of segs) {
          g.strokeStyle = rgba(col, a * (sgm.w < 1 ? 0.75 : 1)); g.lineWidth = lw * sgm.w * sw;
          g.beginPath(); sgm.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
        }
      };
      pass(P[0], 14, 0.35, 8);
      pass(P[1], 5, 0.7, 2);
      pass(P[2], 2.4, 1, 0);
      pass(P[3], 1.1, 1, 0);
      g.filter = 'none';
      // 上端从云里透出来：顶部一段渐隐
      if (fadeTop != null) {
        g.globalCompositeOperation = 'destination-in';
        const gr = g.createLinearGradient(0, fadeTop, 0, fadeTop + 110);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gr; g.fillRect(bx, by, bw, bh);
        g.globalCompositeOperation = 'source-over';
      }
    });
  }

  // ============================================================
  // d4_hilldrunk（第31、32句）：冬夜雪坡老树下，老人背坐；山谷小镇放飞孔明灯，镜头随灯上移，厚云从右压来吞月
  // ============================================================
  (function () {
    const FB1 = [0.182, 0.542, 1.142, 1.842, 2.262, 2.742, 3.122];
    const FB2 = [3.542, 3.862, 4.922];
    const MAN = { x: 330, y: 620, h: 330 };
    const MOON = { x: 640, y: 120, r: 34 };
    const BODY = '#121826', RIM = '#d2dcef';
    const WARM = '#f2b765', WARM2 = '#f7d98f';
    // 前景雪坡顶线（老人坐处一段放平）
    const HILL = [[-30, 600], [90, 606], [220, 618], [262, 620], [410, 620], [462, 626], [520, 646], [575, 680], [625, 728], [660, 790]];
    // 远山：一座双峰的大山（月左）、月下一道低缓的山鞍、月右一座孤尖峰、歌词区里几道极低的远丘——与别的镜头的群峰轮廓不同
    // 主峰（受光面判定用）：月左的峰右坡受光，月右的峰左坡受光
    const RIDGE = [
      [-40, 432], [20, 410], [70, 386], [110, 360], [150, 342], [184, 322], [210, 302], [236, 316], [262, 308], [292, 332], [330, 356],
      [372, 374], [412, 394], [452, 412], [500, 428], [560, 440], [620, 446], [680, 443], [740, 432], [790, 410], [830, 378], [860, 348],
      [880, 326], [896, 314], [912, 324], [936, 348], [964, 380], [1002, 410], [1044, 432], [1100, 447], [1160, 452], [1220, 448], [1320, 458],
    ];
    const SUMMITS = [[210, 302], [262, 308], [896, 314]];
    const sky = () => K.cache('fg6_d4_sky', W, 900, 0.25, (g) => {
      // 世界坐标 y = -160 .. 740
      g.translate(0, 160);
      const gr = g.createLinearGradient(0, -160, 0, 740);
      gr.addColorStop(0, '#090d1a'); gr.addColorStop(0.24, '#0e1323'); gr.addColorStop(0.47, '#151d33');
      gr.addColorStop(0.62, '#1f2a44'); gr.addColorStop(0.72, '#2a3756'); gr.addColorStop(1, '#28324c');
      g.fillStyle = gr; g.fillRect(0, -160, W, 900);
    });
    const halo = () => K.cache('fg6_d4_halo', 640, 640, 0.25, (g) => {
      const gr = g.createRadialGradient(320, 320, 30, 320, 320, 320);
      gr.addColorStop(0, 'rgba(170,190,222,0.42)'); gr.addColorStop(0.12, 'rgba(120,145,190,0.22)');
      gr.addColorStop(0.35, 'rgba(70,92,140,0.09)'); gr.addColorStop(1, 'rgba(40,60,100,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 640, 640);
    });
    const moonDisc = () => K.cache('fg6_d4_moon', 96, 96, 2, (g) => {
      const R = MOON.r, cx = 48, cy = 48;
      const gr = g.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, R);
      gr.addColorStop(0, '#fbfcff'); gr.addColorStop(0.75, '#e9eef6'); gr.addColorStop(1, '#cdd6e6');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      // 月海：几块很淡的灰影
      const mar = [[-10, -8, 11, 0.16], [6, -12, 8, 0.12], [9, 4, 12, 0.13], [-6, 10, 7, 0.1], [-16, 4, 6, 0.08]];
      for (const [dx, dy, rr, a] of mar) {
        const m = g.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, rr);
        m.addColorStop(0, `rgba(120,132,156,${a})`); m.addColorStop(1, 'rgba(120,132,156,0)');
        g.fillStyle = m; g.fillRect(0, 0, 96, 96);
      }
      g.restore();
    });

    // 星：月旁与近地平线处变淡
    const STARS = [];
    {
      const r = rng(7741);
      for (let i = 0; i < 200; i++) {
        const x = r() * W, y = -160 + r() * 590;
        const d = Math.hypot(x - MOON.x, y - MOON.y);
        const k = clamp((d - 70) / 260) * clamp((450 - y) / 120);
        if (k < 0.05) continue;
        const big = r();
        STARS.push({ x, y, s: 0.7 + big * big * big * 1.5, a: (0.3 + 0.6 * r()) * k, f: 0.25 + r() * 0.7, ph: r() * TAU, big: big > 0.93 });
      }
    }

    // 远山：干笔水墨——轮廓边缘带细碎的笔触起伏，坡面是一笔笔顺坡而下、时断时续的竖向皴擦（迎月坡浅、背月坡深），
    // 山顶迎月一侧一道断续的雪光，山脚没进一条软雾带（y 约 450–490）
    const farMtn = () => K.cache('fg6_d4_far', W, 300, 1, (g) => {
      // 世界 y = 300 .. 600
      g.translate(0, -300);
      const r = rng(4242);
      // 细化轮廓：中点位移（只在建缓存时算一次）
      let P = RIDGE.map((q) => [q[0], q[1]]);
      for (let lv = 0; lv < 4; lv++) {
        const np = [P[0]];
        for (let i = 1; i < P.length; i++) {
          const a = P[i - 1], b = P[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          np.push([(a[0] + b[0]) / 2 + (r() - 0.5) * len * 0.05, (a[1] + b[1]) / 2 + (r() - 0.5) * len * 0.16]);
          np.push(b);
        }
        P = np;
      }
      const ry = (x) => { for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const a = P[i - 1], b = P[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1)); } return P[P.length - 1][1]; };
      // 每一处坡面属于哪座峰、是否迎月：坡向朝月的一侧受光
      const owner = (x) => { let best = SUMMITS[0][0]; for (const [sx] of SUMMITS) if (Math.abs(sx - x) < Math.abs(best - x)) best = sx; return best; };
      const litAt = (x) => {
        const sx = owner(x), toMoon = Math.sign(MOON.x - sx) || 1;
        const onSide = Math.sign(x - sx) || toMoon;
        return onSide === toMoon ? 1 : 0;
      };
      const body = new Path2D();
      body.moveTo(P[0][0], 600); P.forEach((q) => body.lineTo(q[0], q[1])); body.lineTo(P[P.length - 1][0], 600); body.closePath();
      // 更远的一层：在山鞍后面露出几座淡淡的峰尖
      const back = new Path2D();
      back.moveTo(380, 600);
      [[380, 440], [420, 420], [456, 404], [490, 392], [516, 380], [540, 386], [566, 398], [604, 408], [640, 402], [676, 390], [700, 384], [726, 392], [760, 404], [800, 414], [850, 430], [900, 600]].forEach((q) => back.lineTo(q[0], q[1]));
      back.closePath();
      g.filter = 'blur(1.2px)';
      g.fillStyle = 'rgba(78,94,128,0.55)'; g.fill(back);
      g.filter = 'blur(0.7px)';
      const sh = g.createLinearGradient(0, 300, 0, 505);
      sh.addColorStop(0, '#46557a'); sh.addColorStop(0.4, '#34425f'); sh.addColorStop(1, '#2b3752');
      g.fillStyle = sh; g.fill(body);
      g.filter = 'none';
      g.save(); g.clip(body);
      // 坡面的明暗：迎月坡从山脊往下渐淡的一层冷白，背月坡一层渐淡的暗青（先画在一张临时画布上，整体模糊一次，软边）
      {
        const c2 = document.createElement('canvas'); c2.width = g.canvas.width; c2.height = g.canvas.height;
        const q = c2.getContext('2d'); q.setTransform(g.getTransform());
        for (let x = -40; x < 1320; x += 4) {
          const lit = litAt(x), y0 = ry(x), sx = owner(x);
          const near = clamp(1 - Math.abs(x - sx) / 300);
          const d = Math.min(160, 505 - y0);
          const gr = q.createLinearGradient(0, y0, 0, y0 + d);
          if (lit) { gr.addColorStop(0, `rgba(156,176,210,${0.3 + 0.28 * near})`); gr.addColorStop(0.45, 'rgba(120,140,180,0.16)'); gr.addColorStop(1, 'rgba(110,130,170,0)'); }
          else { gr.addColorStop(0, `rgba(14,20,38,${0.22 + 0.2 * near})`); gr.addColorStop(0.5, 'rgba(14,20,38,0.12)'); gr.addColorStop(1, 'rgba(14,20,38,0)'); }
          q.fillStyle = gr; q.fillRect(x, y0 - 2, 4.4, d + 2);
        }
        const m = g.getTransform();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.filter = 'blur(' + (3 * m.a).toFixed(2) + 'px)';
        g.drawImage(c2, 0, 0);
        g.filter = 'none';
        g.setTransform(m);
      }
      // 干笔皴擦：一组组短笔顺着坡面的落水线（从峰顶向外放射）往下擦，笔锋分成几丝、时断时续；越往下越稀、越淡，没进雾里
      g.lineCap = 'round';
      const summitOf = (x) => { let best = SUMMITS[0]; for (const S of SUMMITS) if (Math.abs(S[0] - x) < Math.abs(best[0] - x)) best = S; return best; };
      for (let k = 0; k < 420; k++) {
        const cx = -30 + r() * 1340, top = ry(cx);
        if (top > 470) continue;
        const u = Math.pow(r(), 1.35);
        const cy = top + 2 + u * (500 - top);
        if (cy > 492) continue;
        const S = summitOf(cx), lit = litAt(cx);
        let dx = (cx - S[0]) * 0.55, dy = cy - S[1] + 30;
        const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const fade = 1 - smooth((cy - 440) / 50);
        const n = 2 + Math.floor(r() * 4);
        for (let j = 0; j < n; j++) {
          const x0 = cx + (r() - 0.5) * 9, y0 = cy + (r() - 0.5) * 6;
          if (y0 < ry(x0) + 1) continue;
          const len = (8 + r() * 30) * (1 - 0.4 * u);
          const w0 = 0.5 + r() * 1.0;
          const a0 = (lit ? 0.12 + r() * 0.22 : 0.14 + r() * 0.24) * fade;
          const col = lit ? (r() < 0.72 ? '204,216,238' : '24,32,56') : (r() < 0.86 ? '20,28,50' : '110,128,164');
          // 一笔分前后两半（后半更淡更细），中间随机留一处飞白
          const segs = 5, gap = r() < 0.55 ? -1 : 1 + Math.floor(r() * 3);
          for (let half = 0; half < 2; half++) {
            g.strokeStyle = `rgba(${col},${a0 * (half ? 0.45 : 0.9)})`;
            g.lineWidth = w0 * (half ? 0.6 : 0.95);
            g.beginPath();
            for (let q = half ? 3 : 0; q < (half ? segs : 3); q++) {
              if (q === gap) continue;
              const u0 = q / segs, u1 = (q + 0.8) / segs;
              g.moveTo(x0 + dx * len * u0, y0 + dy * len * u0); g.lineTo(x0 + dx * len * u1, y0 + dy * len * u1);
            }
            g.stroke();
          }
        }
      }
      // 山脊的支脉：从峰顶向下几道放射的岩脊，朝月一边亮、背月一边暗，山的体积靠它立起来
      for (const S of SUMMITS) {
        const toMoon = Math.sign(MOON.x - S[0]) || 1;
        for (const [ox, len, bend] of [[-1, 120, 0.25], [-0.45, 150, -0.1], [0.35, 140, 0.12], [1, 110, -0.2]]) {
          const pts = [];
          for (let j = 0; j <= 10; j++) {
            const u = j / 10;
            pts.push([S[0] + ox * len * 0.62 * u + bend * 30 * Math.sin(u * Math.PI) + (h2(j, S[0] + ox * 10) - 0.5) * 4, S[1] + 6 + len * u]);
          }
          const litSide = toMoon;
          for (const [off, col, a] of [[litSide * 1.2, '206,218,240', 0.32], [-litSide * 1.4, '18,24,44', 0.34]]) {
            for (let j = 1; j < pts.length; j++) {
              const p0 = pts[j - 1], p1 = pts[j];
              if (h2(j, S[0] * 3 + ox * 7 + off) < 0.12) continue;
              const fade = (1 - j / pts.length) * (1 - smooth((p1[1] - 440) / 50));
              g.strokeStyle = `rgba(${col},${a * fade})`; g.lineWidth = 1.3 * (1 - j / 14);
              g.beginPath(); g.moveTo(p0[0] + off, p0[1]); g.lineTo(p1[0] + off, p1[1]); g.stroke();
            }
          }
        }
      }
      g.restore();
      // 山脊迎月一侧一道断续的雪光；背月一侧不亮
      g.lineJoin = 'round';
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i], mx = (a[0] + b[0]) / 2;
        const pk = clamp(1 - Math.abs(mx - owner(mx)) / 240);
        if (!litAt(mx) || h2(i, 77) < 0.3 || pk < 0.05) continue;
        const near = clamp(1 - Math.abs(mx - MOON.x) / 700);
        g.strokeStyle = `rgba(214,226,244,${(0.3 + 0.35 * near) * pk})`; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(a[0], a[1] + 0.4); g.lineTo(b[0], b[1] + 0.4); g.stroke();
      }
      // 山脚雾带：一层渐浓的冷雾，加几团横向软雾，山脚看不出底线
      const fog = g.createLinearGradient(0, 430, 0, 510);
      fog.addColorStop(0, 'rgba(56,70,102,0)'); fog.addColorStop(0.45, 'rgba(62,78,110,0.55)'); fog.addColorStop(0.8, 'rgba(66,82,114,0.88)'); fog.addColorStop(1, 'rgba(64,80,112,0.96)');
      g.fillStyle = fog; g.fillRect(0, 430, W, 170);
      g.filter = 'blur(9px)';
      for (let i = 0; i < 22; i++) {
        const x = r() * W, y = 452 + r() * 34, w = 70 + r() * 150;
        g.fillStyle = `rgba(104,120,154,${0.12 + r() * 0.14})`;
        g.beginPath(); g.ellipse(x, y, w, 7 + r() * 8, 0, 0, TAU); g.fill();
      }
      g.filter = 'none';
    });

    // 中景山丘：雪顶，松林点点
    const MID = [[-30, 452], [60, 438], [150, 444], [260, 466], [360, 482], [450, 496], [600, 500], [760, 497], [900, 494], [990, 488], [1080, 484], [1180, 492], [1310, 496]];
    const midMtn = () => K.cache('fg6_d4_mid', W, 220, 1, (g) => {
      // 世界 y = 400 .. 620
      g.translate(0, -400);
      const p = new Path2D();
      smoothTo(p, MID, true); p.lineTo(1310, 620); p.lineTo(-30, 620); p.closePath();
      const gr = g.createLinearGradient(0, 430, 0, 560);
      gr.addColorStop(0, '#5d6f92'); gr.addColorStop(0.25, '#3e4d6d'); gr.addColorStop(1, '#2a3550');
      g.fillStyle = gr; g.fill(p);
      // 松林：一簇簇小三角，顶上一点雪
      const r = rng(812);
      g.save(); g.clip(p);
      for (let i = 0; i < 260; i++) {
        const x = -20 + r() * 1320;
        if (x > 430 && x < 930 && r() < 0.8) continue;
        const y0 = polyY(MID, x);
        const y = y0 + 6 + r() * 46;
        const hh = 5 + r() * 7 * (1 - (y - y0) / 80);
        g.fillStyle = mix('#1a2236', '#2a3550', clamp((y - y0) / 60));
        g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x + hh * 0.36, y); g.lineTo(x - hh * 0.36, y); g.closePath(); g.fill();
        g.fillStyle = 'rgba(170,186,214,0.5)';
        g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x + hh * 0.14, y - hh * 0.6); g.lineTo(x - hh * 0.14, y - hh * 0.6); g.closePath(); g.fill();
      }
      g.restore();
      // 迎月的山脊细亮线（软一点、淡一点，不像描边）
      g.filter = 'blur(0.7px)';
      g.strokeStyle = 'rgba(190,206,232,0.26)'; g.lineWidth = 1.2;
      const q = new Path2D(); smoothTo(q, MID, true);
      g.stroke(q);
      g.filter = 'none';
    });

    // 山谷：雪野、镇前的淡雾与远处一条冻河
    const valley = () => K.cache('fg6_d4_valley', W, 260, 1, (g) => {
      // 世界 y = 500 .. 760
      g.translate(0, -500);
      const gr = g.createLinearGradient(0, 530, 0, 760);
      gr.addColorStop(0, 'rgba(70,85,122,0)'); gr.addColorStop(0.12, 'rgba(72,87,124,0.9)'); gr.addColorStop(0.2, '#44547a');
      gr.addColorStop(0.45, '#35435f'); gr.addColorStop(1, '#232c42');
      g.fillStyle = gr; g.fillRect(-20, 530, 1320, 230);
      // 冻河：从镇前蜿蜒向右下，淡而窄
      g.strokeStyle = 'rgba(150,170,205,0.28)'; g.lineWidth = 5; g.lineCap = 'round';
      const rv = new Path2D(); smoothTo(rv, [[560, 556], [700, 566], [640, 590], [820, 620], [760, 660], [980, 720]], true);
      g.stroke(rv);
      g.strokeStyle = 'rgba(20,26,40,0.25)'; g.lineWidth = 1.2; g.stroke(rv);
      // 雪面起伏与几处小松林（低对比）
      const r = rng(1999);
      for (let i = 0; i < 12; i++) {
        const x = 380 + r() * 900, y = 570 + r() * 150, w = 120 + r() * 220;
        g.save(); g.translate(x, y); g.scale(1, 0.12);
        const gg = g.createRadialGradient(0, 0, 0, 0, 0, w);
        gg.addColorStop(0, r() < 0.5 ? 'rgba(140,158,192,0.14)' : 'rgba(18,24,38,0.18)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gg; g.fillRect(-w, -w, w * 2, w * 2);
        g.restore();
      }
      const groves = [[470, 572, 14], [590, 600, 10], [840, 586, 16], [930, 640, 9], [700, 652, 8]];
      for (const [gx, gy, n] of groves) {
        for (let k = 0; k < n; k++) {
          const x = gx + (r() - 0.5) * n * 7, y = gy + (r() - 0.5) * 10;
          const hh = (5 + r() * 5) * (0.8 + (y - 560) / 160);
          g.fillStyle = rgba('#161d2e', 0.75);
          g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x + hh * 0.34, y); g.lineTo(x - hh * 0.34, y); g.closePath(); g.fill();
          g.fillStyle = 'rgba(160,176,206,0.4)';
          g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x + hh * 0.13, y - hh * 0.62); g.lineTo(x - hh * 0.13, y - hh * 0.62); g.closePath(); g.fill();
        }
      }
      // 镇子前沿的薄雾
      const fog = g.createLinearGradient(0, 530, 0, 580);
      fog.addColorStop(0, 'rgba(90,106,140,0)'); fog.addColorStop(0.5, 'rgba(96,112,146,0.35)'); fog.addColorStop(1, 'rgba(90,106,140,0)');
      g.fillStyle = fog; g.fillRect(-20, 530, 1320, 50);
    });

    // 小镇：三排屋舍，屋顶积雪，窗透暖光；中间一座小塔
    const TOWN = [];
    {
      const r = rng(4410);
      const rows = [{ y: 516, s: 0.62, n: 26, x0: 440, x1: 930 }, { y: 534, s: 0.8, n: 21, x0: 410, x1: 950 }, { y: 552, s: 1, n: 16, x0: 400, x1: 960 }];
      rows.forEach((R, ri) => {
        for (let i = 0; i < R.n; i++) {
          const x = lerp(R.x0, R.x1, (i + 0.2 + r() * 0.6) / R.n);
          TOWN.push({ x, y: R.y + (r() - 0.5) * 4, s: R.s * (0.85 + r() * 0.3), w: 16 + r() * 12, hw: 7 + r() * 5, two: r() < 0.25, lit: r(), ri, seed: (r() * 1e6) | 0 });
        }
      });
      TOWN.sort((a, b) => a.y - b.y);
    }
    function roofPath(g, x, y, w, hr) {
      g.beginPath();
      g.moveTo(x - w / 2 - hr * 0.55, y + 0.5);
      g.quadraticCurveTo(x - w / 2 - hr * 0.1, y - hr * 0.25, x - w * 0.3, y - hr);
      g.lineTo(x + w * 0.3, y - hr);
      g.quadraticCurveTo(x + w / 2 + hr * 0.1, y - hr * 0.25, x + w / 2 + hr * 0.55, y + 0.5);
      g.closePath();
    }
    const town = () => K.cache('fg6_d4_town', 640, 150, 1, (g) => {
      // 世界 x = 360 .. 1000, y = 430 .. 580
      g.translate(-360, -430);
      // 塔
      const tx = 700, ty = 520;
      for (let k = 0; k < 5; k++) {
        const w = 20 - k * 3, y = ty - k * 11;
        g.fillStyle = '#151b2a'; g.fillRect(tx - w * 0.36, y - 8, w * 0.72, 9);
        g.fillStyle = '#f2c27a'; if (k < 4) g.fillRect(tx - 1, y - 6, 2, 3);
        roofPath(g, tx, y - 8, w, 4);
        g.fillStyle = '#9aabc8'; g.fill();
        g.fillStyle = '#101522'; g.fillRect(tx - w / 2 - 2, y - 8.5, w + 4, 1);
      }
      g.fillStyle = '#151b2a'; g.fillRect(tx - 0.8, ty - 72, 1.6, 10);
      for (const hs of TOWN) {
        const s = hs.s, w = hs.w * s, hw = hs.hw * s * (hs.two ? 1.6 : 1), hr = 6 * s;
        const x = hs.x, y = hs.y;
        // 墙
        g.fillStyle = hs.ri === 0 ? '#202840' : hs.ri === 1 ? '#1b2236' : '#161c2d';
        g.fillRect(x - w / 2, y - hw, w, hw);
        // 窗
        const r = rng(hs.seed);
        const nw = Math.max(1, Math.round(w / (7 * s)));
        for (let k = 0; k < nw; k++) {
          if (r() > 0.25 + hs.lit * 0.75) continue;
          const wx = x - w / 2 + (k + 0.5) * (w / nw) - 1.4 * s, wy = y - hw * (hs.two && r() < 0.5 ? 0.82 : 0.6);
          g.fillStyle = r() < 0.7 ? '#f7d58a' : '#f2a95a';
          g.fillRect(wx, wy, 2.8 * s, 2.6 * s);
        }
        // 屋顶：积雪的上表面 + 暗檐
        roofPath(g, x, y - hw, w, hr);
        g.fillStyle = hs.ri === 0 ? '#8d9fbf' : '#a3b3cf'; g.fill();
        g.fillStyle = '#0f1420'; g.fillRect(x - w / 2 - hr * 0.5, y - hw - 0.6, w + hr, 1.1 * s);
      }
      // 街口几盏红灯笼
      const r = rng(66);
      for (let i = 0; i < 14; i++) {
        const x = 420 + r() * 520, y = 530 + r() * 22;
        g.fillStyle = '#d0503c'; g.beginPath(); g.ellipse(x, y, 1.5, 1.8, 0, 0, TAU); g.fill();
      }
    });
    const townGlow = () => K.cache('fg6_d4_tglow', 760, 260, 0.5, (g) => {
      // 世界 x = 300 .. 1060, y = 380 .. 640
      g.translate(-300, -380);
      const blobs = [[520, 535, 150, 0.45], [700, 525, 190, 0.55], [860, 538, 140, 0.4], [620, 545, 120, 0.35], [450, 545, 100, 0.3]];
      for (const [x, y, rr, a] of blobs) {
        g.save(); g.translate(x, y); g.scale(1, 0.42);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, rr);
        gr.addColorStop(0, `rgba(242,170,90,${a})`); gr.addColorStop(0.4, `rgba(220,140,70,${a * 0.4})`); gr.addColorStop(1, 'rgba(200,120,60,0)');
        g.fillStyle = gr; g.fillRect(-rr, -rr, rr * 2, rr * 2);
        g.restore();
      }
    });
    // 红灯笼与窗光的小光晕（逐帧加亮用）
    const townSpark = () => K.cache('fg6_d4_tspark', 640, 150, 0.5, (g) => {
      g.translate(-360, -430);
      const tex = glowTex('#f2b765');
      for (const hs of TOWN) {
        if (hs.lit < 0.45) continue;
        g.globalAlpha = 0.18 + 0.2 * hs.lit;
        putGlow(g, tex, hs.x, hs.y - hs.hw * hs.s * 0.6, 7 * hs.s);
      }
      g.globalAlpha = 1;
    });

    // 前景：雪坡（含老人走来的脚印）
    const hillPath = (() => {
      const p = new Path2D();
      smoothTo(p, HILL, true);
      p.lineTo(660, 820); p.lineTo(-30, 820); p.closePath();
      return p;
    })();
    const hillGrad = (g) => {
      const gr = g.createLinearGradient(0, 596, 0, 800);
      gr.addColorStop(0, '#b6c3da'); gr.addColorStop(0.12, '#8e9dbb'); gr.addColorStop(0.45, '#5b6a8a'); gr.addColorStop(1, '#2f3a54');
      return gr;
    };
    // 坡面高度：按 smoothTo 的二次曲线逐段取样（与画出的坡沿一致）
    const HILLD = (() => {
      const P = [HILL[0]];
      for (let i = 1; i < HILL.length - 1; i++) {
        const a = P[P.length - 1], c0 = HILL[i];
        const b = [(HILL[i][0] + HILL[i + 1][0]) / 2, (HILL[i][1] + HILL[i + 1][1]) / 2];
        for (let k = 1; k <= 16; k++) { const u = k / 16; P.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c0[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c0[1] + u * u * b[1]]); }
      }
      P.push(HILL[HILL.length - 1]);
      return P;
    })();
    const hillY = (x) => {
      for (let i = 1; i < HILLD.length; i++) if (x <= HILLD[i][0]) { const a = HILLD[i - 1], b = HILLD[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); }
      return HILLD[HILLD.length - 1][1];
    };
    const hill = () => K.cache('fg6_d4_hill', 720, 260, 1, (g) => {
      // 世界 x = -30 .. 690, y = 580 .. 840
      g.translate(30, -580);
      g.fillStyle = hillGrad(g); g.fill(hillPath);
      g.save(); g.clip(hillPath);
      // 风吹出的雪纹：几道横向的柔和明暗
      const r = rng(3301);
      for (let i = 0; i < 16; i++) {
        const y = 616 + r() * 170, x = -20 + r() * 640, w = 80 + r() * 200;
        const gg = g.createRadialGradient(x, y, 0, x, y, w);
        const lt = r() < 0.5;
        gg.addColorStop(0, lt ? 'rgba(200,212,232,0.16)' : 'rgba(30,38,60,0.16)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
        g.save(); g.translate(x, y); g.scale(1, 0.16); g.translate(-x, -y);
        g.fillStyle = gg; g.fillRect(x - w, y - w, w * 2, w * 2);
        g.restore();
      }
      // 脚印：从左下延伸到老人身边，近大远小
      for (let k = 0; k < 9; k++) {
        const u = k / 8;
        const x = lerp(40, 236, u) + (k % 2 ? 7 : -7) * lerp(1, 0.6, u), y = lerp(780, 628, Math.pow(u, 0.8));
        const s = lerp(1.25, 0.6, u);
        g.fillStyle = 'rgba(40,50,76,0.45)';
        g.beginPath(); g.ellipse(x, y, 7 * s, 3 * s, -0.25, 0, TAU); g.fill();
        g.fillStyle = 'rgba(205,216,236,0.35)';
        g.beginPath(); g.ellipse(x + 0.5, y + 2 * s, 6 * s, 1.4 * s, -0.25, 0, Math.PI); g.fill();
      }
      // 雪里露出的几簇枯草：稀疏成簇，草梢顺风偏左，脚下一点浅凹
      for (const [tx, ty, n] of [[30, 668, 4], [176, 700, 3], [452, 680, 5], [520, 700, 3], [60, 702, 3], [270, 712, 3]]) {
        const sz = 0.85 + (ty - 650) / 120;
        g.fillStyle = 'rgba(40,50,76,0.12)';
        g.beginPath(); g.ellipse(tx, ty + 1, 7 * sz, 1.6 * sz, 0, 0, TAU); g.fill();
        for (let k = 0; k < n; k++) {
          const bx = tx + (k - n / 2) * 2.4 * sz + (r() - 0.5) * 2, hh = (5 + r() * 7) * sz, lean = (2 + r() * 4) * sz;
          g.strokeStyle = rgba('#232a3c', 0.32 + r() * 0.2); g.lineWidth = 0.8 * sz;
          g.beginPath(); g.moveTo(bx, ty); g.quadraticCurveTo(bx - lean * 0.2, ty - hh * 0.6, bx - lean, ty - hh); g.stroke();
        }
      }
      // 两块半埋的石头：不规则的低矮轮廓，顶上一层软雪
      for (const [sx, sy, sw, sh] of [[478, 706, 14, 6], [214, 714, 11, 5]]) {
        const st = new Path2D();
        st.moveTo(sx - sw, sy + 1);
        st.bezierCurveTo(sx - sw * 0.9, sy - sh * 0.7, sx - sw * 0.35, sy - sh * 1.1, sx + sw * 0.1, sy - sh);
        st.bezierCurveTo(sx + sw * 0.6, sy - sh * 0.95, sx + sw * 0.95, sy - sh * 0.4, sx + sw, sy + 1);
        st.closePath();
        g.fillStyle = 'rgba(48,58,82,0.8)'; g.fill(st);
        g.save(); g.clip(st);
        const sg = g.createLinearGradient(0, sy - sh * 1.1, 0, sy - sh * 0.2);
        sg.addColorStop(0, 'rgba(206,216,234,0.85)'); sg.addColorStop(1, 'rgba(206,216,234,0)');
        g.fillStyle = sg; g.fillRect(sx - sw, sy - sh * 1.2, sw * 2, sh * 1.2);
        g.restore();
        g.fillStyle = 'rgba(176,190,214,0.55)';
        g.beginPath(); g.ellipse(sx, sy + 1.5, sw * 1.15, 2, 0, 0, TAU); g.fill();
      }
      g.restore();
      // 坡沿迎月的细亮边
      g.strokeStyle = 'rgba(226,234,246,0.7)'; g.lineWidth = 1.4;
      const e = new Path2D(); smoothTo(e, HILL.slice(3), true); g.stroke(e);
    });

    // 老树：手摆主干与大枝，细枝按规则生长；每根枝是一条平滑收细的整笔（不是一节节拼起来的）
    const TREE = (() => {
      const strokes = [], r = rng(2718);
      const AV = (x, y) => (x > 470 && y < 330) || x > 600; // 不进月亮与画面中部
      function add(pts, ws) { strokes.push({ pts, ws }); return strokes[strokes.length - 1]; }
      function limb(pts, depth) {
        const P = pts.map((q) => [q[0], q[1]]), Wd = pts.map((q) => q[2]);
        add(P, Wd);
        if (depth >= 3) return;
        for (let i = 1; i < P.length; i++) {
          if (r() > 0.8) continue;
          const a = P[i - 1], b = P[i];
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const t = 0.3 + r() * 0.6;
          const w = lerp(Wd[i - 1], Wd[i], t);
          twig(lerp(a[0], b[0], t), lerp(a[1], b[1], t), ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), Math.min(6.5, w * 0.45), Math.min(150, Math.max(40, 14 * w * (0.7 + r() * 0.6))), 3);
        }
      }
      function twig(x, y, ang, w, len, depth) {
        if (w < 0.5 || len < 8) return;
        // 冬树枝稍向上翘
        let a = ang + (-Math.PI / 2 - ang) * 0.12;
        const n = Math.max(2, Math.round(len / 16));
        const P = [[x, y]], Wd = [w];
        const kids = [];
        for (let i = 0; i < n; i++) {
          a += (r() - 0.5) * 0.5;
          const l = len / n;
          const q = P[P.length - 1];
          const nx = q[0] + Math.cos(a) * l, ny = q[1] + Math.sin(a) * l;
          if (AV(nx, ny) || ny < -150) break;
          P.push([nx, ny]); Wd.push(Math.max(0.45, w * (1 - (i + 1) / n * 0.6)));
          if (depth < 5 && i > 0 && r() < 0.3) kids.push([nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.55), Wd[Wd.length - 1] * 0.72, len * (0.42 + r() * 0.25)]);
        }
        if (P.length < 2) return;
        add(P, Wd);
        for (const k of kids) twig(k[0], k[1], k[2], k[3], k[4], depth + 1);
        if (depth < 5) {
          const q = P[P.length - 1], ww = Wd[Wd.length - 1];
          twig(q[0], q[1], a - 0.3 - r() * 0.3, ww * 0.8, len * 0.55, depth + 1);
          twig(q[0], q[1], a + 0.3 + r() * 0.3, ww * 0.75, len * 0.5, depth + 1);
        }
      }
      // 主干：粗壮、略扭，向上分成三大枝；另有两根低枝伸向左侧
      limb([[124, 616, 52], [116, 586, 46], [108, 548, 41], [110, 512, 38], [121, 474, 36], [133, 436, 34], [141, 398, 32], [147, 366, 30]], 2);
      limb([[146, 372, 26], [134, 330, 23], [114, 282, 20], [92, 232, 18], [74, 176, 16], [60, 116, 14], [50, 50, 12], [42, -20, 10], [36, -90, 8.5], [32, -160, 7]], 1);
      limb([[144, 370, 22], [180, 334, 19], [222, 306, 16], [270, 284, 13.5], [322, 266, 11], [380, 246, 8.5], [428, 234, 6.5], [458, 228, 5]], 1);
      limb([[150, 376, 18], [168, 324, 16], [186, 268, 14], [198, 206, 12.5], [208, 140, 11], [218, 70, 9.5], [226, 0, 8], [232, -80, 6.5], [236, -160, 5.5]], 1);
      limb([[262, 288, 9.5], [288, 242, 8], [314, 192, 6.5], [336, 136, 5.5], [352, 76, 4.5], [362, 20, 3.5]], 2);
      limb([[112, 468, 13], [90, 452, 12], [62, 436, 10.5], [28, 424, 9], [-14, 414, 7.5], [-60, 408, 6.5]], 2);
      limb([[96, 238, 10], [72, 216, 9], [44, 200, 8], [10, 190, 7], [-40, 182, 6]], 2);
      return strokes;
    })();
    // 一笔：沿折线两侧按宽度偏移，二次曲线连成平滑轮廓，末端圆头
    function strokeOutline(p, st, dx, dy) {
      const P = st.pts, Wd = st.ws, n = P.length;
      const L = [], R = [];
      for (let i = 0; i < n; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const h = Wd[i] / 2;
        L.push([P[i][0] - ty * h + dx, P[i][1] + tx * h + dy]);
        R.push([P[i][0] + ty * h + dx, P[i][1] - tx * h + dy]);
      }
      smoothTo(p, L, true);
      const e = P[n - 1], h = Wd[n - 1] / 2;
      const ang = Math.atan2(e[1] - P[n - 2][1], e[0] - P[n - 2][0]);
      p.quadraticCurveTo(e[0] + Math.cos(ang) * h * 1.6 + dx, e[1] + Math.sin(ang) * h * 1.6 + dy, R[n - 1][0], R[n - 1][1]);
      smoothTo(p, R.slice().reverse(), false);
      p.closePath();
    }
    const ROOT = (dx, dy) => {
      const p = new Path2D();
      // 根部向两侧张开，上端收进树干轮廓里（不露台阶）
      p.moveTo(58 + dx, 626 + dy);
      p.bezierCurveTo(86 + dx, 616 + dy, 95 + dx, 600 + dy, 97 + dx, 566 + dy); p.lineTo(131 + dx, 566 + dy);
      p.bezierCurveTo(133 + dx, 598 + dy, 150 + dx, 614 + dy, 192 + dx, 626 + dy); p.closePath();
      return p;
    };
    const STROKE_P = new Map();
    function strokePath(st, dx, dy) {
      const k = st.pts.length + ':' + st.pts[0][0] + ':' + st.pts[0][1] + ':' + dx + ':' + dy;
      let p = STROKE_P.get(k);
      if (!p) { p = new Path2D(); strokeOutline(p, st, dx, dy); STROKE_P.set(k, p); }
      return p;
    }
    // 逐笔填充（各笔走向不同，合成一条路径时重叠处会因缠绕方向相反而镂空）
    function fillTree(g, col, dx, dy, minW) {
      g.fillStyle = col;
      for (const st of TREE) if (!minW || st.ws[0] >= minW) g.fill(strokePath(st, dx, dy));
      g.fill(ROOT(dx, dy));
    }
    function treeCaps(g, thick) {
      // 枝上积雪：较平的枝段上沿一条白边，两端收尖；每笔的第一段起于母枝内部，不画
      g.fillStyle = '#dbe3f0';
      for (const st of TREE) {
        if ((st.ws[0] >= 5) !== thick) continue;
        for (let i = 1; i < st.pts.length - 1; i++) {
          const a = st.pts[i], b = st.pts[i + 1], w0 = st.ws[i], w1 = st.ws[i + 1];
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const tilt = Math.abs(Math.sin(ang));
          if (tilt > 0.8 || w0 < 1.1) continue;
          const th = Math.min(4.5, 0.45 * w0 + 0.7) * (1 - tilt * 0.8);
          const nx = Math.sin(ang), ny = -Math.cos(ang);
          const sgn = ny < 0 ? 1 : -1;
          const ux = nx * sgn, uy = ny * sgn;
          const ax = a[0] + ux * w0 / 2, ay = a[1] + uy * w0 / 2, bx = b[0] + ux * w1 / 2, by = b[1] + uy * w1 / 2;
          g.beginPath();
          g.moveTo(ax - ux * 0.8, ay - uy * 0.8);
          g.quadraticCurveTo((ax + bx) / 2 + ux * th * 1.4, (ay + by) / 2 + uy * th * 1.4, bx - ux * 0.8, by - uy * 0.8);
          g.closePath(); g.fill();
        }
      }
    }
    function treeBody(g, minW) {
      // 迎月一侧（右上）的细亮边：先填亮色，再只在已有像素上把同形向左下偏移填暗色
      fillTree(g, '#6c7fa3', 0, 0, minW);
      g.globalCompositeOperation = 'source-atop';
      fillTree(g, '#121724', -1.7, 0.9, minW);
      g.globalCompositeOperation = 'source-over';
    }
    const tree = () => K.cache('fg6_d4_tree', 760, 800, 1, (g) => {
      // 世界 x = -80 .. 680, y = -160 .. 640
      g.translate(80, 160);
      // 树干与根只画到坡面以下 2 px（根扎进雪里，不露出平底）
      const above = new Path2D();
      above.moveTo(-80, 602);
      smoothTo(above, HILL.map((q) => [q[0], q[1] + 2]), false);
      above.lineTo(700, 792); above.lineTo(700, -200); above.lineTo(-80, -200); above.closePath();
      g.save(); g.clip(above);
      // 先画全部枝干与细枝积雪，再把粗枝盖上去，最后画粗枝积雪
      treeBody(g, 0);
      treeCaps(g, false);
      treeBody(g, 5);
      // 树皮：主干上几道纵向暗纹、迎月侧几道淡纹，一个树瘤
      g.save(); g.clip(strokePath(TREE[0], 0, 0));
      const r = rng(91);
      for (let i = 0; i < 22; i++) {
        const y = 360 + r() * 250, x = 98 + r() * 46, lt = r() < 0.3;
        g.strokeStyle = lt ? 'rgba(100,118,152,0.35)' : 'rgba(6,8,14,0.55)'; g.lineWidth = lt ? 1 : 1.6;
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 4, y - 14, x - 3, y - 28, x + 1, y - 36 - r() * 34); g.stroke();
      }
      g.fillStyle = '#0a0d16'; g.beginPath(); g.ellipse(124, 488, 5, 8, 0.2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(110,128,160,0.5)'; g.lineWidth = 1; g.beginPath(); g.ellipse(124, 488, 6, 9, 0.2, -1.2, 0.9); g.stroke();
      g.restore();
      treeCaps(g, true);
      g.restore();
      // 树根处的积雪：顺坡堆在树根周围的一道雪包，颜色与坡面同一渐变（下缘与坡面无缝），只有上沿迎月微亮
      const dp = new Path2D();
      dp.moveTo(34, hillY(34) + 3);
      dp.bezierCurveTo(60, hillY(60) + 1, 78, hillY(84) - 6, 96, hillY(96) - 8);
      dp.bezierCurveTo(112, hillY(112) - 10, 138, hillY(138) - 9, 156, hillY(156) - 8);
      dp.bezierCurveTo(172, hillY(172) - 6, 190, hillY(196) - 1, 222, hillY(222) + 3);
      for (let x = 222; x >= 34; x -= 8) dp.lineTo(x, hillY(x) + 3);
      dp.closePath();
      g.filter = 'blur(0.6px)';
      g.fillStyle = hillGrad(g); g.fill(dp);
      g.filter = 'none';
      g.save(); g.clip(dp);
      // 背月的左半略暗，迎月的右上沿一道细亮边
      const sh = g.createLinearGradient(40, 0, 200, 0);
      sh.addColorStop(0, 'rgba(40,52,80,0.16)'); sh.addColorStop(0.55, 'rgba(40,52,80,0)');
      g.fillStyle = sh; g.fillRect(30, 580, 200, 50);
      g.restore();
      const top = new Path2D();
      top.moveTo(96, hillY(96) - 8);
      top.bezierCurveTo(112, hillY(112) - 10, 138, hillY(138) - 9, 156, hillY(156) - 8);
      top.bezierCurveTo(172, hillY(172) - 6, 190, hillY(196) - 1, 222, hillY(222) + 3);
      g.strokeStyle = 'rgba(226,234,246,0.55)'; g.lineWidth = 1.2; g.stroke(top);
    });

    // 厚云：大小云团叠成的软边云层（建缓存时模糊），月光从左上来：上缘与左缘略亮、云底更暗、内部有噪声纹理；
    // 外缘另有一张银边贴图。贴图局部坐标：前缘约在 x=150，世界 y = 局部 y − 200 + 镜头上移量 × 0.7
    // 前缘基线：两种频率的大起伏（约 ±60 px），上部领先、下部略退
    const CO = 250;
    const edgeX = (y) => CO + y * 0.18 + 38 * Math.sin(y * 0.016 + 0.4) + 22 * Math.sin(y * 0.041 + 2.2);
    const PUFF = (() => {
      const r = rng(5150), P = [];
      // 前缘：沿边一串大小不一的云团，鼓成一个个云头
      for (let k = 0; k < 24; k++) {
        const y = 14 + k * 18.5 + (r() - 0.5) * 10;
        const x = edgeX(y) + (r() - 0.5) * 70;
        P.push({ x, y, r: 30 + r() * 50 });
      }
      // 云底：参差的下缘
      for (let k = 0; k < 38; k++) {
        const x = CO + 80 + k * 38 + (r() - 0.5) * 20;
        P.push({ x, y: 440 + (r() - 0.5) * 22 + Math.min(1, k / 8) * 14, r: 18 + r() * 30 });
      }
      // 内部：中、大云团
      for (let i = 0; i < 80; i++) P.push({ x: CO + 80 + Math.pow(r(), 0.85) * 1400, y: 40 + r() * 380, r: 40 + r() * 90 });
      return P;
    })();
    // 每 8 px 一行的云左缘（局部 x），用于算月亮处的前缘位置与剔除云后的星
    const PROF = (() => {
      const out = [];
      for (let y = 0; y <= 520; y += 8) {
        let m = y >= 30 && y <= 432 ? edgeX(y) + 14 : 1e9;
        for (const b of PUFF) { const dy = y - b.y; if (Math.abs(dy) < b.r) m = Math.min(m, b.x - Math.sqrt(b.r * b.r - dy * dy)); }
        out.push(m);
      }
      return out;
    })();
    const profAt = (y) => PROF[clamp(Math.round(y / 8), 0, PROF.length - 1)];
    // 贴图左移量：让月亮高度（局部 y = 320）处的云缘落在 xe + 59（与吞月时刻的设计一致）
    const COFF = Math.round(profAt(320) - 59);
    function puffShape(g, col) {
      g.fillStyle = col;
      // 底：沿前缘内侧的多边形，云团之间不留空洞
      g.beginPath(); g.moveTo(1720, 30);
      for (let y = 30; y <= 432; y += 12) g.lineTo(edgeX(y) + 14, y);
      g.lineTo(1720, 432); g.closePath(); g.fill();
      g.beginPath();
      for (const b of PUFF) { g.moveTo(b.x + b.r, b.y); g.arc(b.x, b.y, b.r, 0, TAU); }
      g.fill();
    }
    const cloud = () => K.cache('fg6_d4_cloud', 1720, 520, 0.5, (g) => {
      // 暴风雪的云：浓、暗、实的云体（与右上角的夜空差不多暗，经过歌词区时字后面的明暗不变），
      // 只有迎月的云团左上角略亮，云团之间是更深的暗缝，前缘近月处才有银边
      g.filter = 'blur(4px)';
      puffShape(g, '#121624');
      g.filter = 'none';
      g.globalCompositeOperation = 'source-atop';
      // （模糊滤镜每次填充都很慢：同色的云团合成一条路径一次填完，按离前缘远近分四档颜色）
      g.filter = 'blur(9px)';
      // 每个云团下半一团暗影（云团叠压的体积感）
      g.fillStyle = 'rgba(4,6,12,0.45)';
      g.beginPath();
      for (const b of PUFF) { g.moveTo(b.x + b.r * 0.82, b.y + b.r * 0.38); g.arc(b.x + b.r * 0.12, b.y + b.r * 0.38, b.r * 0.7, 0, TAU); }
      g.fill();
      for (let lv = 0; lv < 4; lv++) {
        g.fillStyle = rgba(mix('#4a5878', '#1e2536', lv / 3), 0.42);
        g.beginPath();
        for (const b of PUFF) {
          if (Math.min(3, Math.floor(clamp((b.x - CO) / 700) * 4)) !== lv) continue;
          g.moveTo(b.x - b.r * 0.3 + b.r * 0.5, b.y - b.r * 0.34); g.arc(b.x - b.r * 0.3, b.y - b.r * 0.34, b.r * 0.5, 0, TAU);
        }
        g.fill();
      }
      g.filter = 'none';
      // 内部纹理：低分辨率噪声放大
      const nc = document.createElement('canvas'); nc.width = 96; nc.height = 30;
      const nx = nc.getContext('2d'), r = rng(808);
      for (let y = 0; y < 30; y++) for (let x = 0; x < 96; x++) { const v = r(); nx.fillStyle = v < 0.5 ? `rgba(6,8,14,${(0.5 - v) * 1.2})` : `rgba(64,76,104,${(v - 0.5) * 0.6})`; nx.fillRect(x, y, 1, 1); }
      g.imageSmoothingEnabled = true; g.globalAlpha = 0.5;
      g.filter = 'blur(6px)';
      g.drawImage(nc, 0, 0, 1720, 520);
      g.filter = 'none'; g.globalAlpha = 1;
      // 云底更暗
      const gr = g.createLinearGradient(0, 0, 0, 500);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(8,10,18,0.12)'); gr.addColorStop(1, 'rgba(8,10,18,0.5)');
      g.fillStyle = gr; g.fillRect(0, 0, 1720, 520);
      g.globalCompositeOperation = 'source-over';
    });
    // 银边：云的外缘内侧一窄一宽两道带子（窄的亮、宽的柔），越往云里越暗；只留在前缘与上缘
    function rimBand(g, m, dx, dy, blur, col) {
      const c2 = document.createElement('canvas'); c2.width = g.canvas.width; c2.height = g.canvas.height;
      const q = c2.getContext('2d');
      q.setTransform(m);
      q.filter = 'blur(' + blur + 'px)';
      puffShape(q, col);
      q.globalCompositeOperation = 'destination-out';
      q.translate(dx, dy);
      puffShape(q, '#000000');
      q.filter = 'none';
      return c2;
    }
    const cloudRim = () => K.cache('fg6_d4_crim', 1720, 520, 0.5, (g) => {
      const m = g.getTransform();
      const wide = rimBand(g, m, 30, 16, 9, '#a8b9d8'), thin = rimBand(g, m, 8, 5, 5, '#d0dcf0');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 0.55; g.drawImage(wide, 0, 0);
      g.globalAlpha = 0.6; g.drawImage(thin, 0, 0);
      g.globalAlpha = 1;
      g.setTransform(m);
      g.globalCompositeOperation = 'destination-in';
      const mh = g.createLinearGradient(CO - 110, 0, CO + 450, 0);
      mh.addColorStop(0, 'rgba(0,0,0,1)'); mh.addColorStop(0.4, 'rgba(0,0,0,0.8)'); mh.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = mh; g.fillRect(0, 0, 1720, 520);
      // 竖向：月亮高度（局部 y = 320）最亮，离月越远越暗
      const mv = g.createLinearGradient(0, 0, 0, 520);
      mv.addColorStop(0, 'rgba(0,0,0,0.06)'); mv.addColorStop(170 / 520, 'rgba(0,0,0,0.3)'); mv.addColorStop(320 / 520, 'rgba(0,0,0,1)');
      mv.addColorStop(430 / 520, 'rgba(0,0,0,0.35)'); mv.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = mv; g.fillRect(0, 0, 1720, 520);
      g.globalCompositeOperation = 'source-over';
    });

    // 孔明灯
    // 孔明灯：上宽下窄、顶部圆鼓的纸罩（梯形），火在底口，纸从里面透出暖光——下部最亮，顶部偏橙；底口一圈竹篾、一点火苗
    const LW_ = 36, LH_ = 46;
    const lanternTex = () => K.cache('fg6_d4_lan2', LW_, LH_, 3, (g) => {
      const p = new Path2D();
      p.moveTo(9.5, 40); p.lineTo(5.2, 12);
      p.bezierCurveTo(4.6, 5.2, 10, 2.2, 18, 2.0); p.bezierCurveTo(26, 2.2, 31.4, 5.2, 30.8, 12);
      p.lineTo(26.5, 40); p.closePath();
      const gr = g.createLinearGradient(0, 2, 0, 41);
      gr.addColorStop(0, '#c26a2a'); gr.addColorStop(0.35, '#e79a48'); gr.addColorStop(0.75, '#f9cf7e'); gr.addColorStop(1, '#ffe6ae');
      g.fillStyle = gr; g.fill(p);
      g.save(); g.clip(p);
      // 里面的火光：底口上方一团亮
      const ig = g.createRadialGradient(18, 36, 0, 18, 34, 22);
      ig.addColorStop(0, 'rgba(255,246,214,0.95)'); ig.addColorStop(0.45, 'rgba(255,224,150,0.45)'); ig.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = ig; g.fillRect(0, 0, LW_, LH_);
      // 两侧略暗（圆筒的明暗），纸缝两道
      const sg = g.createLinearGradient(5, 0, 31, 0);
      sg.addColorStop(0, 'rgba(120,50,16,0.35)'); sg.addColorStop(0.3, 'rgba(120,50,16,0)'); sg.addColorStop(0.7, 'rgba(120,50,16,0)'); sg.addColorStop(1, 'rgba(120,50,16,0.35)');
      g.fillStyle = sg; g.fillRect(0, 0, LW_, LH_);
      g.strokeStyle = 'rgba(150,72,26,0.28)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(12.6, 3.5); g.lineTo(14.4, 40); g.moveTo(23.4, 3.5); g.lineTo(21.6, 40); g.stroke();
      g.restore();
      // 底口竹篾与火苗
      g.strokeStyle = 'rgba(110,52,20,0.8)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(9.5, 40); g.lineTo(26.5, 40); g.stroke();
      const fl = g.createRadialGradient(18, 42.2, 0, 18, 42.2, 3.6);
      fl.addColorStop(0, 'rgba(255,255,240,1)'); fl.addColorStop(0.5, 'rgba(255,222,140,0.9)'); fl.addColorStop(1, 'rgba(255,180,90,0)');
      g.fillStyle = fl; g.fillRect(12, 38, 12, 8);
    });
    // h：画面上的灯高（像素）；底口火苗在 (x, y)
    function drawLantern(g, tex, x, y, h, a) {
      const k = h / 38, w = LW_ * k, hh = LH_ * k;
      g.globalAlpha = clamp(a);
      g.drawImage(tex, x - w / 2, y - 42.2 * k, w, hh);
    }
    const LAN = [];
    {
      const r = rng(9137);
      const N = 96;
      for (let i = 0; i < N; i++) {
        const near = r();
        LAN.push({ tr: -60 + 67.5 * (i + r()) / N, x0: 420 + r() * 490, y0: 504 + near * 38, s: 5.6 + near * 4.2, v: 15 + near * 6 + r() * 2, ph: r() * 50, near, batch: false });
      }
      // 第31句第4字放飞的一批：从镇上各处屋顶升起（x 400–890）
      const roofs = TOWN.filter((hs) => hs.ri > 0 && hs.x > 400 && hs.x < 890).sort((a, b) => a.x - b.x);
      const NB = 10, order = [4, 1, 7, 2, 9, 6, 0, 8, 3, 5];
      for (let k = 0; k < NB; k++) {
        const hs = roofs[Math.round((k + 0.5) / NB * (roofs.length - 1))];
        const top = hs.y - hs.hw * hs.s * (hs.two ? 1.6 : 1) - 6 * hs.s;
        LAN.push({ q: order[k] / (NB - 1), x0: hs.x, y0: top - 1.5, s: 10.5 + r() * 2.6, v: 16 + r() * 13, ph: r() * 50, near: 1, batch: true });
      }
    }
    // 近处的三盏（离镜头近：大、升得快），镜头开始时已在空中或从画面下缘升入；第一盏在第32句前从月亮旁边升过
    const NEARL = [
      { x0: 694, y0: 214, v: 25, h: 23, ph: 1.3, dr: 6.5 },
      { x0: 594, y0: 486, v: 21, h: 19.5, ph: 3.1, dr: 5.2 },
      { x0: 846, y0: 742, v: 30, h: 18, ph: 4.7, dr: 6.0 },
    ];
    // 远处（歌词区）几点极小的灯
    const FARL = [[1012, 214, 1.4], [1085, 168, 1.1], [1150, 292, 1.3], [1228, 236, 1.0], [1046, 330, 1.2]];
    const TAUR = 26;
    function lanternState(L, a) {
      // 起飞时先慢后快（热气把灯托起），再随高度慢慢减速
      const ae = a - 0.8 * (1 - Math.exp(-a / 0.8));
      const R = L.v * TAUR * (1 - Math.exp(-ae / TAUR));
      const drift = 3.2 * a + 2.8 * a * clamp(R / 300);
      return {
        x: L.x0 - drift + 1.2 * Math.sin(0.5 * a + L.ph),
        y: L.y0 - R,
        s: L.s / (1 + a / 48),
        b: smooth(a / 0.8) / (1 + a / 90),
      };
    }

    // 合成的静态层：天、月晕、远山、中景、山谷、小镇（按输出分辨率缓存，镜头停着时整像素贴图）
    const bg = () => K.cache('fg6_d4_bg', W, 800, 1, (g) => {
      // 世界 y = -80 .. 720
      g.translate(0, 80);
      g.drawImage(sky(), 0, -160, W, 900);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.9;
      g.drawImage(halo(), MOON.x - 320, MOON.y - 320, 640, 640);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(farMtn(), 0, 300, W, 300);
      g.drawImage(midMtn(), 0, 400, W, 220);
      g.drawImage(valley(), 0, 500, W, 260);
      g.drawImage(town(), 360, 430, 640, 150);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.7; g.drawImage(townGlow(), 300, 380, 760, 260);
      g.globalAlpha = 0.8; g.drawImage(townSpark(), 360, 430, 640, 150);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    });
    const townGlow1 = () => K.cache('fg6_d4_tglow1', 760, 260, 1, (g) => { g.drawImage(townGlow(), 0, 0, 760, 260); });
    const townSpark1 = () => K.cache('fg6_d4_tspark1', 640, 150, 1, (g) => { g.drawImage(townSpark(), 0, 0, 640, 150); });
    // 前景合成：雪坡、影子（月在前上方，影子朝镜头、略偏左）、老树
    const fgLayer = () => K.cache('fg6_d4_fg', 780, 1000, 1, (g) => {
      // 世界 x = -80 .. 700, y = -160 .. 840
      g.translate(80, 160);
      g.drawImage(hill(), -30, 580, 720, 260);
      g.filter = 'blur(2px)';
      g.fillStyle = 'rgba(28,36,58,0.42)';
      g.beginPath(); g.ellipse(MAN.x - 14, MAN.y + 10, 92, 13, -0.08, 0, TAU); g.fill();
      g.fillStyle = 'rgba(28,36,58,0.35)';
      g.beginPath(); g.ellipse(106, 628, 70, 12, -0.12, 0, TAU); g.fill();
      g.filter = 'none';
      g.drawImage(tree(), -80, -160, 760, 800);
    });
    const fgMask = () => K.cache('fg6_d4_fgm', 780, 1000, 1, (g) => {
      g.drawImage(fgLayer(), 0, 0, 780, 1000);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#060912'; g.fillRect(0, 0, 780, 1000);
      g.globalCompositeOperation = 'source-over';
    });
    const cloud1 = () => K.cache('fg6_d4_cloud1', 1720, 520, 1, (g) => { g.drawImage(cloud(), 0, 0, 1720, 520); });
    const cloudRim1 = () => K.cache('fg6_d4_crim1', 1720, 520, 1, (g) => { g.drawImage(cloudRim(), 0, 0, 1720, 520); });

    XYT.registerShot('d4_hilldrunk', {
      name: '山头醉梦', zone: 'right', night: true, text: '#eef1f6', shadow: 'rgba(8,10,20,0.9)', accent: '#f2b765', bloom: 0.36,
      draw(g, c) {
        const t = c.lt;
        const S = g.getTransform().a;
        const sn = (v) => Math.round(v * S) / S;
        const tQue = charAt(c, 3, 0, FB1), tXiao = charAt(c, 5, 0, FB1);
        const tZui = charAt(c, 0, 1, FB2), tZhong = charAt(c, 2, 1, FB2);
        // 镜头：第32句第1字起 3.4 s 内平滑上移 80 px（峰值约 35 px/s）；运动中不取整（取整会 0/1 像素交替地顿）
        const cam = 80 * smooth((t - tZui) / 3.4);
        const BGF = 0.85;
        const by = cam * BGF, fy = cam;
        // 厚云前缘：画外缓缓逼近（12 px/s），第32句第1字前后开始加速，第3字时已压进右缘，约 7.5 s 吞没月亮
        // 速度是平滑上升的连续函数，位置是它的积分，没有突变
        const r0 = tZui - 0.24, r1 = tZhong + 0.58, VM = 215;
        const uu = clamp((t - r0) / (r1 - r0));
        const F = (r1 - r0) * (uu * uu * uu - uu * uu * uu * uu / 2) + Math.max(0, t - r1);
        const xe = 1290 - 12 * t - (VM - 12) * F;
        const moonY = MOON.y + by;
        // 月亮被云遮住的程度（云的软边约 90 px）
        const cov = smooth((MOON.x + MOON.r + 60 - xe) / (2 * MOON.r + 110));
        const ml = 1 - 0.82 * cov;
        // 镇上加放一批灯：暖光快起慢落
        const batch = smooth((t - tQue) / 0.45) * (t < tXiao ? 1 : Math.exp(-(t - tXiao) / 2.2));

        // 开镜头几帧里先把后面才用到的大贴图建好（建贴图较慢，放在转场里，不在镜头中途卡顿）
        if (t < 0.3) { cloud1(); cloudRim1(); fgMask(); townGlow1(); townSpark1(); }
        // 远景整层（天、月晕、远山、山谷、小镇）
        g.drawImage(bg(), 0, -80 + by, W, 800);
        // 月与星
        g.save();
        g.globalAlpha = 1 - 0.9 * cov;
        g.drawImage(moonDisc(), MOON.x - 48, moonY - 48, 96, 96);
        // 云已遮住的星不画（云在其上，看不见）
        const hid = (s) => s.y < 220 && s.x > xe - COFF + profAt(s.y + 200) + 50;
        g.fillStyle = '#e8eefa';
        for (const s of STARS) {
          if (hid(s)) continue;
          const tw = 0.72 + 0.28 * Math.sin(TAU * s.f * t + s.ph);
          g.globalAlpha = clamp(s.a * tw);
          g.fillRect(s.x - s.s / 2, s.y + by - s.s / 2, s.s, s.s);
        }
        g.globalCompositeOperation = 'lighter';
        const st = glowTex('#c8d6f0');
        for (const s of STARS) if (s.big && !hid(s)) { g.globalAlpha = 0.35 * s.a; putGlow(g, st, s.x, s.y + by, 6); }
        // 歌词区里极远处几点小灯
        const wt = glowTex(WARM);
        FARL.forEach(([x, y, s], i) => {
          g.globalAlpha = 0.35 + 0.08 * Math.sin(t * 1.3 + i * 2);
          putGlow(g, wt, x - 2 * t, y + by, s * 4.5);
        });
        g.restore();
        // 月被遮时远景同步变暗；小镇的灯火是人间的光，不跟着暗（补回来）
        const ty = by;
        g.save();
        if (cov > 0.002) { g.fillStyle = rgba('#070a14', 0.42 * cov); g.fillRect(0, 0, W, H); }
        g.globalCompositeOperation = 'lighter';
        const kd = 0.42 * cov;
        g.globalAlpha = clamp(0.7 * (0.1 * batch + 0.04 * c.de(0.5)) + 0.7 * kd);
        if (g.globalAlpha > 0.003) g.drawImage(townGlow1(), 300, 380 + ty, 760, 260);
        g.globalAlpha = clamp(0.8 * 0.12 * batch + 0.8 * kd);
        if (g.globalAlpha > 0.003) g.drawImage(townSpark1(), 360, 430 + ty, 640, 150);
        g.restore();

        // 孔明灯（远处的、成批的）：先画柔光，再画纸罩；画面上不到 4 px 的只画一点暖光
        g.save();
        const lt = lanternTex(), gt = glowTex(WARM);
        const items = [];
        for (let i = 0; i < LAN.length; i++) {
          const L = LAN[i];
          const tr = L.batch ? lerp(tQue, tXiao, L.q) : L.tr;
          const a = t - tr;
          if (a <= 0) continue;
          const Ls = lanternState(L, a);
          const yy = Ls.y + cam * (0.85 + 0.02 * L.near);
          if (yy < -40) continue;
          items.push([Ls.x, yy, Ls.s * 1.12, Ls.b * (0.86 + 0.14 * noise1(t * 2.3 + L.ph, 5)), L.batch]);
        }
        g.globalCompositeOperation = 'lighter';
        for (const [x, y, h, b, bt] of items) {
          g.globalAlpha = clamp(b * (bt ? 0.55 : 0.45));
          putGlow(g, gt, x, y - h * 0.3, h * (bt ? 2.2 : 2.0));
        }
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#ffe2a4';
        for (const [x, y, h, b] of items) {
          if (h < 4) {
            g.globalAlpha = clamp(b);
            g.fillRect(x - h * 0.3, y - h * 0.8, h * 0.6, h * 0.8);
          } else drawLantern(g, lt, x, y, h, b * 1.05);
        }
        g.restore();

        // 厚云（只在高处，云底高于远山）；云移动快，贴到整像素不会顿
        if (xe < 1340) {
          const cx = sn(xe - COFF), cy = sn(-200 + by);
          g.drawImage(cloud1(), cx, cy, 1720, 520);
          // 银边：前缘离月越近越亮，月被吞进去后渐暗
          const dE = (xe - MOON.x) / 300;
          // 前缘还在歌词区（x>980）时不亮银边，进到月亮这边才亮起来：字后面的明暗保持稳定
          const lin = (Math.exp(-dE * dE) * (1 - 0.8 * smooth((MOON.x - 60 - xe) / 120)) + 0.25 * clamp(1 - Math.abs(dE) / 3)) * smooth((1000 - xe) / 160);
          if (lin > 0.01) {
            g.save(); g.globalAlpha = clamp(0.8 * lin); g.globalCompositeOperation = 'lighter';
            g.drawImage(cloudRim1(), cx, cy, 1720, 520);
            g.restore();
          }
          // 月在云后：云里透出一团暗淡的光
          if (cov > 0.01) {
            g.save(); g.globalCompositeOperation = 'lighter';
            g.globalAlpha = 0.24 * cov;
            putGlow(g, softTex('#7f93b8'), MOON.x, moonY, 130);
            g.globalAlpha = 0.16 * cov;
            putGlow(g, softTex('#b6c4dc'), MOON.x, moonY, 50);
            g.restore();
          }
        }

        // 近处的三盏孔明灯（在云前、雪坡后）
        {
          g.save();
          const lt2 = lanternTex(), gt2 = glowTex(WARM);
          for (const N of NEARL) {
            const yy = N.y0 - N.v * t + cam * 0.92;
            if (yy < -60 || yy > 780) continue;
            const x = N.x0 - N.dr * t * (1 + t / 40) + 2.2 * Math.sin(0.45 * t + N.ph);
            const fb = 0.9 + 0.1 * noise1(t * 2.1 + N.ph, 7);
            g.globalCompositeOperation = 'lighter';
            g.globalAlpha = 0.5 * fb;
            putGlow(g, gt2, x, yy - N.h * 0.3, N.h * 2.4);
            g.globalCompositeOperation = 'source-over';
            drawLantern(g, lt2, x, yy, N.h, fb);
          }
          g.restore();
        }
        // 前景：雪坡、老树、老人
        g.drawImage(fgLayer(), -80, -160 + fy, 780, 1000);
        const rim = mix(BODY, RIM, ml);
        XYT.sil.draw(g, 'old', 'sitBack', MAN.x, MAN.y + fy, MAN.h, t + 5, { wind: 0.2, windDir: -1, body: BODY, rim, rimSide: 1, rimWidth: 2 });
        // 身前的一道雪沿：衣摆陷进雪里
        g.fillStyle = 'rgba(150,164,194,0.85)';
        for (const [dx, w, hh] of [[-62, 22, 3.2], [-30, 30, 3.8], [8, 26, 3.4], [44, 30, 3.6], [70, 16, 2.6]]) {
          g.beginPath(); g.ellipse(MAN.x + dx, MAN.y + 2.5 + fy, w, hh, 0, 0, TAU); g.fill();
        }
        if (cov > 0.002) {
          g.save(); g.globalAlpha = 0.5 * cov;
          g.drawImage(fgMask(), -80, -160 + fy, 780, 1000);
          g.restore();
        }
      },
    });
  })();

  // ============================================================
  // e1_stormpeak（第33句）：雷雨夜孤峰之巅，少年侧影仰天大笑；三道闪电在第1、5、9字照亮他，第11字起黑暗吞没山巅
  // ============================================================
  (function () {
    const FB = [0.267, 0.627, 0.967, 1.327, 2.287, 2.667, 3.167, 3.587, 3.907, 4.377, 4.847];
    // 人物放大到 124 px（720p 下看得出仰起的头、下巴、张开的手臂和斗篷），整个剪影绕脚底向后仰约 3.4°（仰天大笑的姿态，姿势整镜不变）
    const MAN = { x: 520, y: 450, h: 124, lean: 0.06, wind: 0.62 };
    const BODY = '#0b0b15';
    // 冷紫蓝的主调，青白的闪电
    const BOLT_PAL = ['#62b4ec', '#ace2ff', '#ecfaff', '#ffffff'];
    const RIMC = '#d2f2ff';
    const RAINA = 0.27; // 雨向右斜：每下落 1 px 右移 0.27 px
    // 三道闪电：k = 对应的字；side 闪电在哪一侧（也是轮廓光那一侧）；amp 亮度
    // 第一道闪电就是转场的闪白：切点那一帧起在左边落下（不在第1字再另打一道，免得白—暗—白连闪）
    const STRIKES = [
      { k: -1, side: -1, amp: 0.9, seed: 11, x0: 250, y0: 180, x1: 150, y1: 572, br: 4 },
      { k: 4, side: 1, amp: 0.8, seed: 29, x0: 812, y0: 170, x1: 772, y1: 596, br: 3, maxX: 880, behind: true },
      { k: 8, side: -1, amp: 1.0, seed: 47, x0: 342, y0: 150, x1: 226, y1: 604, br: 5 },
    ];
    STRIKES.forEach((S, i) => {
      S.segs = boltPaths(S.seed * 101, S.x0, S.y0, S.x1, S.y1, { dev: 0.2, branches: S.br, maxX: S.maxX });
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const sg of S.segs) for (const p of sg.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      S.box = [Math.floor(x0 - 24), Math.floor(y0 - 24), Math.ceil(x1 - x0 + 48), Math.ceil(y1 - y0 + 48)];
      S.key = 'fg6_e1_bolt' + i;
    });
    // 亮度包络：约 3 帧升起，0.5 s 回落；闪电枝本身更快熄灭。转场那一道从切点峰值直接回落（升起就是转场的闪白），
    // 闪电枝多留约 0.15 s，等闪白退下去时还看得见
    const skyEnv = (tau, cut) => (tau < 0 ? 0 : cut ? Math.exp(-tau / 0.19) : tau < 0.1 ? smooth(tau / 0.1) : Math.exp(-(tau - 0.1) / 0.16));
    const boltEnv = (tau, cut) => (tau < 0 ? 0 : cut ? (tau < 0.15 ? 1 : Math.exp(-(tau - 0.15) / 0.09)) : tau < 0.1 ? smooth(tau / 0.1) : Math.exp(-(tau - 0.1) / 0.075));

    const sky = () => K.cache('fg6_e1_sky', W, H, 0.5, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#0e0d1d'); gr.addColorStop(0.28, '#17162c'); gr.addColorStop(0.46, '#232340');
      gr.addColorStop(0.535, '#36385c'); gr.addColorStop(0.58, '#2e2f4c'); gr.addColorStop(0.75, '#202036'); gr.addColorStop(1, '#161628');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    // 远方的云海平面：地平线附近略亮，向下渐暗，几道横向云纹
    const sea = () => K.cache('fg6_e1_sea', W, 220, 0.5, (g) => {
      g.translate(0, -390);
      const r = rng(3131);
      g.filter = 'blur(3px)';
      for (let i = 0; i < 30; i++) {
        const y = 404 + Math.pow(r(), 1.2) * 170, x = r() * W, w = 160 + r() * 380, hh = 1.5 + (y - 400) * 0.06 + r() * 3;
        const fa = smooth((y - 404) / 40);
        g.fillStyle = r() < 0.6 ? `rgba(58,58,92,${0.5 * fa})` : `rgba(14,14,28,${0.4 * fa})`;
        g.beginPath(); g.ellipse(x, y, w, hh, 0, 0, TAU); g.fill();
      }
      g.filter = 'none';
    });
    // 暴雨云：两层（主云块、低空碎云），各有一张受闪电照亮的浅色版本
    function stormPuffs(seed, n, yMin, yMax, rMin, rMax, right) {
      const r = rng(seed), P = [];
      for (let i = 0; i < n; i++) {
        const x = r() * 1600;
        const yb = yMax + (right && x > 1100 ? 50 : 0);
        P.push({ x, y: yMin + Math.pow(r(), 0.8) * (yb - yMin), r: rMin + r() * (rMax - rMin), k: r() });
      }
      return P;
    }
    const PA = stormPuffs(707, 120, 10, 330, 50, 120, true);
    const PB = stormPuffs(919, 40, 300, 380, 24, 60, false);
    function cloudLayer(g, P, base, hi, lo, solid) {
      g.filter = 'blur(6px)';
      g.fillStyle = base;
      if (solid) g.fillRect(-20, -40, 1640, solid);
      g.beginPath();
      for (const b of P) { g.moveTo(b.x + b.r, b.y); g.arc(b.x, b.y, b.r, 0, TAU); }
      g.fill();
      g.globalCompositeOperation = 'source-atop';
      // 云团上的明暗块：同色的合成一条路径一次填完（模糊滤镜每次填充都很慢）；分两遍叠，重叠处仍有深浅
      g.filter = 'blur(12px)';
      for (let pass = 0; pass < 2; pass++) {
        for (const lit of [true, false]) {
          g.fillStyle = lit ? rgba(hi, 0.21) : rgba(lo, 0.24);
          g.beginPath();
          for (let i = pass; i < P.length; i += 2) {
            const b = P[i];
            if ((b.k < 0.5) !== lit) continue;
            const cx = b.x + (b.k - 0.5) * b.r, cy = b.y - b.r * 0.3;
            g.moveTo(cx + b.r * 0.6, cy); g.arc(cx, cy, b.r * 0.6, 0, TAU);
          }
          g.fill();
        }
      }
      g.filter = 'none';
      // 云底更暗
      const gr = g.createLinearGradient(0, 0, 0, 440);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(4,6,10,0.35)');
      g.fillStyle = gr; g.fillRect(-20, -40, 1640, 600);
      g.globalCompositeOperation = 'source-over';
    }
    const cA = () => K.cache('fg6_e1_cA', 1600, 600, 0.5, (g) => { g.translate(0, 40); cloudLayer(g, PA, '#18172b', '#2c2b4a', '#0d0c1b', 260); });
    const cAlit = () => K.cache('fg6_e1_cAl', 1600, 600, 0.5, (g) => { g.translate(0, 40); cloudLayer(g, PA, '#6c70a6', '#c0ccf4', '#4a4c7e', 260); });
    const cB = () => K.cache('fg6_e1_cB', 1600, 600, 0.5, (g) => { g.translate(0, 40); g.globalAlpha = 0.75; cloudLayer(g, PB, '#1f1e36', '#33324e', '#11101f', 0); });
    const cBlit = () => K.cache('fg6_e1_cBl', 1600, 600, 0.5, (g) => { g.translate(0, 40); g.globalAlpha = 0.75; cloudLayer(g, PB, '#7a7eae', '#cad4f6', '#565a88', 0); });
    // 孤峰身后的云底被远方天光映亮的一条冷带（世界 y 约 250–420）：闪电之间人物和山尖也能从天上分出来；歌词区（x>950）淡出
    const band = () => K.cache('fg6_e1_band', W, 260, 0.5, (g) => {
      g.translate(0, -220);
      g.filter = 'blur(14px)';
      const r = rng(2601);
      for (let lv = 0; lv < 2; lv++) {
        g.fillStyle = `rgba(112,116,170,${lv ? 0.26 : 0.17})`;
        g.beginPath();
        for (let i = 0; i < 13; i++) {
          const x = 40 + r() * 980, y = 300 + r() * 90, w = 90 + r() * 170, hh = 12 + r() * 22;
          g.moveTo(x + w, y); g.ellipse(x, y, w, hh, 0, 0, TAU);
        }
        g.fill();
      }
      g.filter = 'none';
      const v = g.createLinearGradient(0, 240, 0, 440);
      v.addColorStop(0, 'rgba(98,102,154,0)'); v.addColorStop(0.35, 'rgba(98,102,154,0.3)'); v.addColorStop(0.7, 'rgba(98,102,154,0.34)'); v.addColorStop(1, 'rgba(98,102,154,0)');
      g.fillStyle = v; g.fillRect(0, 230, W, 230);
      g.globalCompositeOperation = 'destination-in';
      const hz = g.createLinearGradient(0, 0, W, 0);
      hz.addColorStop(0, 'rgba(0,0,0,0.55)'); hz.addColorStop(0.3, 'rgba(0,0,0,1)'); hz.addColorStop(0.55, 'rgba(0,0,0,1)'); hz.addColorStop(0.74, 'rgba(0,0,0,0)');
      g.fillStyle = hz; g.fillRect(0, 220, W, 260);
      g.globalCompositeOperation = 'source-over';
    });

    const skyAll = () => K.cache('fg6_e1_skyall', W, H, 1, (g) => {
      g.drawImage(sky(), 0, 0, W, H);
      g.drawImage(sea(), 0, 390, W, 220);
    });
    // 每道闪电一张受光云层：按闪电时刻两层云的相对位置合成，遮罩（闪电周围亮、歌词区只留约 22%）画在云层自己的坐标里，随云一起走
    function litOf(i, t0) {
      const S = STRIKES[i], tk = t0 + 0.15;
      const axK = -150 + 8 * tk, offB = 16 * tk;
      return K.cache('fg6_e1_lit' + i + '_' + Math.round(offB), 1600, 600, 0.5, (g) => {
        g.drawImage(cAlit(), 0, 0, 1600, 600);
        g.drawImage(cBlit(), offB, 0, 1600, 600);
        g.globalCompositeOperation = 'destination-in';
        const cx = S.x0 - axK, cy = S.y0 + 70;
        const rg = g.createRadialGradient(cx, cy, 20, cx, cy, 760);
        rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(0.45, 'rgba(0,0,0,0.55)'); rg.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = rg; g.fillRect(0, 0, 1600, 600);
        const lg = g.createLinearGradient(700 - axK, 0, 1080 - axK, 0);
        lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(0.35, 'rgba(0,0,0,0.78)'); lg.addColorStop(0.7, 'rgba(0,0,0,0.3)'); lg.addColorStop(1, 'rgba(0,0,0,0.1)');
        g.fillStyle = lg; g.fillRect(0, 0, 1600, 600);
        g.globalCompositeOperation = 'source-over';
      });
    }
    // 山：远处低峰、近处中峰、主峰（参差的岩边）
    function ridgePath(pts, bottom, seed, jag) {
      const r = rng(seed), p = new Path2D();
      const P = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9));
        for (let k = 0; k < n; k++) {
          const u = k / n;
          P.push([lerp(a[0], b[0], u) + (k ? (r() - 0.5) * jag : 0), lerp(a[1], b[1], u) + (k ? (r() - 0.5) * jag : 0)]);
        }
      }
      P.push(pts[pts.length - 1]);
      p.moveTo(P[0][0], bottom);
      P.forEach((q) => p.lineTo(q[0], q[1]));
      p.lineTo(P[P.length - 1][0], bottom);
      p.closePath();
      return p;
    }
    // 脚下山尖的前沿：两块小石棱压住鞋尖和鞋跟（画在人物之后），脚像踩进岩缝里，不是站在平台上
    const TIP = (() => {
      const p = new Path2D();
      const q = [[499, 462], [503, 455.6], [507, 451.6], [509.6, 449.3], [512, 449.0], [514.4, 450.1], [517, 451.0], [523, 451.1], [526, 449.9], [528.6, 448.9], [531, 449.3], [534, 451.6], [538, 456.4], [541, 462]];
      p.moveTo(q[0][0], q[0][1]); q.forEach((v) => p.lineTo(v[0], v[1])); p.closePath();
      return p;
    })();
    const FARP = ridgePath([[-30, 640], [20, 600], [70, 578], [120, 592], [180, 612], [240, 596], [300, 606], [380, 620], [460, 612], [600, 618], [700, 604], [760, 582], [820, 572], [880, 590], [960, 606], [1040, 592], [1120, 584], [1190, 600], [1260, 612], [1320, 620]], 760, 61, 5);
    const MIDL = ridgePath([[-30, 612], [30, 588], [90, 568], [140, 560], [180, 572], [240, 600], [300, 640], [360, 700], [380, 760]], 760, 73, 6);
    const MIDR = ridgePath([[760, 760], [800, 694], [850, 618], [900, 574], [940, 563], [990, 578], [1060, 610], [1130, 598], [1190, 590], [1250, 602], [1320, 618]], 760, 79, 6);
    const MAIN = ridgePath([[300, 760], [326, 736], [348, 704], [374, 692], [390, 664], [410, 656], [420, 628], [434, 610], [446, 602], [452, 574], [464, 552], [468, 522], [480, 502], [486, 480], [494, 467], [501, 460], [507, 455.5], [512, 452.4], [516, 449.2], [520, 448.4], [524, 449.4], [528, 451.6], [533, 454.6], [538, 458.4], [544, 463], [548, 477], [558, 490], [561, 514], [575, 530], [579, 560], [594, 574], [599, 602], [617, 620], [626, 650], [648, 668], [670, 700], [710, 722], [760, 744], [804, 760]], 760, 89, 3);
    const farPeaks = () => K.cache('fg6_e1_farp', W, 360, 1, (g) => {
      // 世界 y = 400 .. 760
      g.translate(0, -400);
      g.fillStyle = '#1d1c31'; g.fill(FARP);
      // 远峰脚下的云雾
      const fg = g.createLinearGradient(0, 590, 0, 660);
      fg.addColorStop(0, 'rgba(40,40,64,0)'); fg.addColorStop(1, 'rgba(40,40,64,0.9)');
      g.fillStyle = fg; g.fillRect(0, 580, W, 180);
    });
    const midPeaks = () => K.cache('fg6_e1_midp', W, 360, 1, (g) => {
      g.translate(0, -400);
      // 比主峰远：颜色浅一层、偏蓝，脚下没进雾里
      const mc = g.createLinearGradient(0, 560, 0, 700);
      mc.addColorStop(0, '#18172a'); mc.addColorStop(1, '#1f1f35');
      g.fillStyle = mc; g.fill(MIDL); g.fill(MIDR);
      const mg = g.createLinearGradient(0, 600, 0, 720);
      mg.addColorStop(0, 'rgba(32,32,52,0)'); mg.addColorStop(1, 'rgba(32,32,52,0.75)');
      g.save(); g.clip(MIDL); g.fillStyle = mg; g.fillRect(0, 560, W, 200); g.restore();
      g.save(); g.clip(MIDR); g.fillStyle = mg; g.fillRect(0, 560, W, 200); g.restore();
    });
    const mainPeak = () => K.cache('fg6_e1_main', 520, 320, 1, (g) => {
      // 世界 x = 290 .. 810, y = 440 .. 760
      g.translate(-290, -440);
      g.fillStyle = '#0c0c17'; g.fill(MAIN);
      g.save(); g.clip(MAIN);
      // 石面：斧劈皴——一笔笔顺坡向外下方斜劈的长楔形，上宽下尖；亮面只比岩色略浅，旁边贴一道暗缝
      const r = rng(97);
      const xl = (y) => 520 - 220 * (y - 450) / 310, xr = (y) => 520 + 284 * (y - 450) / 310;
      const wedge = (x, y, ang, len, w, col) => {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const P = [];
        // 一侧是直的劈面，另一侧略凹，末端收尖；顶边斜切
        for (let j = 0; j <= 6; j++) { const u = j / 6; P.push([x + sa * len * u, y + ca * len * u]); }
        const Q = [];
        for (let j = 0; j <= 6; j++) {
          const u = j / 6, ww = w * Math.pow(1 - u, 0.9) * (1 - 0.18 * Math.sin(Math.PI * u));
          Q.push([x + sa * len * u + ca * ww, y + ca * len * u - sa * ww - w * 0.35 * (1 - u)]);
        }
        g.fillStyle = col;
        g.beginPath();
        P.forEach((q, j) => (j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        for (let j = Q.length - 1; j >= 0; j--) g.lineTo(Q[j][0], Q[j][1]);
        g.closePath(); g.fill();
      };
      g.filter = 'blur(1.2px)';
      for (let i = 0; i < 46; i++) {
        const y = 462 + Math.pow(r(), 0.8) * 286;
        const a = xl(y) + 6, b = xr(y) - 6;
        if (b - a < 8) continue;
        const x = lerp(a, b, r());
        const side = x < 520 + (r() - 0.5) * 20 ? -1 : 1;
        // 坡越外侧越斜：左半向左下、右半向右下
        const out = clamp(Math.abs(x - 520) / Math.max(20, (b - a) / 2));
        const ang = side * (0.2 + 0.35 * out + r() * 0.15);
        const len = 22 + r() * 54, w = (3 + r() * 6) * (0.7 + (y - 450) / 600);
        const lit = side < 0 ? 0.2 : 0.12;
        wedge(x, y, ang, len, w * side, `rgba(46,46,72,${lit + r() * 0.05})`);
        // 劈面外侧的暗缝
        wedge(x + side * w * 0.95, y + 2, ang, len * 0.85, w * 0.32 * side, 'rgba(0,0,0,0.25)');
      }
      g.filter = 'none';
      // 岩缝：细而暗，顺坡
      for (let i = 0; i < 26; i++) {
        const y = 470 + r() * 270, x = lerp(xl(y) + 8, xr(y) - 8, r()), len = 16 + r() * 46;
        const side = x < 520 ? -1 : 1;
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 0.7 + r() * 0.8;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + side * len * 0.12 + (r() - 0.5) * 6, y + len * 0.5); g.lineTo(x + side * len * 0.25 + (r() - 0.5) * 8, y + len); g.stroke();
      }
      // 几道横向的岩层台阶：画成暗的岩缝（台面下的阴影），不是亮线
      g.filter = 'blur(0.6px)';
      for (const [x0, x1, y] of [[410, 446, 657], [434, 470, 606], [575, 600, 575], [600, 626, 622], [480, 500, 503], [560, 578, 531]]) {
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + 2.5, x1, y + 1); g.stroke();
      }
      g.filter = 'none';
      g.restore();
    });
    // 轮廓光贴图：只留迎光一侧（及上沿）的细边
    function rimOf(key, paths, side, w, box, blur, fadeX) {
      return K.cache(key, box[2], box[3], 1, (g) => {
        g.translate(-box[0], -box[1]);
        if (blur) g.filter = 'blur(' + blur + 'px)';
        g.fillStyle = RIMC;
        for (const p of paths) g.fill(p);
        g.globalCompositeOperation = 'destination-out';
        g.translate(-side * w, w * 0.7);
        g.fillStyle = '#000';
        for (const p of paths) g.fill(p);
        g.translate(side * w, -w * 0.7);
        g.filter = 'none';
        // 歌词区里不亮：x 在 fadeX[0]..fadeX[1] 之间淡出
        if (fadeX) {
          g.globalCompositeOperation = 'destination-in';
          const mg = g.createLinearGradient(fadeX[0], 0, fadeX[1], 0);
          mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = mg; g.fillRect(box[0], box[1], box[2], box[3]);
        }
        g.globalCompositeOperation = 'source-over';
      });
    }
    const BOXP = [0, 400, W, 360], BOXM = [290, 440, 520, 320];
    const rimP = (side) => rimOf('fg6_e1_rimP' + side, [MIDL, MIDR], side, 3, BOXP, 2.4, [900, 980]);
    const rimM = (side) => rimOf('fg6_e1_rimM' + side, [MAIN], side, 1.9, BOXM, 0.5);

    // 谷中云雾两层，缓缓向右飘
    const mist = (k) => K.cache('fg6_e1_mist' + k, 1600, 200, 0.5, (g) => {
      const r = rng(4400 + k);
      g.filter = 'blur(10px)';
      for (let i = 0; i < 40; i++) {
        const x = r() * 1600, y = 60 + r() * 120, w = 80 + r() * 200;
        g.fillStyle = rgba(k ? '#2f2e4a' : '#25243c', 0.35 + r() * 0.3);
        g.beginPath(); g.ellipse(x, y, w, 16 + r() * 22, 0, 0, TAU); g.fill();
      }
      g.filter = 'none';
    });

    // 雨：三层斜线，近快远慢；总数 ≤ 300
    const RAIN = [
      { n: 130, len: 11, sp: 520, a: 0.13, w: 0.8, seed: 1 },
      { n: 110, len: 20, sp: 820, a: 0.2, w: 1.0, seed: 2 },
      { n: 50, len: 38, sp: 1250, a: 0.26, w: 1.4, seed: 3 },
    ];
    function drawRain(g, t, k) {
      g.save();
      g.lineCap = 'round';
      for (const L of RAIN) {
        g.strokeStyle = rgba('#bcc4e8', clamp(L.a * k));
        g.lineWidth = L.w;
        g.beginPath();
        const span = H + 160, spanX = W + 420;
        for (let i = 0; i < L.n; i++) {
          const y0 = h2(i, L.seed * 31) * span, x0 = h2(i, L.seed * 31 + 1) * spanX;
          const yy = y0 + L.sp * t;
          const y = pmod(yy, span) - 80;
          const x = pmod(x0 + RAINA * yy, spanX) - 210;
          g.moveTo(x, y); g.lineTo(x - RAINA * L.len, y - L.len);
        }
        g.stroke();
      }
      g.restore();
    }

    XYT.registerShot('e1_stormpeak', {
      name: '雷峰狂笑', zone: 'right', night: true, text: '#eef2fa', shadow: 'rgba(6,8,14,0.92)', accent: '#c9d6ea', bloom: 0.38,
      draw(g, c) {
        const t = Math.max(0, c.lt);
        // 各道闪电的时刻与亮度
        let env = 0, cur = STRIKES[0], curE = 0;
        const fl = STRIKES.map((S) => {
          const cut = S.k < 0;
          const t0 = cut ? 0 : charAt(c, S.k, 0, FB);
          const e = skyEnv(t - t0, cut) * S.amp;
          if (t >= t0 - 0.3) cur = S;
          if (e > env) env = e;
          return { S, t0, e, be: boltEnv(t - t0, cut) };
        });
        curE = fl.find((f) => f.S === cur).e;
        const tKong = charAt(c, 10, 0, FB);
        const dark = smooth((t - tKong) / 1.1);

        const Sx = g.getTransform().a;
        const sn = (v) => Math.round(v * Sx) / Sx;
        // 开镜的闪白里先建好闪电要用的贴图
        if (t < 0.2) {
          band();
          fl.forEach((f, i) => { litOf(i, f.t0); boltTex(f.S.key, f.S.segs, f.S.box, f.S.y0, 1, BOLT_PAL); rimM(f.S.side); rimP(f.S.side); });
        }
        // 天空与远方云海
        g.drawImage(skyAll(), 0, 0, W, H);
        // 暴雨云缓缓向右翻滚（暗而软，贴到整像素看不出顿）
        const ax = sn(-150 + 8 * t), bx = sn(-150 + 24 * t);
        g.drawImage(up('fg6_e1_cA', 1600, 600, cA), ax, -40, 1600, 600);
        g.drawImage(up('fg6_e1_cB', 1600, 600, cB), bx, -40, 1600, 600);
        // 孤峰身后映亮的云底（静止的一条冷带，闪电之间也能把人物从天上分出来）
        g.drawImage(up('fg6_e1_band', W, 260, band), 0, 220, W, 260);
        // 闪电照亮云层：浅色云层在闪电周围显出来，歌词区（x>980）最多提亮约 15%
        if (env > 0.004) {
          const S = cur, f0 = fl.find((f) => f.S === cur);
          g.save();
          g.globalAlpha = clamp(0.78 * env);
          g.drawImage(litOf(STRIKES.indexOf(S), f0.t0), ax, -40, 1600, 600);
          g.globalCompositeOperation = 'lighter';
          // 闪电周围的天光；右侧那道收小一些，不把歌词区照亮
          const gr0 = S.side > 0 ? 240 : 360;
          g.globalAlpha = clamp(0.34 * env);
          putGlow(g, softTex('#8e9ce6'), S.x0 - (S.side > 0 ? 40 : 0), S.y0 + 60, gr0);
          g.globalAlpha = clamp(0.34 * env);
          putGlow(g, softTex('#8492cc'), S.x1, S.y1, S.side > 0 ? 170 : 240);
          // 云层从里面被照亮：孤峰人物身后的云底也亮起来，剪影被衬出来
          g.globalAlpha = clamp(0.3 * env);
          putGlow(g, softTex('#8c98dc'), MAN.x + S.side * 40, 330, 250);
          g.restore();
        }

        // 闪电：右边那道落在远峰后面（远峰挡住下端），左边两道落在近处山丘上（近丘挡住下端）
        const bolts = (behind) => {
          g.save(); g.globalCompositeOperation = 'lighter';
          for (const f of fl) {
            if (f.be < 0.004 || !f.S.behind !== !behind) continue;
            const B = f.S.box;
            g.globalAlpha = clamp(f.be * (0.75 + 0.25 * f.S.amp));
            g.drawImage(boltTex(f.S.key, f.S.segs, B, f.S.y0, 1, BOLT_PAL), B[0], B[1], B[2], B[3]);
          }
          g.restore();
        };
        bolts(true);
        // 远峰
        g.drawImage(farPeaks(), 0, 400, W, 360);
        bolts(false);
        // 谷中云雾
        g.drawImage(up('fg6_e1_mist0', 1600, 200, () => mist(0)), sn(-150 + 6 * t), 540, 1600, 200);
        g.drawImage(up('fg6_e1_mist1', 1600, 200, () => mist(1)), sn(-150 + 13 * t), 590, 1600, 200);
        // 近处山丘与它们的轮廓光
        g.drawImage(midPeaks(), 0, 400, W, 360);
        if (curE > 0.004) {
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.22 * curE);
          g.drawImage(rimP(cur.side), BOXP[0], BOXP[1], BOXP[2], BOXP[3]);
          g.restore();
        }
        // 主峰与人物
        g.drawImage(mainPeak(), BOXM[0], BOXM[1], BOXM[2], BOXM[3]);
        if (curE > 0.004) {
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.62 * curE);
          g.drawImage(rimM(cur.side), BOXM[0], BOXM[1], BOXM[2], BOXM[3]);
          g.restore();
        }
        // 脚下一小团柔和的暗影（没有亮边）
        g.save(); g.globalAlpha = 0.7;
        g.translate(MAN.x, MAN.y + 0.5); g.scale(1, 0.25);
        putGlow(g, softTex('#04040a'), 0, 0, 7);
        g.restore();
        // 人物：整个剪影绕脚底向后仰一点（面朝左，向右仰）；闪电在哪边，哪边就有 2–3 px 的青白轮廓光
        g.save();
        g.translate(MAN.x, MAN.y); g.rotate(MAN.lean); g.translate(-MAN.x, -MAN.y);
        XYT.sil.draw(g, 'youth', 'laughSide', MAN.x, MAN.y, MAN.h, t + 3, {
          facing: -1, wind: MAN.wind, windDir: 1, body: BODY, rim: mix(BODY, RIMC, clamp(curE * 1.15)), rimSide: cur.side, rimWidth: 2.4,
        });
        g.restore();
        // 脚下山尖的前沿石棱（压住鞋尖、鞋跟），迎闪电一侧的石棱上沿跟着亮
        g.fillStyle = '#0c0c17'; g.fill(TIP);
        if (curE > 0.004) {
          g.save(); g.clip(TIP);
          g.strokeStyle = rgba(RIMC, clamp(0.7 * curE)); g.lineWidth = 1.6;
          g.beginPath();
          if (cur.side < 0) { g.moveTo(499, 462); g.lineTo(503, 455.6); g.lineTo(507, 451.6); g.lineTo(509.6, 449.3); g.lineTo(512, 449.0); }
          else { g.moveTo(528.6, 448.9); g.lineTo(531, 449.3); g.lineTo(534, 451.6); g.lineTo(538, 456.4); g.lineTo(541, 462); }
          g.stroke();
          g.restore();
        }

        // 黑暗吞没：峰与人只剩极淡轮廓
        if (dark > 0.002) { g.fillStyle = rgba('#04040c', 0.74 * dark); g.fillRect(0, 0, W, H); }
        // 雨（闪电时被照亮，黑暗里变淡但不停）
        drawRain(g, t, (1 + 2.2 * env) * (1 - 0.45 * dark));
      },
    });
  })();

  // ============================================================
  // e3_temple（第35句）：雨夜荒山破庙残檐下，戴斗笠披蓑衣的旅人侧影避雨；第5字一道远闪照出盘旋到庙前的山路，第9字复暗
  // ============================================================
  (function () {
    const FB = [0.238, 0.638, 1.038, 1.438, 2.258, 2.678, 3.098, 3.518, 3.918, 4.358, 4.798];
    const MAN = { x: 760, y: 600, h: 210 };
    const STEP_Y = 600, STEP_X0 = 566, DRIP_Y = 626;
    const E = (x) => 262 - (x - 600) * (142 / 700); // 残檐前沿：右上高、左下低
    const HOOK = { x: 852, y: E(852) + 4 };
    const CORD = 74;
    const BODY = '#0c0f14';
    const WARM = '#d9a35a', WARM2 = '#ffd49a', COOL = '#8fa3b8';
    const RAINA = 0.16;

    // ---- 远景：天、三层山、雾；闪电时用的山脊亮边与山路 ----
    const sky = () => K.cache('fg6_e3_sky', 1400, 720, 0.5, (g) => {
      g.translate(60, 0);
      const gr = g.createLinearGradient(0, 0, 0, 640);
      gr.addColorStop(0, '#0b0f15'); gr.addColorStop(0.45, '#151b23'); gr.addColorStop(0.7, '#1f262f'); gr.addColorStop(1, '#222a33');
      g.fillStyle = gr; g.fillRect(-60, 0, 1400, 720);
      // 低云：几团更暗的云
      const r = rng(5501);
      g.filter = 'blur(14px)';
      for (let i = 0; i < 26; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(8,10,15,0.45)' : 'rgba(40,48,58,0.25)';
        g.beginPath(); g.ellipse(-60 + r() * 1400, 40 + r() * 260, 120 + r() * 200, 30 + r() * 50, 0, 0, TAU); g.fill();
      }
      g.filter = 'none';
    });
    const RFAR = [[-80, 432], [-10, 404], [60, 382], [120, 396], [190, 362], [260, 344], [330, 368], [390, 352], [450, 380], [520, 372], [600, 400], [680, 414], [760, 430]];
    const RMID = [[-80, 486], [0, 470], [70, 452], [140, 466], [220, 488], [290, 470], [360, 492], [430, 506], [500, 520], [580, 540], [660, 556]];
    const RNEAR = [[-80, 560], [-10, 548], [70, 534], [150, 546], [230, 566], [300, 574], [380, 588], [470, 600], [560, 610], [660, 614]];
    function ridgeFill(g, pts, bottom, col) {
      const p = new Path2D();
      smoothTo(p, pts, true); p.lineTo(pts[pts.length - 1][0], bottom); p.lineTo(pts[0][0], bottom); p.closePath();
      g.fillStyle = col; g.fill(p);
      return p;
    }
    const mtFar = () => K.cache('fg6_e3_mfar', 900, 360, 0.5, (g) => {
      g.translate(90, -320);
      ridgeFill(g, RFAR, 680, '#29313c');
      // 远山脚下一层冷雾（比中景山亮），闪电之间也看得出远山与中景山的轮廓
      const fg = g.createLinearGradient(0, 396, 0, 486);
      fg.addColorStop(0, 'rgba(52,62,76,0)'); fg.addColorStop(0.6, 'rgba(56,67,82,0.8)'); fg.addColorStop(1, 'rgba(58,70,86,0.95)');
      g.fillStyle = fg; g.fillRect(-90, 380, 900, 300);
    });
    const mtMid = () => K.cache('fg6_e3_mmid', 900, 300, 0.5, (g) => {
      g.translate(90, -420);
      const p = ridgeFill(g, RMID, 720, '#1c232c');
      // 山上的树影
      const r = rng(5577);
      g.save(); g.clip(p);
      for (const [cx, n] of [[20, 9], [130, 6], [300, 11], [470, 7]]) {
        for (let i = 0; i < n; i++) {
          const x = cx + (r() - 0.5) * n * 9, y0 = polyY(RMID, x), y = y0 + 3 + r() * 10, hh = 6 + r() * 9;
          g.fillStyle = 'rgba(16,20,27,0.85)';
          g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x + hh * 0.3, y); g.lineTo(x - hh * 0.3, y); g.closePath(); g.fill();
        }
      }
      g.restore();
      const fg = g.createLinearGradient(0, 492, 0, 580);
      fg.addColorStop(0, 'rgba(40,49,60,0)'); fg.addColorStop(0.65, 'rgba(44,54,66,0.78)'); fg.addColorStop(1, 'rgba(46,56,68,0.9)');
      g.fillStyle = fg; g.fillRect(-90, 480, 900, 260);
    });
    const mtNear = () => K.cache('fg6_e3_mnear', 900, 260, 0.5, (g) => {
      g.translate(90, -500);
      const p = ridgeFill(g, RNEAR, 760, '#141920');
      // 近处几棵枯树
      g.strokeStyle = '#0d1116'; g.lineCap = 'round';
      for (const [x, hh, lean] of [[120, 70, -0.1], [168, 52, 0.08], [402, 60, 0.05]]) {
        const y = polyY(RNEAR, x) + 4;
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * hh, y - hh * 0.5, x + lean * hh * 1.5, y - hh); g.stroke();
        g.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) {
          const u = 0.45 + k * 0.14, bx = x + lean * hh * 1.5 * u, by = y - hh * u, d = k % 2 ? 1 : -1;
          g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + d * 8, by - 6, bx + d * 14, by - 14 + k * 2); g.stroke();
        }
      }
    });
    // 山脊亮边（闪电从远山后面来：远山最亮）
    const ridgeRim = () => K.cache('fg6_e3_rrim', 900, 300, 0.5, (g) => {
      g.translate(90, -320);
      g.lineJoin = 'round';
      const p = new Path2D(); smoothTo(p, RFAR, true);
      g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(170,188,216,0.6)'; g.lineWidth = 5; g.stroke(p);
      g.filter = 'blur(0.6px)'; g.strokeStyle = 'rgba(215,226,244,0.7)'; g.lineWidth = 1.2; g.stroke(p);
      g.filter = 'none';
      const q = new Path2D(); smoothTo(q, RMID, true);
      g.strokeStyle = 'rgba(170,186,212,0.45)'; g.lineWidth = 1; g.stroke(q);
    });
    // 山路：从远山垭口盘旋下来，过近丘，沿庙前地面通到门口；按远近分三段，各自被前面的山挡住
    const ROAD = [
      { pts: [[330, 370], [350, 378], [292, 396], [352, 420], [318, 452]], w0: 1.6, w1: 3.0, seed: 31 },
      { pts: [[300, 478], [338, 486], [262, 502], [350, 522], [296, 546], [372, 566]], w0: 3.0, w1: 4.6, seed: 32 },
      // 近段：过近丘后沿庙前地面一直通到台阶前（人物脚下的门前）；台阶下沿是 y 616，路在它下面露出来
      { pts: [[296, 582], [392, 590], [338, 600], [452, 610], [548, 618], [620, 621], [684, 622], [742, 620]], w0: 4.6, w1: 7.0, seed: 33 },
    ];
    // 每段路只缓存自己的外框（整张大图用 lighter 叠加很慢）
    ROAD.forEach((R) => {
      const xs = R.pts.map((q) => q[0]), ys = R.pts.map((q) => q[1]), m = 6 + R.w1;
      R.box = [Math.floor(Math.min(...xs) - m), Math.floor(Math.min(...ys) - m), 0, 0];
      R.box[2] = Math.ceil(Math.max(...xs) + m) - R.box[0]; R.box[3] = Math.ceil(Math.max(...ys) + m) - R.box[1];
    });
    const roadImg = (k) => { const B = ROAD[k].box; return up('fg6_e3_road' + k, B[2], B[3], () => roadTex(k)); };
    const roadTex = (k) => K.cache('fg6_e3_road' + k, ROAD[k].box[2], ROAD[k].box[3], 0.5, (g) => {
      g.translate(-ROAD[k].box[0], -ROAD[k].box[1]);
      const R = ROAD[k], r = rng(R.seed);
      // 沿平滑曲线取样
      const P = [];
      const pts = R.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = i ? [(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2] : pts[0];
        const c0 = pts[i], b = i < pts.length - 2 ? [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2] : pts[i + 1];
        for (let j = 0; j < 12; j++) {
          const u = j / 12;
          P.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c0[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c0[1] + u * u * b[1]]);
        }
      }
      P.push(pts[pts.length - 1]);
      // 带状路面：两侧边缘按低频起伏不规则，近宽远窄
      const n = P.length, ph1 = r() * 6, ph2 = r() * 6;
      const Lp = [], Rp = [];
      for (let i = 0; i < n; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const u = i / (n - 1), w = lerp(R.w0, R.w1, u) / 2;
        const wl = w * (1 + 0.3 * Math.sin(i * 0.7 + ph1) + 0.15 * Math.sin(i * 1.9 + ph2));
        const wr = w * (1 + 0.3 * Math.sin(i * 0.55 + ph2) + 0.15 * Math.sin(i * 2.3 + ph1));
        Lp.push([P[i][0] - ty * wl, P[i][1] + tx * wl]); Rp.push([P[i][0] + ty * wr, P[i][1] - tx * wr]);
      }
      g.filter = 'blur(0.3px)';
      g.fillStyle = 'rgba(150,168,194,0.5)';
      g.beginPath();
      Lp.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
      for (let i = n - 1; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]);
      g.closePath(); g.fill();
      g.filter = 'none';
      // 湿路面映着天光：路心一道断续的亮水光
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(222,232,246,0.62)';
      g.setLineDash([11, 4, 5, 7, 16, 5]);
      g.lineWidth = Math.max(0.7, 0.32 * (R.w0 + R.w1) / 2);
      g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1] - 0.15 * R.w1) : g.moveTo(q[0], q[1] - 0.15 * R.w1))); g.stroke();
      g.setLineDash([]);
      // 几处被草木、土坎挡住的断口（两端渐隐，不是刀切）
      g.globalCompositeOperation = 'destination-out';
      for (let j = 0; j < 3; j++) {
        const q = P[Math.floor((0.15 + 0.7 * r()) * (n - 1))], rr = 3 + R.w1 * (0.8 + r());
        const gg = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr);
        gg.addColorStop(0, 'rgba(0,0,0,0.85)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gg; g.fillRect(q[0] - rr, q[1] - rr, 2 * rr, 2 * rr);
      }
      g.globalCompositeOperation = 'source-over';
    });
    const mist = () => K.cache('fg6_e3_mist', 1000, 200, 0.5, (g) => {
      const r = rng(6006);
      g.filter = 'blur(12px)';
      for (let i = 0; i < 18; i++) {
        g.fillStyle = rgba('#2c3540', 0.3 + r() * 0.3);
        g.beginPath(); g.ellipse(r() * 1000, 80 + r() * 60, 90 + r() * 160, 14 + r() * 16, 0, 0, TAU); g.fill();
      }
      g.filter = 'none';
    });

    // ---- 破庙：墙、门洞、柱、残檐、台基 ----
    const temple = () => K.cache('fg6_e3_temple', 760, 620, 1, (g) => {
      // 世界 x = 560 .. 1320, y = 100 .. 720
      g.translate(-560, -100);
      // 台基（石阶）
      g.fillStyle = '#20252c'; g.fillRect(STEP_X0, STEP_Y, 760, 16);
      g.fillStyle = '#2c323a'; g.fillRect(STEP_X0, STEP_Y, 760, 2.5);
      g.strokeStyle = 'rgba(8,10,14,0.6)'; g.lineWidth = 1;
      for (let x = STEP_X0 + 40; x < 1320; x += 70 + (x % 23)) { g.beginPath(); g.moveTo(x, STEP_Y + 2); g.lineTo(x - 2, STEP_Y + 16); g.stroke(); }
      // 墙：斑驳的灰泥，局部露砖，檐下水渍
      const WX = 652;
      const wall = new Path2D();
      wall.moveTo(WX, STEP_Y); wall.lineTo(WX, E(WX) + 34);
      for (let x = WX; x <= 1320; x += 20) wall.lineTo(x, E(x) + 34);
      wall.lineTo(1320, STEP_Y); wall.closePath();
      const wg = g.createLinearGradient(0, 160, 0, 600);
      wg.addColorStop(0, '#191c21'); wg.addColorStop(1, '#22262c');
      g.fillStyle = wg; g.fill(wall);
      g.save(); g.clip(wall);
      const r = rng(7117);
      g.filter = 'blur(3px)';
      for (let i = 0; i < 46; i++) {
        g.fillStyle = r() < 0.4 ? 'rgba(48,52,58,0.16)' : 'rgba(6,8,11,0.2)';
        g.beginPath(); g.ellipse(WX + r() * 680, 200 + r() * 400, 10 + r() * 30, 8 + r() * 22, r() * 3, 0, TAU); g.fill();
      }
      g.filter = 'none';
      // 墙上几道裂缝
      g.strokeStyle = 'rgba(4,5,8,0.55)'; g.lineWidth = 1;
      for (const [x0, y0, n] of [[904, 250, 5], [1214, 420, 5], [700, 250, 3]]) {
        let x = x0, y = y0;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < n; k++) { x += (r() - 0.45) * 16; y += 10 + r() * 14; g.lineTo(x, y); }
        g.stroke();
      }
      // 灰泥剥落处露出的砖（不规则的边）
      for (const [bx, by, bw, bh] of [[1150, 318, 100, 60], [870, 500, 84, 56]]) {
        g.save();
        // 剥落处：边缘起伏平缓的一块
        const pts = [];
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * TAU, rr = 0.82 + 0.12 * Math.sin(k * 2.1 + bx) + 0.06 * Math.sin(k * 5.3);
          pts.push([bx + bw / 2 + Math.cos(a) * bw / 2 * rr, by + bh / 2 + Math.sin(a) * bh / 2 * rr]);
        }
        pts.push(pts[0], pts[1]);
        const cp = new Path2D(); smoothTo(cp, pts, true); cp.closePath();
        g.clip(cp);
        g.fillStyle = '#121418'; g.fillRect(bx, by, bw, bh);
        g.fillStyle = '#26221f';
        for (let yy = by; yy < by + bh; yy += 9) for (let xx = bx - ((yy / 9) % 2) * 9; xx < bx + bw; xx += 19) g.fillRect(xx + 1, yy + 1, 16, 6.5);
        g.restore();
      }
      // 水渍：从檐下往下的竖条
      for (let i = 0; i < 26; i++) {
        const x = WX + r() * 670, y0 = E(x) + 34, len = 60 + r() * 220;
        const sg = g.createLinearGradient(0, y0, 0, y0 + len);
        sg.addColorStop(0, 'rgba(8,10,14,0.45)'); sg.addColorStop(1, 'rgba(8,10,14,0)');
        g.fillStyle = sg; g.fillRect(x, y0, 3 + r() * 8, len);
      }
      g.restore();
      // 门洞：深色门内、木门框、门槛
      const DX0 = 978, DX1 = 1112, DT = 352;
      g.fillStyle = '#07090c'; g.fillRect(DX0, DT, DX1 - DX0, STEP_Y - DT);
      const dg = g.createLinearGradient(DX0, 0, DX1, 0);
      dg.addColorStop(0, 'rgba(30,24,20,0.5)'); dg.addColorStop(0.3, 'rgba(0,0,0,0)');
      g.fillStyle = dg; g.fillRect(DX0, DT, DX1 - DX0, STEP_Y - DT);
      g.fillStyle = '#1c1714';
      g.fillRect(DX0 - 12, DT - 16, 12, STEP_Y - DT + 16); g.fillRect(DX1, DT - 16, 12, STEP_Y - DT + 16);
      g.fillRect(DX0 - 22, DT - 26, DX1 - DX0 + 44, 14);
      g.fillStyle = '#241e1a'; g.fillRect(DX0 - 4, STEP_Y - 8, DX1 - DX0 + 8, 8);
      // 一扇歪斜的残门
      g.fillStyle = '#16120f';
      g.beginPath(); g.moveTo(DX1 - 4, DT + 6); g.lineTo(DX1 - 40, DT + 18); g.lineTo(DX1 - 42, STEP_Y - 10); g.lineTo(DX1 - 4, STEP_Y - 8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,48,38,0.5)'; g.lineWidth = 1;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(DX1 - 4 - k * 9, DT + 8 + k * 3); g.lineTo(DX1 - 5 - k * 9.5, STEP_Y - 9); g.stroke(); }
      // 檐下的椽头与暗面
      const soff = new Path2D();
      soff.moveTo(600, E(600)); for (let x = 600; x <= 1320; x += 20) soff.lineTo(x, E(x));
      for (let x = 1320; x >= 600; x -= 20) soff.lineTo(x, E(x) + 36);
      soff.closePath();
      g.fillStyle = '#121519'; g.fill(soff);
      g.fillStyle = '#1d2024';
      for (let x = 618; x < 1320; x += 17) { const y = E(x) + 6; g.fillRect(x, y, 7, 7); }
      // 柱：褪色的红漆，剥落
      const PX = 628, PW = 24;
      const pg = g.createLinearGradient(PX, 0, PX + PW, 0);
      pg.addColorStop(0, '#2a1612'); pg.addColorStop(0.55, '#3f221a'); pg.addColorStop(1, '#1c0f0c');
      g.fillStyle = pg; g.fillRect(PX, E(PX) + 10, PW, STEP_Y - E(PX) - 10);
      // 剥落的漆：几道细长的浅色竖纹
      g.strokeStyle = 'rgba(78,70,62,0.45)'; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const x = PX + 4 + r() * 16, y = 300 + r() * 260, len = 10 + r() * 30;
        g.lineWidth = 1 + r() * 1.6;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 3, y + len * 0.5, x + (r() - 0.5) * 2, y + len); g.stroke();
      }
      g.fillStyle = '#26292e'; g.fillRect(PX - 5, STEP_Y - 12, PW + 10, 12);
    });
    // 远闪照亮的天空（两团冷光叠成一张）
    const flashGlow = () => K.cache('fg6_e3_fglow', 840, 840, 1, (g) => {
      g.drawImage(softTex('#8296b8'), 0, 0, 840, 840);
      g.globalAlpha = 0.3 / 0.82;
      g.drawImage(softTex('#5d6e8c'), 420 - 300, 420 + 70 - 300, 600, 600);
      g.globalAlpha = 1;
    });
    const nearGroup = () => K.cache('fg6_e3_near', 1440, 300, 1, (g) => {
      // 世界 x = -120 .. 1320, y = 420 .. 720
      g.translate(120, -420);
      g.drawImage(mtMid(), -90, 420, 900, 300);
      g.drawImage(mtNear(), -90, 500, 900, 260);
      const gg = g.createLinearGradient(0, 600, 0, 720);
      gg.addColorStop(0, '#191e25'); gg.addColorStop(1, '#0e1116');
      g.fillStyle = gg; g.fillRect(-120, 612, 1440, 110);
    });
    const tint = (src, col) => (g) => {
      const [w, h] = [g.canvas.width, g.canvas.height];
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(src(), 0, 0, w, h);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      g.restore();
    };
    // 闪光时的冷光只落在山坡上；庙前泥地是歌词区，只在地平线下留一窄条湿光（世界 y 606→622 淡到 0）
    const nearCool = () => K.cache('fg6_e3_nearc', 1440, 210, 0.5, (g) => {
      // 世界 y = 420 .. 630（再往下全为 0，不必合成）
      g.drawImage(nearGroup(), 0, 0, 1440, 300);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#6f82a0'; g.fillRect(0, 0, 1440, 210);
      const gf = g.createLinearGradient(0, 0, 0, 210);
      gf.addColorStop(186 / 210, 'rgba(0,0,0,1)'); gf.addColorStop(194 / 210, 'rgba(0,0,0,0.35)'); gf.addColorStop(202 / 210, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = gf; g.fillRect(0, 0, 1440, 210);
      g.globalCompositeOperation = 'source-over';
    });
    const farCool = () => K.cache('fg6_e3_farc', 900, 360, 0.5, tint(() => up('fg6_e3_mfar', 900, 360, mtFar), '#6f82a0'));
    // 闪光时远山的冷光（0.09）与山脊亮边合成一张，按闪光强度一次叠加
    const farFlash = () => K.cache('fg6_e3_ffl', 900, 360, 0.5, (g) => {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.09; g.drawImage(farCool(), 0, 0, 900, 360);
      g.globalAlpha = 1; g.drawImage(ridgeRim(), 0, 0, 900, 300);
      g.globalCompositeOperation = 'source-over';
    });
    const templeAll = () => K.cache('fg6_e3_tall', 800, 780, 1, (g) => {
      // 世界 x = 540 .. 1340, y = -60 .. 720
      g.drawImage(temple(), 20, 160, 760, 620);
      g.drawImage(eave(), 0, 0, 800, 380);
    });
    // 同一张庙向右错开半个设备像素：平移时按半像素相位二选一、贴整像素（小数位贴图慢很多，整像素跳动又会一顿一顿）
    const templeHalf = () => K.cache('fg6_e3_tallh', 801, 780, 1, (g) => {
      g.drawImage(templeAll(), 0.5 / g.getTransform().a, 0, 800, 780);
    });
    const templeCool = () => K.cache('fg6_e3_tcool', 760, 620, 0.5, (g) => {
      g.drawImage(temple(), 0, 0, 760, 620);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = COOL; g.fillRect(0, 0, 760, 620);
      g.globalCompositeOperation = 'source-over';
    });
    // 屋檐（瓦面、瓦当、断口），画在雨帘之后、人物之前不挡人
    const eave = () => K.cache('fg6_e3_eave', 800, 380, 1, (g) => {
      // 世界 x = 540 .. 1340, y = -60 .. 320
      g.translate(-540, 60);
      const r = rng(8228);
      // 瓦面：从檐口向上伸出画框；左上一角塌了，断口参差
      const brk = [[722, -60], [716, -10], [700, 26], [706, 60], [682, 96], [676, 140], [654, 176], [646, 206], [622, 228], [612, 250]];
      const roof = new Path2D();
      roof.moveTo(604, E(604) + 1);
      for (let x = 604; x <= 1340; x += 10) roof.lineTo(x, E(x));
      roof.lineTo(1340, -60);
      for (const q of brk) roof.lineTo(q[0], q[1]);
      roof.closePath();
      g.fillStyle = '#0c0f13'; g.fill(roof);
      g.save(); g.clip(roof);
      // 瓦垄（顺坡向上）
      for (let x = 610; x < 1400; x += 13) {
        const y0 = E(x) - 2, x1 = x - 0.12 * 230, y1 = y0 - 230;
        const gd = g.createLinearGradient(0, y0, 0, y1);
        gd.addColorStop(0, 'rgba(0,0,0,0.3)'); gd.addColorStop(1, 'rgba(0,0,0,0)');
        g.strokeStyle = gd; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x, y0); g.lineTo(x1, y1); g.stroke();
        const gh = g.createLinearGradient(0, y0, 0, y0 - 150);
        gh.addColorStop(0, 'rgba(120,130,144,0.08)'); gh.addColorStop(1, 'rgba(120,130,144,0)');
        g.strokeStyle = gh; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x + 2, y0); g.lineTo(x1 + 2, y1); g.stroke();
      }
      // 瓦面上的水光（很淡）
      const sh = g.createLinearGradient(0, E(900) - 120, 0, E(900));
      sh.addColorStop(0, 'rgba(60,68,80,0)'); sh.addColorStop(1, 'rgba(60,68,80,0.25)');
      g.fillStyle = sh; g.fillRect(560, -60, 800, 380);
      g.restore();
      // 塌口处露出的椽子：几根细木伸向天空，一根折断下垂
      g.strokeStyle = '#0c0f13'; g.lineCap = 'round';
      for (const [y0, len, ang] of [[214, 30, 0.62], [150, 22, 0.5], [70, 34, 0.7]]) {
        const x0 = polyY(brk.map((q) => [q[1], q[0]]), y0) - 2;
        g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(x0 + 8, y0 + 6); g.lineTo(x0 - len * Math.sin(ang), y0 - len * Math.cos(ang)); g.stroke();
      }
      g.lineWidth = 4.5;
      g.beginPath(); g.moveTo(626, E(626) - 6); g.lineTo(590, E(626) + 14); g.stroke();
      // 瓦当：沿檐口一排小半圆，塌口附近缺几片
      for (let x = 606; x < 1340; x += 13) {
        if (x < 700 && r() < 0.4) continue;
        const y = E(x);
        g.fillStyle = '#16191e';
        g.beginPath(); g.arc(x + 6, y + 1, 5.6, 0, Math.PI); g.fill();
        g.fillStyle = 'rgba(66,70,76,0.4)';
        g.beginPath(); g.arc(x + 6, y + 1.5, 3.4, 0.2, Math.PI - 0.2); g.fill();
      }
      // 挂灯的铁钩
      g.strokeStyle = '#1a1c20'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(HOOK.x, E(HOOK.x) - 2); g.lineTo(HOOK.x, HOOK.y); g.stroke();
    });
    // 檐下的暖光（墙、椽、台基），随灯焰明暗
    // 暖金色是这一镜的主色：灯光照得更开、更暖（左边雨夜山野保持冷色，冷暖对照）
    const LR = 400;
    const lampLight = () => K.cache('fg6_e3_lamp2', 2 * LR, 2 * LR, 0.5, (g) => {
      const cx = LR, cy = LR;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, LR);
      gr.addColorStop(0, 'rgba(232,162,84,0.62)'); gr.addColorStop(0.16, 'rgba(214,140,66,0.34)'); gr.addColorStop(0.42, 'rgba(176,108,50,0.13)'); gr.addColorStop(0.72, 'rgba(140,86,40,0.04)'); gr.addColorStop(1, 'rgba(120,80,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 2 * LR, 2 * LR);
    });
    // 风灯悬于檐下：只照得到檐口以下（檐底、墙、地），照不到瓦面
    // 照得到的范围：柱子以右的檐下（墙、柱、门），再加台阶面；台阶下沿（y 616）以下是歌词区，不受灯焰明暗影响
    const UNDER = new Path2D();
    UNDER.moveTo(628, E(628));
    for (let x = 640; x <= 1340; x += 40) UNDER.lineTo(x, E(x));
    UNDER.lineTo(1340, 616); UNDER.lineTo(566, 616); UNDER.lineTo(566, 600); UNDER.lineTo(628, 600); UNDER.closePath();
    const LCX = HOOK.x, LCY = HOOK.y + CORD + 18;
    const LX = 566, LY = Math.floor(E(LCX + LR)) - 2, LW = Math.min(1340, LCX + LR) - 566, LH = 616 - LY;
    const lampLit = () => K.cache('fg6_e3_lampc2', LW, LH, 1, (g) => {
      g.translate(-LX, -LY);
      g.clip(UNDER);
      g.drawImage(lampLight(), LCX - LR, LCY - LR, 2 * LR, 2 * LR);
    });
    // 人挡住灯光，墙上留下的影子：灯在右上方，影子落在人左下方，按灯—人—墙的距离放大约 1.6 倍；
    // 纸罩有宽度，影子边缘是软的；只落到墙面（台基以上、檐底以下）
    const SHK = 1.6, SHX = 560, SHY = 360, SHW = 320, SHH = 250;
    const wallPath = () => {
      const p = new Path2D();
      p.moveTo(652, STEP_Y); p.lineTo(652, E(652) + 34);
      for (let x = 652; x <= 1320; x += 20) p.lineTo(x, E(x) + 34);
      p.lineTo(1320, STEP_Y); p.closePath();
      return p;
    };
    const manShadow = () => K.cache('fg6_e3_msh', SHW, SHH, 0.5, (g) => {
      const sharp = K.cache('fg6_e3_msh0', SHW, SHH, 0.5, (q) => {
        q.translate(-SHX, -SHY);
        q.translate(LCX, LCY); q.scale(SHK, SHK); q.translate(-LCX, -LCY);
        XYT.sil.draw(q, 'traveler', 'standSide', MAN.x, MAN.y, MAN.h, 4, { facing: -1, wind: 0.25, windDir: 1, body: '#05070a', rim: null });
      });
      g.save(); g.translate(-SHX, -SHY); g.clip(wallPath()); g.translate(SHX, SHY);
      g.filter = 'blur(3.5px)';
      g.drawImage(sharp, 0, 0, SHW, SHH);
      g.filter = 'none';
      g.restore();
    });
    // 风灯：纸罩圆筒、木顶木底，罩内火焰
    const lanternTex = () => K.cache('fg6_e3_lan', 40, 56, 3, (g) => {
      const x = 20;
      g.fillStyle = '#1b1410'; g.fillRect(x - 11, 4, 22, 5); g.fillRect(x - 10, 46, 20, 5);
      g.fillStyle = '#1b1410'; g.fillRect(x - 1, 0, 2, 5);
      const gr = g.createLinearGradient(x - 12, 0, x + 12, 0);
      gr.addColorStop(0, '#9a5a24'); gr.addColorStop(0.35, '#f2c27a'); gr.addColorStop(0.55, '#ffe2a8'); gr.addColorStop(1, '#a8642a');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - 10, 9); g.quadraticCurveTo(x - 14, 27, x - 10, 46); g.lineTo(x + 10, 46); g.quadraticCurveTo(x + 14, 27, x + 10, 9); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,70,30,0.45)'; g.lineWidth = 0.8;
      for (const yy of [16, 24, 32, 40]) { g.beginPath(); g.moveTo(x - 12, yy); g.lineTo(x + 12, yy); g.stroke(); }
    });

    // 纸罩变暗用的暗色版（同形）
    const lanternDark = () => K.cache('fg6_e3_land', 40, 56, 3, tint(lanternTex, '#160f0a'));
    // ---- 檐口雨帘：一串串水线，靠灯越近越亮成金线 ----
    const THREADS = [];
    {
      const r = rng(9393);
      let x = 606;
      while (x < 1300) {
        const low = x < 660;
        THREADS.push({ x, T: 0.55 + r() * 0.2, ph: r(), n: low ? 6 : 3 + Math.floor(r() * 2), w: low ? 1.8 : 1 + r() * 0.5, sw: r() * 10 });
        x += low ? 7 + r() * 4 : 12 + r() * 9;
      }
    }
    function lampK(x, y) {
      const dx = x - HOOK.x, dy = y - (HOOK.y + CORD + 18);
      return 1 / (1 + (dx * dx + dy * dy) / (190 * 190));
    }
    function drawCurtain(g, t, ox, lamp, cool) {
      g.save();
      g.lineCap = 'round';
      for (const th of THREADS) {
        const x0 = th.x + 6 + ox, y0 = E(th.x) + 5, L = DRIP_Y - y0;
        const k = lampK(th.x, (y0 + DRIP_Y) / 2);
        if (k < 0.2 && cool < 0.02) continue;
        const col = mix('#6f7f92', WARM2, clamp(k * 1.4));
        const a = (0.03 + 0.95 * k * k) * smooth((k - 0.2) / 0.08) * (0.6 + 0.4 * lamp) + 0.22 * cool;
        // 连续的细水线（略向右飘）：只在灯近处看得见
        if (k > 0.4) {
          g.strokeStyle = rgba(col, clamp(a * 0.175 * smooth((k - 0.4) / 0.25)));
          g.lineWidth = th.w * 0.6;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + RAINA * L * 0.5, DRIP_Y); g.stroke();
        }
        // 下落的水珠：自由落体，越往下越快、拉得越长
        g.strokeStyle = rgba(col, clamp(a));
        g.lineWidth = th.w * (1 + 0.5 * k);
        g.beginPath();
        for (let m = 0; m < th.n; m++) {
          const u = pmod(t / th.T + th.ph + m / th.n, 1);
          const y = y0 + L * u * u, len = 3 + 26 * u;
          const x = x0 + RAINA * 0.5 * (y - y0);
          g.moveTo(x, Math.max(y0, y - len)); g.lineTo(x + RAINA * 0.5 * len * 0.1, y);
        }
        g.stroke();
        // 灯边的水珠闪一点金光
        if (k > 0.42) {
          g.save(); g.globalCompositeOperation = 'lighter';
          const gt = glowTex(WARM2);
          for (let m = 0; m < th.n; m++) {
            const u = pmod(t / th.T + th.ph + m / th.n, 1);
            const y = y0 + L * u * u, x = x0 + RAINA * 0.5 * (y - y0);
            g.globalAlpha = clamp((k - 0.42) * 1.6 * lamp * smooth(u / 0.15));
            putGlow(g, gt, x, y, 4.5);
          }
          g.restore();
        }
        // 落地溅起的小水花
        const u0 = pmod(t / th.T + th.ph, 1 / th.n) * th.n;
        if (u0 < 0.3) {
          const sp = u0 / 0.3, xs = x0 + RAINA * 0.5 * L;
          g.strokeStyle = rgba(col, clamp(a * 0.8 * (1 - sp)));
          g.lineWidth = 0.8;
          g.beginPath(); g.ellipse(xs, DRIP_Y + 1, 2 + 7 * sp, 0.8 + 1.8 * sp, 0, Math.PI, TAU); g.stroke();
        }
      }
      g.restore();
    }

    // ---- 雨、雨圈 ----
    const RAIN = [
      // 雨丝长度约等于一帧（1/30 s）里落下的距离
      { n: 74, len: 16, sp: 560, a: 0.13, w: 0.8, seed: 5 },
      { n: 58, len: 26, sp: 860, a: 0.19, w: 1.0, seed: 6 },
      { n: 28, len: 42, sp: 1300, a: 0.245, w: 1.3, seed: 7 },
    ];
    function drawRain(g, t, peak, ox) {
      g.save();
      // 檐下无雨：把檐口前沿、雨帘与台阶围出的区域挖掉
      const clip = new Path2D();
      clip.rect(-60, -60, W + 120, H + 120);
      clip.moveTo(596 + ox, E(596)); clip.lineTo(596 + ox, DRIP_Y); clip.lineTo(1340 + ox, DRIP_Y); clip.lineTo(1340 + ox, E(1340)); clip.closePath();
      g.clip(clip, 'evenodd');
      g.lineCap = 'round';
      for (const L of RAIN) {
        if (peak > 0.003) {
          const gr = g.createLinearGradient(0, 560, 0, 612);
          gr.addColorStop(0, rgba('#a9b6c6', clamp(L.a * (1 + 2 * peak)))); gr.addColorStop(1, rgba('#a9b6c6', clamp(L.a * (1 + 0.3 * peak))));
          g.strokeStyle = gr;
        } else g.strokeStyle = rgba('#a9b6c6', L.a);
        g.lineWidth = L.w;
        g.beginPath();
        const span = H + 160, spanX = W + 300;
        for (let i = 0; i < L.n; i++) {
          const y0 = h2(i, L.seed * 37) * span, x0 = h2(i, L.seed * 37 + 1) * spanX;
          const yy = y0 + L.sp * t;
          const y = pmod(yy, span) - 80;
          const x = pmod(x0 + RAINA * yy, spanX) - 150;
          g.moveTo(x, y); g.lineTo(x - RAINA * L.len, y - L.len);
        }
        g.stroke();
      }
      g.restore();
    }
    // 风雨扫过：软边雨幕贴图（横向：后面一层薄雾、前缘后更浓、前缘渐隐；竖向：只在山野一带，上下渐隐）
    const VY0 = 262, VH = 360;
    const vProfile = (g, w) => {
      g.globalCompositeOperation = 'destination-in';
      const gv = g.createLinearGradient(0, 0, 0, VH);
      gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(0.22, 'rgba(0,0,0,1)'); gv.addColorStop(0.8, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gv; g.fillRect(0, 0, w, VH);
      g.globalCompositeOperation = 'source-over';
    };
    const veilBand = () => K.cache('fg6_e3_veil', 480, VH, 0.5, (g) => {
      const gr = g.createLinearGradient(0, 0, 480, 0);
      gr.addColorStop(0, 'rgba(62,72,86,0.13)'); gr.addColorStop(0.4, 'rgba(62,72,86,0.17)');
      gr.addColorStop(0.74, 'rgba(62,72,86,0.27)'); gr.addColorStop(1, 'rgba(62,72,86,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 480, VH);
      vProfile(g, 480);
    });
    const veilFlat = () => K.cache('fg6_e3_veilf', 16, VH, 1, (g) => {
      g.fillStyle = 'rgba(62,72,86,0.13)'; g.fillRect(0, 0, 16, VH);
      vProfile(g, 16);
    });
    function drawSweep(g, t, front) {
      const Sx = g.getTransform().a, sn = (v) => Math.round(v * Sx) / Sx;
      const bx = front - 420;
      if (bx > -10) g.drawImage(veilFlat(), -10, VY0, Math.min(bx, W + 10) + 11, VH);
      if (bx < W) g.drawImage(up('fg6_e3_veil', 480, VH, veilBand), sn(bx), VY0, 480, VH);
      // 雨幕里更密的斜雨：位置固定在世界里（只随雨落下），亮度随雨幕经过而起落
      if (front > -150 && front < 1000) {
        g.save(); g.lineCap = 'round'; g.lineWidth = 1.1;
        for (let i = 0; i < 50; i++) {
          const yy = h2(i, 811) * 380 + 1150 * t;
          const y = VY0 + pmod(yy, 380), x = -200 + pmod(h2(i, 812) * 900 + RAINA * yy, 900);
          const e = smooth((x - (front - 320)) / 80) * smooth((front + 20 - x) / 60) * smooth((y - VY0) / 50) * smooth((VY0 + 360 - y) / 50);
          if (e < 0.01) continue;
          g.strokeStyle = rgba('#a9b6c6', 0.27 * e);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - RAINA * 34, y - 34); g.stroke();
        }
        g.restore();
      }
    }
    function drawRings(g, t) {
      // 庙前泥地上的细雨圈：每个雨点周期性落下，圈从 0 长大并淡出，位置每个周期换一次
      g.save();
      g.lineWidth = 0.8;
      for (let i = 0; i < 34; i++) {
        const P = 0.7 + h2(i, 91) * 0.5, ph = h2(i, 92);
        const cyc = t / P + ph, n = Math.floor(cyc), u = cyc - n;
        const x = -40 + h2(i * 131 + n, 93) * (W + 80), y = DRIP_Y + 8 + Math.pow(h2(i * 131 + n, 94), 0.8) * 92;
        const s = 0.6 + (y - DRIP_Y) / 90;
        g.strokeStyle = rgba('#8090a2', 0.22 * (1 - u) * smooth(u / 0.08));
        g.beginPath(); g.ellipse(x, y, (2 + 11 * u) * s, (0.7 + 3.2 * u) * s, 0, 0, TAU); g.stroke();
      }
      g.restore();
    }
    // 远闪：闪电枝只在 x 200–600、远山后面
    const BOLT = (() => {
      const segs = boltPaths(7121, 410, 30, 352, 400, { dev: 0.2, branches: 4, maxX: 600 });
      for (const sg of segs) for (const p of sg.pts) p[0] = Math.max(205, Math.min(595, p[0]));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const sg of segs) for (const p of sg.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      return { segs, box: [Math.floor(x0 - 24), Math.floor(y0 - 24), Math.ceil(x1 - x0 + 48), Math.ceil(y1 - y0 + 48)] };
    })();

    XYT.registerShot('e3_temple', {
      name: '破庙夜雨', zone: 'bottom', night: true, text: '#f2e6d0', shadow: 'rgba(8,8,12,0.9)', accent: '#d9a35a', bloom: 0.26,
      draw(g, c) {
        const t = c.lt;
        const tBao = charAt(c, 4, 0, FB), tMei = charAt(c, 8, 0, FB);
        // 镜头：第5字起 3 s 内平滑左移，画面内容右移 40 px（峰值 20 px/s）
        const pan = 40 * smooth((t - tBao) / 3.0);
        // 远闪：约 3 帧升起、0.5 s 回落；天光、山脊亮边只跟闪光走
        const tau = t - tBao;
        const peak = tau < 0 ? 0 : tau < 0.1 ? smooth(tau / 0.1) : Math.exp(-(tau - 0.1) / 0.17);
        // 山路：湿路面映着天光，闪后仍隐约可见（约 12%），第9字一阵风雨从左向右扫过山野把它盖住
        const roadA = tau < 0 ? 0 : tau < 0.1 ? smooth(tau / 0.1) : 0.12 + 0.88 * Math.exp(-(tau - 0.1) / 0.17);
        const tW = tMei - 0.32;
        const front = -170 + 1320 * Math.max(0, t - tW);
        const swept = t > tW;
        const boltA = tau < 0 ? 0 : tau < 0.1 ? smooth(tau / 0.1) : Math.exp(-(tau - 0.1) / 0.08);
        // 风灯：火焰平时轻轻摇曳；第9字时一阵风把火焰压低，再慢慢回直
        const gu = t - tMei;
        const gust = gu < 0 ? 0 : gu < 0.35 ? smooth(gu / 0.35) : Math.exp(-(gu - 0.35) / 0.7);
        const lamp = (0.9 + 0.07 * noise1(t * 3.1, 11) + 0.03 * Math.sin(t * 7.3)) * (1 - 0.3 * gust) * (1 + 0.05 * c.be(0.3));
        const swing = 0.03 + 0.018 * Math.sin(TAU * 0.42 * t) + 0.008 * Math.sin(TAU * 0.9 * t + 1) + 0.07 * gust;

        const Sx = g.getTransform().a;
        const sn = (v) => Math.round(v * Sx) / Sx;
        const fx = sn(pan * 0.35), mx = sn(pan * 0.7), ox = pan;
        // 转场里先建好远闪要用的贴图
        if (t < 0.3) {
          flashGlow(); boltTex('fg6_e3_bolt', BOLT.segs, BOLT.box, 60, 0.55);
          up('fg6_e3_ffl', 900, 360, farFlash); up('fg6_e3_tcool', 760, 620, templeCool);
          for (let k = 0; k < 3; k++) roadImg(k);
          up('fg6_e3_nearc', 1440, 210, nearCool); lanternDark(); up('fg6_e3_veil', 480, VH, veilBand); veilFlat(); lampLit(); up('fg6_e3_msh', SHW, SHH, manShadow); templeHalf();
        }
        // 天与远山（远景暗、对比低，平移时贴整像素）
        g.drawImage(up('fg6_e3_sky', 1400, 720, sky), sn(-60 + pan * 0.25), 0, 1400, 720);
        // 闪电在远山后面：天空先亮，再画远山（山成剪影）
        if (peak > 0.003) {
          g.save(); g.globalCompositeOperation = 'lighter';
          g.globalAlpha = clamp(0.62 * peak);
          g.drawImage(flashGlow(), 380 + fx - 420, 260 - 420, 840, 840);
          if (boltA > 0.003) {
            g.globalAlpha = clamp(0.8 * boltA);
            const B = BOLT.box;
            g.drawImage(boltTex('fg6_e3_bolt', BOLT.segs, B, 60, 0.55), B[0] + fx, B[1], B[2], B[3]);
          }
          g.restore();
        }
        g.drawImage(up('fg6_e3_mfar', 900, 360, mtFar), -90 + fx, 320, 900, 360);
        // 被风雨扫过的部分不再画山路
        const roadClip = () => { if (swept) { g.beginPath(); g.rect(front - 40, 0, W + 400, H); g.clip(); } };
        if (peak > 0.003) {
          g.save(); g.globalCompositeOperation = 'lighter';
          g.globalAlpha = clamp(peak);
          g.drawImage(up('fg6_e3_ffl', 900, 360, farFlash), -90 + fx, 320, 900, 360);
          g.restore();
        }
        if (roadA > 0.003 && front < 760) {
          g.save(); roadClip(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(roadA);
          const B = ROAD[0].box;
          g.drawImage(roadImg(0), B[0] + fx, B[1], B[2], B[3]);
          g.restore();
        }
        g.drawImage(up('fg6_e3_mist', 1000, 200, mist), sn(-200 + 9 * Math.max(0, t) + pan * 0.3), 400, 1000, 200);
        // 中景、近丘与庙前湿泥地（一张）
        g.drawImage(nearGroup(), -120 + mx, 420, 1440, 300);
        // 闪光时中、近山坡与地面也泛一层冷光，山路落在被照亮的山坡上（闪光弱到不足半个灰阶就不再合成）
        if (peak > 0.02) {
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.12 * peak);
          g.drawImage(up('fg6_e3_nearc', 1440, 210, nearCool), -120 + mx, 420, 1440, 210);
          g.restore();
        }
        if (roadA > 0.003 && front < 760) {
          g.save(); roadClip(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.9 * roadA);
          const B1 = ROAD[1].box, B2 = ROAD[2].box;
          g.drawImage(roadImg(1), B1[0] + mx, B1[1], B1[2], B1[3]);
          g.globalAlpha = clamp(0.8 * roadA);
          g.drawImage(roadImg(2), sn(B2[0] + ox), B2[1], B2[2], B2[3]);
          g.restore();
        }
        // 第9字：一阵风雨从左向右扫过山野（软边的雨幕 + 幕里更密的斜雨），扫过后山野更朦胧
        if (swept) drawSweep(g, t, front);
        // 湿地上灯的暖色反光（只是淡淡的微光）
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16 * lamp;
        g.translate(HOOK.x + ox, DRIP_Y + 14); g.scale(1, 0.18);
        putGlow(g, softTex(WARM), 0, 0, 220);
        g.restore();
        drawRings(g, t);

        // 破庙（墙、门、柱、台基与残檐一张）
        {
          const X2 = Math.round((540 + ox) * Sx * 2), tc = X2 % 2 ? templeHalf() : templeAll();
          g.drawImage(tc, Math.floor(X2 / 2) / Sx, -60, tc.width / Sx, tc.height / Sx);
        }
        // 檐下暖光
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.95 * lamp);
        g.drawImage(lampLit(), sn(LX + ox), LY, LW, LH);
        g.restore();
        // 墙上的人影：深浅随灯焰；灯向右摆时影子向左移（影子离灯更远，位移约为灯的一半、方向相反）
        g.globalAlpha = clamp(0.52 * lamp);
        g.drawImage(up('fg6_e3_msh', SHW, SHH, manShadow), sn(SHX + ox - 0.5 * (CORD + 33) * (Math.sin(swing) - 0.03)), SHY, SHW, SHH);
        g.globalAlpha = 1;
        // 闪电时近景同时泛一层冷光
        if (peak > 0.02) {
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.16 * peak);
          g.drawImage(up('fg6_e3_tcool', 760, 620, templeCool), sn(560 + ox), 100, 760, 620);
          g.restore();
        }

        // 人物：斗笠蓑衣侧影，灯在右上方 → 右侧暖色轮廓光；闪电时左侧一层冷光
        const mxp = MAN.x + ox;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(mxp + 4, STEP_Y + 1, 30, 3, 0, 0, TAU); g.fill();
        XYT.sil.draw(g, 'traveler', 'standSide', mxp, MAN.y, MAN.h, t + 4, {
          facing: -1, wind: 0.25, windDir: 1, body: BODY, rim: mix(BODY, '#ffcf8a', clamp(0.85 * lamp)), rimSide: 1, rimWidth: 1.8,
        });
        // 闪光时面向远闪的左侧再加一道冷色轮廓光：同一剪影只在身体左半画一遍（主色相同，接缝看不出；不用半透明，省一张离屏画布）
        if (peak > 0.05) {
          g.save(); g.beginPath(); g.rect(-100, -100, mxp + 100, H + 200); g.clip();
          XYT.sil.draw(g, 'traveler', 'standSide', mxp, MAN.y, MAN.h, t + 4, {
            facing: -1, wind: 0.25, windDir: 1, body: BODY, rim: mix(BODY, '#c8d6ec', clamp((peak - 0.05) / 0.95)), rimSide: -1, rimWidth: 1.6,
          });
          g.restore();
        }
        // 斗笠边缘滴水：每拍一滴，前后檐轮流；先在笠沿慢慢鼓起，再自由落体（约 0.56 s）落到台阶上
        const b = c.b, st = c.t - c.lt;
        for (let j = b.i - 1; j <= b.i + 1; j++) {
          const td = c.grid.time(j) - st;
          const tip = j % 2 ? [-39, -192] : [36, -192];
          const xd = mxp + tip[0], yd = MAN.y + tip[1];
          const u = t - td;
          const k = lampK(xd - ox, yd);
          const col = mix('#9aa8b8', WARM2, clamp(k * 1.4));
          if (u > -0.45 && u <= 0) {
            const rr = 0.6 + 1.2 * smooth((u + 0.45) / 0.45);
            g.fillStyle = rgba(col, 0.8);
            g.beginPath(); g.ellipse(xd, yd + rr * 0.8, rr * 0.8, rr, 0, 0, TAU); g.fill();
          } else if (u > 0 && u < 0.56) {
            const y = yd + 0.5 * 1224 * u * u, v = 1224 * u;
            g.strokeStyle = rgba(col, 0.85); g.lineWidth = 1.6; g.lineCap = 'round';
            g.beginPath(); g.moveTo(xd, y - Math.min(14, 2 + v * 0.012)); g.lineTo(xd, y); g.stroke();
          } else if (u >= 0.56 && u < 0.86) {
            const sp = (u - 0.56) / 0.3;
            g.strokeStyle = rgba(col, 0.6 * (1 - sp)); g.lineWidth = 0.8;
            g.beginPath(); g.ellipse(xd, STEP_Y, 1.5 + 6 * sp, 0.6 + 1.4 * sp, 0, Math.PI, TAU); g.stroke();
          }
        }

        // 蓑衣下缘的草穗滴水：湿透的蓑衣在前后两处慢慢滴水（与斗笠的滴水错开），落到台阶上溅一点水花
        for (const [dx, P, ph] of [[-21, 1.37, 0.2], [25, 1.61, 0.9], [21, 1.93, 1.5]]) {
          const xd = mxp + dx, yd = MAN.y - 0.405 * MAN.h;
          const u = pmod(t + ph, P);
          const k = lampK(xd - ox, yd);
          const col = mix('#9aa8b8', WARM2, clamp(k * 1.4));
          if (u < 0.5) {
            const rr = 0.5 + 1.1 * smooth(u / 0.5);
            g.fillStyle = rgba(col, 0.7 * smooth(u / 0.15));
            g.beginPath(); g.ellipse(xd, yd + rr * 0.8, rr * 0.75, rr, 0, 0, TAU); g.fill();
          } else {
            const v = u - 0.5, y = yd + 0.5 * 1224 * v * v;
            if (y < STEP_Y) {
              g.strokeStyle = rgba(col, 0.75); g.lineWidth = 1.3; g.lineCap = 'round';
              g.beginPath(); g.moveTo(xd, y - Math.min(10, 2 + 1224 * v * 0.01)); g.lineTo(xd, y); g.stroke();
            } else {
              const sp = (v - Math.sqrt(2 * (STEP_Y - yd) / 1224)) / 0.28;
              if (sp < 1) {
                g.strokeStyle = rgba(col, 0.5 * (1 - sp)); g.lineWidth = 0.8;
                g.beginPath(); g.ellipse(xd, STEP_Y, 1.2 + 5 * sp, 0.5 + 1.2 * sp, 0, Math.PI, TAU); g.stroke();
              }
            }
          }
        }
        // 风灯（摆动；纸罩内火焰）
        g.save();
        g.translate(HOOK.x + ox, HOOK.y);
        // 风向右：灯底向右摆（画布逆时针转）
        g.rotate(-swing);
        g.strokeStyle = '#141414'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, CORD); g.stroke();
        g.drawImage(lanternTex(), -20, CORD - 2, 40, 56);
        const dim = clamp((0.95 - lamp) * 1.3);
        if (dim > 0.004) { g.globalAlpha = dim; g.drawImage(lanternDark(), -20, CORD - 2, 40, 56); g.globalAlpha = 1; }
        g.globalCompositeOperation = 'lighter';
        // 火焰：被风压低时更矮，并顺风偏右
        const fh = 9 * (1 - 0.45 * gust), lean = 1 + 6 * gust + 0.6 * Math.sin(t * 5.1);
        g.globalAlpha = clamp(0.8 * lamp);
        g.save(); g.translate(lean * 0.3, CORD + 33); g.rotate(0.22 * gust); g.scale(0.55, fh / 9);
        putGlow(g, glowTex('#ffe2a8'), 0, 0, 12);
        g.restore();
        g.globalAlpha = clamp(0.5 * lamp);
        putGlow(g, glowTex(WARM), 0, CORD + 26, 46);
        // 灯外一圈大的暖色光晕（雨雾里的灯）
        g.globalAlpha = clamp(0.24 * lamp);
        putGlow(g, softTex('#e0a052'), 0, CORD + 26, 120);
        g.restore();

        // 檐口雨帘（在人物前面）
        drawCurtain(g, t, ox, lamp, peak);
        // 雨
        drawRain(g, t, peak, ox);
      },
    });
  })();
})();
