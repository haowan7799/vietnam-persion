/* 逍遥叹 · 音乐动画 —— 歌词解析、意象匹配、分镜时间线 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});

  // 场景元数据（画面实现见 scenes.js）
  const SCENES = {
    mist: { name: '云山', zone: 'left' },
    boat: { name: '孤舟', zone: 'right' },
    moon: { name: '月夜', zone: 'right' },
    wine: { name: '醉月', zone: 'left' },
    dream: { name: '蝶梦', zone: 'right' },
    poem: { name: '诗卷', zone: 'bottom' },
    sword: { name: '剑气', zone: 'left' },
    flight: { name: '御剑', zone: 'right' },
    petals: { name: '红尘', zone: 'right' },
    rain: { name: '烟雨', zone: 'left' },
    love: { name: '情丝', zone: 'top' },
    memory: { name: '往事', zone: 'right' },
    freedom: { name: '逍遥', zone: 'left' },
  };
  XYT.SCENES = SCENES;
  // 分镜专用镜头：注册到渲染表，同时登记名称与歌词区位
  XYT.registerShot = function (id, def) {
    (XYT.scenes = XYT.scenes || {})[id] = def;
    SCENES[id] = { name: def.name || id, zone: def.zone || 'bottom', shot: true };
  };

  // 意象词典：词 → 权重
  const W = (s) => s.split(' ').map((p) => { const [w, v] = p.split(':'); return [w, +v]; });
  const SCENE_WORDS = {
    mist: W('江湖:2 天涯:2 远方:1.5 山:1.2 峰:1.2 崖:1.2 路:1 途:1 漂泊:1.5 浪迹:1.5 人间:1 归:0.8 万里:1.2 千山:1.5 雾:1.2 足迹:1.5 行:0.5 走:0.5'),
    boat: W('舟:2 船:2 夕阳:2 江:1.2 河:1.2 湖:1.2 水:1 流:0.8 东流:1.5 潮:1.5 波:1 浪:1 渡:1.2 岸:1.2 海:1'),
    moon: W('月:2 夜:1.2 星:1.2 寒:0.8 霜:1 宵:1 夕:0.8 晚:0.8 荷:1.5 莲:1.5 静:0.6'),
    wine: W('酒:2.5 醉:2.5 杯:2 壶:2 饮:1.5 酌:1.5 浊:1 盏:1.5 觞:1.5 知己:2'),
    dream: W('梦:2.5 幻:1.5 蝶:2 恍惚:1.5 虚:0.8 痴:1 迷:1 醒:1.2 魂:1.2'),
    poem: W('诗:2.5 词:1.5 书:1.2 笔:2 墨:2 字:1.2 写:1.5 纸:1.2 画:1.2 题:1'),
    sword: W('剑:2.5 侠:2 刀:2 刃:2 锋:1.5 战:1.5 斩:1.5 肝胆:2 英雄:2 英杰:1.5 豪:1.2 血:1.2 傲:1 狂:1 闯:1.2'),
    flight: W('飞:2 翔:1.5 御:1.2 腾:1.2 九天:2 青云:2 云霄:2 凌云:2 乘风:2 苍穹:1.5 天际:1.5'),
    petals: W('红尘:3 花:2 落:1 春:1.2 桃:2 枫:2 红:1 芳:1.2 谢:0.8 缘:1.2 繁华:1.5 凡尘:2 尘:1 樱:1.5 纷飞:0.5'),
    rain: W('雨:2.5 泪:2 哭:1.5 伤:1.2 痛:1.2 别:1.2 离:1.2 散:1 人散:2 悲:1.2 苦:1 愁:1.2 恨:1.2 殁:1.5 孤:1 寂:1 冷:0.8'),
    love: W('红线:3 伊人:2 情:1.2 爱:1.2 心:0.8 相:0.8 恋:1.2 思:1 念:1 誓:1.5 牵:1.5 守:1 伴:1 依:0.8 你:0.4'),
    memory: W('往事:3 回忆:2.5 记忆:2 忆:1.5 曾:1 当年:2 岁月:2 时光:2 多年:1.5 年:0.8 过去:1.5 从前:1.5 忘:1.2 回首:2 旧:1 昨:1 流年:2 如烟:1.5 灯:1.5 烛:2'),
    freedom: W('逍遥:3 自由:2 潇洒:2.5 天地:2 笑:1.5 鹤:2 自在:2 无忧:2 洒脱:2 一生:1 随风:1.5 放下:1.5 看淡:1.5 快意:1.5 叹:0.8'),
  };
  XYT.SCENE_WORDS = SCENE_WORDS;

  const T2S = {
    劍: '剑', 夢: '梦', 淚: '泪', 紅: '红', 塵: '尘', 詩: '诗', 書: '书', 筆: '笔', 飛: '飞', 雲: '云', 風: '风',
    憶: '忆', 歲: '岁', 時: '时', 遙: '遥', 瀟: '潇', 灑: '洒', 舊: '旧', 盞: '盏', 壺: '壶', 戀: '恋', 愛: '爱',
    傷: '伤', 離: '离', 鶴: '鹤', 燈: '灯', 濁: '浊', 歎: '叹', 嘆: '叹', 湧: '涌', 淚: '泪', 歸: '归', 遠: '远',
    雙: '双', 煙: '烟', 雨: '雨', 華: '华', 舊: '旧', 憂: '忧', 過: '过', 從: '从', 記: '记', 間: '间', 為: '为',
    與: '与', 這: '这', 誰: '谁', 會: '会', 說: '说', 斬: '斩', 戰: '战', 鋒: '锋', 膽: '胆', 傲: '傲', 闖: '闯',
    騰: '腾', 際: '际', 謝: '谢', 緣: '缘', 繁: '繁', 櫻: '樱', 誓: '誓', 牽: '牵', 線: '线', 憐: '怜', 曉: '晓',
  };
  const norm = (s) => Array.from(s, (c) => T2S[c] || c).join('');

  const OVERLAY_WORDS = { snow: ['雪', '冬', '白头'], wind: ['风', '飘', '吹', '叶', '秋'], maple: ['枫'] };
  // 所有意象词按长度从长到短：长词先占用字，避免「岁月」里的「月」被算进月夜
  const ALL_WORDS = [];
  for (const id in SCENE_WORDS) for (const [w, v] of SCENE_WORDS[id]) ALL_WORDS.push([w, v, id]);
  ALL_WORDS.sort((a, b) => b[0].length - a[0].length);
  const FX_CHARS = {
    剑: 'slash', 刀: 'slash', 泪: 'tear', 梦: 'ring', 花: 'petal', 桃: 'petal', 樱: 'petal', 雨: 'rain',
    心: 'pulse', 情: 'pulse', 爱: 'pulse', 恋: 'pulse', 月: 'halo', 风: 'gust', 雪: 'snow', 笑: 'sparkle',
    酒: 'splash', 醉: 'splash', 飞: 'rise', 灯: 'warm', 火: 'warm', 天: 'rays', 叹: 'sigh', 遥: 'sparkle',
  };

  function classify(text) {
    const s = norm(text);
    const used = new Array(s.length).fill(false), scores = {}, hits = {};
    for (const [w, v, id] of ALL_WORDS) {
      let at = s.indexOf(w);
      while (at >= 0) {
        let free = true;
        for (let k = 0; k < w.length; k++) if (used[at + k]) free = false;
        if (free) {
          for (let k = 0; k < w.length; k++) { used[at + k] = true; (hits[id] = hits[id] || []).push(at + k); }
          scores[id] = (scores[id] || 0) + v;
        }
        at = s.indexOf(w, at + 1);
      }
    }
    let best = null, bs = 0;
    for (const id in SCENE_WORDS) if ((scores[id] || 0) > bs) { bs = scores[id]; best = id; }
    const accents = new Set(best ? hits[best] : []);
    const overlays = Object.keys(OVERLAY_WORDS).filter((k) => OVERLAY_WORDS[k].some((w) => s.includes(w)));
    const fx = [];
    const seen = new Set();
    Array.from(s).forEach((c, i) => {
      const f = FX_CHARS[c];
      if (f && !seen.has(f) && fx.length < 2) { seen.add(f); fx.push({ i, type: f }); }
    });
    return { scene: bs >= 1 ? best : null, score: bs, accents, overlays, fx, drunk: s.includes('醉') };
  }
  XYT.classify = classify;

  // ---------- 歌词解析 ----------
  const CREDIT = /^\s*(作词|作曲|编曲|词|曲|演唱|原唱|歌手|制作|制作人|监制|混音|母带|和声|吉他|贝斯|鼓|弦乐|录音|出品|发行|OP|SP|策划|统筹|古筝|笛子|二胡|琵琶|配唱)\s*[:：]/i;
  function parseLyrics(raw) {
    const text = (raw || '').replace(/\r/g, '');
    let offset = 0;
    const m = text.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
    if (m) offset = +m[1] / 1000;
    const lines = [];
    let timed = false;
    for (const row of text.split('\n')) {
      const tags = [...row.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
      let body = row.replace(/\[[^\]]*\]/g, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
      // 增强型 LRC：<mm:ss.xx>字 逐字时间
      let charTimes = null;
      const bodyRaw = row.replace(/\[[^\]]*\]/g, '');
      if (/<\d+:\d+(?:\.\d+)?>/.test(bodyRaw)) {
        const segs = [...bodyRaw.matchAll(/<(\d+):(\d+(?:\.\d+)?)>([^<]*)/g)];
        const chars = [], times = [];
        for (const sg of segs) for (const ch of Array.from(sg[3])) { chars.push(ch); times.push(+sg[1] * 60 + parseFloat(sg[2]) - offset); }
        while (chars.length && /\s/.test(chars[chars.length - 1])) { chars.pop(); times.pop(); }
        while (chars.length && /\s/.test(chars[0])) { chars.shift(); times.shift(); }
        if (chars.length) { body = chars.join(''); charTimes = times; }
      }
      if (tags.length) {
        timed = true;
        for (const tg of tags) {
          const t = +tg[1] * 60 + parseFloat(tg[2].replace(':', '.')) - offset;
          // 空白时间标签表示上一句到此结束
          lines.push({ t: Math.max(0, t), text: body, charTimes, kind: !body ? 'gap' : CREDIT.test(body) ? 'credit' : 'lyric' });
        }
      } else if (body && !/^\[/.test(row.trim())) {
        lines.push({ t: null, text: body, kind: CREDIT.test(body) ? 'credit' : 'lyric' });
      }
    }
    if (timed) {
      lines.sort((a, b) => a.t - b.t);
      while (lines.length && lines[0].kind === 'gap') lines.shift();
      return { lines: lines.filter((l) => l.t != null), timed: true };
    }
    return { lines, timed: false };
  }
  XYT.parseLyrics = parseLyrics;

  function toLRC(lines) {
    const f = (t) => {
      const m = Math.floor(t / 60), s = t - m * 60;
      return `[${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}]`;
    };
    return lines.filter((l) => l.t != null).map((l) => f(l.t) + l.text).join('\n');
  }
  XYT.toLRC = toLRC;

  // ---------- 分镜构建 ----------
  const POOLS = {
    intro: ['mist'],
    verse: ['boat', 'moon', 'dream', 'love', 'memory', 'poem', 'rain', 'wine'],
    chorus: ['flight', 'petals', 'sword', 'freedom'],
    bridge: ['rain', 'dream', 'memory'],
    outro: ['wine', 'mist'],
  };
  const NIGHT = new Set(['moon', 'wine', 'dream', 'sword', 'memory']);
  const isNight = (id) => !!((XYT.scenes && XYT.scenes[id] && XYT.scenes[id].night) || NIGHT.has(id));
  const INTENSITY = { intro: 0.35, verse: 0.55, bridge: 0.45, chorus: 1, outro: 0.4 };
  const PUNCT = /[\s，。、！？,.!?；;：:“”"'‘’…—\-（）()《》·]/;

  function sectionAt(secs, t) {
    for (const s of secs) if (t >= s.start && t < s.end) return s;
    return secs[secs.length - 1];
  }

  function buildTimeline(an, lyr, opts) {
    opts = opts || {};
    const g = an.grid, dur = an.duration, secs = an.sections;
    const overrides = opts.overrides || {};
    const barAt = (t) => g.barDur(t);
    const timedAll = (lyr && lyr.timed ? lyr.lines : []).filter((l) => l.kind !== 'credit' && l.t < dur - 0.5);
    const lyricLines = timedAll.filter((l) => l.kind === 'lyric');
    const credits = (lyr && lyr.lines ? lyr.lines : []).filter((l) => l.kind === 'credit').map((l) => l.text);

    // 1) 歌词行
    const lines = lyricLines.map((l, k) => {
      const next = timedAll[timedAll.indexOf(l) + 1];
      const chars = Array.from(l.text);
      const vis = chars.filter((c) => !PUNCT.test(c)).length || 1;
      const cls = classify(l.text);
      let end = next ? next.t : Math.min(dur - 0.3, l.t + Math.max(6, vis * 0.6 + 3));
      if (next && next.kind !== 'gap' && next.t - l.t > 14) end = l.t + Math.min(12, vis * 0.7 + 4);
      return { t: l.t, end, text: l.text, chars, vis, cls, idx: k, charTimes: l.charTimes && l.charTimes.length === chars.length ? l.charTimes : null };
    });

    // 有分镜表时：每句歌词一个指定镜头，切点卡在这句第一个字开唱的那一拍
    let segs = [];
    let endStart = null;
    const sb = opts.storyboard;
    function storyboardSegs() {
      // 器乐段可给多个镜头：在 [a, b) 内按小节均分
      const span = (list, a, b, src, sec) => {
        const ids = Array.isArray(list) ? list : [list];
        const res = [];
        ids.forEach((it, k) => {
          const id = typeof it === 'object' ? it.id : it;
          const x = typeof it === 'object' && it.at != null ? it.at : k === 0 ? a : g.nearestDown(a + ((b - a) * k) / ids.length);
          res.push({ start: x, scene: id, src, sec });
        });
        return res;
      };
      const firstCut = (() => {
        const ln = lines[0];
        if (!ln) return dur;
        const fi = ln.chars.findIndex((c) => !PUNCT.test(c));
        return ln.charTimes && fi >= 0 ? ln.charTimes[fi] : ln.t;
      })();
      const out = span(sb.intro || 'mist', 0, firstCut, 'intro', 'intro');
      let prevEnd = null;
      lines.forEach((ln, k) => {
        const shot = sb.lines && sb.lines[k + 1];
        const fi = ln.chars.findIndex((c) => !PUNCT.test(c));
        const first = ln.charTimes && fi >= 0 ? ln.charTimes[fi] : ln.t;
        if (prevEnd != null && sb.interlude && first - prevEnd > 7) out.push(...span(sb.interlude, g.nearestDown(prevEnd + 0.4), first, 'interlude', 'bridge'));
        if (shot) {
          let cut = g.quant(first, 2);
          if (cut > first + 0.02) cut -= g.per(g.idx(first)) / 2;
          out.push({ start: Math.max(0.1, cut), scene: shot, src: 'lyric', line: k, sec: sectionAt(secs, first + 0.05).type });
        }
        prevEnd = ln.end;
      });
      if (sb.outro && prevEnd != null && dur - prevEnd > 4) out.push(...span(sb.outro, g.nearestDown(prevEnd + 0.4), dur - 2, 'end', 'outro'));
      const res = [];
      for (const s of out) { if (res.length && s.start < res[res.length - 1].start + 0.6) res[res.length - 1] = s.src === 'lyric' ? s : res[res.length - 1]; else res.push(s); }
      return res;
    }
    if (sb) segs = storyboardSegs();
    else {
    // 2) 场景请求
    const reqs = [];
    const counters = {};
    const poolPick = (type, prev) => {
      const pool = POOLS[type] || POOLS.verse;
      counters[type] = counters[type] || 0;
      let s = pool[counters[type] % pool.length];
      if (s === prev && pool.length > 1) { counters[type]++; s = pool[counters[type] % pool.length]; }
      counters[type]++;
      return s;
    };
    const snap = (t) => {
      const d = g.downAtOrBefore(t + 0.05);
      if (t - d <= barAt(t) * 0.6) return d;
      return g.beatAtOrBefore(t + 0.05);
    };
    reqs.push({ t: 0, pri: 9, src: 'intro', type: secs[0] ? secs[0].type : 'intro' });
    secs.forEach((s, k) => {
      const len = s.end - s.start;
      const bar = barAt(s.start + 0.01);
      const phraseBars = bar > 2.5 ? 4 : 8;
      if (k > 0) reqs.push({ t: g.nearestDown(s.start), pri: 2, src: 'section', type: s.type });
      const step = phraseBars * bar;
      for (let x = s.start + step; x < s.end - step * 0.6; x += step) reqs.push({ t: g.nearestDown(x), pri: 1, src: 'phrase', type: s.type });
      if (len <= 0) return;
    });
    for (const ln of lines) if (ln.cls.scene) reqs.push({ t: snap(ln.t), pri: 3, src: 'lyric', scene: ln.cls.scene, line: ln.idx, score: ln.cls.score });
    reqs.sort((a, b) => a.t - b.t || b.pri - a.pri);

    // 3) 合并：间隔过近时保留优先级高者
    const acc = [];
    for (const r of reqs) {
      if (r.t < 0 || r.t > dur - 1) continue;
      const minGap = (r.src === 'lyric' ? 1 : 2) * barAt(r.t) * 0.95;
      while (acc.length) {
        const last = acc[acc.length - 1];
        if (r.t - last.t >= minGap) break;
        if (last.pri < 9 && (r.pri > last.pri || (r.pri === last.pri && (r.score || 0) > (last.score || 0) + 1))) { acc.pop(); continue; }
        r.skip = true;
        break;
      }
      if (!r.skip) acc.push(r);
    }

    // 4) 赋予场景
    let prev = null;
    // 没有歌词意象时按这一句（乐句）自身的响度选：响的用激昂画面，轻的用抒情画面
    const env = an.env;
    const meanRms = (a, b) => {
      if (!env || !env.rms) return null;
      let sum = 0, n = 0;
      for (let f = Math.max(0, Math.floor(a * env.fps)); f < Math.min(env.rms.length, Math.floor(b * env.fps)); f++) { sum += env.rms[f]; n++; }
      return n ? sum / n : null;
    };
    const songMean = meanRms(0, dur);
    let songSd = 0;
    if (songMean != null) {
      let v = 0, n = 0;
      for (let f = 0; f < env.rms.length; f += 4) { v += (env.rms[f] - songMean) ** 2; n++; }
      songSd = Math.sqrt(v / Math.max(1, n)) || 1;
    }
    const moodType = (sec, a, b) => {
      if (sec.type === 'intro' || sec.type === 'outro' || songMean == null) return sec.type;
      const z = (meanRms(a, b) - songMean) / songSd;
      if (z > 0.25) return 'chorus';
      return sec.type === 'bridge' ? 'bridge' : 'verse';
    };
    acc.forEach((r, k) => {
      const sec = sectionAt(secs, r.t + 0.01);
      const mood = moodType(sec, r.t, k + 1 < acc.length ? acc[k + 1].t : dur);
      let scene = r.scene;
      if (!scene) scene = r.src === 'intro' ? 'mist' : poolPick(mood, prev);
      if (scene === prev && r.src !== 'lyric') scene = poolPick(mood, prev);
      if (scene === prev && segs.length) return;
      segs.push({ start: r.t, scene, src: r.src, line: r.line, sec: sec.type });
      prev = scene;
    });
    // 结尾
    const lastLine = lines[lines.length - 1];
    const outro = secs.length > 1 && secs[secs.length - 1].type === 'outro' ? secs[secs.length - 1] : null;
    endStart = Math.max(lastLine ? lastLine.end + 0.2 : 0, outro ? outro.start + barAt(outro.start) : dur - 12);
    endStart = Math.min(Math.max(endStart, dur * 0.6), dur - 3.5);
    endStart = Math.max(0, g.nearestDown(endStart));
    if (!lastLine || lastLine.end <= endStart) {
      while (segs.length > 1 && segs[segs.length - 1].start > endStart - barAt(endStart)) segs.pop();
      if (segs[segs.length - 1].scene !== 'wine' && endStart - segs[segs.length - 1].start > barAt(endStart)) segs.push({ start: endStart, scene: 'wine', src: 'end', sec: 'outro' });
      else segs[segs.length - 1].src = 'end';
    }
    }

    if (endStart == null) {
      const lastL = lines[lines.length - 1];
      const outS = secs.length > 1 && secs[secs.length - 1].type === 'outro' ? secs[secs.length - 1] : null;
      endStart = Math.max(lastL ? lastL.end + 0.2 : 0, outS ? outS.start + barAt(outS.start) : dur - 12);
      endStart = Math.max(0, g.nearestDown(Math.min(Math.max(endStart, dur * 0.6), dur - 3.5)));
    }
    segs.forEach((s, k) => {
      s.end = k + 1 < segs.length ? segs[k + 1].start : dur;
      s.key = s.start.toFixed(2);
      if (overrides[s.key]) s.scene = overrides[s.key];
    });
    const seen = {};
    segs.forEach((s, k) => {
      seen[s.scene] = (seen[s.scene] || 0) + 1;
      s.variant = seen[s.scene] - 1;
      // 同一画面第二次出现时左右镜像（含文字的醉月、诗卷除外）
      s.mirror = !sb && s.variant % 2 === 1 && s.scene !== 'wine' && s.scene !== 'poem';
      const sec = sectionAt(secs, (s.start + s.end) / 2);
      s.intensity = INTENSITY[sec.type] ?? 0.55;
      s.idx = k;
      s.seed = Math.floor(s.start * 1000) % 100000;
      if (k === 0) { s.trans = null; return; }
      const prevS = segs[k - 1];
      const per = g.per(g.idx(s.start));
      let type = k % 2 ? 'ink' : 'fog';
      const atSection = secs.some((x) => Math.abs(x.start - s.start) < per * 1.1);
      if (atSection && sec.type === 'chorus') type = 'slash';
      else if (s.scene === 'poem') type = 'ink';
      else if (isNight(s.scene) !== isNight(prevS.scene)) type = 'iris';
      // 分镜表按镜头 id 指定转场：字符串类型，或 {type, dur, x, y, color}
      const st = sb && sb.trans && sb.trans[s.scene];
      const so = st && typeof st === 'object' ? st : null;
      if (st) type = so ? so.type : st;
      const d = type === 'cut' ? 0.001 : type === 'slash' ? Math.max(0.35, per * 0.6) : Math.min(1.4, Math.max(0.5, per));
      s.trans = { type, dur: so && so.dur != null ? so.dur : type === 'flash' ? 0.001 : d, x: so && so.x, y: so && so.y, color: so && so.color };
    });

    // 5) 歌词逐字时间（落在十六分音符网格上）
    const sceneAt = (t) => { for (const s of segs) if (t >= s.start - 0.01 && t < s.end) return s; return segs[segs.length - 1]; };
    const fxEvents = [], drunk = [];
    let side = 0;
    for (const ln of lines) {
      const per = g.per(g.idx(ln.t));
      const q = per / 4;
      const span = Math.max(0.3, ln.end - ln.t);
      let sp = Math.min(2 * q, Math.max(q, (span * 0.75) / ln.vis));
      sp = Math.max(q, Math.round(sp / q) * q);
      const t0 = g.quant(ln.t, 4);
      let vi = 0;
      ln.reveal = ln.chars.map((c, ci) => {
        if (PUNCT.test(c)) return null;
        if (ln.charTimes) return Math.max(ln.t, ln.charTimes[ci] - 0.06);
        return t0 + sp * vi++;
      });
      const seg = sceneAt(ln.t + 0.05);
      let zone = (SCENES[seg.scene] || {}).zone || 'bottom';
      if (sb && sb.zones && sb.zones[ln.idx + 1]) zone = sb.zones[ln.idx + 1];
      if (seg.mirror) zone = zone === 'left' ? 'right' : zone === 'right' ? 'left' : zone;
      if (ln.vis > 14 && zone !== 'top') zone = 'bottom';
      ln.zone = zone;
      ln.side = side++;
      ln.scene = seg.scene;
      ln.out = ln.end - 0.15;
      for (const f of ln.cls.fx) {
        const ci = f.i;
        const tt = ln.reveal[ci] != null ? ln.reveal[ci] : ln.t;
        fxEvents.push({ t: tt, type: f.type, line: ln.idx, ci });
      }
      if (ln.cls.drunk) drunk.push([ln.t, ln.end]);
    }
    fxEvents.sort((a, b) => a.t - b.t);

    // 6) 片头标题
    const firstLyric = lines.length ? lines[0].t : dur;
    const introSec = secs[0] && secs[0].type === 'intro' ? secs[0] : null;
    let tStart = g.time(Math.max(0, Math.ceil(g.pos(0.6))));
    let titleEnd = Math.min(firstLyric - 0.4, introSec ? introSec.end - 0.2 : tStart + 16 * g.per(0), tStart + 20 * g.per(0));
    if (titleEnd - tStart < 4) titleEnd = Math.min(dur * 0.3, tStart + 6);
    const b0 = Math.ceil(g.pos(tStart) - 1e-6);
    const avail = g.pos(titleEnd) - b0;
    const stepB = avail >= 12 ? 2 : 1;
    const stamps = [0, 1, 2].map((k) => g.time(b0 + k * stepB));
    const title = { start: tStart, stamps, seal: g.time(b0 + 3 * stepB), sub: g.time(b0 + 4 * stepB), end: Math.max(titleEnd, g.time(b0 + 5 * stepB)), credits };

    return {
      duration: dur, segments: segs, lines, fx: fxEvents, drunk, title: sb && sb.titleCard === false ? null : title,
      end: sb && sb.endCard === false ? null : { start: endStart, fade: dur - 1.6 },
      sections: secs,
      sceneAt,
      lineAt(t) {
        let r = null;
        for (const l of lines) { if (l.t - 0.05 <= t && t < l.end + 0.5) r = l; if (l.t > t) break; }
        return r;
      },
    };
  }
  XYT.buildTimeline = buildTimeline;

  // 示例歌词（自拟，非原曲歌词）——用于演示每种意象
  XYT.DEMO_LINES = [
    '山外青山路漫漫', '孤舟一叶渡江河', '月照荷塘夜未眠', '举杯邀月醉一场', '梦里蝶舞几回还',
    '提笔写下旧时诗', '仗剑江湖斩风波', '御风踏云九天上', '落花满地是红尘', '烟雨蒙蒙泪两行',
    '一根红线牵两心', '往事如灯照流年', '一笑逍遥天地宽',
  ];
})();
