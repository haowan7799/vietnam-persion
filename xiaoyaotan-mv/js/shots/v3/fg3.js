/* 第三版镜头组 fg3：b3_cliffcranes, b4_teahouse, c1_lotus */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { TAU, clamp, lerp, smooth, easeInOut, h2, rgba, mix, noise1, rng } = A;

  // 第 off 句第 k 字的镜头内时间（秒）；没有歌词时用分段表里的时间
  const charLt = (c, k, off, fb) => {
    const v = c.charT ? c.charT(k, off) : null;
    return v == null ? fb[k] : v - (c.t - c.lt);
  };
  const be = (c, d) => (c.be ? c.be(d) : 0);
  const de = (c, d) => (c.de ? c.de(d) : 0);
  // 快起慢落的单次包络：t0 处 rise 秒升到 1，之后按 fall 指数回落
  const pulse = (t, t0, rise, fall) => (t < t0 ? 0 : t < t0 + rise ? smooth((t - t0) / rise) : Math.exp(-(t - t0 - rise) / fall));
  const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
  // b4_teahouse → c1_lotus 的白雾转场（0.8 s，分段表）：引擎在上一镜上盖 FOG_COL（不透明度 0.7·sin(πp)），新镜按 smooth(p) 淡入。
  // 两镜各自补一层同色雾，使整段的雾色权重平滑起落（见 b4 与 c1 末尾的说明）
  const FOG_COL = '#f5efe2', FOG_TR = 0.8;
  // 上一镜（镜头时长 dur）在镜头内时间 t 需要自己补的雾色不透明度
  function fogCurve(t, dur) {
    const ts = dur - FOG_TR;
    const phi = 0.7 * smooth((t - (ts - 1.41)) / 1.95);
    const p = (t - ts) / FOG_TR, f = p > 0 && p < 1 ? 0.7 * Math.sin(Math.PI * p) : 0;
    return phi > f ? 1 - (1 - phi) / (1 - f) : 0;
  }

  // 柔光贴图（按颜色缓存），alpha 乘以调用方的 globalAlpha
  function glowSpr(col) {
    return K.cache('fg3glow' + col, 128, 128, 1, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.22, rgba(col, 0.6)); gr.addColorStop(0.5, rgba(col, 0.2));
      gr.addColorStop(0.78, rgba(col, 0.05)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }
  function glowAt(g, x, y, rx, ry, col, a) {
    if (!(a > 0.002)) return;
    const o = g.globalAlpha;
    g.globalAlpha = o * Math.min(1, a);
    g.drawImage(glowSpr(col), x - rx, y - ry, rx * 2, ry * 2);
    g.globalAlpha = o;
  }
  // 不透明的静态贴图（alpha:false 的画布贴得更快）；按渲染倍率缓存，换分辨率时重建
  const OPQ = new Map();
  function ocache(key, w, h, fn) {
    const S = (XYT.sprites && XYT.sprites.S) || 1;
    const k = key + '@' + S.toFixed(3);
    let c = OPQ.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * S)); c.height = Math.max(1, Math.round(h * S));
      const g = c.getContext('2d', { alpha: false });
      g.scale(S, S); fn(g);
      c.lw = w; c.lh = h;
      OPQ.set(k, c);
    }
    return c;
  }
  // 预先按最终尺寸画好的柔光（位置固定时整像素贴，免去每帧放大采样）
  function glowFixed(g, key, x, y, rx, ry, col, a) {
    if (!(a > 0.002)) return;
    const W = Math.ceil(rx * 2), H = Math.ceil(ry * 2);
    const spr = K.cache('fg3gf' + key, W, H, 1, (q) => q.drawImage(glowSpr(col), 0, 0, W, H));
    const o = g.globalAlpha;
    g.globalAlpha = o * Math.min(1, a);
    g.drawImage(spr, Math.round(x - rx), Math.round(y - ry), W, H);
    g.globalAlpha = o;
  }
  // 在缓存里画模糊层（ctx.filter 只在建缓存时用）
  function blurInto(g, w, h, blur, fn, alpha, op) {
    const t = document.createElement('canvas');
    const m = g.getTransform(), sc = m.a;
    t.width = Math.max(1, Math.round(w * sc)); t.height = Math.max(1, Math.round(h * sc));
    const tg = t.getContext('2d'); tg.scale(sc, sc);
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (op) g.globalCompositeOperation = op;
    if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
    g.drawImage(t, m.e, m.f);
    g.restore();
  }
  // 镜头推拉：先在与画布同像素的草稿画布上按 1:1 画好，最后整张缩放贴一次。
  // 实测（1280 宽）：整屏贴图不缩放约 0.8 ms，带缩放约 3.9 ms——每层都缩放贴会慢得多，所以只在最后缩放一次。
  // 草稿画布不透明（alpha:false，往里画各层更快）；镜头的第一层（不透明的底图）整张覆盖它，帧与帧之间不保留任何画面
  let SCR = null, SCRG = null, SCRA = null, SCRAG = null;
  function camBuf(g, z, cx, cy, fn) {
    const S = (XYT.sprites && XYT.sprites.S) || 1;
    const w = Math.round(1280 * S), h = Math.round(720 * S);
    if (!SCR || SCR.width !== w || SCR.height !== h) {
      SCR = document.createElement('canvas'); SCR.width = w; SCR.height = h; SCRG = SCR.getContext('2d', { alpha: false });
      SCRA = document.createElement('canvas'); SCRA.width = w; SCRA.height = h; SCRAG = SCRA.getContext('2d');
    }
    const sg = SCRG;
    sg.setTransform(S, 0, 0, S, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over'; sg.filter = 'none';
    fn(sg);
    g.save();
    if (Math.abs(z - 1) > 1e-4) {
      // 不透明草稿直接缩放贴出时偶有逐帧不一致：先整像素拷进普通画布，再缩放贴出
      SCRAG.setTransform(1, 0, 0, 1, 0, 0); SCRAG.globalCompositeOperation = 'copy'; SCRAG.drawImage(SCR, 0, 0);
      g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
      g.drawImage(SCRA, 0, 0, 1280, 720);
    } else g.drawImage(SCR, 0, 0, 1280, 720);
    g.restore();
  }
  // 平滑闭合曲线（中点二次曲线）
  function smoothPath(g, pts, closed, cont) {
    const n = pts.length;
    if (closed) {
      const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
      g.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      g.closePath();
    } else {
      if (cont) g.lineTo(pts[0][0], pts[0][1]); else g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      g.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }
  // 云团贴图：右上受光（暖亮），左下背光（冷暗），边缘柔
  function puffSprite(key, hi, mid, lo, soft) {
    return K.cache('fg3puff' + key, 128, 128, 1, (g) => {
      const gr = g.createRadialGradient(84, 36, 2, 58, 72, 80);
      gr.addColorStop(0, hi); gr.addColorStop(0.42, mid); gr.addColorStop(1, lo);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.globalCompositeOperation = 'destination-in';
      const m = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      const s = soft == null ? 0.6 : soft;
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(s, 'rgba(0,0,0,0.96)'); m.addColorStop(s + (1 - s) * 0.55, 'rgba(0,0,0,0.45)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = m; g.fillRect(0, 0, 128, 128);
    });
  }

  // ============================================================
  // b3_cliffcranes：清晨崖顶，少年举剑指天，云后日光渐盛；鹤一只只飞远，只剩一只
  // ============================================================
  (function () {
    const FB1 = [0.21, 0.65, 0.97, 1.35, 1.87, 2.27, 2.67];
    const FB2 = [3.41, 3.93, 4.37, 4.69, 5.23, 5.61, 6.09];
    const SUN = { x: 1062, y: 178 };
    const MAN = { x: 330, y: 520, h: 200 };
    const WD = -1; // 风从日出一侧（右）吹来：云、发带、草都向左
    const HY = 440, FOC = 1100; // 鹤的透视：地平线与焦距
    // 天空静态贴图的高度；光束在 RAY_Y0 以上烘进天空贴图，RAY_Y0~RAY_Y1（云海）逐帧叠加
    // 光束扇形（0.73π~1.03π，自太阳向左、左下）在天空里不超过 x=RAY_X1，在云海带里不超过 x=RAY_XB
    const SKY_H = 500, RAY_Y0 = 428, RAY_Y1 = 616, RAY_X1 = 1120, RAY_XB = 940;

    // ---------- 天空 ----------
    function paintSky(g) {
      const gr = g.createLinearGradient(0, 0, 0, 460);
      gr.addColorStop(0, '#3a6699'); gr.addColorStop(0.24, '#5a87ad'); gr.addColorStop(0.5, '#93b1c1');
      gr.addColorStop(0.72, '#cbd3cb'); gr.addColorStop(0.9, '#eedbb2'); gr.addColorStop(1, '#f4d59e');
      g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
      // 日出一侧的暖光：横向拉长
      g.save(); g.translate(SUN.x, SUN.y + 40); g.scale(1.6, 1);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 620);
      rg.addColorStop(0, 'rgba(255,238,198,0.85)'); rg.addColorStop(0.14, 'rgba(251,227,168,0.62)'); rg.addColorStop(0.38, 'rgba(242,166,90,0.26)');
      rg.addColorStop(0.7, 'rgba(242,166,90,0.06)'); rg.addColorStop(1, 'rgba(242,166,90,0)');
      g.fillStyle = rg; g.fillRect(-1300, -900, 2600, 1800);
      g.restore();
    }
    // 高空薄云：几道横向的淡云丝
    function paintCirrus(g) {
      const r = rng(31);
      blurInto(g, 1600, 300, 3, (cg) => {
        const bands = [[180, 70, 420, 7], [520, 46, 360, 5], [780, 96, 300, 6], [330, 128, 260, 4], [1180, 60, 380, 6], [980, 118, 240, 4], [1420, 100, 300, 5]];
        for (const [x, y, w, hh] of bands) {
          for (let k = 0; k < 14; k++) {
            const u = k / 13 - 0.5;
            const ox = u * w + (r() - 0.5) * 30, oy = (r() - 0.5) * hh + u * u * hh * 2;
            const ww = w * (0.12 + 0.2 * r()), h1 = hh * (0.3 + 0.5 * r());
            cg.fillStyle = rgba('#f4efe4', 0.22 + 0.18 * r());
            cg.beginPath(); cg.ellipse(x + ox, y + oy, ww / 2, h1 / 2, -0.03, 0, TAU); cg.fill();
          }
        }
      });
    }
    // 遮日的云：平底的积云带，由许多圆团叠成（上缘菜花边），背光——云体灰蓝，薄的边缘透亮
    const BANKS = [
      { x0: 905, x1: 1350, y: 236, hmax: 70, rmax: 36, seed: 7 },
      { x0: 742, x1: 938, y: 246, hmax: 18, rmax: 13, seed: 8 },
      { x0: 1146, x1: 1330, y: 124, hmax: 22, rmax: 15, seed: 9 },
    ];
    BANKS.forEach((b) => {
      const r = rng(b.seed * 17), P = [];
      const n = Math.round((b.x1 - b.x0) / (b.rmax * 0.42));
      for (let i = 0; i < n; i++) {
        const u = (i + r()) / n, env = Math.pow(Math.sin(Math.PI * u), 0.7) * (0.75 + 0.25 * noise1(u * 5, b.seed));
        const rr = b.rmax * (0.35 + 0.65 * env) * (0.6 + 0.5 * r());
        // 圆团底部大致齐平，越靠中间越高
        const lift = b.hmax * env * Math.pow(r(), 0.7);
        P.push([b.x0 + u * (b.x1 - b.x0), b.y - rr * 0.55 - lift * 0.6, rr]);
        if (r() < 0.5) P.push([b.x0 + u * (b.x1 - b.x0) + (r() - 0.5) * rr, b.y - rr * 0.3, rr * 0.9]);
      }
      b.P = P;
    });
    function bankBody(g, thin) {
      blurInto(g, 1400, 320, 1.2, (cg) => {
        for (const b of BANKS) {
          // 圆团并成一整块云（同一底色），明暗用整体渐变与少量柔和团块，不画单个圆的边
          cg.save();
          cg.beginPath();
          for (const [x, y, rr] of b.P) { cg.moveTo(x + rr, y); cg.arc(x, y, rr, 0, TAU); }
          const top = b.y - b.hmax - b.rmax;
          const gr = cg.createLinearGradient(0, top, 0, b.y + 4);
          gr.addColorStop(0, '#b4b6be'); gr.addColorStop(0.55, '#9da5b3'); gr.addColorStop(1, '#8a94a7');
          cg.fillStyle = gr; cg.fill('nonzero');
          cg.clip('nonzero');
          const sg = cg.createRadialGradient(SUN.x, SUN.y, 0, SUN.x, SUN.y, 300);
          sg.addColorStop(0, 'rgba(255,222,172,0.8)'); sg.addColorStop(0.35, 'rgba(238,196,156,0.4)'); sg.addColorStop(1, 'rgba(238,196,156,0)');
          cg.fillStyle = sg; cg.fillRect(b.x0 - 40, top - 40, b.x1 - b.x0 + 80, b.y - top + 80);
          // 云团下半的阴影：每个大团下方一抹暗
          const r = rng(b.seed * 5);
          for (const [x, y, rr] of b.P) {
            if (rr < b.rmax * 0.55 || r() < 0.4) continue;
            const sh = cg.createRadialGradient(x, y + rr * 0.6, 0, x, y + rr * 0.6, rr * 1.1);
            sh.addColorStop(0, 'rgba(96,106,128,0.22)'); sh.addColorStop(1, 'rgba(96,106,128,0)');
            cg.fillStyle = sh; cg.fillRect(x - rr * 1.2, y - rr * 0.6, rr * 2.4, rr * 2.4);
          }
          cg.restore();
        }
        if (thin) {
          cg.globalCompositeOperation = 'destination-out';
          const hg = cg.createRadialGradient(SUN.x, SUN.y, 0, SUN.x, SUN.y, 110);
          hg.addColorStop(0, 'rgba(0,0,0,0.55)'); hg.addColorStop(0.5, 'rgba(0,0,0,0.28)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
          cg.fillStyle = hg; cg.fillRect(SUN.x - 120, SUN.y - 120, 240, 240);
        }
      });
    }
    // 云的亮边：每个圆团朝太阳的一侧外扩一圈亮色，再把云体挖掉，只留外缘（亮度随离太阳的距离衰减）
    function bankRim(g) {
      blurInto(g, 1400, 320, 2, (cg) => {
        for (const b of BANKS) {
          for (const [x, y, rr] of b.P) {
            const dx = x - SUN.x, dy = y - SUN.y, d = Math.hypot(dx, dy);
            const k = Math.exp(-d / 200);
            if (k < 0.03) continue;
            cg.fillStyle = rgba('#fff4d8', Math.min(1, 1.1 * k));
            cg.beginPath(); cg.arc(x - (dx / (d + 1)) * 3, y - (dy / (d + 1)) * 3, rr + 3.5, 0, TAU); cg.fill();
          }
        }
        cg.globalCompositeOperation = 'destination-out';
        cg.fillStyle = '#000'; cg.beginPath(); for (const b of BANKS) for (const [x, y, rr] of b.P) { cg.moveTo(x + rr - 0.5, y); cg.arc(x, y, rr - 0.5, 0, TAU); } cg.fill();
      });
    }
    // 光束：亮的光柱与云头挡出的暗柱交替，从云后太阳向左下散开；beamAng 那一道正经过最后一只鹤在第14句第7字时的位置
    function rayList(beamAng) {
      const r = rng(19), L = [];
      for (let i = 0; i < 12; i++) {
        const a = Math.PI * (0.73 + (0.3 * (i + 0.4 + 0.3 * r())) / 12);
        if (Math.abs(a - beamAng) > 0.04) L.push([a, 0.01 + 0.02 * r(), 0.55 + 0.4 * r()]);
      }
      L.push([beamAng, 0.024, 1]);
      return L;
    }
    // 叠加模式的光束层：中灰为不变，亮柱偏暖亮，暗柱偏冷暗
    function paintRays(g, beamAng) {
      blurInto(g, 1280, 720, 8, (rg) => {
        const Lr = 1300;
        rg.fillStyle = '#808080'; rg.fillRect(0, 0, 1280, 720);
        const rays = rayList(beamAng).sort((a, b) => a[0] - b[0]);
        for (let i = 0; i < rays.length - 1; i++) {
          const a0 = rays[i][0] + rays[i][1] * 1.6, a1 = rays[i + 1][0] - rays[i + 1][1] * 1.6;
          if (a1 <= a0) continue;
          const gr = rg.createRadialGradient(SUN.x, SUN.y, 40, SUN.x, SUN.y, Lr);
          gr.addColorStop(0, 'rgba(40,56,90,0)'); gr.addColorStop(0.12, 'rgba(40,56,90,0.6)'); gr.addColorStop(0.6, 'rgba(40,56,90,0.3)'); gr.addColorStop(1, 'rgba(48,64,96,0)');
          rg.fillStyle = gr;
          rg.beginPath(); rg.moveTo(SUN.x, SUN.y); rg.arc(SUN.x, SUN.y, Lr, a0, a1); rg.closePath(); rg.fill();
        }
        for (const [a, w, a0] of rays) {
          const gr = rg.createRadialGradient(SUN.x, SUN.y, 24, SUN.x, SUN.y, Lr);
          gr.addColorStop(0, 'rgba(255,240,206,0)'); gr.addColorStop(0.05, `rgba(255,240,206,${a0.toFixed(3)})`);
          gr.addColorStop(0.42, `rgba(255,232,186,${(a0 * 0.55).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,226,176,0)');
          rg.fillStyle = gr;
          rg.beginPath(); rg.moveTo(SUN.x, SUN.y); rg.arc(SUN.x, SUN.y, Lr, a - w, a + w); rg.closePath(); rg.fill();
        }
      });
    }
    // ---------- 远峰：浮在云上的花岗岩石柱峰林（峰顶有松），背光，越远越融进天色 ----------
    const PEAKS = [
      { items: [[690, 112, 40, 18], [800, 152, 46, 11], [852, 178, 54, 12], [908, 128, 42, 13], [1124, 192, 58, 14], [1180, 158, 48, 15], [1240, 210, 62, 16], [1300, 150, 50, 17]], base: 474, haze: 0.36 },
      { items: [[758, 108, 44, 21], [872, 118, 48, 22], [1156, 126, 52, 23], [1228, 112, 46, 24], [1296, 124, 50, 25]], base: 486, haze: 0.12 },
    ];
    function paintPeaks(g, layer) {
      const L = PEAKS[layer];
      const tmp = document.createElement('canvas');
      const sc = g.getTransform().a;
      tmp.width = Math.round(1280 * sc); tmp.height = Math.round(720 * sc);
      const pg = tmp.getContext('2d'); pg.scale(sc, sc);
      for (const [x, h, w, seed] of L.items) {
        XYT.env.stonePeak(pg, { x, y: L.base, h, w, color: layer ? '#5f7788' : '#7a90a1', light: layer ? '#c9b89a' : '#bfb6a6', lightDir: 1, haze: '#c6d3d8', base: '#ebe6d8', mist: false, seed, t: 0 });
      }
      // 背光：先整体压暗成蓝灰（保留岩纹明暗），再蒙一层天色，越往下越接近云海色
      pg.globalCompositeOperation = 'source-atop';
      pg.fillStyle = rgba('#3a5068', layer ? 0.55 : 0.46); pg.fillRect(0, 0, 1280, 720);
      const hz = pg.createLinearGradient(0, 260, 0, L.base);
      hz.addColorStop(0, rgba('#a9bccb', L.haze)); hz.addColorStop(0.75, rgba('#c3cfd6', L.haze + 0.12)); hz.addColorStop(1, rgba('#e6e2d6', 0.85));
      pg.fillStyle = hz; pg.fillRect(0, 0, 1280, 720);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.filter = `blur(${(layer ? 0.4 : 0.9) * sc}px)`;
      g.drawImage(tmp, 0, 0); g.restore();
    }
    // ---------- 云海：自远而近五层，每层上缘是一串会缓慢胀缩的云头，向左流动；云头右上受光 ----------
    const SEA = [
      { base: 454, h: [5, 12], w: [14, 36], sp: 4, seed: 11, c: ['#fbeed4', '#dfe0da', '#bcc7cf'], dep: 22, cap: 0.55 },
      { base: 474, h: [9, 22], w: [22, 56], sp: 8, seed: 12, c: ['#fcefd2', '#d9dfdf', '#a9b9c6'], dep: 30, cap: 0.65 },
      { base: 504, h: [14, 34], w: [32, 80], sp: 13, seed: 13, c: ['#fdf0d0', '#d6dee2', '#98abbe'], dep: 42, cap: 0.75 },
      { base: 548, h: [20, 50], w: [44, 112], sp: 19, seed: 14, c: ['#fff2d4', '#d3dde3', '#8aa0b6'], dep: 56, cap: 0.85 },
      { base: 600, h: [28, 70], w: [60, 150], sp: 30, seed: 15, c: ['#fff4d8', '#d1dce3', '#7f97ae'], dep: 72, cap: 0.95 },
    ];
    // 峰脚的流云（薄雾带）：横向拉长的柔团，上缘受光偏暖、下缘偏冷
    const WISPS = [
      { x0: 830, y: 404, w: 300, h: 20, sp: 11, a: 0.8, seed: 3 },
      { x0: 1190, y: 424, w: 360, h: 24, sp: 15, a: 0.85, seed: 5 },
      { x0: 1020, y: 372, w: 210, h: 14, sp: 8, a: 0.6, seed: 7 },
      { x0: 640, y: 432, w: 260, h: 18, sp: 13, a: 0.6, seed: 9 },
    ];
    function paintWisp(g, W) {
      const cx = W.w / 2 + 20, cy = W.h * 1.5 + 10;
      blurInto(g, W.w + 40, W.h * 3 + 20, Math.max(3, W.h * 0.28), (q) => {
        const r = rng(W.seed * 13 + 1);
        for (let k = 0; k < 16; k++) {
          const u = k / 15 - 0.5, env = Math.pow(Math.cos(Math.PI * u), 0.8);
          const x = cx + u * W.w * 0.92 + (r() - 0.5) * 16, y = cy + (r() - 0.5) * W.h * 0.5 - env * W.h * 0.2;
          const rx = W.w * (0.08 + 0.07 * r()), ry = W.h * (0.3 + 0.35 * env) * (0.7 + 0.5 * r());
          const gr = q.createLinearGradient(0, y - ry, 0, y + ry);
          gr.addColorStop(0, rgba('#fff3dc', 0.75)); gr.addColorStop(0.5, rgba('#eee9e0', 0.6)); gr.addColorStop(1, rgba('#c4ced6', 0.35));
          q.fillStyle = gr; q.beginPath(); q.ellipse(x, y, rx, ry, 0, 0, TAU); q.fill();
        }
      });
    }
    // 云海各层的视差权重（镜头后拉时离得越近移动越多）
    const SEA_W = [0.1, 0.25, 0.4, 0.55, 0.7];
    // 最前一层：冷蓝灰云影（歌词区），云头低平、对比低
    const FRONT = { base: 612, h: [4, 11], w: [70, 160], sp: 20, seed: 16, c: ['#b2bec2', '#8197a4', '#61788a'], dep: 60, cap: 0.22 };
    function initSea(L) {
      L.P = 1280 + 2 * L.w[1] + 120;
      const r = rng(L.seed * 31);
      L.B = [];
      for (let x = 0; x < L.P - L.w[0];) {
        const w = lerp(L.w[0], L.w[1], r()), h = Math.min(L.h[1], w * (0.32 + 0.3 * r()));
        L.B.push({ x0: x + w * 0.5, w, h, ph: r() * TAU, f: 0.14 + 0.06 * r(), dx: 2 + 4 * r() });
        // 大团上再叠一个小云头（菜花状）
        if (r() < 0.6) L.B.push({ x0: x + w * (0.25 + 0.5 * r()), w: w * 0.45, h: h * 1.25, ph: r() * TAU, f: 0.15 + 0.06 * r(), dx: 3 + 4 * r() });
        x += w * (0.7 + 0.45 * r());
      }
    }
    SEA.forEach(initSea); initSea(FRONT);
    // 云头贴图：半椭圆穹顶，顶上暖白、底部与本层云身同色；右上一团受光，左侧略冷
    function domeSprite(L) {
      return K.cache('fg3b3dome' + L.seed, 136, 68, 2, (g) => {
        // 先画在临时画布上，再带一点模糊贴进来，云头边缘柔和、互相叠压时不出硬线
        blurInto(g, 136, 68, 1.2, (q) => {
          q.translate(4, 4);
          q.beginPath(); q.moveTo(0, 64.5);
          for (let i = 0; i <= 64; i++) { const u = i / 32 - 1; q.lineTo(i * 2, 64 - 62 * Math.pow(Math.max(0, 1 - u * u), 0.62)); }
          q.lineTo(128, 64.5); q.lineTo(128, 70); q.lineTo(0, 70); q.closePath();
          const gr = q.createLinearGradient(0, 0, 0, 64);
          gr.addColorStop(0, L.c[0]); gr.addColorStop(0.55, mix(L.c[0], L.c[1], 0.6)); gr.addColorStop(1, L.c[1]);
          q.fillStyle = gr; q.fill();
          q.save(); q.clip();
          const hl = q.createRadialGradient(84, 10, 2, 76, 24, 62);
          hl.addColorStop(0, rgba('#fffaf0', 0.85 * L.cap)); hl.addColorStop(0.4, rgba('#fff0d0', 0.4 * L.cap)); hl.addColorStop(1, rgba('#fff0d0', 0));
          q.fillStyle = hl; q.fillRect(0, 0, 128, 64);
          const sh = q.createRadialGradient(18, 52, 4, 24, 48, 52);
          sh.addColorStop(0, rgba('#8899b2', 0.26)); sh.addColorStop(1, rgba('#8899b2', 0));
          q.fillStyle = sh; q.fillRect(0, 0, 128, 70);
          const bt = q.createLinearGradient(0, 36, 0, 64);
          bt.addColorStop(0, rgba(L.c[1], 0)); bt.addColorStop(1, rgba(L.c[1], 1));
          q.fillStyle = bt; q.fillRect(0, 36, 128, 34);
          q.restore();
        });
      });
    }
    function drawSea(g, L, t, bottom, periodic) {
      const half = (L.P - 1280) / 2;
      // 云身：本层底线以下到下一层底线（逐帧画的层用缓存好的不透明贴图，渐变填充较慢）
      const paintBody = (q) => {
        const gr = q.createLinearGradient(0, L.base, 0, bottom);
        gr.addColorStop(0, L.c[1]); gr.addColorStop(1, L.c[2]);
        q.fillStyle = gr; q.fillRect(periodic ? -L.w[1] : 0, L.base - 1, periodic ? L.P + 2 * L.w[1] : 1280, bottom - L.base + 1);
      };
      if (periodic) paintBody(g);
      else g.drawImage(ocache('b3body' + L.seed + '_' + bottom, 1280, bottom - L.base + 1, (q) => { q.translate(0, 1 - L.base); paintBody(q); }), 0, L.base - 1, 1280, bottom - L.base + 1);
      const spr = domeSprite(L);
      for (const b of L.B) {
        if (periodic) {
          // 周期长条：每团在 x 与 x±P 处都画，接缝处无断口
          for (const k of [-1, 0, 1]) g.drawImage(spr, b.x0 + k * L.P - b.w * 1.0625, L.base - b.h * 1.0625, b.w * 2.125, b.h * 1.0625 + 4);
          continue;
        }
        let x = b.x0 + WD * L.sp * t + b.dx * Math.sin(TAU * b.f * 0.7 * t + b.ph);
        x = ((x % L.P) + L.P) % L.P - half;
        // 翻涌：云头缓缓胀缩（周期 5–7 s，大团约 ±6 像素），并随风前后错动
        const h = b.h + Math.min(6, 0.2 * b.h) * Math.sin(TAU * b.f * t + b.ph), w = b.w * (1 + 0.06 * Math.sin(TAU * b.f * 0.8 * t + b.ph * 1.3));
        if (x + w < -4 || x - w > 1284) continue;
        g.drawImage(spr, x - w * 1.0625, L.base - h * 1.0625, w * 2.125, h * 1.0625 + 4);
      }
    }
    // ---------- 崖石：左侧一整块巨岩，崖顶平台，右侧陡壁落入云海 ----------
    const CLIFF_TOP = [[-30, 296], [22, 288], [70, 300], [112, 330], [146, 372], [176, 420], [204, 466], [232, 500], [262, 516], [300, 521], [362, 520], [410, 518], [438, 520], [456, 528], [468, 548], [474, 590], [480, 650], [490, 760]];
    function paintCliff(g) {
      g.save();
      g.beginPath(); g.moveTo(-30, 780);
      smoothPath(g, CLIFF_TOP, false, true);
      g.lineTo(500, 780); g.closePath();
      const gr = g.createLinearGradient(0, 290, 0, 720);
      gr.addColorStop(0, '#2e3d44'); gr.addColorStop(0.5, '#27353b'); gr.addColorStop(1, '#33454e');
      g.fillStyle = gr; g.fill();
      g.clip();
      // 岩块：几块斧劈的大面，朝右（向光）的面暖一些
      const facets = [
        [[150, 380], [210, 470], [190, 560], [120, 470], 'rgba(70,86,92,0.35)'],
        [[262, 520], [440, 522], [430, 600], [300, 620], [240, 560], 'rgba(58,74,80,0.35)'],
        [[438, 524], [470, 552], [482, 650], [440, 700], [420, 600], 'rgba(214,164,112,0.22)'],
        [[30, 300], [100, 330], [80, 430], [10, 420], 'rgba(70,86,92,0.28)'],
        [[300, 600], [420, 610], [440, 700], [320, 720], 'rgba(20,28,32,0.3)'],
      ];
      for (const f of facets) {
        const col = f[f.length - 1], P = f.slice(0, -1);
        g.fillStyle = col; g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
      }
      // 斧劈皴：成组的短阔斜笔（墨色淡而宽），少量浅色擦笔
      const r = rng(13);
      g.lineCap = 'round';
      for (let gI = 0; gI < 26; gI++) {
        const gx = -10 + r() * 480, gy = 320 + r() * 380;
        if (gy < 300 + (gx < 260 ? Math.max(0, gx - 40) * 0.8 : 220)) continue;
        const a = 1.05 + (r() - 0.5) * 0.35;
        for (let i = 0; i < 5; i++) {
          const x = gx + i * 7 + (r() - 0.5) * 4, y = gy + i * 3 + (r() - 0.5) * 6, len = 12 + r() * 18;
          g.strokeStyle = rgba('#141e23', 0.14 + 0.16 * r()); g.lineWidth = 3 + r() * 5;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
        }
      }
      for (let i = 0; i < 14; i++) {
        const x = r() * 470, y = 330 + r() * 360, len = 10 + r() * 22, a = 1.1 + (r() - 0.5) * 0.4;
        g.strokeStyle = rgba('#6d8187', 0.1 + 0.08 * r()); g.lineWidth = 3 + r() * 4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
      }
      // 几道岩缝：由粗到细的墨线
      const cracks = [[[96, 318], [118, 360], [112, 410], [130, 470]], [[180, 430], [196, 480], [188, 540], [206, 600]], [[300, 528], [318, 560], [310, 610]], [[400, 524], [394, 570], [410, 640]], [[30, 300], [44, 350], [40, 420]]];
      for (const c of cracks) {
        for (let i = 1; i < c.length; i++) {
          g.strokeStyle = 'rgba(14,20,24,0.55)'; g.lineWidth = 2.6 - i * 0.6;
          g.beginPath(); g.moveTo(c[i - 1][0], c[i - 1][1]); g.lineTo(c[i][0], c[i][1]); g.stroke();
        }
      }
      // 顶面朝天，略受天光
      g.strokeStyle = rgba('#7d9098', 0.3); g.lineWidth = 7;
      g.beginPath(); smoothPath(g, CLIFF_TOP.slice(6, 14).map((p) => [p[0], p[1] + 4.5]), false); g.stroke();
      // 右侧陡壁：迎着日出的暖反光，向下渐弱
      const lg = g.createLinearGradient(380, 0, 486, 0);
      lg.addColorStop(0, 'rgba(242,166,90,0)'); lg.addColorStop(0.7, 'rgba(242,170,96,0.14)'); lg.addColorStop(1, 'rgba(251,210,150,0.3)');
      g.fillStyle = lg; g.fillRect(380, 520, 120, 240);
      g.restore();
      // 顶缘轮廓光：越靠右越亮
      g.lineCap = 'round';
      for (let i = 1; i < CLIFF_TOP.length; i++) {
        const [xa, ya] = CLIFF_TOP[i - 1], [xb, yb] = CLIFF_TOP[i];
        if (yb > 660) break;
        const k = clamp((xb - 120) / 340);
        g.strokeStyle = rgba('#ffd9a0', 0.12 + 0.6 * k); g.lineWidth = 1 + 1.3 * k;
        g.beginPath(); g.moveTo(xa, ya + 0.6); g.lineTo(xb, yb + 0.6); g.stroke();
      }
    }
    // 崖上的几簇草：风从右来，草梢向左
    const TUFTS = [[226, 496, 7, 13], [252, 512, 5, 10], [418, 518, 6, 12], [446, 524, 4, 9], [60, 294, 6, 14], [130, 352, 5, 11]];
    function drawTufts(g, t) {
      for (const [cx, cy, n, hh] of TUFTS) {
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < n; i++) {
            const k = cx * 13 + i;
            const x = cx + (h2(k, 1) - 0.5) * 12, len = hh * (0.55 + 0.6 * h2(k, 2));
            const fan = (i / Math.max(1, n - 1) - 0.5) * 0.9;
            const sw = 0.06 * Math.sin(TAU * t * (0.45 + 0.3 * h2(k, 5)) + k) + 0.03 * Math.sin(TAU * t * 1.1 + k * 2.3);
            const a = fan + WD * (0.25 + 0.08 * Math.sin(TAU * 0.23 * t)) + sw;
            const mx = x + Math.sin(a * 0.45) * len * 0.5, my = cy - Math.cos(a * 0.45) * len * 0.5;
            const tx = mx + Math.sin(a * 1.3) * len * 0.5, ty = my - Math.cos(a * 1.3) * len * 0.5;
            if (pass === 0) { g.strokeStyle = rgba('#ffdca6', 0.5); g.lineWidth = 2; g.save(); g.translate(0.8, 0); }
            else { g.strokeStyle = '#25323a'; g.lineWidth = 1.1; }
            g.beginPath(); g.moveTo(x, cy + 1); g.quadraticCurveTo(mx, my, tx, ty); g.stroke();
            if (pass === 0) g.restore();
          }
        }
      }
    }
    // ---------- 古松：从崖边斜出，平展的针叶团，右上缘金边 ----------
    const PINE_ROOT = [452, 532];
    const TRUNK = [[450, 536], [456, 506], [468, 476], [488, 448], [516, 424], [550, 404], [590, 390], [632, 382]];
    const BRANCHES = [
      { pts: [[488, 448], [530, 440], [580, 436], [640, 430], [702, 426], [748, 428]], w0: 9, w1: 2.5 },
      { pts: [[552, 404], [566, 378], [586, 350]], w0: 6, w1: 2 },
      { pts: [[632, 382], [664, 372], [690, 368]], w0: 4, w1: 1.5 },
    ];
    const PADS = [[636, 370, 66, 21], [742, 420, 60, 17], [590, 340, 46, 15], [694, 360, 44, 14], [546, 428, 42, 13]];
    function tube(g, pts, w0, w1) {
      const n = pts.length, L = [], R = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
        const w = lerp(w0, w1, i / (n - 1)) / 2;
        L.push([pts[i][0] - (dy / d) * w, pts[i][1] + (dx / d) * w]);
        R.push([pts[i][0] + (dy / d) * w, pts[i][1] - (dx / d) * w]);
      }
      g.beginPath();
      smoothPath(g, L.concat(R.reverse()), true);
    }
    function paintPine(g) {
      const trunkAll = (dx, dy) => {
        g.save(); g.translate(dx, dy);
        tube(g, TRUNK, 22, 8); g.fill();
        for (const b of BRANCHES) { tube(g, b.pts, b.w0, b.w1); g.fill(); }
        g.restore();
      };
      g.fillStyle = 'rgba(255,214,156,0.8)'; trunkAll(1.8, -0.8);
      g.fillStyle = '#262826'; trunkAll(0, 0);
      // 树皮鳞纹
      const r = rng(41);
      g.strokeStyle = 'rgba(92,82,66,0.5)'; g.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const u = r(), k = Math.min(TRUNK.length - 2, Math.floor(u * (TRUNK.length - 1)));
        const p = TRUNK[k], q = TRUNK[k + 1], f = u * (TRUNK.length - 1) - k;
        const x = lerp(p[0], q[0], f) + (r() - 0.5) * 8, y = lerp(p[1], q[1], f) + (r() - 0.5) * 5;
        g.beginPath(); g.arc(x, y, 2 + r() * 2.5, 0.3, 2.6); g.stroke();
      }
      // 针叶团：几个扁团叠在一起，周缘是一簇簇针尖；先画向光偏移的金边，再画墨色本体
      const subs = [];
      for (const [cx, cy, rw, rh] of PADS) {
        subs.push([cx - rw * 0.42, cy + rh * 0.12, rw * 0.6, rh * 0.82, cx], [cx + rw * 0.4, cy + rh * 0.08, rw * 0.62, rh * 0.8, cx + 1], [cx + rw * 0.02, cy - rh * 0.22, rw * 0.64, rh * 0.92, cx + 2]);
      }
      const padPath = (cx, cy, rw, rh, seed) => {
        g.beginPath();
        const N = Math.max(40, Math.round(rw * 1.6));
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * TAU, up = Math.sin(a) < 0;
          const tuft = i % 2 ? (up ? 0.16 : 0.07) : -0.02;
          const k = 1 + tuft * (0.6 + 0.8 * h2(seed * 131 + i, 3)) + 0.1 * (noise1(a * 3 + seed, seed) - 0.5);
          const x = cx + Math.cos(a) * rw * k, y = cy + Math.sin(a) * rh * k * (up ? 1 : 0.7);
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath();
      };
      g.fillStyle = 'rgba(255,212,150,0.85)';
      for (const [x, y, rw, rh, sd] of subs) { g.save(); g.translate(1.6, -1.3); padPath(x, y, rw, rh, sd); g.fill(); g.restore(); }
      for (const [x, y, rw, rh, sd] of subs) {
        padPath(x, y, rw, rh, sd);
        const gr = g.createLinearGradient(0, y - rh, 0, y + rh * 0.7);
        gr.addColorStop(0, '#2c3d36'); gr.addColorStop(0.55, '#1f2b27'); gr.addColorStop(1, '#141c1a');
        g.fillStyle = gr; g.fill();
      }
      // 团内针叶纹：短弧线，暗绿与墨色
      for (const [cx, cy, rw, rh] of PADS) {
        const rr = rng(cx * 7 + cy);
        for (let i = 0; i < rw * 0.9; i++) {
          const x = cx + (rr() - 0.5) * rw * 1.7, y = cy + (rr() - 0.6) * rh * 1.1;
          const len = 4 + rr() * 6, a = -Math.PI / 2 + (rr() - 0.5) * 1.6;
          g.strokeStyle = rr() < 0.5 ? 'rgba(70,96,80,0.5)' : 'rgba(12,18,16,0.5)'; g.lineWidth = 0.9;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
        }
      }
    }

    // ---------- 鹤：三维骨架正交投影（视线略仰），翼展为 1 ----------
    // 四只鹤：前三只在第14句第1、3、5字时从右前侧离群，飞向远峰之间；第四只一直盘旋
    // 离群的目标在两组远峰之间、峰脚的薄雾里（y≈390）；第三只盘旋得最低，离雾最近
    const CR = [
      { Xc: 150, Yc: 560, R: 360, Dc: 2500, w: 0.62, k: 0, tx: 1018, ty: 392, far: 7000 },
      { Xc: 120, Yc: 500, R: 330, Dc: 2350, w: 0.6, k: 2, tx: 1052, ty: 398, far: 7000 },
      { Xc: 170, Yc: 340, R: 350, Dc: 2450, w: 0.64, k: 4, tx: 970, ty: 392, far: 6000 },
      { Xc: -283, Yc: 388, R: 300, Dc: 2000, w: -0.5, k: -1, thP: -0.671 },
    ];
    const SPAN = 92, BLEND = 0.9;
    // 盘旋：θ = θd + ω(t − td)，θd = −π/4 时正位于右前方、朝右后方飞（离群的方向）
    function circlePos(C, t, i, shift) {
      // 最后一只：在 tPass（掠过光束的时刻）正好转到 thP
      const th = C.k >= 0 ? -Math.PI / 4 + C.w * (t - C.tdL) : C.thP + C.w * (t - C.tPass);
      const Xc = C.Xc + (shift || 0);
      return [Xc + C.R * Math.cos(th), C.Yc + 14 * Math.sin(0.55 * t + i * 1.7), C.Dc + C.R * Math.sin(th)];
    }
    const toWorld = (sx, sy, D) => [((sx - 640) * D) / FOC, ((HY - sy) * D) / FOC, D];
    function cranePos(C, t, i, lastShift) {
      if (C.k < 0) return circlePos(C, t, i, lastShift(t));
      const P0 = circlePos(C, C.tdL, i), Pc = circlePos(C, t, i);
      if (t <= C.tdL) return Pc;
      // 离群：三次贝塞尔，起点速度与盘旋一致，终点在远峰之间的远处
      const h = 1 / 120;
      const Pa = circlePos(C, C.tdL - h, i), Pb = circlePos(C, C.tdL + h, i);
      const V0 = [(Pb[0] - Pa[0]) / (2 * h), (Pb[1] - Pa[1]) / (2 * h), (Pb[2] - Pa[2]) / (2 * h)];
      const E = C.esc;
      const P3 = toWorld(C.tx, C.ty, C.far);
      const dir = [P3[0] - P0[0], P3[1] - P0[1], P3[2] - P0[2]];
      const P1 = [0, 1, 2].map((j) => P0[j] + (V0[j] * E) / 3);
      const P2 = [0, 1, 2].map((j) => P3[j] - dir[j] * 0.25);
      const u = clamp((t - C.tdL) / E), v = 1 - u;
      const B = [0, 1, 2].map((j) => v * v * v * P0[j] + 3 * v * v * u * P1[j] + 3 * v * u * u * P2[j] + u * u * u * P3[j]);
      // 与继续盘旋的位置用五次平滑混合，速度、加速度都连续
      const w = smoother((t - C.tdL) / BLEND);
      return [0, 1, 2].map((j) => lerp(Pc[j], B[j], w));
    }
    // 投影：世界 (X 右, Y 上, D 远) → 屏幕
    // CAM_DZ：镜头后拉的距离（与鹤同一单位；崖与少年约在 D_NEAR 处）
    let CAM_DZ = 0;
    const D_NEAR = 374;
    const proj = (P) => { const D = P[2] + CAM_DZ; return [640 + (FOC * P[0]) / D, HY - (FOC * P[1]) / D, FOC / D]; };
    // 翅膀轮廓（弦向 a、展向 d）；内翼后缘的黑色次级飞羽另成一块
    const WING = [[0.05, 0.03], [0.07, 0.12], [0.064, 0.22], [0.036, 0.33], [0.006, 0.43], [-0.018, 0.5], [-0.05, 0.49], [-0.062, 0.455], [-0.082, 0.44], [-0.09, 0.4], [-0.112, 0.34], [-0.126, 0.25], [-0.132, 0.15], [-0.12, 0.05], [-0.096, 0.03]];
    const WING_BLACK = [[-0.08, 0.05], [-0.092, 0.15], [-0.094, 0.25], [-0.086, 0.33], [-0.112, 0.34], [-0.126, 0.25], [-0.132, 0.15], [-0.12, 0.05]];
    const WRIST = 0.22;
    function drawCrane(g, st) {
      const { x, y, k, yaw, pitch, bank, f1, f2, fade, alpha, lit } = st;
      if (alpha < 0.01 || k < 1) return;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const F = [cy * cp, sp, -sy * cp];
      const U0 = [-cy * sp, cp, sy * sp];
      // S0 = U0 × F（鸟的右侧）
      const S0 = [U0[1] * F[2] - U0[2] * F[1], U0[2] * F[0] - U0[0] * F[2], U0[0] * F[1] - U0[1] * F[0]];
      const cb = Math.cos(bank), sb = Math.sin(bank);
      const U = [0, 1, 2].map((j) => U0[j] * cb + S0[j] * sb), S = [0, 1, 2].map((j) => S0[j] * cb - U0[j] * sb);
      const e = st.elev, ce = Math.cos(e), se = Math.sin(e);
      const P = (o) => [x + o[0] * k, y - (o[1] * ce + o[2] * se) * k, o[2] * ce - o[1] * se];
      const loc = (a, b, c) => [a * F[0] + b * U[0] + c * S[0], a * F[1] + b * U[1] + c * S[1], a * F[2] + b * U[2] + c * S[2]];
      const wingPt = (a, d, sg) => {
        const c1 = Math.cos(f1), s1 = Math.sin(f1), c2 = Math.cos(f1 + f2), s2 = Math.sin(f1 + f2);
        let side, up;
        if (d <= WRIST) { side = d * c1; up = d * s1; } else { side = WRIST * c1 + (d - WRIST) * c2; up = WRIST * s1 + (d - WRIST) * s2; }
        return P(loc(a, up, sg * side));
      };
      // 远去时颜色向峰脚薄雾的暖灰靠拢；被光束照到时偏暖亮
      const white = mix(mix('#f4f2ea', '#fff0c8', lit), '#d8d6ca', fade), shadeW = mix(mix('#cdd6da', '#f6dfb2', lit), '#d2d2c6', fade);
      const black = mix('#222c33', '#c4c8c0', fade * 0.9);
      const o = g.globalAlpha;
      // 逆光里的鹤：周身一圈暖色散射光
      if (lit > 0.02) {
        g.save(); g.globalCompositeOperation = 'lighter';
        glowAt(g, x, y, 1.2 * k, 0.8 * k, '#ffd99a', 0.5 * lit * alpha);
        g.restore();
      }
      g.globalAlpha = o * alpha;
      const wings = [1, -1].map((sg) => {
        const pts = WING.map(([a, d]) => wingPt(a, d, sg));
        const blk = WING_BLACK.map(([a, d]) => wingPt(a, d, sg));
        const dep = pts.reduce((s, p) => s + p[2], 0) / pts.length;
        // 看到的是上面还是下面：用翼面法线与视线的关系
        const n = loc(0, Math.cos(f1), -sg * Math.sin(f1));
        const top = n[1] * se - n[2] * ce < 0 ? 0 : 1;
        return { pts, blk, dep, top };
      });
      const body = () => {
        const tail = P(loc(-0.2, 0, 0)), chest = P(loc(0.08, 0.004, 0)), neck = P(loc(0.34, 0.002, 0)), head = P(loc(0.37, 0.004, 0)), bill = P(loc(0.445, -0.006, 0));
        // 腿：拖在尾后
        g.strokeStyle = black; g.lineCap = 'round'; g.lineWidth = Math.max(0.6, 0.009 * k);
        for (const sgn of [-1, 1]) { const a0 = P(loc(-0.1, -0.02, 0.012 * sgn)), a1 = P(loc(-0.41, -0.03, 0.016 * sgn)); g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke(); }
        g.strokeStyle = white; g.lineWidth = Math.max(1.2, 0.062 * k);
        g.beginPath(); g.moveTo(tail[0], tail[1]); g.lineTo(chest[0], chest[1]); g.stroke();
        // 黑色三级飞羽垂在尾部
        const tt = P(loc(-0.19, 0.008, 0));
        g.fillStyle = black; g.beginPath(); g.arc(tt[0], tt[1], Math.max(0.6, 0.024 * k), 0, TAU); g.fill();
        g.strokeStyle = black; g.lineWidth = Math.max(0.7, 0.022 * k);
        g.beginPath(); g.moveTo(chest[0], chest[1]); g.lineTo(neck[0], neck[1]); g.stroke();
        g.fillStyle = white; g.beginPath(); g.arc(head[0], head[1], Math.max(0.6, 0.016 * k), 0, TAU); g.fill();
        g.strokeStyle = mix('#8a8470', '#b9ccd4', fade); g.lineWidth = Math.max(0.5, 0.008 * k);
        g.beginPath(); g.moveTo(head[0], head[1]); g.lineTo(bill[0], bill[1]); g.stroke();
        // 丹顶：一粒小红点
        if (k > 30) { g.fillStyle = mix('#c8352c', '#b9ccd4', fade); const cr = P(loc(0.372, 0.016, 0)); g.beginPath(); g.arc(cr[0], cr[1], Math.max(0.5, 0.008 * k), 0, TAU); g.fill(); }
      };
      wings.sort((a, b) => a.dep - b.dep);
      const bodyDep = P(loc(0, 0, 0))[2];
      let bodyDone = false;
      for (const w of wings) {
        if (!bodyDone && w.dep > bodyDep) { body(); bodyDone = true; }
        g.fillStyle = w.top ? white : shadeW;
        g.beginPath(); smoothPath(g, w.pts, true); g.fill();
        g.fillStyle = black;
        g.beginPath(); for (let i = 0; i < w.blk.length; i++) i ? g.lineTo(w.blk[i][0], w.blk[i][1]) : g.moveTo(w.blk[i][0], w.blk[i][1]); g.closePath(); g.fill();
      }
      if (!bodyDone) body();
      // 被照亮时：翼前缘（上缘）一道 1 像素暖色亮边
      if (lit > 0.02) {
        g.save(); g.globalCompositeOperation = 'lighter';
        g.strokeStyle = rgba('#ffd28e', Math.min(1, 0.9 * lit)); g.lineWidth = 1; g.lineCap = 'round'; g.lineJoin = 'round';
        for (const w of wings) { g.beginPath(); smoothPath(g, w.pts.slice(0, 6), false); g.stroke(); }
        g.restore();
      }
      g.globalAlpha = o;
    }
    // 鹤的状态：位置、朝向（由速度）、侧倾（由侧向加速度）、扇翅
    function craneState(C, i, t, lastShift, beam) {
      const h = 1 / 60;
      const Pm = cranePos(C, t - h, i, lastShift), P0 = cranePos(C, t, i, lastShift), Pp = cranePos(C, t + h, i, lastShift);
      const V = [0, 1, 2].map((j) => (Pp[j] - Pm[j]) / (2 * h));
      const Ac = [0, 1, 2].map((j) => (Pp[j] - 2 * P0[j] + Pm[j]) / (h * h));
      const yaw = Math.atan2(V[2], V[0]);
      const sp = Math.hypot(V[0], V[2]);
      const pitch = clamp(Math.atan2(V[1], sp), -0.25, 0.25);
      // 右侧（水平）方向：S0 = (−sinψ, 0, −cosψ)（Z 朝镜头 = −D）→ 在 (X, D) 里是 (−sinψ, +cosψ)
      const lat = -Math.sin(yaw) * Ac[0] + Math.cos(yaw) * Ac[2];
      const bank = clamp(Math.atan2(lat, 420), -0.5, 0.5);
      const [x, y, sc] = proj(P0);
      const k = SPAN * sc;
      // 扇翅：盘旋时以滑翔为主，偶尔几下；离群时加力
      const burst = Math.pow(Math.max(0, Math.sin((TAU * t) / 6.2 + i * 1.9)), 2);
      let amp = 0.36 * burst;
      if (C.k >= 0) amp = lerp(amp, 0.5, smooth((t - C.tdL + 0.1) / 0.7));
      else amp *= 1 - Math.exp(-Math.pow((t - C.tPass) / 0.9, 2)); // 掠过光束前后平展滑翔
      const ph = (TAU * t) / 0.9 + i * 2.1;
      const f1 = 0.05 + amp * Math.sin(ph), f2 = 0.07 + 0.55 * amp * Math.sin(ph - 0.9);
      // 远去变淡
      const dist = P0[2];
      let fade = clamp((dist - 2600) / 3800);
      // 离群的鹤：每只有自己的消失期限（最晚在第14句第7字前 0.1 s 完全没入雾中）
      let alpha = 1;
      if (C.k >= 0) { alpha = 1 - smooth((t - C.tS) / (C.tE - C.tS)); fade = Math.max(fade, 0.8 * (1 - alpha)); }
      // 掠过光束时被照亮：在光束里（角距高斯），第14句第7字时云隙最亮
      let lit = 0;
      if (beam) {
        const ang = Math.atan2(y - SUN.y, x - SUN.x);
        const dA = ang - beam.ang;
        lit = beam.on * Math.exp(-Math.pow(dA / 0.06, 2)) * (0.35 + 0.65 * Math.exp(-Math.pow((t - beam.t) / 0.3, 2)));
      }
      return { x, y, k, yaw, pitch, bank, f1, f2, fade, alpha, lit, elev: 0.5, dep: dist };
    }

    XYT.registerShot('b3_cliffcranes', {
      name: '\u51cc\u4e91\u9e64\u6563', zone: 'bottom', night: false, text: '#fbf3e2', shadow: 'rgba(32,46,58,0.9)', accent: '#f2a65a', bloom: 0.3,
      draw(g, c) {
        const t = c.lt;
        const tLing = charLt(c, 2, 0, FB1), tYun = charLt(c, 3, 0, FB1), tLiu = charLt(c, 6, 1, FB2);
        // 离群：在第14句第1、3、5字前 0.2 s 开始转向，转身最明显的时刻正落在字上
        // 最后一只鹤掠过光束：原定第14句第7字，但那时已在转入下一镜的 0.8 s 淡化里看不清，提前到淡化开始前约 0.27 s（约第 5.4–5.85 秒掠过）
        const tPass = Math.min(tLiu, c.dur - 0.8 - 0.27);
        CR[3].tPass = tPass; CR[0].tdL = charLt(c, 0, 1, FB2) - 0.2; CR[1].tdL = charLt(c, 2, 1, FB2) - 0.2; CR[2].tdL = charLt(c, 4, 1, FB2) - 0.2;
        for (let i = 0; i < 3; i++) {
          const C = CR[i];
          C.tE = Math.min(C.tdL + 2.4, tLiu - 0.1); C.tS = Math.max(C.tdL + 0.35, C.tE - 1.1);
          // 离群飞行的时长：消失时已飞完全程的约九成（正在峰脚雾里）
          C.esc = clamp((C.tE - C.tdL) / 0.9, 1.35, 2.7);
        }
        // 最后一只在少年右上方盘旋（顺时针），第14句第7字时正从近处向左滑过光束
        const lastShift = () => 0;
        // 光：第13句第3字起云边 1.2 s 变薄变亮；光束随后 1.5 s 淡入并持续增强
        const e1 = smooth((t - tLing) / 1.2);
        const e2 = smooth((t - tLing - 0.7) / 1.5) * (0.78 + 0.22 * smooth((t - tLing - 2.2) / 3.5));
        const beat = 1 + 0.07 * be(c, 0.45);
        // 镜头：整镜缓缓后拉，近处的崖、松、人由 1.05 倍缩到 1.00 倍（以画面主点 (640, 440) 为中心）；
        // 远处的天、远峰、云堤、光束在无穷远，不动；云海各层按远近只做很小的上移；鹤按真实深度变化
        const zp = easeInOut((t + 0.7) / (c.dur + 0.7));
        const zN = 1.05 - 0.05 * zp;
        const camZ = (w) => 1 + (zN - 1) * w; // 视差：w=1 与崖同远，w→0 越远越不动
        const bandDy = (L, w) => (L.base - HY) * (camZ(w) - 1);
        CAM_DZ = D_NEAR * (1 / zN - 1);
        // 光束：亮柱与暗柱；最亮的一道经过最后一只鹤在第14句第7字时的位置
        // 光束的方向按第14句第7字那一刻的鹤（连同那一刻的镜头位置）算，整镜不变
        const zL = 1.05 - 0.05 * easeInOut((tPass + 0.7) / (c.dur + 0.7));
        CAM_DZ = D_NEAR * (1 / zL - 1);
        const lastAt = craneState(CR[3], 3, tPass, lastShift, null);
        CAM_DZ = D_NEAR * (1 / zN - 1);
        const beamAng = Math.atan2(lastAt.y - SUN.y, lastAt.x - SUN.x);
        const bk = beamAng.toFixed(3);
        const rays = K.cache('b3rays' + bk, 1280, 720, 0.5, (rg) => paintRays(rg, beamAng));
        const ra = e2 > 0.002 ? Math.min(1, e2 * beat) : 0;
        // 天空、高云、远峰与峰间薄雾：一张静态贴图；叠了光束的同一张贴图按光束强度交叉淡化（等价于逐帧叠加，但只贴两次）
        const skyB = ocache('b3skyB', 1280, SKY_H, (sg) => {
          paintSky(sg);
          sg.drawImage(K.cache('b3cirrus', 1600, 300, 1, paintCirrus), -170, 0, 1600, 300);
          glowAt(sg, SUN.x, SUN.y, 420, 300, '#ffe6b8', 0.32);
          glowAt(sg, SUN.x, SUN.y, 170, 140, '#fff6dc', 0.45);
          paintPeaks(sg, 0); glowAt(sg, 1010, 404, 460, 46, '#f3e8d2', 0.6); paintPeaks(sg, 1);
        });
        // 天空贴图（y<500）与各层云身（y≥453）都不透明且铺满整宽，每帧把草稿画布整张盖住
        g.drawImage(skyB, 0, 0, 1280, SKY_H);
        if (ra > 0) {
          const skyR = ocache('b3skyR' + bk, 1280, RAY_Y0, (sg) => {
            sg.drawImage(skyB, 0, 0, 1280, SKY_H);
            sg.globalCompositeOperation = 'overlay';
            sg.drawImage(rays, 0, 0, 1280, 720);
          });
          // 光束只在太阳左侧扇形里，右边那一截叠加后不变，不必贴
          const sk = skyR.width / 1280;
          g.globalAlpha = ra; g.drawImage(skyR, 0, 0, RAY_X1 * sk, skyR.height, 0, 0, RAY_X1, RAY_Y0); g.globalAlpha = 1;
        }
        // 云后的太阳：只见光晕，不见日轮（基础光晕已在天空贴图里，这里只加随第13句第3字增强的部分与拍点微光）
        glowFixed(g, 'b3sun', SUN.x, SUN.y, 300, 230, '#fff0cc', 0.5 * e1 + 0.06 * (beat - 1) / 0.07);
        // 云堤：云边变薄（完整云体+弱亮边 → 削薄云体+强亮边，两张合成好的贴图交叉淡化）；光柱从云后透出，所以云堤画在光束之上
        const bx = WD * 1.2 * (t + 1);
        const bankAt = (thin) => K.cache('b3bank' + (thin ? 'T' : 'F'), 700, 280, 1, (cg) => {
          cg.translate(-700, -20);
          bankBody(cg, thin);
          cg.globalAlpha = thin ? 1 : 0.4;
          cg.drawImage(K.cache('b3bankR', 1400, 320, 1, bankRim), 0, 0, 1400, 320);
        });
        if (e1 > 0.001) g.drawImage(bankAt(true), 700 + bx, 20, 700, 280);
        if (e1 < 0.999) { g.globalAlpha = 1 - e1; g.drawImage(bankAt(false), 700 + bx, 20, 700, 280); g.globalAlpha = 1; }
        glowFixed(g, 'b3sun2', SUN.x - 6, SUN.y - 6, 130, 80, '#fff3d6', (0.15 + 0.45 * e1) * beat);
        // 峰脚的流云：几缕薄雾带着暖白的亮边，从远峰的石柱前缓缓向左飘过（在云海之上、石柱之前）
        for (const W of WISPS) {
          const spr = K.cache('b3wisp' + W.seed, W.w + 40, W.h * 3 + 20, 1, (q) => paintWisp(q, W));
          const P = 1280 + W.w + 80;
          const x = ((((W.x0 + WD * W.sp * (t + 2)) + W.w / 2 + 40) % P) + P) % P - W.w / 2 - 40;
          const yy = W.y + 2.5 * Math.sin((TAU * (t + W.seed)) / 6.3) + bandDy({ base: W.y }, 0.12);
          g.globalAlpha = W.a; g.drawImage(spr, x - W.w / 2 - 20, yy - W.h * 1.5 - 10, W.w + 40, W.h * 3 + 20); g.globalAlpha = 1;
        }
        // 云海：自远而近
        // 远两层预先画成周期长条，只做平移（视差）；近三层逐团绘制（云头各自胀缩、翻涌）
        const seaStrip = (L, key, bottom, dy) => {
          const top = L.base - L.h[1] - 10, hh = bottom - top;
          const strip = K.cache('b3seaStrip' + key, 2 * L.P, hh, 1, (q) => {
            q.translate(0, -top);
            for (let rep = 0; rep < 2; rep++) { q.save(); q.translate(rep * L.P, 0); q.beginPath(); q.rect(0, top, L.P, hh); q.clip(); drawSea(q, L, 0, bottom, true); q.restore(); }
          });
          const off = ((((WD * L.sp * (t + 2)) % L.P) + L.P) % L.P);
          g.drawImage(strip, -L.P + off - (L.P - 1280) / 2, top + dy, 2 * L.P, hh);
        };
        for (let i = 0; i < SEA.length; i++) {
          const L = SEA[i], bottom = (SEA[i + 1] || FRONT).base + 6, dy = bandDy(L, SEA_W[i]);
          if (i < 2) seaStrip(L, i, bottom, dy);
          else { g.save(); g.translate(0, dy); drawSea(g, L, t + 2, bottom); g.restore(); }
        }
        // 云海受日光：右侧偏暖，左侧偏冷
        g.drawImage(K.cache('b3seaLight', 1280, 200, 1, (q) => {
          const lg = q.createLinearGradient(0, 0, 1280, 0); lg.addColorStop(0, 'rgba(90,110,150,0.16)'); lg.addColorStop(0.45, 'rgba(200,200,200,0)'); lg.addColorStop(0.8, 'rgba(255,214,150,0.2)'); lg.addColorStop(1, 'rgba(255,214,150,0.24)');
          q.fillStyle = lg; q.fillRect(0, 0, 1280, 200);
        }), 0, 440, 1280, 200);
        // 云海一带的光束逐帧叠加（再往下被最前的云影带盖住，不用画）
        if (ra > 0) {
          const S = rays.width / 1280;
          g.save();
          g.globalCompositeOperation = 'overlay'; g.globalAlpha = ra;
          g.drawImage(rays, 0, RAY_Y0 * S, RAY_XB * S, (RAY_Y1 - RAY_Y0) * S, 0, RAY_Y0, RAY_XB, RAY_Y1 - RAY_Y0);
          g.restore();
        }
        // 鹤：远的先画
        const beam = { ang: beamAng, t: tPass, on: e2 };
        const sts = CR.map((C, i) => craneState(C, i, t, lastShift, beam)).sort((a, b) => b.dep - a.dep);
        for (const st of sts) drawCrane(g, st);
        // 崖、松、人（近景，随镜头后拉缩小）
        g.save();
        g.translate(640, HY); g.scale(zN, zN); g.translate(-640, -HY);
        g.drawImage(K.cache('b3cliff', 520, 450, 1, (cg) => { cg.translate(0, -270); paintCliff(cg); }), 0, 270, 520, 450);
        const sway = 0.004 * Math.sin(TAU * 0.27 * t) + 0.002 * Math.sin(TAU * 0.61 * t + 1);
        g.save();
        g.translate(PINE_ROOT[0], PINE_ROOT[1]); g.rotate(sway * WD); g.translate(-PINE_ROOT[0], -PINE_ROOT[1]);
        g.drawImage(K.cache('b3pine', 400, 250, 1, (pg) => { pg.translate(-420, -300); paintPine(pg); }), 420, 300, 400, 250);
        g.restore();
        drawTufts(g, t);
        // 影子：光从右后方来，影子向左；日光透出后更清楚
        const sh = 0.28 + 0.3 * e1;
        g.fillStyle = `rgba(16,24,28,${sh.toFixed(3)})`;
        g.beginPath(); g.ellipse(MAN.x - 6, MAN.y + 1, 26, 3.2, 0, 0, TAU); g.fill();
        g.fillStyle = `rgba(16,24,28,${(sh * 0.45).toFixed(3)})`;
        g.beginPath(); g.ellipse(MAN.x - 48, MAN.y + 1.5, 52, 2.6, 0, 0, TAU); g.fill();
        XYT.sil.draw(g, 'youth', 'swordUp', MAN.x, MAN.y, MAN.h, t + 3, {
          facing: 1, wind: 0.5, windDir: WD, body: '#1e262c', rim: '#ffe0a6', rimSide: 1,
        });
        // 剑尖星芒：第13句第4字时一次，快起慢落
        const gl = pulse(t, tYun - 0.06, 0.1, 0.32);
        if (gl > 0.01) {
          const br = 1 + 0.004 * Math.sin((TAU * (t + 3)) / 3.6);
          const tx = MAN.x + 0.197 * MAN.h, ty = MAN.y - 1.483 * MAN.h * br;
          g.save(); g.globalCompositeOperation = 'lighter';
          glowAt(g, tx, ty, 26, 26, '#fff2cc', 0.75 * gl);
          g.strokeStyle = `rgba(255,246,220,${(0.85 * gl).toFixed(3)})`; g.lineCap = 'round';
          for (const [ang, L] of [[0, 22], [Math.PI / 2, 26], [Math.PI / 4, 9], [-Math.PI / 4, 9]]) {
            const L2 = L * (0.7 + 0.3 * gl);
            g.lineWidth = ang % (Math.PI / 2) === 0 ? 1.4 : 0.9;
            g.beginPath(); g.moveTo(tx - Math.cos(ang) * L2, ty - Math.sin(ang) * L2); g.lineTo(tx + Math.cos(ang) * L2, ty + Math.sin(ang) * L2); g.stroke();
          }
          g.restore();
        }
        g.restore();
        // 最前：冷蓝灰云影带（歌词区）：云头低平，只随风平移、不胀缩，字的背景稳定
        seaStrip(FRONT, 'F', 740, bandDy(FRONT, 1));
      },
    });
  })();

  // ============================================================
  // b4_teahouse：夜，老街茶楼一层；纸窗上折扇与人影，窗下白发人醉睡；一滴檐水落进水洼，月影荡开
  // ============================================================
  (function () {
    const FB1 = [0.183, 0.463, 1.043, 1.683, 2.263, 2.703, 3.043];
    const FB2 = [3.503, 3.863, 4.723];
    // 透视：地平线 y=350，相机高 1.7 m，立面在 6.45 m 处（约 170 像素/米）
    const HZ = 350;
    const EAVE = 150, SOFF = 197, BEAM = 214, STEP_T = 614, STEP_F = 627, STREET = 654;
    const WIN = { x0: 242, x1: 758, y0: 218, y1: 476 };
    const COLS = [[50, 74], [218, 242], [758, 782], [922, 956]];
    const MAN = { x: 880, y: 621, h: 290 };
    // 水洼在檐口滴水线下（立面前 0.8 m）、茶楼转角外的开阔处；月亮与它的倒影在同一竖列 x=1105，按地平线对称。
    // 转角外是空场与远处的河岸、对岸人家，水洼向前上方的反射光路不被任何建筑挡住，所以能映出月亮
    const PUD = { x: 1105, y: 680, rx: 112, ry: 23 };
    const MOON = { x: 1105, y: 2 * HZ - 681, r: 16 };
    const VP = { x: 640, y: HZ }; // 正面一点透视：消失点在画面中线
    const LANT = [[200, 186, 0.3], [800, 186, 2.1]];
    const eaveY = (x) => (x < 980 ? EAVE : EAVE - 30 * Math.pow(Math.min(1, (x - 980) / 170), 2));
    const DRIP = { x: PUD.x, y: 0 };
    DRIP.y = eaveY(DRIP.x) + 5;
    const GPX = 1909; // 9.8 m/s² × 195 像素/米（滴水所在深度）
    const T_FALL = Math.sqrt((2 * (PUD.y - DRIP.y)) / GPX);

    // ---------- 静态底图：夜空、月、巷子、屋顶、檐下、立面、台基、街面 ----------
    function paintBase(g) {
      const gy = (d) => HZ + (1.7 * 1100) / d; // 地面上深度 d 米处的屏幕 y
      const gx = (X, d) => VP.x + (X * 1100) / d; // 横向 X 米（相对相机轴）
      // 夜空
      const sk = g.createLinearGradient(0, 0, 0, 420);
      sk.addColorStop(0, '#131221'); sk.addColorStop(0.6, '#1c1a2b'); sk.addColorStop(1, '#2a2638');
      g.fillStyle = sk; g.fillRect(0, 0, 1280, 720);
      // 月晕与月亮（在茶楼转角右侧的开阔天空里）
      glowAt(g, MOON.x, MOON.y, 260, 220, '#aeb8d8', 0.2);
      glowAt(g, MOON.x, MOON.y, 70, 70, '#e4e9f6', 0.42);
      paintMoonDisc(g, MOON.x, MOON.y, MOON.r, 1);
      // ---------- 右侧远景：河对岸的人家（约 30 m）、河面、近处石栏（约 12.5 m）、空场地 ----------
      const yFar = gy(55), yRail = gy(12.5);
      // 对岸：粉墙黛瓦，墙面受月光微亮（偏冷），屋顶深；几扇昏黄小窗；倒影在河里（以对岸水线为轴翻转、更暗、横向碎开）
      const houses = [[950, 990, 3.4, 1.2], [986, 1046, 4.4, 0.9], [1042, 1088, 3.6, 1.6], [1084, 1150, 5.0, 0.8], [1146, 1196, 3.6, 1.3], [1192, 1250, 4.4, 1.0], [1246, 1300, 3.8, 1.2]];
      const sc30 = 1100 / 55;
      const drawHouses = (mirror) => {
        for (const [x0, x1, hm, rh] of houses) {
          const top = yFar - hm * sc30, rt = top - rh * sc30 * 0.8;
          const Y = (y) => (mirror ? 2 * yFar - y : y);
          // 粉墙
          g.fillStyle = mirror ? '#252536' : '#34364a';
          g.beginPath(); g.moveTo(x0, Y(top)); g.lineTo(x1, Y(top)); g.lineTo(x1, Y(yFar)); g.lineTo(x0, Y(yFar)); g.closePath(); g.fill();
          // 黛瓦：屋面梯形，两端微翘
          g.fillStyle = mirror ? '#17161f' : '#1b1a24';
          g.beginPath(); g.moveTo(x0 - 6, Y(top + 2)); g.quadraticCurveTo(x0 + 4, Y(top - 1), x0 + 10, Y(rt)); g.lineTo(x1 - 10, Y(rt)); g.quadraticCurveTo(x1 - 4, Y(top - 1), x1 + 6, Y(top + 2)); g.closePath(); g.fill();
          if (!mirror) {
            g.strokeStyle = 'rgba(180,192,226,0.55)'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(x0 + 10, rt + 0.5); g.lineTo(x1 - 10, rt + 0.5); g.stroke();
            g.fillStyle = 'rgba(14,13,20,0.5)'; g.fillRect(x0, top + 2, x1 - x0, 3);
          }
        }
      };
      drawHouses(false);
      const wins = [[1012, yFar - 22], [1112, yFar - 26], [1168, yFar - 20], [1268, yFar - 22]];
      for (const [wx, wy] of wins) {
        g.fillStyle = 'rgba(224,160,86,0.75)'; g.fillRect(wx, wy, 5, 7);
        glowAt(g, wx + 3.5, wy + 4.5, 18, 14, '#e0a050', 0.25);
      }
      // 河面
      const wg = g.createLinearGradient(0, yFar, 0, yRail);
      wg.addColorStop(0, '#24233a'); wg.addColorStop(1, '#17161f');
      g.fillStyle = wg; g.fillRect(940, yFar, 360, yRail - yFar);
      g.save(); g.beginPath(); g.rect(940, yFar, 360, yRail - yFar); g.clip();
      g.globalAlpha = 0.55; drawHouses(true); g.globalAlpha = 1;
      for (const [wx, wy] of wins) {
        const ry = 2 * yFar - wy;
        g.fillStyle = 'rgba(224,160,86,0.3)';
        for (let k = 0; k < 4; k++) g.fillRect(wx - 3 + Math.sin(k * 2.3) * 2.5, ry - 6 + k * 4, 13 - k * 2, 1.4);
      }
      // 横向水纹
      g.strokeStyle = 'rgba(150,160,200,0.12)'; g.lineWidth = 1;
      for (let y = yFar + 3; y < yRail; y += 4) { g.beginPath(); g.moveTo(940, y); g.lineTo(1300, y); g.stroke(); }
      g.restore();
      // 石栏：栏板与望柱，顶面一线冷月光
      const railTop = yRail - (0.62 * 1100) / 12.5;
      g.fillStyle = '#262330'; g.fillRect(940, railTop, 360, yRail - railTop);
      for (let x = 950; x < 1300; x += 58) { g.fillStyle = '#2d2a37'; g.fillRect(x, railTop - 6, 9, yRail - railTop + 6); g.fillStyle = 'rgba(176,188,222,0.4)'; g.fillRect(x, railTop - 6, 9, 1); }
      g.fillStyle = 'rgba(176,188,222,0.32)'; g.fillRect(940, railTop, 360, 1);
      // 空场地：青石板地面，越近越亮一点（湿）
      const pg = g.createLinearGradient(0, yRail, 0, 720);
      pg.addColorStop(0, '#1d1b25'); pg.addColorStop(1, '#1f1c23');
      g.fillStyle = pg; g.fillRect(940, yRail, 360, 720 - yRail);
      // ---------- 正面屋顶：黑瓦，瓦垄汇向屋面的消失点 (640, -285)；右端是山面的博风斜边 ----------
      const VERGE = [[1100, eaveY(1100) - 2], [836, -6]];
      g.save();
      g.beginPath(); g.moveTo(-20, -6); g.lineTo(VERGE[1][0], -6); g.lineTo(VERGE[0][0], VERGE[0][1]);
      for (let x = 1100; x >= -20; x -= 10) g.lineTo(x, eaveY(x));
      g.closePath();
      const rf = g.createLinearGradient(0, 0, 0, EAVE);
      rf.addColorStop(0, '#16141c'); rf.addColorStop(1, '#201d26');
      g.fillStyle = rf; g.fill();
      g.clip();
      for (let x = -200; x < 1160; x += 15) {
        const xt = VP.x + (x - VP.x) * 0.641;
        g.strokeStyle = 'rgba(46,42,54,0.9)'; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(xt, -6); g.lineTo(x, eaveY(x)); g.stroke();
        g.strokeStyle = 'rgba(10,9,14,0.7)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(xt + 2.3, -6); g.lineTo(x + 3.6, eaveY(x)); g.stroke();
      }
      for (let k = 0; k < 9; k++) {
        const y = EAVE - 8 - k * k * 1.9 - k * 6;
        g.strokeStyle = 'rgba(8,8,12,0.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-20, y); g.lineTo(1100, y); g.stroke();
      }
      g.restore();
      // 屋脊在画面上沿；博风斜边与翘角：上缘冷月光
      g.fillStyle = '#121119'; g.fillRect(-20, -6, VERGE[1][0] + 20, 12);
      g.strokeStyle = 'rgba(176,188,222,0.55)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-20, 0.8); g.lineTo(VERGE[1][0], 0.8); g.stroke();
      g.fillStyle = '#18161e';
      g.beginPath(); g.moveTo(VERGE[1][0] - 2, -6); g.lineTo(VERGE[1][0] + 12, -6); g.lineTo(VERGE[0][0] + 10, VERGE[0][1] - 4); g.lineTo(VERGE[0][0], VERGE[0][1] + 4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(176,188,222,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(VERGE[1][0] + 12, -5); g.lineTo(VERGE[0][0] + 10, VERGE[0][1] - 4); g.stroke();
      g.fillStyle = '#19171f';
      g.beginPath(); g.moveTo(1092, eaveY(1092) + 2); g.quadraticCurveTo(1130, eaveY(1130), 1150, 104); g.quadraticCurveTo(1146, 122, 1122, 134); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(176,188,222,0.5)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(1104, eaveY(1104) - 3); g.quadraticCurveTo(1134, eaveY(1134) - 4, 1149, 105); g.stroke();
      // 檐口：一排瓦当与滴水
      for (let x = 4; x < 1112; x += 14) {
        const y = eaveY(x);
        g.fillStyle = '#25212a';
        g.beginPath(); g.arc(x, y - 1, 5.2, 0, TAU); g.fill();
        g.fillStyle = '#1d1a22';
        g.beginPath(); g.moveTo(x + 2, y + 3); g.lineTo(x + 12, y + 3); g.lineTo(x + 7, y + 9); g.closePath(); g.fill();
      }
      // 檐下：椽子与立面垂直，在画面里从墙顶汇向消失点（向中间收拢），被窗光、灯笼光照暖
      g.save();
      g.beginPath(); g.moveTo(-20, EAVE + 6);
      for (let x = -20; x <= 1100; x += 10) g.lineTo(x, eaveY(x) + 6);
      g.lineTo(956, SOFF); g.lineTo(-20, SOFF); g.closePath();
      g.fillStyle = '#20191d'; g.fill();
      g.clip();
      const kE = (HZ - (EAVE + 6)) / (HZ - SOFF);
      for (let xw = -60; xw < 970; xw += 13) {
        const xe = VP.x + (xw - VP.x) * kE;
        g.strokeStyle = 'rgba(74,52,48,0.85)'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(xw, SOFF); g.lineTo(xe, EAVE + 6); g.stroke();
        g.strokeStyle = 'rgba(24,16,18,0.9)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(xw + 4, SOFF); g.lineTo(xe + 4 * kE, EAVE + 6); g.stroke();
      }
      g.restore();
      // ---------- 立面 ----------
      g.fillStyle = '#2f2226'; g.fillRect(-20, SOFF, 978, BEAM - SOFF);
      g.fillStyle = 'rgba(120,52,40,0.35)'; g.fillRect(-20, SOFF + 4, 978, 7);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-20, BEAM - 2, 978, 2);
      const panel = (x0, x1, y0, y1) => {
        g.fillStyle = '#261d21'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        for (let x = x0 + 12; x < x1 - 4; x += 16) { g.fillStyle = 'rgba(10,6,8,0.55)'; g.fillRect(x, y0, 1.4, y1 - y0); g.fillStyle = 'rgba(80,60,56,0.18)'; g.fillRect(x + 1.4, y0, 1, y1 - y0); }
      };
      panel(-20, 50, BEAM, STEP_T); panel(74, 218, BEAM, STEP_T); panel(782, 922, BEAM, STEP_T);
      g.fillStyle = '#272026'; g.fillRect(242, WIN.y1 + 6, 516, STEP_T - WIN.y1 - 6);
      g.strokeStyle = 'rgba(12,9,12,0.5)'; g.lineWidth = 1;
      for (let y = WIN.y1 + 14, r = 0; y < STEP_T; y += 11, r++) {
        g.beginPath(); g.moveTo(242, y); g.lineTo(758, y); g.stroke();
        for (let x = 242 + (r % 2) * 18; x < 758; x += 36) { g.beginPath(); g.moveTo(x, y - 11); g.lineTo(x, y); g.stroke(); }
      }
      g.fillStyle = '#2a1e20';
      g.fillRect(WIN.x0 - 6, WIN.y0 - 6, WIN.x1 - WIN.x0 + 12, 6); g.fillRect(WIN.x0 - 6, WIN.y1, WIN.x1 - WIN.x0 + 12, 8);
      g.fillRect(WIN.x0 - 6, WIN.y0, 6, WIN.y1 - WIN.y0); g.fillRect(WIN.x1, WIN.y0, 6, WIN.y1 - WIN.y0);
      for (const [x0, x1] of COLS) {
        const cg = g.createLinearGradient(x0, 0, x1, 0);
        const lit = x0 > 500 ? [0.4, 0.05] : [0.05, 0.4];
        cg.addColorStop(0, `rgba(${Math.round(44 + 60 * lit[0])},${Math.round(34 + 34 * lit[0])},${Math.round(36 + 16 * lit[0])},1)`);
        cg.addColorStop(1, `rgba(${Math.round(44 + 60 * lit[1])},${Math.round(34 + 34 * lit[1])},${Math.round(36 + 16 * lit[1])},1)`);
        g.fillStyle = cg; g.fillRect(x0, BEAM - 2, x1 - x0, STEP_T - BEAM + 2);
        g.fillStyle = '#3a3236'; g.fillRect(x0 - 4, STEP_T - 10, x1 - x0 + 8, 10);
      }
      // ---------- 台基 ----------
      const st = g.createLinearGradient(0, STEP_T, 0, STEP_F);
      st.addColorStop(0, '#3b3337'); st.addColorStop(1, '#463c3e');
      g.fillStyle = st; g.fillRect(-20, STEP_T, 976, STEP_F - STEP_T);
      g.fillStyle = '#2a2328'; g.fillRect(-20, STEP_F, 976, STREET - STEP_F);
      g.strokeStyle = 'rgba(10,8,10,0.6)'; g.lineWidth = 1;
      for (let x = 30; x < 956; x += 96) { g.beginPath(); g.moveTo(x, STEP_F); g.lineTo(x, STREET); g.stroke(); }
      g.fillStyle = 'rgba(200,170,140,0.18)'; g.fillRect(-20, STEP_F, 976, 1.2);
      // 台基右端的转角：端面朝消失点一侧，看不见；只露一点石边
      g.fillStyle = 'rgba(200,170,140,0.12)'; g.fillRect(954, STEP_T, 2, STREET - STEP_T);
      // ---------- 街面：青石板，横缝平行于立面，纵缝汇向消失点；潮湿，略有天光 ----------
      g.fillStyle = '#1c1a21'; g.fillRect(-20, STREET, 1310, 80);
      const rws = [12.5, 10.5, 9, 7.8, 6.9, 6.15, 5.72, 5.3, 4.9, 4.5];
      const r = rng(71);
      for (let i = 0; i < rws.length - 1; i++) {
        const y0 = gy(rws[i]), y1 = gy(rws[i + 1]);
        const off = (i % 2) * 0.4;
        for (let k = -16; k < 16; k++) {
          const X0 = (k + off) * 0.78, X1 = X0 + 0.78;
          let xa0 = gx(X0, rws[i]), xa1 = gx(X1, rws[i]);
          const xb0 = gx(X0, rws[i + 1]), xb1 = gx(X1, rws[i + 1]);
          // 台基前面只有近处几排；台基右边（场地）才往远处铺
          if (rws[i] > 6.2 && Math.max(xa1, xb1) < 960) continue;
          if (Math.max(xa1, xb1) < -20 || Math.min(xa0, xb0) > 1300) continue;
          const v = r();
          g.fillStyle = `rgb(${Math.round(30 + 10 * v)},${Math.round(28 + 9 * v)},${Math.round(36 + 10 * v)})`;
          g.save();
          if (rws[i] > 6.2) { g.beginPath(); g.rect(958, 0, 400, 720); g.clip(); }
          g.beginPath(); g.moveTo(xa0 + 1, y0 + 0.6); g.lineTo(xa1 - 1, y0 + 0.6); g.lineTo(xb1 - 1, y1 - 0.6); g.lineTo(xb0 + 1, y1 - 0.6); g.closePath(); g.fill();
          const sheen = 0.04 + 0.08 * Math.exp(-Math.abs((xa0 + xb1) / 2 - 1100) / 220);
          g.fillStyle = `rgba(150,160,196,${sheen.toFixed(3)})`;
          g.beginPath(); g.moveTo(xa0 + 2, y0 + 1); g.lineTo(xa1 - 2, y0 + 1); g.lineTo((xa1 + xb1) / 2 - 2, (y0 + y1) / 2); g.lineTo((xa0 + xb0) / 2 + 2, (y0 + y1) / 2); g.closePath(); g.fill();
          g.restore();
        }
      }
      // 窗光落在台基顶面与街面上（暖色光池）
      g.save(); g.globalCompositeOperation = 'lighter';
      g.save(); g.translate(500, STEP_T + 6); g.scale(1, 0.09);
      let lg = g.createRadialGradient(0, 0, 0, 0, 0, 330);
      lg.addColorStop(0, 'rgba(243,199,121,0.42)'); lg.addColorStop(1, 'rgba(243,199,121,0)');
      g.fillStyle = lg; g.fillRect(-340, -340, 680, 680); g.restore();
      g.save(); g.translate(500, 690); g.scale(1, 0.14);
      lg = g.createRadialGradient(0, 0, 0, 0, 0, 380);
      lg.addColorStop(0, 'rgba(230,170,96,0.2)'); lg.addColorStop(1, 'rgba(230,170,96,0)');
      g.fillStyle = lg; g.fillRect(-400, -400, 800, 800); g.restore();
      g.save(); g.beginPath(); g.rect(-20, EAVE, 980, SOFF - EAVE); g.clip();
      g.translate(500, SOFF); g.scale(1, 0.35);
      lg = g.createRadialGradient(0, 0, 0, 0, 0, 360);
      lg.addColorStop(0, 'rgba(243,190,110,0.3)'); lg.addColorStop(1, 'rgba(243,190,110,0)');
      g.fillStyle = lg; g.fillRect(-380, -380, 760, 760); g.restore();
      g.restore();
    }
    // 月面：亮面朝向（满月），几块淡灰的月海
    function paintMoonDisc(g, x, y, r, a) {
      g.save(); g.globalAlpha *= a;
      const mg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      mg.addColorStop(0, '#f6f8fc'); mg.addColorStop(0.8, '#e2e7f2'); mg.addColorStop(1, '#c9d0e2');
      g.fillStyle = mg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(150,160,186,0.35)';
      for (const [dx, dy, rr] of [[-0.3, -0.2, 0.28], [0.2, 0.1, 0.22], [-0.05, 0.35, 0.18], [0.35, -0.3, 0.12]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, rr * r, 0, TAU); g.fill(); }
      g.restore();
    }
    // ---------- 纸窗 ----------
    function paintPaper(g) {
      const W0 = WIN.x1 - WIN.x0, H0 = WIN.y1 - WIN.y0;
      const pg = g.createRadialGradient(W0 * 0.5, H0 * 0.55, 10, W0 * 0.5, H0 * 0.5, W0 * 0.62);
      pg.addColorStop(0, '#ffe7b4'); pg.addColorStop(0.45, '#f6cd82'); pg.addColorStop(0.85, '#e4a157'); pg.addColorStop(1, '#cf8a46');
      g.fillStyle = pg; g.fillRect(0, 0, W0, H0);
      // 纸纹
      const r = rng(17);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(160,100,50,${0.03 + 0.04 * r()})`; g.fillRect(r() * W0, r() * H0, 1 + r() * 10, 0.8); }
    }
    // 窗棂（贴在纸前）：四扇，上有横披；扇内方格
    function paintLattice(g) {
      const W0 = WIN.x1 - WIN.x0, H0 = WIN.y1 - WIN.y0;
      g.fillStyle = '#2b1f20';
      const bar = (x, y, w, h) => g.fillRect(x, y, w, h);
      const top = 58;
      bar(0, top - 3, W0, 6);
      for (let k = 1; k < 4; k++) bar((W0 * k) / 4 - 3, 0, 6, H0);
      g.globalAlpha = 0.92;
      for (let x = 21; x < W0; x += 21.5) bar(x - 1, 0, 2, top);
      for (let y = 14; y < top - 6; y += 14) bar(0, y - 1, W0, 2);
      for (let k = 0; k < 4; k++) {
        const x0 = (W0 * k) / 4 + 3, x1 = (W0 * (k + 1)) / 4 - 3;
        for (let x = x0 + 16; x < x1 - 4; x += 16) bar(x - 1, top + 3, 2, H0 - top - 3);
        for (let y = top + 18; y < H0 - 4; y += 18) bar(x0, y - 1, x1 - x0, 2);
      }
      g.globalAlpha = 1;
    }
    // 人影：屋里灯前的人投在窗纸上的影子——用 XYT.sil 的剪影整块染成影子色，建缓存时按远近模糊（不画任何细节）
    // 贴图 380×340，人物着地点在贴图 (190, 340)；只露出窗里的上半身
    const SHW = 380, SHH = 340;
    function paintShadow(g, B) {
      const S = g.getTransform().a;
      const tmp = document.createElement('canvas');
      tmp.width = Math.round(SHW * S); tmp.height = Math.round(SHH * S);
      const tg = tmp.getContext('2d'); tg.scale(S, S);
      XYT.sil.draw(tg, B.who, B.pose, SHW / 2, SHH, B.h, 2.0, { facing: B.facing, wind: 0, body: '#5c2e16' });
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = '#5c2e16'; tg.fillRect(0, 0, tmp.width, tmp.height);
      blurInto(g, SHW, SHH, B.blur, (q) => { q.save(); q.setTransform(1, 0, 0, 1, 0, 0); q.drawImage(tmp, 0, 0); q.restore(); });
    }
    // 折扇影：open 1 全开、0 合拢；扇纸为半环，扇骨从扇轴放射；枢轴藏在人影肩头里
    const FAN = { x: 448, y: 356, R: 62 };
    function paintFan(g, open) {
      blurInto(g, 160, 120, 1.8, (q) => {
        const cx = 40, cy = 96;
        const a0 = lerp(-1.42, -2.45, open), a1 = lerp(-1.22, -0.18, open);
        q.fillStyle = 'rgba(92,46,22,0.55)';
        q.beginPath(); q.arc(cx, cy, FAN.R, a0, a1); q.arc(cx, cy, FAN.R * 0.38, a1, a0, true); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(92,46,22,0.95)'; q.lineCap = 'round';
        const n = 12;
        for (let i = 0; i <= n; i++) {
          const a = lerp(a0, a1, i / n);
          q.lineWidth = i === 0 || i === n ? 2.6 : 1.2;
          q.beginPath(); q.moveTo(cx, cy); q.lineTo(cx + Math.cos(a) * FAN.R * (i === 0 || i === n ? 1.0 : 0.4), cy + Math.sin(a) * FAN.R * (i === 0 || i === n ? 1.0 : 0.4)); q.stroke();
        }
      });
    }
    const FAN_N = 20;
    // 人影：说书人（左，背身坐着，扇子举在右肩）、举起葫芦大笑的听客（右，背身坐着）、离灯更近的仰头大笑的听客（影子更大更虚）
    // x、y 是剪影着地点（坐面）在窗里的位置（坐面在窗下沿附近，只露上半身）
    const BLOBS = [
      { who: 'old', pose: 'sitBack', facing: 1, h: 320, x: 400, y: 500, blur: 3.5, a: 0.6, laugh: 0.35 },
      { who: 'old', pose: 'sitBoat', facing: 1, h: 300, x: 632, y: 506, blur: 3.5, a: 0.56, laugh: 1 },
      { who: 'youth', pose: 'laughSide', facing: -1, h: 380, x: 528, y: 610, blur: 10, a: 0.22, laugh: 0.7 },
    ];
    function drawWindow(g, t, flash, closeK, laugh) {
      const W0 = WIN.x1 - WIN.x0, H0 = WIN.y1 - WIN.y0;
      g.drawImage(K.cache('b4paper', W0, H0, 1, paintPaper), WIN.x0, WIN.y0, W0, H0);
      g.save();
      g.beginPath(); g.rect(WIN.x0, WIN.y0, W0, H0); g.clip();
      // 人影（远的先画）
      for (let i = 2; i >= 0; i--) {
        const B = BLOBS[i];
        const spr = K.cache('b4shadow' + i, SHW, SHH, 0.6, (q) => paintShadow(q, B));
        const dy = laugh * B.laugh;
        g.globalAlpha = B.a;
        g.drawImage(spr, B.x - SHW / 2, B.y - SHH + dy, SHW, SHH);
      }
      // 扇影：在 FAN_N 个预先模糊好的状态之间交叉淡化
      const f = (1 - closeK) * (FAN_N - 1), i0 = Math.floor(f), w = f - i0;
      const fanAt = (i) => K.cache('b4fan' + i, 160, 120, 1, (q) => paintFan(q, i / (FAN_N - 1)));
      const fy = FAN.y - 96 + laugh * BLOBS[0].laugh;
      g.globalAlpha = 0.72 * (1 - w); g.drawImage(fanAt(i0), FAN.x - 40, fy, 160, 120);
      if (w > 0.001) { g.globalAlpha = 0.72 * w; g.drawImage(fanAt(Math.min(FAN_N - 1, i0 + 1)), FAN.x - 40, fy, 160, 120); }
      g.globalAlpha = 1;
      // 笑声时窗纸一亮
      if (flash > 0.002) { g.globalCompositeOperation = 'lighter'; glowAt(g, 500, 350, 330, 190, '#ffd99a', 0.26 * flash); g.globalCompositeOperation = 'source-over'; }
      g.restore();
      g.drawImage(K.cache('b4lattice', W0, H0, 1, paintLattice), WIN.x0, WIN.y0, W0, H0);
    }
    // 水洼里的月影（与天上的月同大：远处物体在平静水面里的像不被压扁）
    function moonRefl() {
      return K.cache('b4moonR', 64, 64, 2, (g) => {
        blurInto(g, 64, 64, 0.8, (q) => {
          paintMoonDisc(q, 32, 32, MOON.r, 1);
        });
      });
    }
    // 水洼轮廓：不规则的两瓣形（地面上的形状，按透视压扁），只建一次
    const PUD_N = 96;
    const pudR = (a) => 1 + 0.05 * Math.cos(2 * a) + 0.07 * Math.sin(3 * a + 0.5) + 0.035 * Math.sin(5 * a + 2.0) + 0.02 * Math.sin(7 * a + 1.0);
    function pudPath(g, grow) {
      g.beginPath();
      for (let i = 0; i <= PUD_N; i++) {
        const a = (i / PUD_N) * TAU, r = pudR(a);
        const x = PUD.x + (PUD.rx * r + grow) * Math.cos(a), y = PUD.y + (PUD.ry * r + grow * 0.45) * Math.sin(a);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    const PB = { x: PUD.x - PUD.rx * 1.3 - 12, y: PUD.y - PUD.ry * 1.3 - 10, w: PUD.rx * 2.6 + 24, h: PUD.ry * 2.6 + 20 };
    // 静态的水洼：外圈一道渐隐的湿暗边（建缓存时模糊）+ 映着夜空的水面（远沿映低处的天，略亮）+ 月影周围的柔光
    function paintPuddle(g) {
      g.translate(-PB.x, -PB.y);
      blurInto(g, 1400, 760, 3.2, (q) => {
        q.fillStyle = 'rgba(8,7,12,0.55)'; pudPath(q, 6); q.fill();
      });
      pudPath(g, 0);
      const pg = g.createLinearGradient(0, PUD.y - PUD.ry * 1.2, 0, PUD.y + PUD.ry * 1.2);
      pg.addColorStop(0, '#2c2b3e'); pg.addColorStop(0.5, '#1d1c2b'); pg.addColorStop(1, '#141420');
      g.fillStyle = pg; g.fill();
      g.save(); g.clip();
      const rg = g.createRadialGradient(PUD.x, PUD.y, 2, PUD.x, PUD.y, PUD.rx * 0.8);
      rg.addColorStop(0, 'rgba(160,170,210,0.32)'); rg.addColorStop(1, 'rgba(150,160,200,0)');
      g.save(); g.translate(PUD.x, PUD.y); g.scale(1, 0.4); g.translate(-PUD.x, -PUD.y);
      g.fillStyle = rg; g.fillRect(PUD.x - PUD.rx, PUD.y - PUD.rx, PUD.rx * 2, PUD.rx * 2);
      g.restore();
      g.restore();
    }
    function drawPuddle(g, t, tHit) {
      g.drawImage(K.cache('b4pud', PB.w, PB.h, 1, paintPuddle), PB.x, PB.y, PB.w, PB.h);
      g.save();
      pudPath(g, 0); g.clip();
      const age = t - tHit;
      // 月影：2 像素横条，错位随涟漪的相位由中心向外传播，约 1.5 s 内平复（最大 2 像素）
      const A = age > 0 ? 3.5 * smooth(age / 0.05) * Math.exp(-age / 0.6) : 0;
      const spr = moonRefl(), r = MOON.r, ps = spr.width / 64;
      g.globalAlpha = 0.86;
      for (let k = -r - 2; k < r + 2; k += 2) {
        const kc = k + 1;
        const dx = A > 0.01 ? A * Math.sin(0.35 * Math.abs(kc) - 14 * age) * Math.exp(-Math.abs(kc) / 14) : 0;
        g.drawImage(spr, 0, (32 + k) * ps, spr.width, 2 * ps, PUD.x - 32 + dx, PUD.y + k, 64, 2);
      }
      g.globalAlpha = 1;
      // 涟漪：从落点向外扩散的椭圆圈，渐淡
      if (age > 0) {
        // 一圈圈从落点向外扩散，约 1.5 s 扩到 120 像素（压扁成地面上的椭圆），越外越淡
        for (let j = 0; j < 4; j++) {
          const a2 = age - j * 0.16;
          if (a2 <= 0) continue;
          const rr = 5 + 118 * (1 - Math.exp(-a2 / 0.75));
          const al = 0.8 * Math.exp(-a2 / 0.9) * (1 - j * 0.2) * smooth(a2 / 0.06) * clamp(1.2 - rr / (PUD.rx * 1.12));
          if (al < 0.01) continue;
          g.strokeStyle = `rgba(222,230,250,${al.toFixed(3)})`; g.lineWidth = 1.6;
          g.beginPath(); g.ellipse(PUD.x, PUD.y, rr, rr * (PUD.ry / PUD.rx), 0, 0, TAU); g.stroke();
          g.strokeStyle = `rgba(6,6,12,${(al * 0.6).toFixed(3)})`; g.lineWidth = 1;
          g.beginPath(); g.ellipse(PUD.x, PUD.y + 1.2, rr - 1.5, (rr - 1.5) * (PUD.ry / PUD.rx), 0, 0, TAU); g.stroke();
        }
      }
      g.restore();
    }
    // 倒在台基上的酒坛（开口、无封布）：坛底在左、坛口朝右；侧躺时坛肚与坛底边缘同时着地（稳定），坛口略抬；坛口边淌出一小摊酒
    const JAR_S = 0.42;
    let JAR_ROT = Math.PI / 2;
    function jarOutline(g) {
      g.beginPath();
      g.moveTo(-34, 0); g.bezierCurveTo(-50, -14, -54, -76, -36, -92);
      g.lineTo(-22, -100); g.lineTo(-22, -105); g.lineTo(-26, -106); g.lineTo(-26, -112);
      g.lineTo(26, -112); g.lineTo(26, -106); g.lineTo(22, -105); g.lineTo(22, -100); g.lineTo(36, -92);
      g.bezierCurveTo(54, -76, 50, -14, 34, 0); g.closePath();
    }
    function paintJar(g) {
      g.translate(64, 124);
      jarOutline(g);
      const col = '#4a3426';
      g.fillStyle = K.lin(g, -56, 0, 56, 0, [[0, mix(col, '#000', 0.35)], [0.3, mix(col, '#c89a6a', 0.3)], [0.55, col], [1, mix(col, '#000', 0.55)]]); g.fill();
      g.save(); g.clip();
      // 釉面高光（窗光在左上）与肩部一道弦纹
      g.fillStyle = 'rgba(255,226,180,0.2)'; g.beginPath(); g.ellipse(-30, -54, 6, 22, 0.1, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(20,12,8,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-40, -86); g.quadraticCurveTo(0, -80, 40, -86); g.stroke();
      g.fillStyle = mix(col, '#000', 0.25); g.fillRect(-26, -112, 52, 6);
      g.fillStyle = 'rgba(14,9,8,0.6)'; g.fillRect(-36, -4, 72, 4);
      g.restore();
    }
    // 酒坛着地点：旋转后轮廓的最低点正好落在 groundY 上
    let JAR_LOW = null;
    function jarLow() {
      if (JAR_LOW) return JAR_LOW;
      const pts = [];
      const cv = { x0: 0, y0: 0, moveTo(x, y) { pts.push([x, y]); this.x0 = x; this.y0 = y; }, lineTo(x, y) { pts.push([x, y]); this.x0 = x; this.y0 = y; },
        bezierCurveTo(a, b, c, d, x, y) { for (let i = 1; i <= 16; i++) { const u = i / 16, v = 1 - u; pts.push([v * v * v * this.x0 + 3 * v * v * u * a + 3 * v * u * u * c + u * u * u * x, v * v * v * this.y0 + 3 * v * v * u * b + 3 * v * u * u * d + u * u * u * y]); } this.x0 = x; this.y0 = y; },
        beginPath() {}, closePath() {} };
      jarOutline(cv);
      // 找坛底边缘与坛肚同时着地的转角：rot = π/2 − β，逐步搜索
      const lowOf = (rot, sel) => { const c = Math.cos(rot), sn = Math.sin(rot); let m = -1e9; for (const [x, y] of pts) if (sel(y)) m = Math.max(m, x * sn + y * c); return m; };
      let best = 0, bd = 1e9;
      for (let b = 0; b <= 0.6; b += 0.002) {
        const rot = Math.PI / 2 - b;
        const d = Math.abs(lowOf(rot, (y) => y > -3) - lowOf(rot, (y) => y < -20 && y > -90));
        if (d < bd) { bd = d; best = b; }
      }
      JAR_ROT = Math.PI / 2 - best;
      const c = Math.cos(JAR_ROT), sn = Math.sin(JAR_ROT);
      let low = -1e9, mx = -1e9;
      for (const [x, y] of pts) { const Y = (x * sn + y * c) * JAR_S, X = (x * c - y * sn) * JAR_S; if (Y > low) low = Y; if (X > mx) mx = X; }
      JAR_LOW = { low, mouthX: mx };
      return JAR_LOW;
    }
    function drawJar(g, x, groundY) {
      const L = jarLow(), y = groundY - L.low;
      // 坛口淌出的酒：一小摊扁平的湿痕，映一点窗光
      const mx = x + L.mouthX;
      g.fillStyle = 'rgba(14,9,8,0.55)';
      g.beginPath(); g.ellipse(mx + 6, groundY + 1.2, 16, 2.6, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(243,199,121,0.22)'; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(mx + 6, groundY + 0.6, 12, 1.6, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      // 接触阴影
      g.fillStyle = 'rgba(8,6,10,0.55)';
      g.beginPath(); g.ellipse(x + L.mouthX * 0.45, groundY + 1.5, 30, 3.2, 0, 0, TAU); g.fill();
      g.save(); g.translate(x, y); g.rotate(JAR_ROT); g.scale(JAR_S, JAR_S);
      g.drawImage(K.cache('b4jar', 128, 132, 2, paintJar), -64, -124, 128, 132);
      // 坛口：开口端面看去是一道窄椭圆（里面黑）
      g.fillStyle = '#120c0a'; g.beginPath(); g.ellipse(0, -112, 22, 4.5, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,214,160,0.3)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, -112, 24, 5.5, 0, Math.PI, TAU); g.stroke();
      g.restore();
    }
    // 檐水：在滴水瓦下慢慢聚成一滴，第16句第3字前 T_FALL 秒脱落，自由落体，正落在月影上；落点溅起几粒细水珠
    function drawDrip(g, t, tHit) {
      const tRel = tHit - T_FALL;
      const grow = smooth((t - (tRel - 1.6)) / 1.5);
      if (t < tRel) {
        if (grow <= 0) return;
        const rr = 2.6 * grow, sag = 1.5 * grow * grow;
        g.fillStyle = 'rgba(200,210,236,0.85)';
        g.beginPath(); g.ellipse(DRIP.x, DRIP.y + rr * 0.6 + sag, rr * 0.85, rr + sag * 0.4, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,240,210,0.9)'; g.beginPath(); g.arc(DRIP.x - rr * 0.3, DRIP.y + rr * 0.3 + sag, Math.max(0.5, rr * 0.3), 0, TAU); g.fill();
        return;
      }
      if (t < tHit) {
        const u = t - tRel, y = DRIP.y + 3 + 0.5 * GPX * u * u, v = GPX * u;
        const len = Math.min(10, 2.6 + v * 0.006);
        const gr = g.createLinearGradient(0, y - len, 0, y + 2.4);
        gr.addColorStop(0, 'rgba(200,210,236,0)'); gr.addColorStop(1, 'rgba(226,232,250,0.95)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(DRIP.x - 1.4, y - len + 2); g.lineTo(DRIP.x + 1.4, y - len + 2); g.lineTo(DRIP.x + 2.3, y); g.arc(DRIP.x, y, 2.3, 0, Math.PI); g.closePath(); g.fill();
        return;
      }
      // 溅起的细水珠：抛物线，0.2 s 内落回
      const age = t - tHit;
      if (age < 0.3) {
        for (let k = 0; k < 7; k++) {
          const ang = -Math.PI / 2 + (k / 6 - 0.5) * 1.9, v0 = 110 + 40 * h2(k, 9);
          const x = PUD.x + Math.cos(ang) * v0 * age * 0.6, y = PUD.y + Math.sin(ang) * v0 * age * 0.5 + 0.5 * GPX * age * age;
          if (y > PUD.y + 1) continue;
          g.fillStyle = `rgba(220,228,248,${(0.85 * (1 - age / 0.3)).toFixed(3)})`;
          g.beginPath(); g.arc(x, y, 1.1, 0, TAU); g.fill();
        }
      }
    }

    XYT.registerShot('b4_teahouse', {
      name: '\u7b11\u4f20\u9189\u68a6', zone: 'top', night: true, text: '#f6e7c8', shadow: 'rgba(10,8,18,0.92)', accent: '#f3c779', bloom: 0.42,
      draw(g, c) {
        const t = c.lt;
        const tWen = charLt(c, 4, 0, FB1), tXiao = charLt(c, 5, 0, FB1), tChuan = charLt(c, 6, 0, FB1);
        const tZui = charLt(c, 0, 1, FB2), tZhong = charLt(c, 2, 1, FB2);
        // 第16句第1字起 smoothstep 推向水洼 1.00→1.06，正好在白雾到来时推完（峰值约 2%/s）
        const z = 1 + 0.06 * smooth((t - tZui) / Math.max(1, c.dur - tZui));
        camBuf(g, z, PUD.x, PUD.y - 9, (g) => {
          g.drawImage(ocache('b4base', 1280, 720, paintBase), 0, 0, 1280, 720);
          // 纸窗：第15句第5字扇影 0.35 s 合拢；第15句第6、7字窗纸各一亮（提前 0.06 s 起，0.14 s 升到顶，约 0.55 s 落下）、人影轻晃
          const closeK = smooth((t - tWen) / 0.35);
          const flash = pulse(t, tXiao - 0.06, 0.14, 0.55) + 0.7 * pulse(t, tChuan - 0.06, 0.14, 0.55);
          const bob = (t0) => (t > t0 - 0.06 ? -Math.sin(TAU * 2.4 * (t - t0 + 0.06)) * Math.exp(-(t - t0 + 0.06) / 0.5) * smooth((t - t0 + 0.06) / 0.1) : 0);
          const laugh = 4 * (bob(tXiao) + 0.8 * bob(tChuan));
          drawWindow(g, t, flash, closeK, laugh);
          // 窗光溢出到檐下与台基（随笑声的亮度一起起落）
          if (flash > 0.002) {
            g.save(); g.globalCompositeOperation = 'lighter';
            glowAt(g, 500, STEP_T + 8, 360, 40, '#f3c779', 0.12 * flash);
            glowAt(g, 500, SOFF - 10, 380, 50, '#f3c779', 0.1 * flash);
            g.restore();
          }
          // 灯笼：单摆 ±3°，灯火随拍轻轻摇曳
          const fl = 1 + 0.06 * be(c, 0.35);
          for (const [lx, ly, ph] of LANT) {
            const ang = 0.052 * Math.sin((TAU * t) / 1.45 + ph);
            g.save(); g.globalCompositeOperation = 'lighter';
            glowAt(g, lx + Math.sin(ang) * 60, ly + 70, 150, 130, '#e0903f', 0.2 * fl);
            g.restore();
            XYT.env.lantern(g, { x: lx, y: ly, s: 2.1, t: t + ph, color: '#b8322a', lit: 1, swing: 0, tilt: ang, seed: Math.round(ph * 3) });
          }
          // 酒坛（倒在脚边）与老人：窗光从左边照亮他的轮廓
          g.fillStyle = 'rgba(8,6,10,0.55)';
          g.beginPath(); g.ellipse(MAN.x - 30, MAN.y + 2, 112, 5, 0, 0, TAU); g.fill();
          drawJar(g, 676, MAN.y + 1.5);
          XYT.sil.draw(g, 'old', 'sitSleep', MAN.x, MAN.y, MAN.h, t + 1.3, {
            facing: -1, wind: 0, body: '#1e1a21', rim: '#f3c779', rimSide: -1, rimWidth: 1.6,
          });
          // 水洼与檐水
          drawPuddle(g, t, tZhong);
          drawDrip(g, t, tZhong);
        });
        // 收尾渐白，接下一镜的白雾转场：画面上的雾色总权重 Φ 从第 FOG_A 秒起平滑升到 0.7（FOG_B 秒）。
        // 转场时引擎会在本镜上再盖一层同色的雾（不透明度 0.7·sin(πp)）；这里只补足两者的差，
        // 本镜最终的雾色权重 = max(Φ, 引擎的雾)，整段亮度每帧变化不超过约 3.5 级，不再在转场开头突然变白
        const fogW = fogCurve(t, c.dur);
        if (fogW > 0.001) { g.fillStyle = rgba(FOG_COL, Math.min(1, fogW)); g.fillRect(0, 0, 1280, 720); }
      },
    });
  })();

  // ============================================================
  // c1_lotus：盛夏正午的荷塘，少年仰卧小舟，草帽盖脸、葫芦在怀，顺水漂；水珠从斜叶上滚落入水；一阵风从左向右掠过荷塘；
  // 第17句第9字前后镜头缓缓降低，近处挺水的高荷叶随视差升起、挡住远处的小舟，只剩空水道上一道渐弱的 V 形水纹
  // ============================================================
  (function () {
    const FB = [0.259, 0.579, 0.979, 1.359, 2.179, 2.679, 3.099, 3.579, 3.859, 4.219, 4.859];
    // 平视略俯：地平线 y=430，焦距 650 像素，眼高水面上 1.4 m；水面上深度 d 处 y = 430 + 910/d
    const HZ = 430, F = 650, CH = 1.4, WD = 1;
    const yW = (d) => HZ + (F * CH) / d;
    // 小舟：深 9.5 m（水道中线），船长 430、少年身高 132（船长约 3.3 倍身高，卧姿约 130 像素长）；向右漂 12 px/s
    const BOAT = { x0: 790, d: 9.5, len: 430, h: 132, v: 12 };
    BOAT.wl = yW(BOAT.d); BOAT.deck = BOAT.wl - 0.03 * BOAT.len;
    // 镜头降低：第17句第5字后不久起、到第17句第11字后 0.2 s，眼高平滑降低 0.14 m（smoothstep）。
    // 小舟长 430 像素、只漂 12 px/s，靠横向漂移一秒内只能多挡住 12 像素，挡不住；镜头降低时近处（1.5 m）的高荷叶比远处（9.5 m）的小舟多升起约 51 像素，
    // 正好把卧在舟里的人和船身整条盖住。近叶升起最快约 33 px/s（≤ 35 px/s），叶形不变、不转动，只有 ±1.5° 以内的摇曳
    const CAM_D = 0.14, CAM_T0 = 2.2;
    let DC = 0; // 当前帧镜头降低了多少（米）
    const up = (d) => (F * DC) / d; // 深度 d 处的物体随镜头降低而上移的像素
    const yWc = (d) => HZ + (F * (CH - DC)) / d;
    const BANK_D = 45, BANK_Y = yW(BANK_D); // 远岸
    // 风：第17句第5字一阵风从左向右掠过荷塘（650 px/s 的风头，平滑起落）
    let T_GU = 2.179;
    const GV = 650;
    function gust(x, t) {
      const tau = t - T_GU - (x + 150) / GV;
      if (tau <= 0) return 0;
      return smooth(tau / 0.3) * Math.exp(-Math.max(0, tau - 0.3) / 0.5);
    }
    // 荷叶的摇曳：0.4 Hz，±1.1°，风过时再加一点（总共不超过 ±1.5°）
    const swayAng = (t, ph, x) => 0.019 * Math.sin(TAU * 0.4 * t + ph) + 0.007 * gust(x, t) * Math.sin(TAU * 1.1 * t + ph * 1.7);

    // ---------- 荷叶贴图：俯视的圆叶（叶脉放射、叶缘微波、左上受光、叶缘一道墨色与一段亮边），画时按透视压扁 ----------
    const LP = {
      mid: { c: ['#d6e9a4', '#8fc384', '#4f996b', '#2e6c55'], vein: '#f0f7d2', rim: '#245446', lit: '#fdffe6', under: '#a3c0a6' },
      young: { c: ['#e4efb2', '#acd28d', '#6aa975', '#3f7d5c'], vein: '#f6fadc', rim: '#2f6450', lit: '#ffffee', under: '#b5cdb0' },
      deep: { c: ['#6f9b70', '#467a5a', '#2c5e4a', '#1b4235'], vein: '#9fc296', rim: '#11302a', lit: '#cfe8b2', under: '#557a63' },
      pale: { c: ['#eaefe2', '#d2ddcf', '#b8cabb', '#9ab0a0'], vein: '#f8faf4', rim: '#83a08e', lit: '#ffffff', under: '#c8d6c8' },
      // 高过眼睛的叶看到的是叶背：偏灰的深绿，叶脉凸起、更明显
      back: { c: ['#7f9c86', '#61846f', '#4a6e5d', '#355648'], vein: '#bcd2ba', rim: '#22403a', lit: '#d6e6cc', under: '#3f6050' },
    };
    function paintLeafTop(q0, P, seed, blur) {
      blurInto(q0, 256, 256, blur, (q) => {
        const cx = 128, cy = 128, R = 100, r = rng(seed * 97 + 13);
        const p1 = r() * TAU, p2 = r() * TAU;
        const rad = (a) => R * (1 + 0.022 * Math.sin(9 * a + p1) + 0.013 * Math.sin(15 * a + p2) + 0.008 * Math.sin(23 * a + p1 * 2));
        const path = () => {
          q.beginPath();
          for (let i = 0; i <= 120; i++) { const a = (i / 120) * TAU, rr = rad(a); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? q.lineTo(x, y) : q.moveTo(x, y); }
          q.closePath();
        };
        path();
        const gr = q.createRadialGradient(cx - 8, cy - 10, 3, cx, cy, R);
        gr.addColorStop(0, P.c[0]); gr.addColorStop(0.3, P.c[1]); gr.addColorStop(0.8, P.c[2]); gr.addColorStop(1, P.c[3]);
        q.fillStyle = gr; q.fill();
        q.save(); q.clip();
        const hl = q.createRadialGradient(cx - 70, cy - 62, 5, cx - 40, cy - 34, 150);
        hl.addColorStop(0, rgba(P.lit, 0.42)); hl.addColorStop(1, rgba(P.lit, 0));
        q.fillStyle = hl; q.fillRect(0, 0, 256, 256);
        const sh = q.createRadialGradient(cx + 62, cy + 56, 5, cx + 40, cy + 40, 140);
        sh.addColorStop(0, 'rgba(14,40,32,0.3)'); sh.addColorStop(1, 'rgba(14,40,32,0)');
        q.fillStyle = sh; q.fillRect(0, 0, 256, 256);
        // 叶脉：约 19 条从叶心放射，近叶缘分叉
        q.lineCap = 'round';
        const N = 19;
        for (let k = 0; k < N; k++) {
          const a = ((k + 0.35 * r()) / N) * TAU, rr = rad(a), bend = 0.07 * (r() - 0.5);
          q.strokeStyle = rgba(P.vein, 0.36); q.lineWidth = 2.3;
          q.beginPath(); q.moveTo(cx, cy);
          q.quadraticCurveTo(cx + Math.cos(a + bend) * rr * 0.5, cy + Math.sin(a + bend) * rr * 0.5, cx + Math.cos(a) * rr * 0.96, cy + Math.sin(a) * rr * 0.96); q.stroke();
          q.lineWidth = 1.2; q.strokeStyle = rgba(P.vein, 0.22);
          const fx = cx + Math.cos(a) * rr * 0.7, fy = cy + Math.sin(a) * rr * 0.7;
          for (const s of [-1, 1]) { const b = a + s * 0.085; q.beginPath(); q.moveTo(fx, fy); q.lineTo(cx + Math.cos(b) * rr * 0.96, cy + Math.sin(b) * rr * 0.96); q.stroke(); }
        }
        // 左上（迎光）一段叶缘亮边
        q.strokeStyle = rgba(P.lit, 0.65); q.lineWidth = 3.4;
        q.beginPath();
        for (let i = 0; i <= 40; i++) { const a = Math.PI * (0.92 + (0.66 * i) / 40), rr = rad(a) - 1.8; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? q.lineTo(x, y) : q.moveTo(x, y); }
        q.stroke();
        q.restore();
        path(); q.strokeStyle = rgba(P.rim, 0.55); q.lineWidth = 3; q.stroke();
        q.fillStyle = rgba(P.c[0], 0.85); q.beginPath(); q.arc(cx, cy, 6.5, 0, TAU); q.fill();
      });
    }
    // kind：调色；v：叶形变体（0..3）；blur：建缓存时的虚化（贴图像素，叶半径 100）
    const leafSpr = (kind, v, blur) => K.cache('c1v3leaf_' + kind + v + '_' + blur, 256, 256, 0.75, (q) => paintLeafTop(q, LP[kind], v + 1, blur));
    // 画一片叶：先画叶缘翻起的一圈叶背（偏灰的浅绿，在叶面下方略低处，显出杯状与厚度），再画压扁的叶面；pale 是风里叶色变浅的程度
    function blade(g, x, y, rx, ry, rot, kind, v, blur, pale, cup) {
      g.save(); g.translate(x, y); g.rotate(rot);
      const P = LP[kind];
      if (!(cup < 0)) { g.fillStyle = P.under; g.beginPath(); g.ellipse(0, ry * (cup == null ? 0.2 : cup), rx * 0.985, ry, 0, 0, Math.PI); g.fill(); }
      const sx = (rx * 128) / 100, sy = (ry * 128) / 100;
      g.drawImage(leafSpr(kind, v, blur), -sx, -sy, 2 * sx, 2 * sy);
      if (pale > 0.01) { g.globalAlpha *= Math.min(1, pale); g.drawImage(leafSpr('pale', v, blur), -sx, -sy, 2 * sx, 2 * sy); }
      g.restore();
    }
    // 叶梗：从水面（或画面下沿以下）升到叶心，略弯；背光一侧深、迎光一侧一道浅色
    function stalk(g, xb, yb, xt, yt, w) {
      const mx = xb + (xt - xb) * 0.25, my = (yb + yt) / 2;
      g.lineCap = 'round';
      g.strokeStyle = '#4b7848'; g.lineWidth = w;
      g.beginPath(); g.moveTo(xb, yb); g.quadraticCurveTo(mx, my, xt, yt); g.stroke();
      g.strokeStyle = 'rgba(214,236,178,0.4)'; g.lineWidth = Math.max(0.6, w * 0.32);
      g.beginPath(); g.moveTo(xb - w * 0.28, yb); g.quadraticCurveTo(mx - w * 0.28, my, xt - w * 0.28, yt); g.stroke();
    }
    // 盛开的荷花（侧视）：后瓣淡、前瓣深，瓣尖粉红，花心嫩黄的莲蓬
    function paintFlower(g) {
      const cx = 64, cy = 92;
      const petal = (ang, len, wid, c0, c1, a) => {
        g.save(); g.translate(cx, cy); g.rotate(ang);
        const gr = g.createLinearGradient(0, 0, len, 0);
        gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        g.globalAlpha = a; g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.3, -wid, len * 0.85, -wid * 0.7, len, 0); g.bezierCurveTo(len * 0.85, wid * 0.7, len * 0.3, wid, 0, 0); g.fill();
        g.strokeStyle = 'rgba(200,90,120,0.3)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(len * 0.15, 0); g.lineTo(len * 0.9, 0); g.stroke();
        g.restore();
      };
      for (const a of [-2.55, -2.05, -1.57, -1.1, -0.6]) petal(a, 50, 15, '#f8efe0', '#ec93a8', 0.92);
      g.globalAlpha = 1;
      g.fillStyle = '#e9c860'; g.beginPath(); g.ellipse(cx, cy - 16, 13, 6, 0, 0, TAU); g.fill();
      g.fillStyle = '#c9a43c'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(cx + k * 4.5, cy - 17, 1.3, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(250,224,120,0.9)'; for (let k = 0; k < 14; k++) { const a = Math.PI + (k / 13) * Math.PI; g.fillRect(cx + Math.cos(a) * 15, cy - 14 + Math.sin(a) * 6, 1.2, 4); }
      for (const a of [-2.85, -2.3, -0.85, -0.3]) petal(a, 44, 14, '#fbf3e6', '#e57f98', 1);
      for (const a of [-1.9, -1.25]) petal(a, 40, 13, '#fff6ea', '#ea8ba1', 1);
    }
    const flowerSpr = () => K.cache('c1v3flower', 128, 112, 1, paintFlower);
    function paintBud(g) {
      const gr = g.createLinearGradient(0, 60, 0, 0);
      gr.addColorStop(0, '#f6efd6'); gr.addColorStop(1, '#e57f98');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(32, 62); g.bezierCurveTo(10, 50, 14, 16, 32, 2); g.bezierCurveTo(50, 16, 54, 50, 32, 62); g.fill();
      g.strokeStyle = 'rgba(200,90,120,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(32, 60); g.quadraticCurveTo(26, 30, 32, 4); g.stroke();
      g.beginPath(); g.moveTo(31, 58); g.quadraticCurveTo(42, 34, 33, 6); g.stroke();
    }
    const budSpr = () => K.cache('c1v3bud', 64, 64, 1, paintBud);
    // 卷着的嫩叶（未展开的荷叶）：细长的卷筒，下段收向叶梗
    function paintRoll(g) {
      const gr = g.createLinearGradient(8, 0, 40, 0);
      gr.addColorStop(0, '#c9e19a'); gr.addColorStop(0.5, '#86b874'); gr.addColorStop(1, '#4c8a5e');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(24, 118); g.bezierCurveTo(10, 90, 12, 40, 20, 4); g.quadraticCurveTo(26, 0, 30, 6); g.bezierCurveTo(38, 44, 38, 92, 24, 118); g.fill();
      g.strokeStyle = 'rgba(40,90,60,0.5)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(22, 112); g.bezierCurveTo(30, 80, 20, 50, 28, 10); g.stroke();
      g.strokeStyle = 'rgba(250,255,220,0.55)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(15, 90); g.bezierCurveTo(13, 60, 15, 30, 21, 8); g.stroke();
    }
    const rollSpr = () => K.cache('c1v3roll', 48, 120, 1, paintRoll);

    // ---------- 场景元素（屏幕坐标为镜头未降时；d 为深度，决定随镜头降低上移多少） ----------
    // 近处挺水的高荷叶丛（1.5–1.8 m，略虚）：在水道前、小舟下方一字排开，叶顶刚在船身下沿附近；镜头降低时整丛升起挡住小舟
    // x, y：叶心；rx, k：叶面横半径与压扁比；bx：叶梗入画处的 x
    const NEAR = [
      { x: 1040, y: 552, rx: 104, k: 0.34, rot: 0.06, v: 1, d: 1.8, bx: 1018, ph: 2.4, cup: 0.22 },
      { x: 700, y: 556, rx: 92, k: 0.36, rot: -0.07, v: 2, d: 1.8, bx: 690, ph: 0.8, cup: 0.2 },
      { x: 870, y: 562, rx: 98, k: 0.35, rot: 0.03, v: 3, d: 1.8, bx: 880, ph: 4.0, cup: 0.22 },
      { x: 640, y: 560, rx: 86, k: 0.37, rot: -0.1, v: 0, d: 1.5, bx: 624, ph: 1.6, cup: 0.24 },
      { x: 790, y: 558, rx: 112, k: 0.35, rot: 0.05, v: 1, d: 1.5, bx: 774, ph: 3.1, cup: 0.22 },
      { x: 950, y: 560, rx: 108, k: 0.36, rot: -0.04, v: 2, d: 1.5, bx: 962, ph: 5.2, cup: 0.22 },
      { x: 1090, y: 548, rx: 96, k: 0.37, rot: 0.08, v: 3, d: 1.5, bx: 1104, ph: 0.3, cup: 0.24 },
      { x: 720, y: 640, rx: 126, k: 0.33, rot: 0.04, v: 0, d: 1.5, bx: 708, ph: 2.0, cup: 0.2 },
      { x: 1000, y: 650, rx: 120, k: 0.34, rot: -0.05, v: 3, d: 1.5, bx: 990, ph: 4.6, cup: 0.2 },
      { x: 860, y: 700, rx: 132, k: 0.32, rot: 0.02, v: 2, d: 1.5, bx: 852, ph: 1.1, cup: 0.2 },
    ].sort((a, b) => b.d - a.d || a.y - b.y);
    // 近丛里一卷未展开的嫩叶（在船头以外，不挡小舟）
    const NEAR_ROLL = { x: 1140, y: 470, h: 96, d: 1.6, ph: 3.7 };
    // 右侧中近景（4.4–5 m）：两朵盛开的荷花（花径约 40 像素）立在高梗上，几片挺水叶
    const RIGHT = [
      { x: 1244, y: 510, rx: 40, k: 0.36, rot: 0.1, v: 2, d: 4.6, ph: 0.6 },
    ];
    const FLOWERS = [
      { x: 1164, y: 456, s: 40, d: 4.4, lean: -0.05, ph: 1.2 },
      { x: 1252, y: 466, s: 42, d: 4.8, lean: 0.06, ph: 3.4 },
    ];
    const RBUD = { x: 1106, y: 462, s: 26, d: 4.2, ph: 2.2 };
    // 四片斜着的叶：水珠从叶心滚向最低的叶缘，脱落、落进叶旁的空水面（第17句第1~4字各一颗，位置各不相同）
    // lo：最低叶缘点相对叶心的方向（屏幕上），水珠在那里脱落
    const DROPS = [
      { x: 1214, y: 548, rx: 38, k: 0.42, rot: 0.32, v: 1, d: 4.6, lo: [0.92, 0.38], ph: 0.4 },
      { x: 470, y: 556, rx: 32, k: 0.42, rot: 0.28, v: 3, d: 5.6, lo: [0.9, 0.42], ph: 2.1 },
      { x: 402, y: 586, rx: 40, k: 0.42, rot: 0.3, v: 0, d: 4.3, lo: [0.9, 0.4], ph: 3.3 },
      { x: 1180, y: 594, rx: 32, k: 0.42, rot: -0.3, v: 2, d: 5.0, lo: [-0.9, 0.42], ph: 4.4 },
    ];
    for (const D of DROPS) {
      D.ry = D.rx * D.k;
      D.yWater = yW(D.d) + 4; // 落点：叶缘正下方的水面
    }
    // 左侧（歌词区）近处的大荷叶（约 1.7 m，虚化、偏深，叶脉与左上亮边仍看得见）；高处的叶子看到叶背
    const LEFT_D = 1.7;

    // ---------- 静态远景：天空、云、远山与柳岸、水面 ----------
    function paintSky(g) {
      const sk = g.createLinearGradient(0, 0, 0, BANK_Y + 4);
      sk.addColorStop(0, '#eef1e8'); sk.addColorStop(0.3, '#dcebe7'); sk.addColorStop(0.62, '#e2eee9'); sk.addColorStop(0.88, '#f1f2e7'); sk.addColorStop(1, '#f6f3e6');
      g.fillStyle = sk; g.fillRect(0, 0, 1280, BANK_Y + 4);
      // 左上的日光：很淡的一团暖白
      g.fillStyle = (() => { const r = g.createRadialGradient(120, -40, 10, 120, -40, 620); r.addColorStop(0, 'rgba(255,252,232,0.7)'); r.addColorStop(1, 'rgba(255,252,232,0)'); return r; })();
      g.fillRect(0, 0, 1280, BANK_Y);
    }
    // 云：水墨晕染的几团淡云（大块模糊、低对比；上缘暖白，下缘一层极淡的灰蓝），整体向右缓移
    function paintClouds(g) {
      blurInto(g, 1800, 320, 13, (q) => {
        const r = rng(43);
        for (const [cx, cy, w, hh] of [[420, 120, 380, 46], [860, 74, 300, 34], [1180, 150, 420, 50], [1560, 96, 340, 40], [640, 210, 260, 28], [1400, 230, 240, 24]]) {
          for (let k = 0; k < 11; k++) {
            const u = k / 10 - 0.5, env = Math.cos(Math.PI * u);
            const x = cx + u * w + (r() - 0.5) * 30, y = cy - env * hh * 0.35 + (r() - 0.5) * 10;
            q.fillStyle = rgba('#fbfaf2', 0.5 + 0.2 * r());
            q.beginPath(); q.ellipse(x, y, w * (0.12 + 0.06 * r()), hh * (0.45 + 0.35 * env), 0, 0, TAU); q.fill();
          }
          q.fillStyle = rgba('#c3d3d6', 0.22);
          q.beginPath(); q.ellipse(cx, cy + hh * 0.42, w * 0.46, hh * 0.28, 0, 0, TAU); q.fill();
        }
      });
    }
    const WILLOWS = [[40, 64], [150, 86], [300, 70], [450, 92], [610, 74], [760, 88], [930, 70], [1080, 94], [1230, 78]];
    function drawWillows(g, mir) {
      for (const [x, hgt] of WILLOWS) {
        const Y = (y) => (mir ? 2 * BANK_Y - y : y);
        const cr = rng(x * 3 + 1);
        const top = BANK_Y - hgt;
        for (const [dx, dy, rw, rh, a] of [[4, 0.36, 0.44, 0.3, 0.55], [-hgt * 0.16, 0.5, 0.26, 0.32, 0.42], [hgt * 0.2, 0.52, 0.26, 0.3, 0.42]]) {
          g.fillStyle = mir ? rgba('#86a88a', a * 0.5) : rgba('#93b88a', a);
          g.beginPath(); g.ellipse(x + dx, Y(top + hgt * dy), hgt * rw, hgt * rh, 0, 0, TAU); g.fill();
        }
        g.strokeStyle = mir ? 'rgba(80,100,80,0.35)' : '#5d5a48'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(x, Y(BANK_Y)); g.quadraticCurveTo(x - 2, Y(BANK_Y - hgt * 0.4), x + 3, Y(top + hgt * 0.25)); g.stroke();
        g.lineWidth = 1;
        for (let k = 0; k < 64; k++) {
          const u = (k / 63 - 0.5) * 2, ax = x + 3 + u * hgt * 0.42 * (0.7 + 0.3 * cr()), ay = top + hgt * (0.1 + 0.22 * u * u + 0.12 * cr());
          const L = hgt * (0.35 + 0.35 * cr()) * (1 - 0.3 * Math.abs(u)), c2 = cr();
          g.strokeStyle = mir ? rgba('#7d9f80', 0.35) : (c2 < 0.33 ? '#89b27a' : c2 < 0.66 ? '#77a46c' : '#689863');
          g.beginPath(); g.moveTo(ax, Y(ay)); g.quadraticCurveTo(ax + 2, Y(ay + L * 0.5), ax + 4 + L * 0.06, Y(ay + L)); g.stroke();
        }
      }
    }
    // 远景（透明）：两层青山（越远越淡越蓝，山脚化进薄雾）、柳岸、柳梢下的一层薄雾
    const FAR_Y0 = 300, FAR_H = BANK_Y + 8 - 300;
    function paintFar(g) {
      g.translate(0, -FAR_Y0);
      const hill = (pts, c0, c1) => {
        g.beginPath(); g.moveTo(-20, BANK_Y + 4); smoothPath(g, pts, false, true); g.lineTo(1300, BANK_Y + 4); g.closePath();
        const gr = g.createLinearGradient(0, 330, 0, BANK_Y); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        g.fillStyle = gr; g.fill();
      };
      blurInto(g, 1280, BANK_Y + 10, 1.4, (q) => {
        const og = g; g = q;
        hill([[-20, 384], [120, 356], [270, 372], [430, 338], [580, 364], [720, 348], [880, 326], [1030, 356], [1180, 340], [1300, 362]], 'rgba(170,200,196,0.85)', 'rgba(226,236,228,0.4)');
        hill([[-20, 406], [170, 392], [340, 400], [520, 384], [700, 398], [890, 380], [1070, 396], [1300, 388]], 'rgba(146,184,170,0.9)', 'rgba(214,230,220,0.55)');
        g = og;
      });
      // 柳岸
      g.fillStyle = '#7a9a6a'; g.fillRect(-20, BANK_Y - 2.5, 1320, 4);
      drawWillows(g, false);
      // 柳梢下的薄雾带（远处的空气透视）
      const mg = g.createLinearGradient(0, BANK_Y - 34, 0, BANK_Y + 2);
      mg.addColorStop(0, 'rgba(246,244,232,0)'); mg.addColorStop(0.6, 'rgba(246,244,232,0.5)'); mg.addColorStop(1, 'rgba(246,244,232,0.25)');
      g.fillStyle = mg; g.fillRect(0, BANK_Y - 34, 1280, 37);
    }
    // 水面（不透明，比画面多出 100 行：镜头降低时水面按地平线纵向压缩）：映着天光，近处偏深；柳影、远处成片的浮叶、水道、近处的浮叶
    const WY0 = Math.floor(BANK_Y) - 2, WH = 720 + 100 - WY0;
    const OPEN = [[470 + 30, 5.6], [402 + 36, 4.3], [1214 + 35, 4.6], [1180 - 29, 5.0]]; // 水珠落点：周围留出空水面
    function paintWater(g) {
      g.translate(0, -WY0);
      const gr = g.createLinearGradient(0, WY0, 0, WY0 + WH);
      gr.addColorStop(0, '#eaf1e5'); gr.addColorStop(0.07, '#dbece4'); gr.addColorStop(0.28, '#bfe0d5'); gr.addColorStop(0.6, '#9ccbbb'); gr.addColorStop(1, '#77ae9d');
      g.fillStyle = gr; g.fillRect(0, WY0, 1280, WH);
      // 柳影：以岸线为轴翻转，偏暗、略模糊，带横向的碎波
      blurInto(g, 1280, WY0 + WH, 1.6, (q) => {
        const og = g; g = q;
        q.save(); q.beginPath(); q.rect(0, BANK_Y + 1, 1280, 110); q.clip();
        drawWillows(q, true);
        q.restore();
        g = og;
      });
      g.strokeStyle = 'rgba(236,246,238,0.35)'; g.lineWidth = 1;
      for (let y = BANK_Y + 4; y < BANK_Y + 70; y += 3.2) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
      const r = rng(808);
      // 远处成片的浮叶（14–40 m）：扁椭圆，越远越扁越密
      for (let i = 0; i < 420; i++) {
        const d = 14 + Math.pow(r(), 1.3) * 26, x = -40 + r() * 1360, rad = 0.2 + 0.18 * r();
        const rx = (F * rad) / d, ry = rx * (CH / d) * (1.05 + 0.25 * r()), y = yW(d);
        g.fillStyle = r() < 0.5 ? 'rgba(102,160,112,0.9)' : 'rgba(84,144,100,0.9)';
        g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(200,232,180,0.35)';
        g.beginPath(); g.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.6, ry * 0.45, 0, 0, TAU); g.fill();
      }
      // 远处的几点荷花
      for (let i = 0; i < 26; i++) {
        const d = 15 + r() * 22, x = r() * 1280, s = (F * 0.22) / d;
        g.drawImage(flowerSpr(), x - s / 2, yW(d) - s * 1.3, s, s * 0.875);
      }
      // 水道（8.3–12 m）：开阔、映天光，几道细横纹
      const c0 = yW(12.2), c1 = yW(8.2);
      const cg = g.createLinearGradient(0, c0, 0, c1);
      cg.addColorStop(0, 'rgba(240,248,240,0.0)'); cg.addColorStop(0.35, 'rgba(240,248,240,0.32)'); cg.addColorStop(1, 'rgba(240,248,240,0.12)');
      g.fillStyle = cg; g.fillRect(0, c0, 1280, c1 - c0);
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      for (let y = c0 + 3; y < c1; y += 4.5) { const o = 40 * Math.sin(y * 0.9); g.beginPath(); g.moveTo(o, y); g.lineTo(1280 + o, y); g.stroke(); }
      // 近处的浮叶（3.3–8 m）：平躺在水面上的扁椭圆（压扁比 = 视线与水面的夹角，约 0.2–0.4），有的叶缘翻起一角；水珠落点与水道留空
      for (let i = 0; i < 70; i++) {
        const d = 3.3 + Math.pow(r(), 0.9) * 4.7, x = 330 + r() * 990, rad = 0.17 + 0.13 * r();
        const rx = (F * rad) / d, ry = rx * (CH / d) * (1.0 + 0.15 * r()), y = yW(d), rot = (r() - 0.5) * 0.12, v = (r() * 4) | 0, curl = r() < 0.25;
        if (OPEN.some(([ox, od]) => Math.abs(x - ox) < rx + 52 && Math.abs(y - yW(od)) < ry + 18)) continue;
        if (x > 560 && x < 1140) continue; // 近丛下方（被近丛挡住）不画
        g.fillStyle = 'rgba(40,96,80,0.22)';
        g.beginPath(); g.ellipse(x + rx * 0.06, y + ry * 0.3, rx, ry, rot, 0, TAU); g.fill();
        blade(g, x, y, rx, ry, rot, r() < 0.5 ? 'mid' : 'young', v, 0.6, 0, curl ? 0.32 : 0.12);
      }
    }
    // 远岸以外、水道对面的挺水叶与荷花（12–24 m）：一张透明贴图；风里叶色偏浅的一张
    const MID_Y0 = 440, MID_H = 80, MID_D = 15;
    function paintMid(g, pale) {
      g.translate(0, -MID_Y0);
      const r = rng(515), items = [];
      for (let i = 0; i < 90; i++) {
        const d = 12.4 + Math.pow(r(), 1.2) * 12, x = -20 + r() * 1320, hgt = 0.25 + 0.7 * r(), R = 0.18 + 0.14 * r();
        items.push({ d, x, hgt, R, k: 0.3 + 0.2 * r(), rot: (r() - 0.5) * 0.4, v: (r() * 4) | 0, fl: r() < 0.12 });
      }
      items.sort((a, b) => b.d - a.d);
      for (const it of items) {
        const yb = yW(it.d), yc = HZ + (F * (CH - it.hgt)) / it.d, rx = (F * it.R) / it.d;
        g.strokeStyle = 'rgba(78,118,72,0.8)'; g.lineWidth = Math.max(0.8, (F * 0.012) / it.d);
        g.beginPath(); g.moveTo(it.x, yb); g.lineTo(it.x + rx * 0.1, yc); g.stroke();
        if (it.fl) { const s = (F * 0.24) / it.d; g.drawImage(flowerSpr(), it.x - s / 2, yc - s * 0.82, s, s * 0.875); }
        else blade(g, it.x, yc, rx, rx * it.k, it.rot, pale ? 'pale' : 'mid', it.v, 0.6, 0, 0.25);
      }
    }
    // 左侧（歌词区）的大荷叶：透明贴图（比画面高出 80 行：镜头降低时下面的部分升进画面）
    const LEFT_W = 400, LEFT_H = 820;
    function paintLeft(g, pale) {
      const kind = pale ? 'pale' : 'deep';
      // 叶梗（从画面下沿以下升起）
      for (const [xb, xt, yt, w] of [[150, 96, 230, 9], [250, 214, 440, 8], [70, 70, 560, 10], [300, 236, 640, 8], [330, 312, 300, 5]]) stalk(g, xb, LEFT_H + 10, xt, yt, w);
      // 高处的一片：叶面朝下斜着，看到的是偏灰绿的叶背（叶脉明显）
      g.save(); g.globalAlpha = 0.96;
      blade(g, 96, 228, 190, 96, -0.3, pale ? 'pale' : 'back', 1, 3, 0, -1);
      g.restore();
      blade(g, 214, 440, 150, 64, 0.14, kind, 2, 3, 0, 0.24);
      blade(g, 70, 560, 210, 92, -0.08, kind, 0, 3, 0, 0.22);
      blade(g, 236, 640, 160, 62, 0.16, kind, 3, 3, 0, 0.24);
      blade(g, 90, 770, 230, 96, 0.04, kind, 1, 3, 0, 0.2);
      // 一个粉色花苞：打破大片的深绿
      g.save(); g.translate(312, 300); g.rotate(0.12);
      g.drawImage(budSpr(), -18, -40, 36, 40);
      g.restore();
    }

    // ---------- 船与倒影 ----------
    let RB = null, RBG = null, RF = null, RFG = null;
    const RBW = 560, RBH = 120;
    function refBuf() {
      const S = (XYT.sprites && XYT.sprites.S) || 1;
      const w = Math.round(RBW * S), h = Math.round(RBH * S);
      if (!RB || RB.width !== w || RB.height !== h) {
        RB = document.createElement('canvas'); RB.width = w; RB.height = h; RBG = RB.getContext('2d');
        RF = document.createElement('canvas'); RF.width = w; RF.height = h; RFG = RF.getContext('2d');
      }
      RBG.setTransform(1, 0, 0, 1, 0, 0); RBG.clearRect(0, 0, w, h);
      RBG.setTransform(S, 0, 0, S, 0, 0); RBG.globalAlpha = 1; RBG.globalCompositeOperation = 'source-over';
      return RBG;
    }
    function drawBoatAndMan(g, bx, by, t, wind) {
      const opts = { body: '#4a3826', rim: '#fff4dc', rimSide: -1 };
      const m = XYT.sil.boat(g, bx, by, BOAT.len, t, Object.assign({ layer: 'back' }, opts));
      XYT.sil.draw(g, 'youth', 'lieBoat', bx + 6, by, BOAT.h, t + 0.7, { facing: 1, boat: m, wind, windDir: WD, body: '#262b30', rim: '#fff4dc', rimSide: -1, rimWidth: 1.3 });
      XYT.sil.boat(g, bx, by, BOAT.len, t, Object.assign({ layer: 'front' }, opts));
      return m;
    }
    // 水面闪光点：水道与空水面上的日光碎点（世界坐标 x、深度 d），慢闪，淡入淡出
    const GLINTS = (() => {
      const r = rng(5), out = [];
      for (let i = 0; i < 64; i++) {
        let x, d;
        if (i < 40) { d = 8.4 + r() * 3.6; x = 360 + r() * 920; } else if (i < 54) { d = 3.6 + r() * 3.6; x = 370 + r() * 200; } else { d = 4 + r() * 3; x = 1150 + r() * 130; }
        out.push({ x, d, ph: r() * TAU, f: 0.35 + 0.45 * r(), s: 1.2 + 1.6 * r(), i });
      }
      return out;
    })();
    // 竖条叠色：按风力 w(x) 把“风里”那张贴图分成竖条叠到“静”的上面（alpha 取条中心的风力）
    function paleStrips(g, img, ox, oy, w, h, t, amp) {
      const k = img.width / img.lw;
      for (let x = Math.max(0, ox); x < Math.min(1280, ox + w); x += 32) {
        const a = amp * gust(x + 16, t);
        if (a < 0.01) continue;
        const sw = Math.min(32, ox + w - x);
        g.globalAlpha = Math.min(1, a);
        g.drawImage(img, (x - ox) * k, 0, sw * k, img.height, x, oy, sw, h);
      }
      g.globalAlpha = 1;
    }

    XYT.registerShot('c1_lotus', {
      name: '荷塘狂歌', zone: 'left', night: false, text: '#fbf6e8', shadow: 'rgba(16,46,34,0.9)', accent: '#e98aa0', bloom: 0.22,
      draw(g, c) {
        const t = c.lt;
        const tc = (k) => charLt(c, k, 0, FB);
        T_GU = tc(4);
        const tKong = tc(10);
        DC = CAM_D * smooth((t - CAM_T0) / (tKong + 0.2 - CAM_T0));
        const kz = (CH - DC) / CH; // 水面纵向压缩
        // 天空（不透明）与向右缓移的云（约 4 px/s）
        g.drawImage(ocache('c1v3sky', 1280, Math.ceil(BANK_Y) + 4, paintSky), 0, 0, 1280, Math.ceil(BANK_Y) + 4);
        g.drawImage(K.cache('c1v3cloud', 1800, 320, 0.5, paintClouds), -330 + 4 * (t + 1), -10, 1800, 320);
        // 水面：按地平线纵向压缩（镜头降低时近处的水面向地平线收拢）
        const wimg = ocache('c1v3water', 1280, WH, paintWater), wk = wimg.width / 1280;
        const wy0 = HZ + (WY0 - HZ) * kz;
        const rows = Math.min(WH, (720 - wy0) / kz + 2);
        g.drawImage(wimg, 0, 0, wimg.width, rows * wk, 0, wy0, 1280, rows * kz);
        // 远山与柳岸（45 m 以外，镜头降低时只升起不到 2 像素）
        g.drawImage(K.cache('c1v3far', 1280, FAR_H, 1, paintFar), 0, FAR_Y0 - up(BANK_D), 1280, FAR_H);
        // 风过水面：被风揉皱的水面映出更多天光，一道偏灰的浅色带随风头向右扫过
        if (t > T_GU && t < T_GU + 4.5) {
          for (let x = 0; x < 1280; x += 32) {
            const a = 0.16 * gust(x + 16, t);
            if (a < 0.005) continue;
            g.fillStyle = `rgba(226,236,228,${a.toFixed(3)})`; g.fillRect(x, wy0 + 6, 32, 720 - wy0);
          }
        }
        // 水道对面的挺水叶与荷花
        const m0 = K.cache('c1v3mid0', 1280, MID_H, 1, (q) => paintMid(q, false));
        const myy = MID_Y0 - up(MID_D);
        g.drawImage(m0, 0, myy, 1280, MID_H);
        if (t > T_GU && t < T_GU + 4.5) paleStrips(g, K.cache('c1v3mid1', 1280, MID_H, 1, (q) => paintMid(q, true)), 0, myy, 1280, MID_H, t, 0.65);
        // 水道上的闪光点（随拍轻轻提亮，淡入淡出）
        const bx = BOAT.x0 + BOAT.v * t, by = BOAT.deck - up(BOAT.d), wl = BOAT.wl - up(BOAT.d);
        {
          const bb = 0.65 + 0.35 * be(c, 0.35);
          g.save(); g.globalCompositeOperation = 'lighter';
          for (const G of GLINTS) {
            const gy = yWc(G.d), gx = G.x;
            // 船身后面的闪光点按离船的远近平滑压掉
            const hide = G.d > BOAT.d - 0.3 ? smooth((Math.abs(gx - bx) - BOAT.len * 0.52) / 30) : 1;
            const tw = Math.pow(Math.max(0, Math.sin(TAU * G.f * t + G.ph)), 3) * bb * hide;
            if (tw < 0.03) continue;
            const s = G.s * Math.min(1.6, 6 / G.d + 0.4);
            const spr = K.cache('c1v3glint', 16, 8, 2, (q) => {
              q.globalAlpha = 0.4; q.drawImage(glowSpr('#fffbe8'), 1, 0.8, 14, 6.4); q.globalAlpha = 1;
              q.fillStyle = 'rgba(255,252,236,1)'; q.beginPath(); q.ellipse(8, 4, 3.2, 0.9, 0, 0, TAU); q.fill();
            });
            g.globalAlpha = Math.min(1, 0.9 * tw);
            g.drawImage(spr, gx - 4 * s, gy - 2 * s, 8 * s, 4 * s);
          }
          g.globalAlpha = 1;
          g.restore();
        }
        // 小舟：先画进小画布，正像贴回；倒影以吃水线为轴翻转，一像素一条轻轻错开，压暗偏冷，越往下越淡
        const wind = 0.22 + 0.35 * gust(bx, t);
        const mm = XYT.sil.boatMotion(bx, by, BOAT.len, t);
        const ox = Math.floor(bx - RBW / 2), oy = Math.floor(by - 86);
        const rb = refBuf();
        rb.translate(-ox, -oy - 0.25 * mm.dy);
        drawBoatAndMan(rb, bx, by, t, wind);
        const S = (XYT.sprites && XYT.sprites.S) || 1;
        const wlr = wl + 0.75 * mm.dy, wlB = wlr - oy;
        RFG.setTransform(1, 0, 0, 1, 0, 0); RFG.globalAlpha = 1;
        RFG.globalCompositeOperation = 'copy'; RFG.drawImage(RB, 0, 0);
        RFG.globalCompositeOperation = 'source-atop'; RFG.fillStyle = 'rgba(30,60,62,0.55)'; RFG.fillRect(0, 0, RF.width, RF.height);
        RFG.globalCompositeOperation = 'source-over';
        for (let k = 0; k < 22; k++) {
          const dx = 0.8 * Math.sin(k * 0.55 - t * 2.1) + 0.25 * Math.sin(k * 1.7 + t * 3.3);
          g.globalAlpha = 0.85 * (1 - smooth((k - 12) / 9));
          g.drawImage(RF, 0, (wlB - k - 1) * S, RF.width, S, ox + dx, wlr + k, RBW, 1);
        }
        g.globalAlpha = 1;
        // 船尾后的 V 形水纹：两道从船尾向后张开的细纹，离船越远越淡；第17句第11字以后在空水道上 2 s 内渐弱
        {
          const stern = bx - BOAT.len * 0.47, L = 360;
          const wf = 1 - 0.82 * smooth((t - tKong + 0.2) / 2.0);
          for (const [col, lw, dy, a] of [['255,255,250', 1.7, 0, 0.75], ['46,104,98', 1.3, 1.6, 0.45]]) {
            const gr = g.createLinearGradient(stern, 0, stern - L, 0);
            gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.05, `rgba(${col},${(a * wf).toFixed(3)})`); gr.addColorStop(0.5, `rgba(${col},${(a * 0.4 * wf).toFixed(3)})`); gr.addColorStop(1, `rgba(${col},0)`);
            g.strokeStyle = gr; g.lineWidth = lw;
            g.beginPath();
            for (const sgn of [-1, 1]) {
              for (let s0 = 0; s0 <= L; s0 += 10) {
                const y = wl + 1 + dy + sgn * (1 + s0 * (sgn > 0 ? 0.06 : 0.035)) + 0.8 * Math.sin(s0 * 0.12 - t * 2);
                s0 ? g.lineTo(stern - s0, y) : g.moveTo(stern - s0, y);
              }
            }
            g.stroke();
          }
        }
        g.drawImage(RB, ox, oy, RBW, RBH);
        // 右侧中近景：挺水叶、两朵荷花与一个花苞（随风轻摇，±1.5° 以内）
        for (const L of RIGHT) {
          const dy = up(L.d), a = swayAng(t, L.ph, L.x);
          stalk(g, L.x - 4, yWc(L.d), L.x, L.y - dy, Math.max(1.4, (F * 0.012) / L.d));
          blade(g, L.x, L.y - dy, L.rx, L.rx * L.k, L.rot + a, 'mid', L.v, 0.8, 0.6 * gust(L.x, t), 0.24);
        }
        for (const Fl of [...FLOWERS, RBUD]) {
          const dy = up(Fl.d), a = swayAng(t, Fl.ph, Fl.x) + (Fl.lean || 0);
          const yb = yWc(Fl.d), tx = Fl.x + Math.sin(a) * (yb - Fl.y), ty = Fl.y - dy;
          g.strokeStyle = '#557f4c'; g.lineWidth = Math.max(1.2, (F * 0.012) / Fl.d); g.lineCap = 'round';
          g.beginPath(); g.moveTo(Fl.x, yb); g.quadraticCurveTo(Fl.x, (yb + ty) / 2, tx, ty); g.stroke();
          g.save(); g.translate(tx, ty); g.rotate(a);
          if (Fl === RBUD) g.drawImage(budSpr(), -Fl.s * 0.3, -Fl.s, Fl.s * 0.6, Fl.s);
          else g.drawImage(flowerSpr(), -Fl.s / 2, -Fl.s * 0.82, Fl.s, Fl.s * 0.875);
          g.restore();
        }
        // 四片斜叶与水珠：水珠先静静停在叶心旁（开镜就在），到时在叶面上滚向最低的叶缘（0.35 s，渐快），脱落后自由落体，
        // 正好在第17句第1~4字落进叶旁的空水面，荡开一亮一暗的涟漪（约 1.2 s 扩到四十像素上下）
        for (let k = 0; k < 4; k++) {
          const D = DROPS[k], dy = up(D.d), a = swayAng(t, D.ph, D.x);
          const cx = D.x, cy = D.y - dy, yWat = D.yWater - dy;
          stalk(g, cx - 3, yWat - 4, cx, cy, Math.max(1.4, (F * 0.012) / D.d));
          blade(g, cx, cy, D.rx, D.ry, D.rot + a, 'mid', D.v, 0.8, 0.6 * gust(D.x, t), 0.3);
          // 叶缘最低点（屏幕上，叶随摇曳一起转）
          const ca = Math.cos(D.rot + a), sa = Math.sin(D.rot + a);
          const lx0 = D.lo[0] * D.rx, ly0 = D.lo[1] * D.ry;
          const rimX = cx + lx0 * ca - ly0 * sa, rimY = cy + lx0 * sa + ly0 * ca;
          const sx0 = cx - D.lo[0] * D.rx * 0.18, sy0 = cy - D.ry * 0.25;
          const hit = tc(k), gpx = (9.8 * F) / D.d, fall = Math.sqrt((2 * Math.max(4, yWat - rimY)) / gpx);
          const tDet = hit - fall, tRoll = tDet - 0.35;
          let p = null;
          if (t < tRoll) p = [sx0, sy0];
          else if (t < tDet) { const u = (t - tRoll) / 0.35, e = u * u; p = [lerp(sx0, rimX, e), lerp(sy0, rimY, e) - 1.2 * Math.sin(Math.PI * e)]; }
          else if (t < hit) { const u = t - tDet; p = [rimX + D.lo[0] * 10 * u, rimY + 0.5 * gpx * u * u]; }
          if (p) {
            g.save(); g.globalCompositeOperation = 'lighter';
            glowAt(g, p[0], p[1] - 1, 8, 8, '#fffbe6', 0.65);
            g.restore();
            g.fillStyle = 'rgba(214,240,236,0.95)'; g.beginPath(); g.arc(p[0], p[1] - 2.4, 2.8, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath(); g.arc(p[0] - 0.9, p[1] - 3.3, 1.0, 0, TAU); g.fill();
          }
          const age = t - hit;
          if (age > 0 && age < 2.6) {
            const lx = rimX + D.lo[0] * 10 * fall, R1 = (40 * 4.6) / D.d, kk = CH / D.d;
            for (let j = 0; j < 3; j++) {
              const a2 = age - j * 0.2;
              if (a2 <= 0) continue;
              const rr = 2 + R1 * (1 - Math.exp(-a2 / 0.5));
              const al = 0.85 * Math.exp(-a2 / 0.8) * (1 - j * 0.28) * smooth(a2 / 0.06);
              if (al < 0.01) continue;
              g.strokeStyle = `rgba(250,255,250,${al.toFixed(3)})`; g.lineWidth = 1.8;
              g.beginPath(); g.ellipse(lx, yWat, rr, rr * kk, 0, 0, TAU); g.stroke();
              g.strokeStyle = `rgba(36,94,88,${(al * 0.6).toFixed(3)})`; g.lineWidth = 1.4;
              g.beginPath(); g.ellipse(lx, yWat + 1.6, rr * 0.94, rr * kk * 0.94, 0, 0, TAU); g.stroke();
            }
          }
        }
        // 近处的高荷叶丛（1.5–1.8 m，略虚）：叶梗从画面下沿以下升起；叶形不变，只随风轻摇
        {
          const ro = NEAR_ROLL, rdy = up(ro.d), ra = swayAng(t, ro.ph, ro.x);
          stalk(g, ro.x - 6, 760, ro.x, ro.y - rdy + ro.h * 0.95, 4.5);
          g.save(); g.translate(ro.x, ro.y - rdy + ro.h); g.rotate(ra + 0.04);
          g.drawImage(rollSpr(), -ro.h * 0.2, -ro.h, ro.h * 0.4, ro.h);
          g.restore();
        }
        for (const L of NEAR) {
          const dy = up(L.d), a = swayAng(t, L.ph, L.x), ry = L.rx * L.k;
          stalk(g, L.bx, 770, L.x + Math.sin(a) * 6, L.y - dy + ry * 0.2, (F * 0.011) / L.d);
          blade(g, L.x, L.y - dy, L.rx, ry, L.rot + a, 'mid', L.v, 1.6, 0.55 * gust(L.x, t), L.cup);
        }
        // 最近处：左侧（歌词区）的大荷叶，随镜头降低按自己的深度上移
        const ly = -up(LEFT_D);
        g.drawImage(K.cache('c1v3left0', LEFT_W, LEFT_H, 1, (q) => paintLeft(q, false)), 0, ly, LEFT_W, LEFT_H);
        if (t > T_GU && t < T_GU + 4.5) paleStrips(g, K.cache('c1v3left1', LEFT_W, LEFT_H, 1, (q) => paintLeft(q, true)), 0, ly, LEFT_W, LEFT_H, t, 0.45);
        // 白雾化入：转场的 0.8 s 里与上一镜补的雾一起，使整段的雾色权重平滑落下（不在转场开头突然变白）
        const fa = 0.3 * (1 - smooth((t + FOG_TR) / 1.2));
        if (fa > 0.001) { g.fillStyle = rgba(FOG_COL, fa); g.fillRect(0, 0, 1280, 720); }
      },
    });
  })();
})();
