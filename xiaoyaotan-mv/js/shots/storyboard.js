/* 分镜表：每句歌词对应的镜头 id、歌词区位与转场（不含歌词文字）。由分镜流程生成。 */
(function () {
  'use strict';
  window.XYT = window.XYT || {};
  XYT.STORYBOARD = {
    "titleCard": false,
    "endCard": false,
    "intro": [
      {
        "id": "in1_ink",
        "at": 0.0
      },
      {
        "id": "in2_yuhang",
        "at": 7.31
      },
      {
        "id": "in3_reflection",
        "at": 13.97
      },
      {
        "id": "in4_return",
        "at": 17.3
      },
      {
        "id": "in5_banner",
        "at": 23.98
      }
    ],
    "interlude": [
      {
        "id": "x1_frostpond",
        "at": 135.85
      },
      {
        "id": "x2_nuwa",
        "at": 143.98
      },
      {
        "id": "x3_scroll",
        "at": 153.99
      }
    ],
    "outro": [
      {
        "id": "o1_spring",
        "at": 295.85
      },
      {
        "id": "o2_depart",
        "at": 300.66
      },
      {
        "id": "o3_jetty",
        "at": 303.99
      },
      {
        "id": "o4_seal",
        "at": 310.68
      }
    ],
    "lines": {
      "1": "va1_silence",
      "2": "va2_kite",
      "3": "va3_eave",
      "4": "va4_wall",
      "5": "va5_whisper",
      "6": "va6_tide",
      "7": "va7_lookback",
      "8": "va8_maple",
      "9": "vb1_farewell",
      "10": "vb2_arena",
      "11": "vb3_gu",
      "12": "vb4_crossroad",
      "13": "vb5_flysword",
      "14": "vb6_bonfire",
      "15": "vb7_storyteller",
      "16": "vb8_drunkroof",
      "17": "c1_lotusboat",
      "18": "c1_swordarray",
      "19": "c1_ashroad",
      "20": "c1_stranger",
      "21": "c1_wallink",
      "22": "c1_caiyi",
      "23": "c1_butterflycandle",
      "24": "c1_maplestorm",
      "25": "vb21_ruins",
      "26": "vb22_stage",
      "27": "vb23_window",
      "28": "vb24_signpost",
      "29": "vb25_cliff",
      "30": "vb26_ashring",
      "31": "vb27_sunshower",
      "32": "vb28_gourdfall",
      "33": "c2_bloodmoon",
      "34": "c2_anu",
      "35": "c2_tower",
      "36": "c2_chains",
      "37": "c2_yueru",
      "38": "c2_tassel",
      "39": "c2_nuwalight",
      "40": "c2_redlight",
      "41": "c3_wake",
      "42": "c3_frostsword",
      "43": "c3_relics",
      "44": "c3_icelake",
      "45": "c3_snowcursive",
      "46": "c3_riverlanterns",
      "47": "c3_lastlamp",
      "48": "c3_allred"
    },
    "zones": {
      "1": "left",
      "2": "top",
      "3": "left",
      "4": "right",
      "5": "right",
      "6": "top",
      "7": "left",
      "8": "left",
      "9": "right",
      "10": "top",
      "11": "top",
      "12": "top",
      "13": "right",
      "14": "top",
      "15": "top",
      "16": "left",
      "17": "left",
      "18": "left",
      "19": "top",
      "20": "top",
      "21": "right",
      "22": "left",
      "23": "right",
      "24": "top",
      "25": "right",
      "26": "left",
      "27": "top",
      "28": "top",
      "29": "right",
      "30": "right",
      "31": "top",
      "32": "left",
      "33": "top",
      "34": "left",
      "35": "right",
      "36": "top",
      "37": "right",
      "38": "left",
      "39": "top",
      "40": "left",
      "41": "left",
      "42": "right",
      "43": "left",
      "44": "top",
      "45": "right",
      "46": "left",
      "47": "top",
      "48": "left"
    },
    "trans": {
      "in2_yuhang": {
        "type": "ink",
        "dur": 1.2
      },
      "in3_reflection": "cut",
      "in4_return": "cut",
      "in5_banner": {
        "type": "wipe:wind",
        "dur": 0.5
      },
      "va1_silence": "cut",
      "va2_kite": "cut",
      "va3_eave": "cut",
      "va4_wall": "cut",
      "va5_whisper": "cut",
      "va6_tide": {
        "type": "iris",
        "dur": 0.6,
        "x": 520,
        "y": 420
      },
      "va7_lookback": "cut",
      "va8_maple": "cut",
      "vb1_farewell": "cut",
      "vb2_arena": "cut",
      "vb3_gu": {
        "type": "iris",
        "dur": 0.6,
        "x": 520,
        "y": 520
      },
      "vb4_crossroad": {
        "type": "wipe:rain",
        "dur": 0.7
      },
      "vb5_flysword": {
        "type": "wipe:cloud",
        "dur": 0.7
      },
      "vb6_bonfire": "cut",
      "vb7_storyteller": {
        "type": "scroll",
        "dur": 0.9
      },
      "vb8_drunkroof": "cut",
      "c1_lotusboat": {
        "type": "flash",
        "color": "#ffffff"
      },
      "c1_swordarray": "cut",
      "c1_ashroad": "cut",
      "c1_stranger": "cut",
      "c1_wallink": "cut",
      "c1_caiyi": {
        "type": "flash",
        "color": "#ffffff"
      },
      "c1_butterflycandle": {
        "type": "iris",
        "dur": 0.6,
        "x": 880,
        "y": 260
      },
      "c1_maplestorm": "cut",
      "x1_frostpond": {
        "type": "fade",
        "dur": 1.0
      },
      "x2_nuwa": {
        "type": "flash",
        "color": "#ffe9b0"
      },
      "x3_scroll": {
        "type": "scroll",
        "dur": 0.9
      },
      "vb21_ruins": "cut",
      "vb22_stage": {
        "type": "wipe:rain",
        "dur": 0.7
      },
      "vb23_window": "cut",
      "vb24_signpost": "cut",
      "vb25_cliff": "cut",
      "vb26_ashring": "cut",
      "vb27_sunshower": "cut",
      "vb28_gourdfall": "cut",
      "c2_bloodmoon": {
        "type": "flash",
        "color": "#ffffff"
      },
      "c2_anu": "cut",
      "c2_tower": "cut",
      "c2_chains": "cut",
      "c2_yueru": "cut",
      "c2_tassel": {
        "type": "wipe:dust",
        "dur": 0.7
      },
      "c2_nuwalight": {
        "type": "wipe:wave",
        "dur": 0.7
      },
      "c2_redlight": {
        "type": "flash",
        "color": "#ffffff"
      },
      "c3_wake": "cut",
      "c3_frostsword": "cut",
      "c3_relics": {
        "type": "wipe:snow",
        "dur": 0.7
      },
      "c3_icelake": {
        "type": "wipe:mist",
        "dur": 0.7
      },
      "c3_snowcursive": "cut",
      "c3_riverlanterns": "cut",
      "c3_lastlamp": "cut",
      "c3_allred": "cut",
      "o1_spring": {
        "type": "fade",
        "dur": 1.2
      },
      "o2_depart": "cut",
      "o3_jetty": {
        "type": "wipe:mist",
        "dur": 0.7
      },
      "o4_seal": {
        "type": "ink",
        "dur": 1.0
      }
    }
  };
  XYT.STORYBOARD_NAMES = {"in1_ink": "墨开山河", "in2_yuhang": "余杭晨雾", "in3_reflection": "篙点倒影", "in4_return": "白发归人", "in5_banner": "酒旗风起", "va1_silence": "铃静尘浮", "va2_kite": "风倦纸鸢", "va3_eave": "落日赖檐", "va4_wall": "日挂墙头", "va5_whisper": "喜堂耳语", "va6_tide": "潮声东去", "va7_lookback": "回首旧街", "va8_maple": "枫落成忆", "vb1_farewell": "推舟离岛", "vb2_arena": "擂台撕绸", "vb3_gu": "茶中蛊影", "vb4_crossroad": "岔路红线", "vb5_flysword": "御剑凌云", "vb6_bonfire": "篝火散席", "vb7_storyteller": "隔窗听书", "vb8_drunkroof": "醉卧入梦", "c1_lotusboat": "荷湖轻狂", "c1_swordarray": "万剑梦碎", "c1_ashroad": "负骨南行", "c1_stranger": "街头陌路", "c1_wallink": "题壁墨枯", "c1_caiyi": "彩依还蝶", "c1_butterflycandle": "蝶绕残烛", "c1_maplestorm": "枫天初雪", "x1_frostpond": "枫落秋池", "x2_nuwa": "女娲时轮", "x3_scroll": "长卷故地", "vb21_ruins": "孤舟归岛", "vb22_stage": "空台系绸", "vb23_window": "窗纸童年", "vb24_signpost": "路标无人", "vb25_cliff": "剑落晨崖", "vb26_ashring": "灰烬五座", "vb27_sunshower": "太阳雨童戏", "vb28_gourdfall": "檐下坠壶", "c2_bloodmoon": "血月拜月", "c2_anu": "阿奴弑父", "c2_tower": "塔中符牢", "c2_chains": "锁链相认", "c2_yueru": "月如回眸", "c2_tassel": "塔倾红穗", "c2_nuwalight": "孤光抗魔", "c2_redlight": "怀中红光", "c3_wake": "雪巅长啸", "c3_frostsword": "霜剑为碑", "c3_relics": "雪原遗物", "c3_icelake": "冰池倒影", "c3_snowcursive": "雪上题名", "c3_riverlanterns": "湖灯送人", "c3_lastlamp": "十年孤灯", "c3_allred": "天地皆红", "o1_spring": "雪融春回", "o2_depart": "渡口反打", "o3_jetty": "渡头小女孩", "o4_seal": "落款钤印"};
})();
