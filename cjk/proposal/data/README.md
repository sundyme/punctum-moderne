# 方案页字形数据

`dots-0.2.json` 是方案页的输入，包含 3,518 个字符的 24/em 点阵，以及「永国囊鬱」在 16/em、32/em 的对照。汉字均为自动草稿；14 个标点由 `data.py` 手工试排，另外「」《》由轮廓起稿。它不是可发布的成品字体。

## 来源与许可

- 字形源：Noto Serif CJK SC Regular 2.003，字体内置版权为 `© 2017-2024 Adobe (http://www.adobe.com/).`，许可 SIL OFL 1.1。完整许可随本目录的 `OFL.txt` 保留；构建出的单文件方案页也内嵌完整文本。
- 本目录点阵是该字体的衍生数据，按 SIL OFL 1.1 提供。源字体本身不随仓库分发；`source` 字段记录字体名称、版本、版权、许可和 SHA-256。
- `tongyong-l1.txt` 是《通用规范汉字表》的一级字 3,500 字，按表序排列，**不是字频排序**。本次整理自 `lunatao/chinese_character` 的转录，去除转录附带的脚注标记，仅保留码位序列；未复制该项目程序。发布字体前仍应与官方字表逐字校核，不能把字表顺序当成语料频次证据。
- 页内 Google Fonts 的 Noto Serif SC 用于原形叠加和未内嵌字的 0.1 实时转换。内嵌 0.2 点阵不依赖网络字体成功加载。

## 重建

从仓库根目录运行（Python 需要 numpy、Pillow、fontTools）：

```bash
python3 cjk/proposal/data.py /path/to/NotoSerifCJKsc-Regular.otf
```

```bash
python3 cjk/proposal/build.py
```

数据生成约需数分钟，使用至多 10 个 CPU worker。正式使用其他版本或字体前，必须重新确认许可、笔宽阈值与视觉结果，并更新随附版权。生成器读取实际字体元数据，不再硬写来源版本。

## 编码

每字 23 列 × 24 行，列中心为 1…23，行中心为 j+½。552 个字节按行存放，0 为空，1…5 依次对应发丝、过渡、主笔、球点、喙点。依 `chars` 顺序拼接后使用 raw DEFLATE、Base64 编码。`grid` 存储其他密度的 `[列, 行, 点类]` 数组，Python 喙点值为 1.31。

中文点径候选表位于 `proposal/src.html` 的 `CJK_R`。点阵数据只记录位置和点类，不记录半径；旧体积实验与 `proto2.rad()` 仍使用拉丁半径模型，不能声称已经构建了采用新点径的发布字体。
