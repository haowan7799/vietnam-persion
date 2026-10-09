# 绘画工具包约定（kit）

镜头（shot）由工具包拼出来。工具包分三块：人物 `XYT.fig`、场景 `XYT.env`、特效 `XYT.vfx`。所有镜头都必须遵守下面的约定，才能逐帧渲染、任意跳转、风格统一。

## 坐标与时间

- 逻辑画布固定 1280×720（`XYT.art.W`、`XYT.art.H`）。绘制函数拿到的 `g` 已经缩放到逻辑坐标，直接按 1280×720 画。
- 镜头的 `draw(g, c)` 每帧调用一次。`c` 的字段：
  - `t` 歌曲时间（秒），`lt` 本镜头内的时间（可能为负：转场时下一个镜头会提前开始画），`dur` 镜头长度，`p` 进度 0..1。
  - `b` 节拍信息：`b.i` 当前拍序号，`b.ph` 拍内相位 0..1，`b.since` 距上一拍秒数，`b.period` 一拍时长，`b.down` 当前拍是否强拍，`b.sinceDown` 距上一强拍秒数，`b.bar` 小节号，`b.x` 连续拍位置，`b.str` 这一拍的强度 0..1。
  - `be(d)`：拍点包络 `exp(-since/d)`，乘了拍强度；`de(d)`：强拍包络。
  - `grid`：节拍网格，`grid.time(i)` 第 i 拍的时间，`grid.isDown(i)`。
  - `inten` 段落强度（主歌约 0.55，副歌 1），`rms`/`onset`/`low`/`high` 当前音频能量 0..1。
- **无状态**：画面只能由 `t`（和 `c` 里的量）算出来。不准用 `Math.random()`，不准在帧之间保存状态。随机用 `XYT.art.hash(n)`、`XYT.art.h2(a, b)`、`XYT.art.rng(seed)`（每帧用固定种子重建）。粒子位置写成时间的函数，比如 `y = (y0 + t * speed) % H`。
- 拍点同步：要“踩点”的动作，用 `c.b.since`、`c.be()`、`c.de()` 或 `c.grid.time(c.b.i - k)` 算出来。

## 性能

- 目标：一个镜头在无 GPU 的无头 Chromium 里，1280×720 每帧不超过 15 毫秒绘制。
- 静态或慢变的东西（远山、建筑、树、雕像）先画进离屏画布再贴：用 `XYT.kit.cache(key, w, h, scale, drawFn)`，返回按当前分辨率缓存的 canvas（见 `js/kit/core.js`）。
- 不要在循环里用 `ctx.filter`、`shadowBlur`；发光用 `XYT.art.glow()`（预渲染的径向渐变贴图）配合 `globalCompositeOperation = 'lighter'`。
- 粒子数量：同屏 100–300 个小粒子以内。

## 风格

- 中国水墨加古风插画：至少 4 个景深层（远景淡、偏冷偏蓝，近景深、实），要有留白，雾气分层。
- 人物不画五官，画剪影和衣袂。用轮廓光（rim light）和一处服饰色块来区分角色。脸部只需要侧影轮廓。
- 每个镜头至少一处“唯美”元素：丁达尔光、光斑、花瓣或雪、飘带、水面倒影、薄雾、萤火。
- 动起来：衣袂、发带、飘带随风；镜头有缓慢推拉或平移；粒子有景深（近大远小，近快远慢）。
- 色彩按镜头设定，不要整片灰。暗场也要有一个暖色或冷色的亮点。

## 人物 `XYT.fig`（js/kit/figures.js）

`XYT.fig.draw(g, who, x, y, s, t, opts)`：在脚底 (x, y) 画人物，`s=1` 时身高约 180 像素。

- `who`：`'xiaoyao'`（李逍遥）、`'linger'`（赵灵儿）、`'yueru'`（林月如）、`'anu'`（阿奴）、`'tangyu'`（唐钰）、`'jiujianxian'`（酒剑仙）、`'laolao'`（姥姥）、`'baiyue'`（拜月教主）、`'caiyi'`（彩依）、`'jinyuan'`（刘晋元）、`'storyteller'`（说书人）、`'villager'`（路人）。
- `opts`：
  - `facing`：1 朝右，-1 朝左；`pose`（见下）；`wind` 0..1；`alpha`；
  - `stage`（仅逍遥）：`'youth'` 店小二、`'hero'` 侠客（默认）、`'old'` 白发、`'wedding'` 婚服；`form`（仅灵儿）：`'girl'`、`'nuwa'`（蛇尾）；
  - `ink` 主体颜色（默认深墨），`accent` 服饰色，`rim` 轮廓光颜色（null 不画），`glow` 周身光 0..1；
  - `prop`：`'sword'`、`'gourd'`、`'umbrella'`、`'whip'`、`'staff'`、`'lantern'`、`'fan'`、`'none'`；
  - `whiteHair`、`hairLoose`：布尔。
