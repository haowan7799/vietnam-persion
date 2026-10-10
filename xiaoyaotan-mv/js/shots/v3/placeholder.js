/* 第三版分镜：占位镜头（正式镜头在各组文件里重新注册覆盖）。不含歌词。 */
(function () {
  'use strict';
  const A = XYT.art, W = A.W, H = A.H;
  const P = {
    i1_inkdawn: { name: "墨晓", zone: 'bottom', night: false, c0: '#f1ebdd', c1: '#6f8190' },
    i2_river: { name: "一叶孤舟", zone: 'bottom', night: false, c0: '#e9e4d6', c1: '#58707c' },
    i3_whitehair: { name: "白发归人", zone: 'left', night: false, c0: '#efe6d2', c1: '#6c7f86' },
    a1_pavilion: { name: "长亭秋风", zone: 'right', night: false, c0: '#e8dcc4', c1: '#7d6a55' },
    a2_wallsun: { name: "夕阳墙头", zone: 'right', night: false, c0: '#f6c27a', c1: '#b8483a' },
    a3_tide: { name: "伊人潮声", zone: 'top', night: true, c0: '#0f1b2e', c1: '#7e9bb8' },
    a4_maplepond: { name: "回首枫落", zone: 'left', night: false, c0: '#f3c27c', c1: '#8e2a1e' },
    b1_bridge: { name: "伞落桥尽", zone: 'top', night: false, c0: '#c9cfd0', c1: '#4d575c' },
    b2_puppet: { name: "命运戏偶", zone: 'top', night: true, c0: '#f4d9a3', c1: '#a8422f' },
    b3_cliffcranes: { name: "凌云鹤散", zone: 'right', night: false, c0: '#fbe3a8', c1: '#8fb3c0' },
    b4_teahouse: { name: "笑传醉梦", zone: 'top', night: true, c0: '#1b1a26', c1: '#f3c779' },
    c1_lotus: { name: "荷塘狂歌", zone: 'left', night: false, c0: '#bfe3e0', c1: '#2f6e57' },
    c1_rustsword: { name: "剑锈梦破", zone: 'left', night: true, c0: '#2a2f45', c1: '#c9785a' },
    c1_oldroad: { name: "古道西风", zone: 'top', night: false, c0: '#f4b26a', c1: '#7a3b2e' },
    c1_citywall: { name: "城头望尘", zone: 'right', night: true, c0: '#2a2238', c1: '#c8604a' },
    c1_inkdesk: { name: "墨尽愁书", zone: 'right', night: true, c0: '#1d2230', c1: '#e9dcc0' },
    c1_guqin: { name: "曲终人散", zone: 'top', night: true, c0: '#1a1c28', c1: '#e3b46a' },
    c1_candle: { name: "残烛争晖", zone: 'left', night: false, c0: '#2a1e1c', c1: '#c0392b' },
    c1_fireworks: { name: "烟火成红", zone: 'bottom', night: true, c0: '#0b0f1e', c1: '#f4f0e6' },
    x1_frozen: { name: "冰湖孤灯", zone: 'bottom', night: true, c0: '#0d1626', c1: '#8ea6bf' },
    x2_bell: { name: "寺钟雪晓", zone: 'bottom', night: false, c0: '#e8ecef', c1: '#5a6b78' },
    x3_fishing: { name: "寒江独钓", zone: 'bottom', night: false, c0: '#f2f3f2', c1: '#8e979c' },
    d1_gate: { name: "灯熄门掩", zone: 'top', night: true, c0: '#14161f', c1: '#b8282c' },
    d2_weiqi: { name: "雪落棋局", zone: 'top', night: false, c0: '#e9ecee', c1: '#6c757c' },
    d3_geese: { name: "雁阵剑尘", zone: 'bottom', night: false, c0: '#d9d2c3', c1: '#5c5246' },
    d4_hilldrunk: { name: "山头醉梦", zone: 'right', night: true, c0: '#0f1424', c1: '#f2b765' },
    e1_stormpeak: { name: "雷峰狂笑", zone: 'right', night: true, c0: '#0b0e16', c1: '#4d5a70' },
    e2_ropebridge: { name: "断桥", zone: 'top', night: false, c0: '#151a24', c1: '#6a7686' },
    e3_temple: { name: "破庙夜雨", zone: 'left', night: true, c0: '#0e1218', c1: '#4a5562' },
    e4_redsand: { name: "红尘风沙", zone: 'top', night: false, c0: '#3a1a14', c1: '#c2532e' },
    e5_inkrain: { name: "墨尽雨洗", zone: 'bottom', night: true, c0: '#1a1d24', c1: '#cfd3d6' },
    e6_peony: { name: "残红", zone: 'left', night: false, c0: '#d9dcdc', c1: '#3f5a48' },
    e7_fireflies: { name: "萤火消晨", zone: 'left', night: true, c0: '#0d1626', c1: '#5d7a8a' },
    e8_riverlanterns: { name: "河灯红雪", zone: 'top', night: true, c0: '#1a1424', c1: '#f2a35a' },
    f1_snowhut: { name: "雪庐笑饮", zone: 'left', night: true, c0: '#0f1522', c1: '#e7ecf3' },
    f2_icicle: { name: "冰棱断", zone: 'left', night: false, c0: '#dfe9f1', c1: '#5b7690' },
    f3_footprints: { name: "雪径无人", zone: 'top', night: false, c0: '#f4f6f8', c1: '#8fa6bf' },
    f4_frostwindow: { name: "霜窗", zone: 'bottom', night: true, c0: '#10141f', c1: '#f3c47a' },
    f5_plumshadow: { name: "梅影墨尽", zone: 'left', night: true, c0: '#dfe4ec', c1: '#3a3540' },
    f6_lotusboat: { name: "残荷雪舟", zone: 'top', night: false, c0: '#d8dde0', c1: '#4b4f52' },
    f7_sundial: { name: "白首如烛", zone: 'top', night: false, c0: '#eef1f4', c1: '#7d8a99' },
    f8_redplain: { name: "天地皆红", zone: 'top', night: false, c0: '#e7eaee', c1: '#3b3f4a' },
    o1_thaw: { name: "春回", zone: 'bottom', night: false, c0: '#eef3e8', c1: '#7fb08a' },
    o2_depart: { name: "远去", zone: 'bottom', night: false, c0: '#f4efe6', c1: '#f2b8c4' },
    o3_seal: { name: "落款", zone: 'bottom', night: false, c0: '#f1ebdd', c1: '#b8322a' },
  };
  for (const id in P) {
    const p = P[id];
    XYT.registerShot(id, { name: p.name, zone: p.zone, night: p.night, text: p.night ? '#f2ead8' : '#2a2622', shadow: p.night ? 'rgba(6,8,14,0.85)' : 'rgba(250,246,236,0.85)', accent: '#c8452f',
      draw(g, c) {
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, p.c0); gr.addColorStop(1, p.c1);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.font = '28px serif'; g.textAlign = 'center';
        g.fillText(p.name + '（制作中）', W / 2, H / 2);
      } });
  }
})();
