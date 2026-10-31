# 点宋 Punctum Song SC · 中文扩展方案

Punctum Moderne 中文版的设计方案和原型。状态：**方案页为草案 0.1（2026-10），五项决定尚待确认；起稿原型已到 0.2（2026-10-31）**，方案页还没按 0.2 改写。

## 方案要点

- **立论。** 宋体的横细竖粗与 Didone 的竖向重音是同一套笔画逻辑。横画用发丝点，竖画用主笔点，点画与捺脚用球点，沿用 `src/radii.py` 的点径模型。
- **新增一类点：喙点。** 横末的喙、横折的肩。CNTR 100 时与球点同大，CNTR 0 时消失，于是 CNTR 轴的两端分别是点宋与点黑。
- **网格每 em 24 点。** 3 个中文点距 = 2 个拉丁点距，两套网格每 1/8 em 对齐；UPM 2400，中文点距 100。
- **笔画语法。** 永字八法各有固定点型；平行笔画之间至少空 1 行，24 点网格最多排 11 道。
- **起稿与构建。** 由思源宋体自动起稿（成品因此以 OFL 发布，名称不含保留名 “Source”）；每个点是对 5 个可变点字形的复合引用。
- **排期。** P0 试点 300 字 → P1 一级字 3,500 → P2 GB 2312 6,763 → P3 通用规范 8,105。

## 文件

```text
proposal/src.html    方案页源文件：实时点阵转换器、三轴调节器、网格对比、笔画语法、排期与风险
proposal/build.py    内嵌 Punctum Moderne 字体和拉丁点数据 → proposal/punctum-song.html（及本地预览 preview.html）
proto.py             转换器原型 0.1：宋体光栅 → 距离场 → 笔画中线 → 24/em 点阵 → 点类
proto2.py            起稿原型 0.2：骨架沿笔画放点、平行笔画分行、衬线归入喙点、奇数列
sizetest.py          用 fontTools 实际构建两种可变字体（逐点轮廓 / 点字形复合引用），比较体积
```

```bash
python3 cjk/proposal/build.py     # 方案页
python3 cjk/proto.py              # 网格对比图 → cjk/out/grids.png（需要 macOS 宋体-简）
python3 cjk/proto2.py <NotoSerifCJKsc-Regular.otf> 永三的   # 0.2 起稿，打印点阵
python3 cjk/sizetest.py           # 体积实测 → cjk/out/size_*.ttf / .woff2
```

方案页在浏览器里用 Google Fonts 的 Noto Serif SC（即思源宋体，OFL）实时起稿。`proto.py` 和 `sizetest.py` 为了本地快速试验，读的是 macOS 自带的宋体-简，所以它们的输出（`cjk/out/`）只留在本地，不进仓库。`proto2.py` 直接读思源宋体（Noto Serif CJK SC），字体文件不随仓库提供，需要另外下载。

## 起稿 0.2

0.1 的转换器按格子取样笔画中线，斜笔会同时落进相邻两格，衬线也被起稿成一簇碎点。0.2 改为：

- **骨架放点。** 把笔画细化成单像素骨架，拆成笔画段，沿每段按点距放点，一道笔画只有一行点。
- **笔画分行。** 横画、竖画按间距约束分配到行和列，重叠的平行笔画之间至少空 1 行；其余部分按这些位移沿笔画插值。位移在笔画末端 2.5 个点距内退回原位，两端都不连别的笔画的短笔画（彡的撇、点）不跟着移。
- **衬线。** 竖画起笔的斜角、横画两端的弯尖从骨架上剪掉；横末的喙和横折的肩各收成一个喙点，CNTR 0 时消失。
- **奇数列。** 列中心在整点距 1 … 23 上，em 中线是一列，十、中、木的竖画不用偏半格。行不变。

一级字 3,500 字的实测（两版用同一套检查脚本，思源宋体起稿，未经人工修整）：

| | 0.1 | 0.2 |
| --- | --- | --- |
| 笔画排成两点宽（连续 4 点以上） | 2,965 字（85%） | 7 字（0.2%） |
| 平行笔画落在相邻行或列 | 3,189 字（91%） | 3 字（0.1%） |
| 笔画偏离原位 1 个点距以上的字 | 0% | 1% |
| 每字点数（平均） | 186 | 111 |
| 正文灰度，24 px，相对思源宋体 | 0.55 | 0.36 |
| 3,500 字可变字体 WOFF2 | 0.49 MB | 0.30 MB |

还没解决的：矗、囊超过 11 道平行笔画的上限，要逐字重构；正文偏淡，中文要另定点径，和拉丁混排时 48 px 以上约需 wght 540–580。字样对比见 `docs/snapshots/2026-10-31-点宋起稿0.2对比.png`。

## 实测

常用 300 字、24/em、12 个母版（wght 3 × CNTR 2 × opsz 2），线性外推到 3,500 字：

| 构建方式 | TTF | WOFF2 |
| --- | --- | --- |
| 逐点轮廓（拉丁版现做法） | 约 100 MB | 约 6.6 MB |
| 点字形复合引用 | 约 4.9 MB | 约 0.55 MB |

---

**English.** Design proposal and prototypes for a CJK companion to Punctum Moderne ("Punctum Song SC"): a 24-dots-per-em lattice locked 3:2 to the Latin grid, a fifth dot class (the Song beak) that vanishes at CNTR 0 so the contrast axis runs from Song to Hei, a stroke grammar for the eight basic strokes, auto-drafting from Source Han Serif, and a composite-glyph build measured at about 0.55 MB WOFF2 for 3,500 characters. Status: proposal draft 0.1, decisions pending. `proto2.py` is the 0.2 drafting prototype (skeleton-traced dots, row allocation for parallel strokes, serifs folded into the beak class, an odd column lattice); over the 3,500 level-1 characters it cuts two-dot-wide strokes from 85% to 0.2% and builds to 0.30 MB WOFF2.