- `pose`：`'stand'`、`'walk'`（用 `t` 驱动步伐）、`'sit'`、`'kneel'`、`'lie'`、`'drink'`、`'swordUp'`、`'swordPoint'`、`'flySword'`（站在飞剑上）、`'lookBack'`、`'reach'`（伸手）、`'whisper'`（侧身附耳）、`'embrace'`（单人姿势，两人相拥时用两个人物相对放置）、`'fall'`、`'dance'`、`'laugh'`（仰天）。
- 角色默认配色（来自研究报告）：李逍遥月白、浅青长衫，蓝色发带，剑穗红；赵灵儿白、浅粉、淡紫轻纱，长发、小花簪；林月如正红劲装，高马尾，红剑穗；阿奴苗银头冠，彩绣短衣，铃铛；唐钰青蓝；酒剑仙灰褐道袍敞怀、蓬发胡须、大酒葫芦、背剑；姥姥银发高髻、素色宫装、拄杖；拜月教主墨黑暗紫长袍、高冠、月牙图腾；彩依淡黄、粉色、蝶翼纹。

## 场景 `XYT.env`（js/kit/env.js）

每个函数都画一层或一组层，参数是对象，所有尺寸以 1280×720 逻辑坐标为准。时间相关的效果接收 `t`。

- 天空与光：`sky(g, {top, mid, bottom})`、`sun(g, {x, y, r, color, glow})`、`moon(g, {x, y, r, phase, glow})`、`stars(g, {t, n, seed, maxY})`、`clouds(g, {t, y, color, speed, scale, alpha, seed})`、`cloudSea(g, {t, y, color, shade, speed})`。
- 地形：`mountains(g, {layers: [{color, alpha, y, scaleY, speed}], t})`（用 `XYT.art.drawMountain`）、`stonePeak(g, {x, y, h, color})`（鼎湖峰式石笋）、`grassRoad(g, {t, color, wind})`（古道荒坡）、`snowfield(g, {...})`、`shore(g, {...})`。
- 水：`water(g, {y, top, bottom, t, reflectFn})`、`waves(g, {t, y, color, dir})`（潮水，方向可选向东）、`ripples(g, {x, y, t0, t})`。
- 植物：`peachTree(g, {x, y, s, sway})`、`mapleTree(g, {...})`、`pines(g, {...})`、`bamboo(g, {t, x0, x1, color})`、`lotus(g, {x, y, s, open})`、`reeds(g, {t, ...})`、`dandelions(g, {...})`。
- 建筑：`jiangnanTown(g, {t, y, color, lit})`（白墙黛瓦、马头墙）、`courtyardWall(g, {x, y, w, color})`（带瓦檐的墙头）、`inn(g, {...})`（客栈，酒旗）、`dock(g, {...})`、`palace(g, {...})`（水月宫，白玉楼阁、轻纱）、`arena(g, {...})`（擂台、红绸）、`tower(g, {x, y, h, broken})`（锁妖塔，可倒塌）、`temple(g, {...})` 与 `nuwaStatue(g, {...})`、`altar(g, {...})`（拜月祭坛、图腾柱）、`teahouse(g, {...})`、`weddingHall(g, {...})`、`candleRoom(g, {...})`。
- 道具：`candle(g, {x, y, h, burn, t})`、`swordInGround(g, {...})`、`wineJar(g, {...})`、`gourd(g, {...})`、`scroll(g, {...})`、`inkstone(g, {...})`、`chessboard(g, {...})`、`pendant(g, {...})`、`lantern(g, {...})`。

## 特效 `XYT.vfx`（js/kit/vfx.js）

都接收 `(g, c, opts)`，`c` 是镜头上下文（用 `c.t`、`c.b` 等做动画与拍点同步）。

`godRays`（丁达尔光）、`bokeh`（光斑）、`petals`（`kind: 'peach'|'plum'|'maple'|'lotus'`）、`snow`（`red` 0..1，白雪变红）、`fireflies`、`butterflies`、`birds`、`ribbons`（飘带）、`inkBloom`（墨晕扩散）、`dust`、`rain`、`lightning`、`ripples`、`shatter`（碎裂）、`embers`、`sparks`、`timeVortex`（时光漩涡）、`glowOrbs`、`smoke`、`fluff`（红蒲公英絮）、`tear`、`flame`、`threads`（命运丝线）、`swordQi`（剑气）、`grade(g, preset)`（整体调色：`'autumn'`、`'dusk'`、`'night'`、`'storm'`、`'snow'`、`'blood'`、`'gold'`、`'dream'`）。

## 镜头注册

```js
XYT.registerShot('va1_years', {
  name: '岁月回响',          // 分镜表里显示的名字
  zone: 'right',            // 歌词区：left / right / top / bottom
  night: true,              // 暗场（影响字幕底色与转场）
  text: '#f4e8c8', shadow: 'rgba(8,10,20,0.9)', accent: '#e6b85c',  // 歌词颜色
  bloom: 0.45,              // 可选：柔光强度
  draw(g, c) { /* ... */ },
});
```

预览：`node tools/preview-shot.cjs va1_years --times 0.5,2,4,6 --text "示例" --out /tmp/x.png`，然后打开图片检查。
