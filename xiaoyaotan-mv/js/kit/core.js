/* 逍遥叹 · 音乐动画 —— 工具包核心：按分辨率缓存的离屏贴图与常用绘制助手 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const kit = (XYT.kit = XYT.kit || {});
  const store = new Map();

  // 静态或慢变的图层先画进离屏画布；按当前渲染倍率缓存，换分辨率时自动重建
  kit.cache = function (key, w, h, scale, fn) {
    const S = (XYT.sprites && XYT.sprites.S) || 1;
    const sc = S * (scale || 1);
    const k = key + '@' + sc.toFixed(3);
    let c = store.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * sc));
      c.height = Math.max(1, Math.round(h * sc));
      const g = c.getContext('2d');
      g.scale(sc, sc);
      fn(g);
      c.lw = w; c.lh = h;
      store.set(k, c);
    }
    return c;
  };
  kit.blit = (g, c, x, y, w, h) => g.drawImage(c, x, y, w == null ? c.lw : w, h == null ? c.lh : h);
  kit.lin = (g, x0, y0, x1, y1, stops) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    return gr;
  };
  kit.rad = (g, x, y, r0, r1, stops) => {
    const gr = g.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    return gr;
  };
  kit.lighter = (g, fn) => { const op = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; fn(); g.globalCompositeOperation = op; };
  kit.alpha = (g, a, fn) => { const o = g.globalAlpha; g.globalAlpha = o * a; fn(); g.globalAlpha = o; };
  // 慢速推拉镜头：围绕 (cx, cy) 缩放并平移，返回时请 g.restore()
  kit.camera = (g, c, o = {}) => {
    const { W, H } = XYT.art;
    const p = Math.max(0, Math.min(1, c.p));
    const z = (o.z0 ?? 1.0) + ((o.z1 ?? 1.06) - (o.z0 ?? 1.0)) * p;
    const dx = ((o.x1 ?? 0) - (o.x0 ?? 0)) * p + (o.x0 ?? 0);
    const dy = ((o.y1 ?? 0) - (o.y0 ?? 0)) * p + (o.y0 ?? 0);
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
    g.save();
    g.translate(cx + dx, cy + dy); g.scale(z, z); g.translate(-cx, -cy);
  };
})();
