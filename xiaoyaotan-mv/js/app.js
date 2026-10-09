/* 逍遥叹 · 音乐动画 —— 页面控制：播放、分析、歌词、分镜表、导出 */
(function () {
  'use strict';
  const XYT = window.XYT;
  const $ = (id) => document.getElementById(id);
  const fmt = (t) => {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60), s = t - m * 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
  };
  const SEC_NAME = { intro: '前奏', verse: '主歌', chorus: '副歌', bridge: '间奏', outro: '尾声' };

  const st = {
    actx: null, gain: null, src: null, buffer: null, demo: true, an: null, tl: null, lyr: null,
    playing: false, startCtx: 0, startOff: 0, pos: 0, overrides: {}, factor: 1, offsetMs: 0,
    recording: null, tapping: null, demoLRC: '',
  };
  const R = new XYT.Renderer($('stage'));
  const previewWidth = () => (window.innerWidth < 720 ? 960 : 1280);

  // ---------- 演示：合成配乐 ----------
  const DEMO_BPM = 76;
  const DEMO_PLAN = [['intro', 2], ['verse', 8], ['bridge', 4], ['chorus', 8], ['verse', 4], ['chorus', 2], ['outro', 3]];
  function demoDuration() { return DEMO_PLAN.reduce((s, p) => s + p[1], 0) * 4 * (60 / DEMO_BPM); }
  function demoLRC() {
    const per = 60 / DEMO_BPM;
    return XYT.toLRC(XYT.DEMO_LINES.map((text, k) => ({ t: (2 + 2 * k) * 4 * per + 0.05, text })));
  }
  // 直接按采样合成（拨弦用 Karplus-Strong，近似古筝音色），比搭建上千个音频节点快得多
  async function synthDemo() {
    const per = 60 / DEMO_BPM, dur = demoDuration(), SR = 32000;
    const N = Math.ceil(dur * SR);
    const L = new Float32Array(N), Rr = new Float32Array(N);
    const rnd = XYT.art.rng(42);
    const secAt = (bar) => { let b = 0; for (const [type, n] of DEMO_PLAN) { if (bar < b + n) return type; b += n; } return 'outro'; };
    const scale = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880];
    const chords = [[146.83, 220, 293.66], [123.47, 185, 246.94], [98, 146.83, 196], [110, 164.81, 220]];
    const add = (i, v, pan) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan); Rr[i] += v * (1 + pan); } };
    const pluck = (t, f, v, pan) => {
      const period = Math.max(2, Math.round(SR / f)), buf = new Float32Array(period);
      for (let k = 0; k < period; k++) buf[k] = rnd() * 2 - 1;
      const i0 = Math.round(t * SR), n = Math.round(1.8 * SR);
      let idx = 0, prev = 0;
      for (let k = 0; k < n; k++) {
        const cur = buf[idx];
        const nxt = 0.4985 * (cur + buf[(idx + 1) % period]);
        buf[idx] = nxt;
        idx = (idx + 1) % period;
        prev += 0.55 * (cur - prev);
        add(i0 + k, prev * v * (k < 40 ? k / 40 : 1), pan);
      }
    };
    const kick = (t, v) => {
      const i0 = Math.round(t * SR), n = Math.round(0.35 * SR);
      let ph = 0;
      for (let k = 0; k < n; k++) {
        const tt = k / SR;
        ph += (2 * Math.PI * (42 + 90 * Math.exp(-tt * 28))) / SR;
        add(i0 + k, Math.sin(ph) * Math.exp(-tt / 0.1) * v, 0);
      }
    };
    const hat = (t, v) => {
      const i0 = Math.round(t * SR), n = Math.round(0.05 * SR);
      let last = 0;
      for (let k = 0; k < n; k++) { const x = rnd() * 2 - 1; add(i0 + k, (x - last) * Math.exp(-k / (0.012 * SR)) * v, 0.3); last = x; }
    };
    const tone = (t, d, f, v, att, pan) => {
      const i0 = Math.round(t * SR), n = Math.round(d * SR), a = Math.round(att * SR);
      let ph = 0, y = 0;
      for (let k = 0; k < n; k++) {
        ph += f / SR; if (ph >= 1) ph -= 1;
        y += 0.06 * (2 * ph - 1 - y);
        const e = Math.min(1, k / a) * Math.min(1, (n - k) / a);
        add(i0 + k, y * e * v, pan);
      }
    };
    let note = 4;
    const bars = Math.round(dur / (4 * per));
    for (let bar = 0; bar < bars; bar++) {
      const type = secAt(bar), t0 = bar * 4 * per, ch = chords[bar % 4];
      const last = bar === bars - 1;
      tone(t0, 4 * per, ch[0] / 2, type === 'intro' ? 0.25 : 0.42, 0.02, 0);
      if (type !== 'intro') ch.forEach((f, k) => { tone(t0, 4 * per, f * 1.003, type === 'chorus' ? 0.07 : 0.05, 0.6, k - 1); tone(t0, 4 * per, f * 0.997, type === 'chorus' ? 0.07 : 0.05, 0.6, 1 - k); });
      for (let b = 0; b < 4; b++) {
        if (last && b > 0) break;
        const t = t0 + b * per;
        note = Math.max(0, Math.min(scale.length - 1, note + Math.round((rnd() - 0.5) * 3)));
        pluck(t, scale[note], b === 0 ? 0.55 : 0.4, (rnd() - 0.5) * 0.6);
        if (type === 'chorus' || (type === 'verse' && b % 2 === 1)) pluck(t + per / 2, scale[Math.max(0, note - 2)], 0.25, (rnd() - 0.5) * 0.6);
        if (type === 'chorus') { kick(t, b % 2 ? 0.5 : 0.8); hat(t + per / 2, 0.18); }
        else if (type === 'verse' || type === 'bridge') { if (b % 2 === 0) kick(t, 0.45); }
        else if (type === 'intro' && b === 0) kick(t, 0.3);
      }
      if ((bar & 3) === 3) await new Promise((r) => setTimeout(r, 0));
    }
    // 回声：左右不同延时的反馈，带低通
    for (const [ch, dt, fb] of [[L, 0.31, 0.32], [Rr, 0.43, 0.3]]) {
      const d = Math.round(dt * SR);
      let lp = 0;
      for (let i = d; i < N; i++) { lp += 0.35 * (ch[i - d] - lp); ch[i] += fb * lp; }
    }
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
    const gain = 0.85 / (peak || 1);
    const buf = new AudioBuffer({ length: N, numberOfChannels: 2, sampleRate: SR });
    for (let i = 0; i < N; i++) { L[i] *= gain; Rr[i] *= gain; }
    buf.copyToChannel(L, 0); buf.copyToChannel(Rr, 1);
    return buf;
  }

  // ---------- 数据流 ----------
  function rebuild(keepPos) {
    st.tl = XYT.buildTimeline(st.an, st.lyr, { overrides: st.overrides, storyboard: st.storyboard });
    decorate(st.tl);
    R.setData(st.an, st.tl);
    drawStripStatic();
    renderBoard();
    updateStats();
    loadFonts().then(() => { R.layouts.clear(); if (!st.playing) draw(); });
    if (!keepPos) st.pos = Math.min(st.pos, st.an.duration - 0.05);
    if (!st.playing) draw();
  }
  function decorate(tl) {
    const defaults = ['叹', '逍', '遥', '梦', '情'];
    tl.segments.forEach((s) => {
      if (s.scene !== 'poem') return;
      const ln = tl.lines.find((l) => l.t >= s.start - 0.2 && l.t < s.end) || tl.lineAt(s.start + 0.1);
      if (ln) {
        const ac = [...ln.cls.accents].sort((a, b) => a - b).map((i) => ln.chars[i]).filter((c) => !/[\s，。]/.test(c));
        s.char = ac[0] || ln.chars.find((c) => !/[\s，。、！？,.!?]/.test(c));
        s.inscription = ln.text.replace(/[\s，。、！？,.!?]/g, '');
      } else s.char = defaults[s.variant % defaults.length];
    });
  }
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const text = '逍遥叹演唱胡歌终同人音乐动画版权归原作者所有酒' + (st.tl ? st.tl.lines.map((l) => l.text).join('') + st.tl.segments.map((s) => s.char || '').join('') : '');
    const uniq = [...new Set(Array.from(text))].join('');
    return Promise.all([
      document.fonts.load(`64px "Ma Shan Zheng"`, uniq),
      document.fonts.load(`18px "Noto Serif SC"`, uniq),
    ]).catch(() => {});
  }

  function setLyricsFromText(text, opts) {
    const parsed = XYT.parseLyrics(text);
    if (!parsed.lines.length) { st.lyr = null; setLyricsHint('没有识别到歌词。'); rebuild(true); return; }
    if (!parsed.timed) {
      st.lyr = null;
      $('tapStart').hidden = false;
      setLyricsHint(`识别到 ${parsed.lines.length} 句纯文本歌词（无时间轴）。点「打点同步」，边听边在每句开唱时按空格。`);
      st.pendingPlain = parsed.lines.filter((l) => l.kind === 'lyric');
      rebuild(true);
      return;
    }
    $('tapStart').hidden = true;
    st.lyr = parsed;
    const n = parsed.lines.filter((l) => l.kind === 'lyric').length;
    if (!(opts && opts.silent)) setLyricsHint(`已应用 ${n} 句歌词，分镜已按歌词意象重排。`);
    rebuild(true);
  }
  function setLyricsHint(msg) { $('lyricsMsg').textContent = msg; }

  // ---------- 音频 ----------
  function ensureCtx() {
    if (!st.actx) {
      st.actx = new (window.AudioContext || window.webkitAudioContext)();
      st.gain = st.actx.createGain();
      st.gain.connect(st.actx.destination);
    }
    if (st.actx.state === 'suspended') st.actx.resume();
    return st.actx;
  }
  async function loadAudioFile(file) {
    const ab = await file.arrayBuffer();
    await loadAudioBuffer(ab, file.name);
  }
  async function loadAudioBuffer(ab, name) {
    pause();
    const box = $('anaBox');
    box.hidden = false;
    setProgress(0.02, '解码音频');
    try {
      const ctx = st.actx || new (window.AudioContext || window.webkitAudioContext)();
      if (!st.actx) { st.actx = ctx; st.gain = ctx.createGain(); st.gain.connect(ctx.destination); }
      const buf = await ctx.decodeAudioData(ab);
      const an = await XYT.audio.analyze(buf, setProgress);
      st.buffer = buf; st.an = an; st.demo = false; st.overrides = {}; st.factor = 1; st.offsetMs = 0; st.pos = 0;
      $('offset').value = 0; $('offsetOut').textContent = '0 ms';
      if ($('lyrics').value.trim() === st.demoLRC.trim()) { $('lyrics').value = ''; st.lyr = null; setLyricsHint('换成你的歌之后，示例歌词已清空。导入或粘贴《逍遥叹》的 LRC 歌词，画面会按每句意象切换。'); }
      $('srcLabel').textContent = name ? `音频：${name}` : '音频已载入';
      $('play').disabled = false; $('bigPlay').disabled = false; $('bigPlayLabel').textContent = '播放';
      $('demoBadge').hidden = true; $('demoNote').hidden = true;
      $('srcLabel').dataset.kind = 'user';
      setTimeout(() => { box.hidden = true; }, 900);
      if (st.lyr) setLyricsFromText($('lyrics').value, { silent: true }); else rebuild();
    } catch (e) {
      const enc = /\.(ncm|qmc\w*|mflac\w*|mgg\w*|kgm|kgma|kwm|vpr|tkm|bkc\w*)$/i.test(name || '');
      setProgress(0, enc ? '这是音乐 App 的加密下载格式，浏览器读不了。请换成普通的 mp3、m4a、flac 或 wav 文件。' : '读不了这个文件。请换成 mp3、m4a、flac 或 wav 格式的音频。');
      console.error(e);
    }
  }
  function setProgress(p, label) {
    $('anaBar').style.width = `${Math.round(p * 100)}%`;
    $('anaLabel').textContent = `${label}${p > 0 && p < 1 ? ` · ${Math.round(p * 100)}%` : ''}`;
  }

  function latency() { return st.recording ? 0 : (st.actx && (st.actx.outputLatency || st.actx.baseLatency)) || 0; }
  function now() {
    if (!st.playing) return st.pos;
    return st.startOff + (st.actx.currentTime - st.startCtx) - latency();
  }
  function play(from) {
    if (!st.buffer) return;
    ensureCtx();
    stopSource();
    const t0 = Math.max(0, Math.min(st.buffer.duration - 0.05, from ?? st.pos));
    const src = st.actx.createBufferSource();
    src.buffer = st.buffer;
    src.connect(st.gain);
    if (st.recording) src.connect(st.recording.dest);
    src.onended = () => { if (st.src === src) onEnded(); };
    src.start(0, t0);
    st.src = src; st.startCtx = st.actx.currentTime; st.startOff = t0; st.playing = true;
    $('play').textContent = '暂停'; $('bigPlay').hidden = true;
    requestAnimationFrame(loop);
  }
  function stopSource() {
    if (st.src) { const s = st.src; st.src = null; try { s.stop(); } catch (e) { /* 已停止 */ } }
  }
  function pause() {
    if (!st.playing) return;
    st.pos = now();
    st.playing = false;
    stopSource();
    $('play').textContent = '播放'; $('bigPlay').hidden = false;
    draw();
  }
  function onEnded() {
    st.playing = false;
    st.pos = 0;
    $('play').textContent = '播放'; $('bigPlay').hidden = false;
    if (st.recording) finishRecording();
    if (st.tapping) finishTap();
    draw();
  }
  function seek(t) {
    st.pos = Math.max(0, Math.min((st.an ? st.an.duration : 1) - 0.05, t));
    if (st.playing) play(st.pos); else draw();
  }

  // ---------- 绘制循环 ----------
  function draw() {
    const t = now();
    R.frame(t);
    drawStrip(t);
    $('time').textContent = `${fmt(t)} / ${fmt(st.an ? st.an.duration : 0)}`;
    const seg = st.tl && st.tl.segments[R.segIndex(t)];
    if (seg) $('nowScene').textContent = XYT.SCENES[seg.scene].name;
    if (st.recording) {
      const d = st.an.duration;
      $('recBar').style.width = `${Math.min(100, (t / d) * 100)}%`;
      $('recTime').textContent = `${fmt(t)} / ${fmt(d)}`;
    }
  }
  function loop() {
    if (!st.playing) return;
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- 时间线条 ----------
  const strip = $('strip');
  let stripStatic = null;
  const SEC_COL = { intro: '#8c8a83', verse: '#4f6f8a', chorus: '#b23a27', bridge: '#6b5aa0', outro: '#8c8a83' };
  function drawStripStatic() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, strip.clientWidth), h = 76;
    strip.width = Math.round(w * dpr); strip.height = Math.round(h * dpr);
    const c = document.createElement('canvas');
    c.width = strip.width; c.height = strip.height;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ink').trim() || '#222', muted = cs.getPropertyValue('--muted').trim() || '#777', surf = cs.getPropertyValue('--surface-2').trim() || '#eee';
    const d = st.an.duration, X = (t) => (t / d) * w;
    g.fillStyle = surf; g.fillRect(0, 0, w, h);
    for (const s of st.tl.sections) {
      g.fillStyle = SEC_COL[s.type] || '#777';
      g.fillRect(X(s.start), 0, Math.max(1, X(s.end) - X(s.start) - 1), 8);
    }
    st.tl.segments.forEach((s, k) => {
      const x0 = X(s.start), x1 = X(s.end);
      g.fillStyle = k % 2 ? 'rgba(127,127,127,0.16)' : 'rgba(127,127,127,0.07)';
      g.fillRect(x0, 12, x1 - x0, 34);
      g.fillStyle = ink; g.font = '13px "Noto Serif SC", serif'; g.textBaseline = 'middle';
      const name = XYT.SCENES[s.scene].name;
      if (x1 - x0 > 30) g.fillText(name, x0 + 4, 29);
    });
    const gr = st.an.grid;
    g.strokeStyle = muted;
    for (let i = 0; i < gr.n; i++) {
      const t = gr.b[i];
      if (t < 0 || t > d) continue;
      const down = gr.isDown(i);
      g.globalAlpha = down ? 0.8 : 0.35; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X(t) + 0.5, down ? 52 : 60); g.lineTo(X(t) + 0.5, 70); g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#c0392b';
    for (const l of st.tl.lines) { g.beginPath(); g.arc(X(l.t), 48, 2.6, 0, Math.PI * 2); g.fill(); }
    stripStatic = c;
  }
  function drawStrip(t) {
    if (!stripStatic) return;
    const g = strip.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(stripStatic, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    const x = (t / st.an.duration) * strip.width;
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b23a27';
    g.fillRect(Math.round(x) - dpr, 0, 2 * dpr, strip.height);
  }
  function stripSeek(ev) {
    const r = strip.getBoundingClientRect();
    seek(((ev.clientX - r.left) / r.width) * st.an.duration);
  }
  let dragging = false;
  strip.addEventListener('pointerdown', (e) => { dragging = true; strip.setPointerCapture(e.pointerId); stripSeek(e); });
  strip.addEventListener('pointermove', (e) => { if (dragging) stripSeek(e); });
  strip.addEventListener('pointerup', () => { dragging = false; });

  // ---------- 分镜表 ----------
  function renderBoard() {
    const tb = $('boardBody');
    tb.textContent = '';
    const opts = Object.entries(XYT.SCENES);
    st.tl.segments.forEach((s) => {
      const tr = document.createElement('tr');
      const ln = st.tl.lines.find((l) => l.t >= s.start - 0.2 && l.t < s.end);
      const sec = st.tl.sections.find((x) => s.start + 0.05 >= x.start && s.start + 0.05 < x.end) || st.tl.sections[st.tl.sections.length - 1];
      const td = (txt, cls) => { const e = document.createElement('td'); e.textContent = txt; if (cls) e.className = cls; tr.appendChild(e); return e; };
      const tt = td(fmt(s.start), 'num');
      tt.title = '跳到这里';
      tt.addEventListener('click', () => seek(s.start + 0.01));
      td(SEC_NAME[sec.type] || '', 'sec sec-' + sec.type);
      const cell = document.createElement('td');
      const sel = document.createElement('select');
      sel.id = 'scene-' + s.key.replace('.', '-');
      sel.setAttribute('aria-label', `${fmt(s.start)} 的画面`);
      for (const [id, m] of opts) { const o = document.createElement('option'); o.value = id; o.textContent = m.name; if (id === s.scene) o.selected = true; sel.appendChild(o); }
      sel.addEventListener('change', () => { st.overrides[s.key] = sel.value; rebuild(true); seek(s.start + 0.05); });
      cell.appendChild(sel); tr.appendChild(cell);
      const why = s.src === 'lyric' ? '歌词意象' : s.src === 'intro' ? '片头' : s.src === 'end' ? '片尾' : st.overrides[s.key] ? '手动' : '段落';
      td(st.overrides[s.key] ? '手动' : why, 'why');
      td(ln ? ln.text : '—', 'lyric');
      tb.appendChild(tr);
    });
  }

  function updateStats() {
    const an = st.an;
    $('bpm').textContent = an.bpm.toFixed(1);
    $('beats').textContent = String(an.grid.n);
    $('secs').textContent = an.sections.map((s) => SEC_NAME[s.type]).join(' · ');
    $('shots').textContent = String(st.tl.segments.length);
    const adj = an.source === 'audio';
    for (const id of ['half', 'double', 'offset']) $(id).disabled = !adj;
  }

  // ---------- 打点同步 ----------
  function startTap() {
    if (!st.pendingPlain || !st.pendingPlain.length || st.demo) {
      setLyricsHint(st.demo ? '请先在第 ① 步载入你的歌曲，再打点同步。' : '没有待同步的歌词。');
      return;
    }
    st.tapping = { lines: st.pendingPlain.map((l) => l.text), idx: 0, times: [] };
    $('tapBox').hidden = false;
    updateTap();
    play(0);
  }
  function tap() {
    const tp = st.tapping;
    if (!tp || !st.playing) return;
    const t = st.an.grid.quant(Math.max(0, now() - 0.12), 2);
    tp.times[tp.idx] = t;
    tp.idx++;
    if (tp.idx >= tp.lines.length) finishTap(); else updateTap();
  }
  function undoTap() { const tp = st.tapping; if (tp && tp.idx > 0) { tp.idx--; updateTap(); } }
  function updateTap() {
    const tp = st.tapping;
    $('tapNext').textContent = tp.lines[tp.idx] || '';
    $('tapCount').textContent = `${tp.idx} / ${tp.lines.length}`;
  }
  function finishTap() {
    const tp = st.tapping;
    st.tapping = null;
    $('tapBox').hidden = true;
    if (!tp || !tp.idx) return;
    const lines = tp.lines.slice(0, tp.idx).map((text, k) => ({ t: tp.times[k], text }));
    const lrc = XYT.toLRC(lines);
    $('lyrics').value = lrc;
    pause();
    setLyricsFromText(lrc);
  }

  // ---------- 导出 ----------
  function pickMime() {
    const list = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4D401F,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    if (!window.MediaRecorder) return null;
    return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  }
  async function startExport() {
    if (st.recording) return;
    const msg = $('exportMsg');
    const mime = pickMime();
    if (mime == null || !$('stage').captureStream) { msg.textContent = '这个浏览器不支持录制画布，请用最新版 Chrome、Edge 或 Safari 打开。'; return; }
    pause();
    ensureCtx();
    const res = +$('res').value;
    msg.textContent = '准备画面…';
    R.setSize(res === 1080 ? 1920 : 1280);
    await loadFonts();
    const fps = 30;
    const vstream = $('stage').captureStream(fps);
    const dest = st.actx.createMediaStreamDestination();
    const stream = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: res === 1080 ? 9e6 : 5e6, audioBitsPerSecond: 192000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    st.recording = { rec, dest, chunks, mime: rec.mimeType || mime, cancelled: false };
    $('recOverlay').hidden = false;
    document.body.classList.add('is-recording');
    msg.textContent = '';
    rec.start(1000);
    play(0);
  }
  function cancelExport() {
    if (!st.recording) return;
    st.recording.cancelled = true;
    pause();
    finishRecording();
  }
  function finishRecording() {
    const r = st.recording;
    if (!r) return;
    st.recording = null;
    r.rec.onstop = async () => {
      $('recOverlay').hidden = true;
      document.body.classList.remove('is-recording');
      R.setSize(previewWidth());
      R.layouts.clear();
      draw();
      if (r.cancelled) { $('exportMsg').textContent = '已取消导出。'; return; }
      const type = (r.mime || 'video/webm').split(';')[0];
      const blob = new Blob(r.chunks, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const name = `逍遥叹-音乐动画.${ext}`;
      const v = $('resultVideo');
      v.src = URL.createObjectURL(blob); v.hidden = false;
      await saveBlob(blob, name);
    };
    try { r.rec.stop(); } catch (e) { r.rec.onstop(); }
  }
  async function saveBlob(blob, name) {
    const msg = $('exportMsg');
    const mb = (blob.size / 1048576).toFixed(1);
    let dl = null;
    try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (dl) {
      try {
        await dl.save({ filename: name, data: blob });
        msg.textContent = `已保存 ${name}（${mb} MB）。`;
      } catch (e) {
        msg.textContent = e && e.code === 'declined' ? '你取消了保存。视频还在下方，可以再点一次「保存视频」。' : `保存没有完成（${(e && e.code) || '未知原因'}）。`;
        showSaveAgain(blob, name);
      }
      return;
    }
    if (window.claude) { msg.textContent = `视频已生成（${mb} MB），但当前查看方式不能保存文件。可在下方预览。`; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    msg.textContent = `已生成 ${name}（${mb} MB）。`;
  }
  function showSaveAgain(blob, name) {
    const b = $('saveAgain');
    b.hidden = false;
    b.onclick = () => { b.hidden = true; saveBlob(blob, name); };
  }

  // ---------- 事件 ----------
  $('play').addEventListener('click', () => (st.playing ? pause() : play()));
  $('bigPlay').addEventListener('click', () => play());
  $('stage').addEventListener('click', () => { if (!st.recording) (st.playing ? pause() : play()); });
  $('audioFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadAudioFile(f); });
  $('lrcFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('lyrics').value = await f.text();
    setLyricsFromText($('lyrics').value);
  });
  $('applyLyrics').addEventListener('click', () => setLyricsFromText($('lyrics').value));
  const stageBox = document.querySelector('.stage');
  stageBox.addEventListener('dragover', (e) => { e.preventDefault(); stageBox.classList.add('drop'); });
  stageBox.addEventListener('dragleave', () => stageBox.classList.remove('drop'));
  stageBox.addEventListener('drop', async (e) => {
    e.preventDefault();
    stageBox.classList.remove('drop');
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f || st.recording) return;
    if (/\.(lrc|txt)$/i.test(f.name)) { $('lyrics').value = await f.text(); setLyricsFromText($('lyrics').value); }
    else loadAudioFile(f);
  });
  $('tapStart').addEventListener('click', startTap);
  $('tapBtn').addEventListener('click', tap);
  $('tapUndo').addEventListener('click', undoTap);
  $('tapDone').addEventListener('click', finishTap);
  $('half').addEventListener('click', () => adjustBeat(st.factor / 2));
  $('double').addEventListener('click', () => adjustBeat(st.factor * 2));
  $('offset').addEventListener('input', () => { $('offsetOut').textContent = `${$('offset').value} ms`; });
  $('offset').addEventListener('change', () => { st.offsetMs = +$('offset').value; adjustBeat(st.factor); });
  $('export').addEventListener('click', startExport);
  $('recCancel').addEventListener('click', cancelExport);
  function adjustBeat(f) {
    if (!st.an || st.an.source !== 'audio') return;
    st.factor = Math.max(0.25, Math.min(4, f));
    st.an = XYT.audio.adjust(st.an, { factor: st.factor, offsetMs: st.offsetMs });
    rebuild(true);
  }
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.code === 'Space') { e.preventDefault(); if (st.tapping) tap(); else if (!st.recording) (st.playing ? pause() : play()); }
    else if (e.code === 'ArrowRight' && !st.recording) seek(now() + 5);
    else if (e.code === 'ArrowLeft' && !st.recording) seek(now() - 5);
  });
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!st.recording) { R.setSize(previewWidth()); drawStripStatic(); draw(); } }, 200); });

  // ---------- 启动：演示 ----------
  async function boot() {
    R.setSize(previewWidth());
    const dur = demoDuration();
    st.an = XYT.audio.synthetic(dur, DEMO_BPM, DEMO_PLAN);
    st.demoLRC = demoLRC();
    $('lyrics').value = st.demoLRC;
    st.lyr = XYT.parseLyrics(st.demoLRC);
    rebuild();
    st.pos = st.tl.title.sub + 0.6;
    draw();
    setLyricsHint('现在是演示：示例歌词为自拟，用来展示 13 种意象画面。');
    try {
      st.buffer = await synthDemo();
      $('play').disabled = false; $('bigPlay').disabled = false;
      if (st.demo) $('bigPlayLabel').textContent = '播放演示（合成配乐）';
    } catch (e) { console.error(e); }
  }

  // 供离线渲染脚本调用
  XYT.api = {
    async loadAudio(ab, name) { await loadAudioBuffer(ab, name); return { bpm: st.an.bpm, duration: st.an.duration, sections: st.an.sections }; },
    setLyrics(text) { $('lyrics').value = text; setLyricsFromText(text); return st.tl.segments.length; },
    setResolution(w) { R.setSize(w); R.layouts.clear(); },
    fonts: loadFonts,
    renderAt(t) { R.frame(t); },
    setStoryboard(sb) { st.storyboard = sb; if (st.an) rebuild(true); return st.tl ? st.tl.segments.length : 0; },
    // 单个镜头预览：合成 72 BPM 节拍网格，可带一句示例歌词
    previewShot(id, o = {}) {
      const dur = o.dur || 12;
      const an = XYT.audio.synthetic(dur, 72, [[o.sec || 'verse', Math.ceil(dur / 3.3334) + 1]]);
      const text = o.text || '';
      const lyr = text ? XYT.parseLyrics(`[00:00.83]${text}\n[00:${String(Math.min(59, Math.floor(dur - 1))).padStart(2, '0')}.00]`) : null;
      const sb = { intro: id, lines: text ? { 1: id } : {} };
      const tl = XYT.buildTimeline(an, lyr, { storyboard: sb });
      tl.segments.forEach((sg) => { sg.trans = null; });
      tl.title = null; tl.end = null;
      R.setData(an, tl);
      return tl.segments.map((sg) => sg.scene);
    },
    state: () => st,
  };
  boot();
})();
