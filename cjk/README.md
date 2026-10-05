# 点宋 Punctum Song SC · 中文扩展方案

Punctum Moderne 中文版的设计方案和原型。状态：**草案 0.1（2026-10）**，方案里的五项决定尚待确认。

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
proto.py             转换器原型：宋体光栅 → 距离场 → 笔画中线 → 24/em 点阵 → 点类
sizetest.py          用 fontTools 实际构建两种可变字体（逐点轮廓 / 点字形复合引用），比较体积
```

```bash
python3 cjk/proposal/build.py     # 方案页
python3 cjk/proto.py              # 网格对比图 → cjk/out/grids.png（需要 macOS 宋体-简）
python3 cjk/sizetest.py           # 体积实测 → cjk/out/size_*.ttf / .woff2
```

方案页在浏览器里用 Google Fonts 的 Noto Serif SC（即思源宋体，OFL）实时起稿。`proto.py` 和 `sizetest.py` 为了本地快速试验，读的是 macOS 自带的宋体-简，所以它们的输出（`cjk/out/`）只留在本地，不进仓库。

## 实测

常用 300 字、24/em、12 个母版（wght 3 × CNTR 2 × opsz 2），线性外推到 3,500 字：

| 构建方式 | TTF | WOFF2 |
| --- | --- | --- |
| 逐点轮廓（拉丁版现做法） | 约 100 MB | 约 6.6 MB |
| 点字形复合引用 | 约 4.9 MB | 约 0.55 MB |

---

**English.** Design proposal and prototypes for a CJK companion to Punctum Moderne ("Punctum Song SC"): a 24-dots-per-em lattice locked 3:2 to the Latin grid, a fifth dot class (the Song beak) that vanishes at CNTR 0 so the contrast axis runs from Song to Hei, a stroke grammar for the eight basic strokes, auto-drafting from Source Han Serif, and a composite-glyph build measured at about 0.55 MB WOFF2 for 3,500 characters. Status: draft 0.1, decisions pending.
