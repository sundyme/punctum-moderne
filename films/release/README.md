# 发布片 Release film

Punctum Moderne 的发布片，72 秒，1920×1080，60 fps，另有 32 秒的 9:16 社媒版。画面由自写的 WebGL2 点阵引擎逐帧渲染，没有用 HyperFrames；每一颗点都来自本仓库 `src/` 的字形数据。

成片下载见 [Releases · films-2026-10](https://github.com/sundyme/punctum-moderne/releases/tag/films-2026-10)：

| 文件 | 内容 |
| --- | --- |
| `Punctum-Moderne-Release-Final-ElevenLabs.mp4` | 72 秒正片，ElevenLabs 配乐按画面剪接，叠加画面同步的拟音层 |
| `Punctum-Moderne-Release-Final.mp4` | 72 秒正片，numpy 逐音合成的配乐 |
| `Punctum-Moderne-Social-9x16-v2.mp4` | 32 秒竖版社媒剪辑，可无缝循环 |

## 文件

```text
index.html / social.html   正片 / 社媒版的渲染页面（FILM.frame(t) 是 t 的纯函数）
assets/engine.js           WebGL2 实例化点渲染：材质、景深、运动模糊、辉光、合成后期
assets/film.js             正片 12 个章节
assets/social.part.js      社媒版场景；tools/build_social.py 把它和 film.js 合成 assets/social.js
assets/data.js             字形点阵、斜体、字偶，由 tools/export_data.py 从 ../../src 生成
assets/el/v4.mp3           选用的 ElevenLabs 配乐素材
tools/                     导出数据、配乐、混音、截帧、并行渲染
```

## 构建

```bash
python3 tools/export_data.py                 # 字形 → assets/data.js
python3 tools/build_social.py                # film.js + social.part.js → assets/social.js
python3 tools/subset.py                      # 宋体子集（仅 macOS，见下）
node tools/export_events.cjs && python3 tools/score.py            # numpy 配乐 → assets/score.wav
SCORE_ONLY=fx,keys SCORE_FOLEY=1 SCORE_OUT=assets/el/stem_foley.wav python3 tools/score.py
python3 tools/mix_el.py                      # ElevenLabs 配乐 + 拟音 → assets/score_el.wav
python3 -m http.server 8790 &                # 渲染脚本从这里读页面
PUPPETEER_CORE=/path/to/puppeteer-core node tools/render.cjs --workers 4 --sub 8 --out renders/release.mp4
```

渲染需要 Google Chrome、ffmpeg 和一份 `puppeteer-core`（用环境变量 `PUPPETEER_CORE` 指定位置）。社媒版加 `--social`。

## 未收录的文件

- **中文字幕字体。** 字幕用的是 macOS 自带的宋体-简（Songti SC）子集。系统字体不能再分发，所以 `assets/fonts/song-sub.woff2` 和 `songb-sub.woff2` 不在仓库里，请在 Mac 上运行 `tools/subset.py` 生成。
- **配乐 WAV。** `score.wav`、`score_el.wav`、`score_social.wav` 和各条分轨都能用上面的脚本重新生成，成片里也已包含，所以不收录。
- **帧与渲染中间文件**（`frames/`、`renders/`）。

---

**English.** The 72 s release film for Punctum Moderne (1080p60) and a 32 s 9:16 social cut, rendered frame by frame by a hand-written WebGL2 dot engine from the glyph data in `src/`. Finished films are attached to the [films-2026-10 release](https://github.com/sundyme/punctum-moderne/releases/tag/films-2026-10). The Songti SC caption subsets and the score WAVs are not included: generate them with `tools/subset.py` (macOS) and the score scripts above.
