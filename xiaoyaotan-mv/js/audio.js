/* 逍遥叹 · 音乐动画 —— 音频分析：起音包络、速度、节拍、强拍、段落 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const nextTick = () => new Promise((r) => setTimeout(r, 0));

  // ---------- 基础工具 ----------
  function makeFFT(n) {
    const levels = Math.round(Math.log2(n));
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let x = i, y = 0;
      for (let j = 0; j < levels; j++) { y = (y << 1) | (x & 1); x >>= 1; }
      rev[i] = y;
    }
    const cs = new Float64Array(n / 2), sn = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cs[i] = Math.cos((2 * Math.PI * i) / n); sn[i] = Math.sin((2 * Math.PI * i) / n); }
    return function fft(re, im) {
      for (let i = 0; i < n; i++) {
        const j = rev[i];
        if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = i, k = 0; j < i + half; j++, k += step) {
            const a = j + half;
            const tre = re[a] * cs[k] + im[a] * sn[k];
            const tim = im[a] * cs[k] - re[a] * sn[k];
            re[a] = re[j] - tre; im[a] = im[j] - tim;
            re[j] += tre; im[j] += tim;
          }
        }
      }
    };
  }

  function percentile(arr, p) {
    if (!arr.length) return 0;
    const a = Float32Array.from(arr).sort();
    return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
  }

  function movingAvg(x, r) {
    const n = x.length, out = new Float32Array(n), cs = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + x[i];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - r), b = Math.min(n, i + r + 1);
      out[i] = (cs[b] - cs[a]) / (b - a);
    }
    return out;
  }

  function norm01(x, p) {
    const hi = percentile(x, p || 0.98) || 1;
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = Math.max(0, Math.min(1.25, x[i] / hi));
    return out;
  }

  function meanStd(x) {
    let m = 0;
    for (let i = 0; i < x.length; i++) m += x[i];
    m /= x.length || 1;
    let v = 0;
    for (let i = 0; i < x.length; i++) v += (x[i] - m) ** 2;
    return [m, Math.sqrt(v / (x.length || 1)) || 1];
  }

  // ---------- 节拍网格 ----------
  class Grid {
    constructor(beats, downPhase, strength) {
      this.b = beats;
      this.n = beats.length;
      this.dp = downPhase || 0;
      this.str = strength || new Float32Array(this.n).fill(0.6);
    }
    idx(t) {
      const b = this.b;
      let lo = 0, hi = this.n - 1, r = -1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (b[m] <= t) { r = m; lo = m + 1; } else hi = m - 1;
      }
      return r;
    }
    per(i) {
      const n = this.n;
      if (n < 2) return 0.8;
      i = Math.max(0, Math.min(n - 2, i));
      return this.b[i + 1] - this.b[i];
    }
    time(i) {
      const n = this.n, b = this.b;
      if (i < 0) return b[0] + i * this.per(0);
      if (i >= n) return b[n - 1] + (i - n + 1) * this.per(n - 2);
      return b[i];
    }
    pos(t) {
      const n = this.n, b = this.b;
      const i = this.idx(t);
      if (i < 0) return (t - b[0]) / this.per(0);
      if (i >= n - 1) return n - 1 + (t - b[n - 1]) / this.per(n - 2);
      return i + (t - b[i]) / (b[i + 1] - b[i]);
    }
    timeAt(x) {
      const i = Math.floor(x), f = x - i;
      const a = this.time(i);
      return a + f * (this.time(i + 1) - a);
    }
    isDown(i) { return ((((i - this.dp) % 4) + 4) % 4) === 0; }
    strength(i) { return i >= 0 && i < this.n ? this.str[i] : 0.35; }
    info(t) {
      const x = this.pos(t), i = Math.floor(x);
      const bt = this.time(i);
      const di = i - ((((i - this.dp) % 4) + 4) % 4);
      return {
        x, i, ph: x - i, since: t - bt, period: this.time(i + 1) - bt,
        down: this.isDown(i), di, sinceDown: t - this.time(di),
        bar: Math.floor((i - this.dp) / 4), barPh: (x - di) / 4, str: this.strength(i),
      };
    }
    nearest(t) { return this.time(Math.round(this.pos(t))); }
    nearestDown(t) {
      const k = Math.round((this.pos(t) - this.dp) / 4);
      return this.time(this.dp + 4 * k);
    }
    downAtOrBefore(t) {
      const x = this.pos(t + 1e-6);
      const k = Math.floor((x - this.dp) / 4);
      return this.time(this.dp + 4 * k);
    }
    beatAtOrBefore(t) { return this.time(Math.floor(this.pos(t + 1e-6))); }
    quant(t, div) { return this.timeAt(Math.round(this.pos(t) * div) / div); }
    barDur(t) { return this.per(this.idx(t)) * 4; }
  }
  XYT.Grid = Grid;

  // ---------- 速度估计 ----------
  function estimateTempo(on, fps) {
    const n = on.length;
    const minLag = Math.floor((fps * 60) / 190), maxLag = Math.ceil((fps * 60) / 50);
    const top = Math.min(n - 2, maxLag * 2 + 2);
    const [m] = meanStd(on);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = on[i] - m;
    const ac = new Float64Array(top + 2);
    for (let L = 1; L <= top; L++) {
      let s = 0;
      for (let i = 0; i + L < n; i++) s += y[i] * y[i + L];
      ac[L] = s / (n - L);
    }
    const score = (L) => {
      const a = ac[L] || 0, b = ac[2 * L] || 0, c = ac[Math.round(L / 2)] || 0;
      return a + 0.5 * b + 0.25 * c;
    };
    let best = -Infinity, bl = Math.round((fps * 60) / 80);
    for (let L = minLag; L <= Math.min(maxLag, top); L++) {
      const bpm = (60 * fps) / L;
      const w = Math.exp(-0.5 * (Math.log2(bpm / 85) / 0.85) ** 2);
      const s = score(L) * w;
      if (s > best) { best = s; bl = L; }
    }
    const s0 = score(bl - 1), s1 = score(bl), s2 = score(bl + 1);
    const den = s0 - 2 * s1 + s2;
    const off = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (s0 - s2)) / den)) : 0;
    return (60 * fps) / (bl + off);
  }

  // ---------- 动态规划节拍跟踪（Ellis 2007） ----------
  function trackBeats(on, fps, bpm) {
    const n = on.length, P = (fps * 60) / bpm;
    const sig = Math.max(1, P / 16), R = Math.ceil(sig * 3);
    const g = [];
    for (let k = -R; k <= R; k++) g.push(Math.exp(-0.5 * (k / sig) ** 2));
    const loc = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = -R; k <= R; k++) { const j = i + k; if (j >= 0 && j < n) s += on[j] * g[k + R]; }
      loc[i] = s;
    }
    const [, sd] = meanStd(loc);
    for (let i = 0; i < n; i++) loc[i] /= sd;
    const lo = Math.max(1, Math.round(P / 2)), hi = Math.round(P * 2);
    const pen = new Float32Array(hi + 1);
    for (let L = lo; L <= hi; L++) pen[L] = 100 * Math.log(L / P) ** 2;
    const score = new Float32Array(n), back = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      let best = -Infinity, bi = -1;
      for (let L = lo; L <= hi; L++) {
        const j = i - L;
        if (j < 0) break;
        const v = score[j] - pen[L];
        if (v > best) { best = v; bi = j; }
      }
      score[i] = loc[i] + (bi >= 0 ? best : 0);
      back[i] = bi;
    }
    let end = n - 1, bs = -Infinity;
    for (let i = Math.max(0, n - Math.round(P)); i < n; i++) if (score[i] > bs) { bs = score[i]; end = i; }
    const frames = [];
    for (let i = end; i >= 0; i = back[i]) { frames.push(i); if (back[i] < 0) break; }
    frames.reverse();
    return { frames, loc };
  }

  // ---------- 强拍相位 ----------
  function downbeatPhase(beatsF, fr) {
    const nb = beatsF.length;
    if (nb < 8) return 0;
    const { chroma, lowFlux, nF } = fr;
    const ch = [];
    for (let k = 0; k < nb; k++) {
      const a = beatsF[k], z = k + 1 < nb ? beatsF[k + 1] : Math.min(nF, a + 40);
      const v = new Float64Array(12);
      for (let f = a; f < z; f++) for (let c = 0; c < 12; c++) v[c] += chroma[f * 12 + c];
      let m = 0;
      for (let c = 0; c < 12; c++) m += v[c] * v[c];
      m = Math.sqrt(m) || 1;
      for (let c = 0; c < 12; c++) v[c] /= m;
      ch.push(v);
    }
    const hc = new Float32Array(nb), lowAt = new Float32Array(nb);
    for (let k = 0; k < nb; k++) {
      if (k > 0) { let d = 0; for (let c = 0; c < 12; c++) d += ch[k][c] * ch[k - 1][c]; hc[k] = 1 - d; }
      let mx = 0;
      for (let f = beatsF[k] - 2; f <= beatsF[k] + 2; f++) if (f >= 0 && f < nF) mx = Math.max(mx, lowFlux[f]);
      lowAt[k] = mx;
    }
    const [hm, hs] = meanStd(hc), [lm, ls] = meanStd(lowAt);
    let best = -Infinity, bp = 0;
    for (let p = 0; p < 4; p++) {
      let s = 0, c = 0;
      for (let k = p; k < nb; k += 4) { s += (hc[k] - hm) / hs + 0.6 * ((lowAt[k] - lm) / ls); c++; }
      s /= c || 1;
      if (s > best) { best = s; bp = p; }
    }
    return bp;
  }

  // ---------- 段落（主歌/副歌…） ----------
  function detectSections(grid, fr, duration) {
    const { fps, nF, rmsDb, onset, cent, highDb, chroma } = fr;
    const b = grid.b, n = grid.n, dp = grid.dp;
    const bars = [];
    for (let i = dp; i + 4 < n; i += 4) bars.push([b[i], b[i + 4]]);
    const nbar = bars.length;
    const one = (type) => [{ start: 0, end: duration, type, energy: 0 }];
    if (nbar < 8) return one('verse');
    const feats = bars.map(([s, e]) => {
      const a = Math.max(0, Math.floor(s * fps)), z = Math.min(nF, Math.max(a + 1, Math.floor(e * fps)));
      let r = 0, o = 0, c = 0, h = 0;
      const ch = new Float64Array(12);
      for (let f = a; f < z; f++) {
        r += rmsDb[f]; o += onset[f]; c += cent[f]; h += highDb[f];
        for (let k = 0; k < 12; k++) ch[k] += chroma[f * 12 + k];
      }
      const m = z - a;
      let cn = 0;
      for (let k = 0; k < 12; k++) cn += ch[k] * ch[k];
      cn = Math.sqrt(cn) || 1;
      return { r: r / m, o: o / m, c: c / m, h: h / m, ch: Array.from(ch, (v) => v / cn) };
    });
    const zs = (key) => {
      const arr = feats.map((f) => f[key]);
      const [m, s] = meanStd(arr);
      return arr.map((v) => (v - m) / s);
    };
    const zr = zs('r'), zo = zs('o'), zc = zs('c'), zh = zs('h');
    const vec = feats.map((f, j) => [zr[j], 0.7 * zo[j], 0.5 * zc[j], 0.6 * zh[j], ...f.ch.map((v) => v * 2.2)]);
    const dist = (u, v) => { let s = 0; for (let k = 0; k < u.length; k++) s += (u[k] - v[k]) ** 2; return Math.sqrt(s); };
    const D = [];
    const all = [];
    for (let a = 0; a < nbar; a++) { D.push(new Float32Array(nbar)); }
    for (let a = 0; a < nbar; a++) for (let c = a + 1; c < nbar; c++) { const d = dist(vec[a], vec[c]); D[a][c] = D[c][a] = d; all.push(d); }
    const sigma = percentile(all, 0.5) || 1;
    const S = (a, c) => Math.exp(-(D[a][c] ** 2) / (2 * sigma * sigma));
    const K = 4, nov = new Float32Array(nbar), ej = new Float32Array(nbar);
    for (let j = 1; j < nbar; j++) {
      let s = 0, ws = 0;
      for (let u = -K; u < K; u++) for (let v = -K; v < K; v++) {
        const a = j + u, c = j + v;
        if (a < 0 || c < 0 || a >= nbar || c >= nbar) continue;
        const w = Math.exp(-((u + 0.5) ** 2 + (v + 0.5) ** 2) / (2 * (K / 2) ** 2));
        const sign = (u < 0) === (v < 0) ? 1 : -1;
        s += sign * w * S(a, c); ws += w;
      }
      nov[j] = ws ? s / ws : 0;
      const after = (zr[j] + (zr[j + 1] ?? zr[j])) / 2;
      const before = (zr[j - 1] + (zr[j - 2] ?? zr[j - 1])) / 2;
      ej[j] = Math.abs(after - before);
    }
    const [nm, ns] = meanStd(nov), [em, es] = meanStd(ej);
    const comb = new Float32Array(nbar);
    for (let j = 1; j < nbar; j++) comb[j] = (nov[j] - nm) / ns + 0.8 * ((ej[j] - em) / es);
    const [cm, cs] = meanStd(comb.subarray(1));
    const cand = [];
    for (let j = 2; j < nbar - 1; j++) {
      if (comb[j] >= comb[j - 1] && comb[j] >= comb[j + 1] && comb[j] > cm + 0.35 * cs) cand.push(j);
    }
    cand.sort((a, c) => comb[c] - comb[a]);
    const maxN = Math.max(2, Math.floor(nbar / 4));
    const picked = [];
    for (const j of cand) {
      if (picked.length >= maxN) break;
      if (picked.every((p) => Math.abs(p - j) >= 4)) picked.push(j);
    }
    picked.sort((a, c) => a - c);
    const cuts = [0, ...picked.map((j) => bars[j][0]), duration];
    const secs = [];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const s = cuts[k], e = cuts[k + 1];
      const a = Math.floor(s * fps), z = Math.max(a + 1, Math.min(nF, Math.floor(e * fps)));
      let r = 0;
      for (let f = a; f < z; f++) r += rmsDb[f];
      secs.push({ start: s, end: e, energy: r / (z - a) });
    }
    labelSections(secs);
    return secs;
  }

  function labelSections(secs) {
    let tw = 0, m = 0;
    for (const s of secs) { const w = s.end - s.start; tw += w; m += s.energy * w; }
    m /= tw || 1;
    let v = 0;
    for (const s of secs) v += (s.end - s.start) * (s.energy - m) ** 2;
    const sd = Math.sqrt(v / (tw || 1)) || 1;
    secs.forEach((s, k) => {
      s.z = (s.energy - m) / sd;
      if (s.z > 0.4) s.type = 'chorus';
      else if (k > 0 && k < secs.length - 1 && s.z < -0.7) s.type = 'bridge';
      else s.type = 'verse';
    });
    if (secs.length > 1 && secs[0].z < 0 && secs[0].end - secs[0].start < 40) secs[0].type = 'intro';
    const last = secs[secs.length - 1];
    if (secs.length > 2 && last.z < 0.2) last.type = 'outro';
    if (!secs.some((s) => s.type === 'chorus')) {
      const mid = secs.filter((s) => s.type === 'verse').sort((a, b) => b.z - a.z);
      if (mid.length > 1) mid[0].type = 'chorus';
    }
  }
  XYT.labelSections = labelSections;

  // ---------- 由起音包络得到节拍 + 段落 ----------
  function beatsFromEnvelope(fr, bpm, offsetSec) {
    const { fps, onsetRaw, rms, nF, HOPS, duration } = fr;
    const { frames, loc } = trackBeats(onsetRaw, fps, bpm);
    const thr = 0.04 * (percentile(rms, 0.95) || 1);
    const sm = movingAvg(rms, Math.round(fps * 0.5));
    let a = 0, z = frames.length - 1;
    while (a < z && sm[frames[a]] < thr) a++;
    while (z > a && sm[frames[z]] < thr) z--;
    let fs = frames.slice(a, z + 1);
    if (fs.length < 4) {
      const P = (fps * 60) / bpm;
      fs = [];
      for (let f = 0; f < nF; f += P) fs.push(Math.round(f));
    }
    const per = ((fs[fs.length - 1] - fs[0]) / Math.max(1, fs.length - 1)) / fps;
    const dpLocal = downbeatPhase(fs, fr);
    const strengthsCore = fs.map((f) => {
      let mx = 0;
      for (let k = f - 2; k <= f + 2; k++) if (k >= 0 && k < nF) mx = Math.max(mx, loc[k]);
      return mx;
    });
    const p90 = percentile(strengthsCore, 0.9) || 1;
    const times = fs.map((f) => f * HOPS + offsetSec);
    const pre = [];
    for (let t = times[0] - per; t > -per * 0.5; t -= per) pre.unshift(t);
    const post = [];
    for (let t = times[times.length - 1] + per; t < duration + per; t += per) post.push(t);
    const beats = Float64Array.from([...pre, ...times, ...post]);
    const str = new Float32Array(beats.length).fill(0.3);
    strengthsCore.forEach((v, k) => { str[pre.length + k] = 0.25 + 0.75 * Math.min(1, v / p90); });
    const dp = (((dpLocal + pre.length) % 4) + 4) % 4;
    const grid = new Grid(beats, dp, str);
    return { grid, bpm: 60 / per };
  }

  // ---------- 主入口 ----------
  async function analyze(buffer, onProgress) {
    const report = onProgress || (() => {});
    const SR = 22050;
    const len = Math.max(2048, Math.ceil(buffer.duration * SR));
    const off = new OfflineAudioContext(1, len, SR);
    const src = off.createBufferSource();
    src.buffer = buffer;
    src.connect(off.destination);
    src.start(0);
    const x = (await off.startRendering()).getChannelData(0);
    report(0.05, '读取波形');
    const N = 1024, HOP = 256, fps = SR / HOP;
    const nF = Math.max(16, Math.floor((x.length - N) / HOP) + 1);
    const nb = N / 2, binHz = SR / N;
    const fft = makeFFT(N);
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    const re = new Float64Array(N), im = new Float64Array(N);
    let prev = new Float32Array(nb), cur = new Float32Array(nb);
    const flux = new Float32Array(nF), lowFlux = new Float32Array(nF), rms = new Float32Array(nF);
    const cent = new Float32Array(nF), lowE = new Float32Array(nF), highE = new Float32Array(nF);
    const chroma = new Float32Array(nF * 12);
    const pc = new Int8Array(nb).fill(-1);
    for (let k = 1; k < nb; k++) {
      const f = k * binHz;
      if (f >= 60 && f <= 2200) pc[k] = (((Math.round(12 * Math.log2(f / 440)) + 9) % 12) + 12) % 12;
    }
    const kLow = Math.round(180 / binHz), kHigh = Math.round(2500 / binHz), kMax = Math.round(8000 / binHz);
    for (let f = 0; f < nF; f++) {
      const o = f * HOP;
      let e = 0;
      for (let i = 0; i < N; i++) { const s = x[o + i] || 0; e += s * s; re[i] = s * win[i]; im[i] = 0; }
      rms[f] = Math.sqrt(e / N);
      fft(re, im);
      let fl = 0, lfl = 0, lo = 0, hi = 0, num = 0, den = 0;
      for (let k = 1; k < nb; k++) {
        const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        const lm = Math.log1p(100 * m);
        cur[k] = lm;
        const d = lm - prev[k];
        if (d > 0 && k <= kMax) { fl += d; if (k <= kLow) lfl += d; }
        if (k <= kLow) lo += m * m; else if (k >= kHigh) hi += m * m;
        num += k * m; den += m;
        if (pc[k] >= 0) chroma[f * 12 + pc[k]] += m;
      }
      flux[f] = fl; lowFlux[f] = lfl; lowE[f] = lo; highE[f] = hi;
      cent[f] = den > 0 ? (num / den) * binHz : 0;
      const tmp = prev; prev = cur; cur = tmp;
      if ((f & 1023) === 0) { report(0.05 + 0.75 * (f / nF), '频谱分析'); await nextTick(); }
    }
    report(0.82, '估计速度');
    await nextTick();
    const avg = movingAvg(flux, Math.round(fps * 0.35));
    const onsetRaw = new Float32Array(nF);
    for (let f = 0; f < nF; f++) onsetRaw[f] = Math.max(0, flux[f] - avg[f]);
    const rmsDb = new Float32Array(nF), highDb = new Float32Array(nF);
    for (let f = 0; f < nF; f++) { rmsDb[f] = 20 * Math.log10(rms[f] + 1e-5); highDb[f] = 10 * Math.log10(highE[f] + 1e-8); }
    const HOPS = HOP / SR;
    const offsetSec = (N / 2 - HOP / 2) / SR;
    const fr = { fps, nF, HOPS, duration: buffer.duration, onsetRaw, rms, rmsDb, highDb, cent, chroma, lowFlux, onset: norm01(onsetRaw, 0.99) };
    const bpm0 = estimateTempo(onsetRaw, fps);
    report(0.9, '跟踪节拍');
    await nextTick();
    const res = build(fr, bpm0, offsetSec);
    res.env = {
      fps,
      rms: norm01(movingAvg(rms, 2), 0.98),
      onset: fr.onset,
      low: norm01(movingAvg(lowE, 3), 0.98),
      high: norm01(movingAvg(highE, 3), 0.98),
    };
    report(1, '完成');
    return res;
  }

  function build(fr, bpm, offsetSec) {
    const { grid, bpm: realBpm } = beatsFromEnvelope(fr, bpm, offsetSec);
    const sections = detectSections(grid, fr, fr.duration);
    return { duration: fr.duration, bpm: realBpm, baseBpm: bpm, grid, sections, _fr: fr, _off: offsetSec, offsetMs: 0, source: 'audio' };
  }

  // 节拍倍率 / 偏移调整：复用已算好的包络，只重算节拍与段落
  function adjust(an, opts) {
    if (!an._fr) {
      if (an.source === 'synthetic') return an;
      return an;
    }
    const factor = opts.factor || 1;
    const offMs = opts.offsetMs != null ? opts.offsetMs : an.offsetMs || 0;
    const bpm = Math.max(40, Math.min(220, an.baseBpm * factor));
    const res = build(an._fr, bpm, an._off + offMs / 1000);
    res.baseBpm = bpm;
    res.offsetMs = offMs;
    res.env = an.env;
    return res;
  }

  // 演示/无音频：按给定 BPM 与段落直接生成网格
  function synthetic(duration, bpm, plan) {
    const per = 60 / bpm, beats = [];
    for (let t = 0; t < duration + per; t += per) beats.push(t);
    const grid = new Grid(Float64Array.from(beats), 0, new Float32Array(beats.length).map((_, i) => (i % 4 === 0 ? 1 : i % 2 === 0 ? 0.7 : 0.5)));
    const sections = [];
    let bar = 0;
    for (const [type, bars] of plan) {
      const s = bar * 4 * per, e = Math.min(duration, (bar + bars) * 4 * per);
      sections.push({ start: s, end: e, type, energy: type === 'chorus' ? 1 : type === 'verse' ? 0.5 : 0.2, z: type === 'chorus' ? 1 : -0.3 });
      bar += bars;
    }
    if (sections.length) sections[sections.length - 1].end = duration;
    const fps = 50, nFr = Math.ceil(duration * fps);
    const mk = (fn) => { const a = new Float32Array(nFr); for (let f = 0; f < nFr; f++) a[f] = fn(f / fps); return a; };
    const secType = (t) => { for (const s of sections) if (t >= s.start && t < s.end) return s.type; return 'outro'; };
    const env = {
      fps,
      onset: mk((t) => { const ph = (t / per) % 1; return Math.exp(-ph * 6) * (secType(t) === 'chorus' ? 1 : 0.6); }),
      rms: mk((t) => (secType(t) === 'chorus' ? 0.85 : secType(t) === 'verse' ? 0.55 : 0.3) + 0.1 * Math.exp(-((t / per) % 1) * 4)),
      low: mk((t) => Math.exp(-((t / per) % 4) * 3)),
      high: mk((t) => (secType(t) === 'chorus' ? 0.7 : 0.3) * Math.exp(-(((t / per) + 0.5) % 1) * 8)),
    };
    return { duration, bpm, baseBpm: bpm, grid, sections, env, source: 'synthetic', offsetMs: 0 };
  }

  function sampleEnv(env, key, t) {
    const a = env && env[key];
    if (!a || !a.length) return 0;
    const x = t * env.fps, i = Math.floor(x);
    if (i < 0) return a[0];
    if (i >= a.length - 1) return a[a.length - 1];
    const f = x - i;
    return a[i] * (1 - f) + a[i + 1] * f;
  }

  XYT.audio = { analyze, adjust, synthetic, sampleEnv, percentile };
})();
