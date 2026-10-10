/* 第三版分镜表：每句歌词对应的镜头 id（一镜可跨两句）、歌词区位与转场（不含歌词文字）。 */
(function () {
  'use strict';
  window.XYT = window.XYT || {};
  XYT.STORYBOARD = {
    "titleCard": false,
    "endCard": false,
    "duration": 313.6,
    "intro": [
      {
        "id": "i1_inkdawn",
        "at": 0.0
      },
      {
        "id": "i2_river",
        "at": 10.64
      },
      {
        "id": "i3_whitehair",
        "at": 17.3
      }
    ],
    "interlude": [
      {
        "id": "x1_frozen",
        "at": 135.85
      },
      {
        "id": "x2_bell",
        "at": 143.98
      },
      {
        "id": "x3_fishing",
        "at": 153.99
      }
    ],
    "outro": [
      {
        "id": "o1_thaw",
        "at": 295.85
      },
      {
        "id": "o2_depart",
        "at": 303.99
      },
      {
        "id": "o3_seal",
        "at": 310.68
      }
    ],
    "lines": {
      "1": "a1_pavilion",
      "3": "a2_wallsun",
      "5": "a3_tide",
      "7": "a4_maplepond",
      "9": "b1_bridge",
      "11": "b2_puppet",
      "13": "b3_cliffcranes",
      "15": "b4_teahouse",
      "17": "c1_lotus",
      "18": "c1_rustsword",
      "19": "c1_oldroad",
      "20": "c1_citywall",
      "21": "c1_inkdesk",
      "22": "c1_guqin",
      "23": "c1_candle",
      "24": "c1_fireworks",
      "25": "d1_gate",
      "27": "d2_weiqi",
      "29": "d3_geese",
      "31": "d4_hilldrunk",
      "33": "e1_stormpeak",
      "34": "e2_ropebridge",
      "35": "e3_temple",
      "36": "e4_redsand",
      "37": "e5_inkrain",
      "38": "e6_peony",
      "39": "e7_fireflies",
      "40": "e8_riverlanterns",
      "41": "f1_snowhut",
      "42": "f2_icicle",
      "43": "f3_footprints",
      "44": "f4_frostwindow",
      "45": "f5_plumshadow",
      "46": "f6_lotusboat",
      "47": "f7_sundial",
      "48": "f8_redplain"
    },
    "zones": {
      "1": "right",
      "2": "right",
      "3": "right",
      "4": "right",
      "5": "top",
      "6": "top",
      "7": "left",
      "8": "left",
      "9": "top",
      "10": "top",
      "11": "top",
      "12": "top",
      "13": "right",
      "14": "right",
      "15": "top",
      "16": "top",
      "17": "left",
      "18": "left",
      "19": "top",
      "20": "right",
      "21": "right",
      "22": "top",
      "23": "left",
      "24": "bottom",
      "25": "top",
      "26": "top",
      "27": "top",
      "28": "top",
      "29": "bottom",
      "30": "bottom",
      "31": "right",
      "32": "right",
      "33": "right",
      "34": "top",
      "35": "left",
      "36": "top",
      "37": "bottom",
      "38": "left",
      "39": "left",
      "40": "top",
      "41": "left",
      "42": "left",
      "43": "top",
      "44": "bottom",
      "45": "left",
      "46": "top",
      "47": "top",
      "48": "top"
    },
    "trans": {
      "i2_river": {
        "type": "wipe:mist",
        "dur": 1.0
      },
      "i3_whitehair": {
        "type": "fade",
        "dur": 0.8
      },
      "a1_pavilion": {
        "type": "fade",
        "dur": 0.8
      },
      "a2_wallsun": {
        "type": "fade",
        "dur": 0.7
      },
      "a3_tide": {
        "type": "fade",
        "dur": 0.9
      },
      "a4_maplepond": {
        "type": "fade",
        "dur": 0.8
      },
      "b1_bridge": {
        "type": "wipe:rain",
        "dur": 0.8
      },
      "b2_puppet": {
        "type": "iris",
        "dur": 0.7
      },
      "b3_cliffcranes": {
        "type": "fade",
        "dur": 0.7
      },
      "b4_teahouse": {
        "type": "fade",
        "dur": 0.8
      },
      "c1_lotus": {
        "type": "fog",
        "dur": 0.8
      },
      "c1_rustsword": "cut",
      "c1_oldroad": {
        "type": "fade",
        "dur": 0.6
      },
      "c1_citywall": "cut",
      "c1_inkdesk": {
        "type": "fade",
        "dur": 0.6
      },
      "c1_guqin": "cut",
      "c1_candle": {
        "type": "fade",
        "dur": 0.6
      },
      "c1_fireworks": "cut",
      "x1_frozen": {
        "type": "fade",
        "dur": 1.2
      },
      "x2_bell": {
        "type": "wipe:snow",
        "dur": 1.0
      },
      "x3_fishing": {
        "type": "fade",
        "dur": 1.0
      },
      "d1_gate": {
        "type": "fade",
        "dur": 0.8
      },
      "d2_weiqi": {
        "type": "fade",
        "dur": 0.7
      },
      "d3_geese": {
        "type": "fade",
        "dur": 0.7
      },
      "d4_hilldrunk": {
        "type": "fade",
        "dur": 0.8
      },
      "e1_stormpeak": {
        "type": "flash",
        "dur": 0.001,
        "color": "#ffffff"
      },
      "e2_ropebridge": "cut",
      "e3_temple": {
        "type": "wipe:rain",
        "dur": 0.7
      },
      "e4_redsand": {
        "type": "wipe:dust",
        "dur": 0.7
      },
      "e5_inkrain": "cut",
      "e6_peony": {
        "type": "fade",
        "dur": 0.6
      },
      "e7_fireflies": {
        "type": "fade",
        "dur": 0.6
      },
      "e8_riverlanterns": {
        "type": "fade",
        "dur": 0.7
      },
      "f1_snowhut": {
        "type": "fog",
        "dur": 0.8
      },
      "f2_icicle": "cut",
      "f3_footprints": {
        "type": "wipe:snow",
        "dur": 0.8
      },
      "f4_frostwindow": {
        "type": "fade",
        "dur": 0.7
      },
      "f5_plumshadow": {
        "type": "fade",
        "dur": 0.7
      },
      "f6_lotusboat": {
        "type": "fade",
        "dur": 0.7
      },
      "f7_sundial": {
        "type": "fade",
        "dur": 0.7
      },
      "f8_redplain": {
        "type": "fade",
        "dur": 0.7
      },
      "o1_thaw": {
        "type": "fade",
        "dur": 1.2
      },
      "o2_depart": {
        "type": "wipe:mist",
        "dur": 1.0
      },
      "o3_seal": {
        "type": "ink",
        "dur": 1.0
      }
    }
  };
  XYT.STORYBOARD_NAMES = {"i1_inkdawn": "墨晓", "i2_river": "一叶孤舟", "i3_whitehair": "白发归人", "a1_pavilion": "长亭秋风", "a2_wallsun": "夕阳墙头", "a3_tide": "伊人潮声", "a4_maplepond": "回首枫落", "b1_bridge": "伞落桥尽", "b2_puppet": "命运戏偶", "b3_cliffcranes": "凌云鹤散", "b4_teahouse": "笑传醉梦", "c1_lotus": "荷塘狂歌", "c1_rustsword": "剑锈梦破", "c1_oldroad": "古道西风", "c1_citywall": "城头望尘", "c1_inkdesk": "墨尽愁书", "c1_guqin": "曲终人散", "c1_candle": "残烛争晖", "c1_fireworks": "烟火成红", "x1_frozen": "冰湖孤灯", "x2_bell": "寺钟雪晓", "x3_fishing": "寒江独钓", "d1_gate": "灯熄门掩", "d2_weiqi": "雪落棋局", "d3_geese": "雁阵剑尘", "d4_hilldrunk": "山头醉梦", "e1_stormpeak": "雷峰狂笑", "e2_ropebridge": "断桥", "e3_temple": "破庙夜雨", "e4_redsand": "红尘风沙", "e5_inkrain": "墨尽雨洗", "e6_peony": "残红", "e7_fireflies": "萤火消晨", "e8_riverlanterns": "河灯红雪", "f1_snowhut": "雪庐笑饮", "f2_icicle": "冰棱断", "f3_footprints": "雪径无人", "f4_frostwindow": "霜窗", "f5_plumshadow": "梅影墨尽", "f6_lotusboat": "残荷雪舟", "f7_sundial": "白首如烛", "f8_redplain": "天地皆红", "o1_thaw": "春回", "o2_depart": "远去", "o3_seal": "落款"};
})();
