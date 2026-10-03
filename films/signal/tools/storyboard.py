"""Build storyboard/storyboard.artifact.html from the keyframe JPEGs + the shot list."""
import base64
import html
import os

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.dirname(HERE)
SB = os.path.join(FILM, "storyboard")


def b64(path):
    return base64.b64encode(open(path, "rb").read()).decode()


FONT = b64(os.path.join(FILM, "assets", "fonts", "PunctumModerne-VF.woff2"))

# (key, bars, time, en, zh, picture, motion, transition, sound, color)
SHOTS = [
    (0, "1", "0:00–0:02", "SIGNAL", "信号",
     "黑场里一个紫色的点随底鼓脉动，每拍一次闪光、外扩一圈涟漪；背景是极淡的点阵网格。HUD（套准标、时间码、场次号）在第一帧就出现，贯穿全片。",
     "第 4 拍时，点分裂成一串。",
     "分裂出的点被横向甩出去，用甩镜拖影进入下一场。",
     "808 底鼓，一声电报“嘀”。", "#B9A4E8"),
    (1, "2", "0:02–0:04", "MORSE", "摩尔斯",
     "紫色的点和划拼出 PUNCTUM 的摩尔斯码，带着高速横向拖影掠过；下方一条穿孔纸带斜穿画面。",
     "点划逐个打出，与节拍严格对位。",
     "最后一个点迎面冲向镜头，落地成一颗灯泡。",
     "电报 beep 跟随点划节奏。", "#B9A4E8"),
    (2, "3", "0:04–0:06", "MARQUEE", "灯泡招牌",
     "拉斯维加斯式灯泡招牌：字母上的每个点都是一颗钨丝灯泡，边框跑马灯，地面有倒影。",
     "灯泡按八分音符追逐点亮，每小节第一拍全亮一次。",
     "镜头冲进一颗灯泡。",
     "继电器咔嗒声，电流嗡鸣。", "#FFB347"),
    (3, "3.5", "0:06–0:07", "IRIS", "光圈转场",
     "灯泡的圆形光圈张开，里面已经是孔版网点印刷的世界，四周是放射状的推进拖影。",
     "圆形遮罩在一拍内扩到全屏。",
     "直接进入孔版画面。",
     "上扬的 riser，接一个反向混响。", "#FFB347"),
    (4, "4–5", "0:07–0:10", "RISO", "孔版网点",
     "荧光红与中蓝的双色 Riso 叠印：“Moderne”的两个色版错位，配一个网点大太阳、印刷测试色条和套准标。",
     "两个色版随鼓点来回错位，第 5 小节第一拍“咔”地对准套准。",
     "画面切成格子，每格翻转成一块翻牌（翻牌擦除）。",
     "印刷机滚筒的节奏 loop。", "#FF4B2B"),
    (5, "6", "0:10–0:12", "SPLIT-FLAP", "机场翻牌",
     "Solari 翻牌板，每块翻片上都是点阵字母，逐格翻出 PUNCTUM / MODERNE / DIDONE。",
     "按十六分音符连续翻转，翻片边缘带琥珀色高光。",
     "最后一片翻下来变成打印纸，纸带向上急速走纸（走纸擦除）。",
     "翻牌的 clack 声，十六分音符。", "#EEEBE3"),
    (6, "7", "0:12–0:14", "DOT MATRIX", "针式打印",
     "带链孔的绿条连续纸倾斜着高速上卷，9 针打印头来回扫印 Aa Bb Cc / 0123 / wght 100–900。",
     "打印头急停急走，纸面带竖向运动模糊。",
     "打印头撞到行尾，硬切到四条竖向的字重条带。",
     "针式打印机经典的“吱——”扫印声，切成节奏。", "#D8E9D6"),
    (7, "8", "0:14–0:16", "WGHT PUMP", "字重泵",
     "四个 'a' 分别是 wght 100 / 400 / 700 / 900，条带黑白反相。",
     "每拍所有点同步胀缩，像扬声器的振膜；条带每拍黑白互换，形成频闪。",
     "点爆开，飞向 Z 轴深处。",
     "底鼓，加侧链压缩的 bass 泵感。", "#FF4B2B"),
    (8, "9", "0:16–0:18", "Z-TUNNEL", "点阵隧道",
     "点环层层后退构成隧道，颜色从朱红渐变到紫，中心是一个 'P'。",
     "镜头高速穿越；由 CNTR 轴驱动，隧道墙上的点在方与圆之间变形。",
     "隧道尽头收缩成一条水平亮线，也就是 CRT 开机的那条线。",
     "上升的 sweep，接反向镲。", "#FF4B2B"),
    (9, "10", "0:18–0:20", "CRT", "荧光屏",
     "琥珀色单色 CRT，带扫描线、暗角和屏幕反光。同一个“Punctum”从 opsz 12 到 144 逐行排列：字号越小，点越圆越粗，展示光学尺寸轴。",
     "滚动干扰条，行同步抖动。",
     "信号失真，点开始向下融化。",
     "CRT 高频啸叫，开机时“嘭”的一声。", "#FFB000"),
    (10, "11", "0:20–0:22", "PIXEL SORT", "像素排序",
     "字标的点向下拉出长长的像素排序条纹，带 RGB 分离和横向错切。",
     "datamosh 式的拖尾与切片位移。",
     "画面被竖向切开，进入高潮。",
     "鼓突然停下，一个下潜的 bass drop。", "#B9A4E8"),
    (11, "12", "0:22–0:24", "THE DROP", "高潮",
     "同一个字标在灯泡、Riso、翻牌、打印纸、CRT、光六种媒介之间硬切，定格时成为六条竖向拼贴。",
     "先每拍换一种媒介，越切越快，最后到十六分音符。",
     "所有条带向中心合拢。",
     "全编制回归，全片最强的段落。", "#EEEBE3"),
    (12, "13", "0:24–0:26", "LOCK", "锁定",
     "一切归位成干净的 Punctum Moderne 字标，冲击波点环向外扩散，带紫色辉光。",
     "字标落定时轻微过冲后回弹，冲击波按拍逐圈扩散。",
     "冲击波散去，光晕收回到字标上。",
     "大的冲击 hit，加低频 sub。", "#B9A4E8"),
    (13, "14–15", "0:26–0:30", "END", "结尾",
     "字标下方是“Retro signal. Modern type. / 复古的信号，前卫的字。”，句末一个朱红色光标点在闪烁，呼应开场的点。",
     "光标按拍闪烁，最后一拍熄灭。",
     "黑场收尾。",
     "只剩一声电报“嘀”，与开场首尾相扣。", "#FF4B2B"),
]

TRANSITIONS = [
    ("甩镜拖影", "点被横向甩出，速度线带入下一场"),
    ("迎面变形", "摩尔斯的最后一点冲向镜头，变成灯泡"),
    ("光圈钻入", "穿过一颗灯泡的圆形遮罩"),
    ("套色对准", "两个色版错位后咔地对齐，作为节拍点"),
    ("翻牌擦除", "画面切成格子逐格翻转"),
    ("走纸擦除", "翻片变成连续纸，向上急速走纸"),
    ("硬切频闪", "黑白反相，每拍一次"),
    ("Z 轴爆散", "点爆开飞入纵深，形成隧道"),
    ("CRT 开机线", "隧道收成一条亮线，再展开成荧光屏"),
    ("像素融化", "点向下拉出排序条纹"),
    ("媒介速切", "同一字标八分到十六分音符换介质"),
    ("冲击波", "所有点归位，环形扩散"),
]

PALETTE = [("墨黑", "#0B0A0D"), ("纸白", "#EEEBE3"), ("品牌紫", "#B9A4E8"), ("信号朱红", "#FF4B2B"),
           ("钨丝琥珀", "#FFB347"), ("Riso 蓝", "#2F55FF")]


def esc(s):
    return html.escape(s)


bars = []
for k, b, t, en, zh, *_rest, col in SHOTS:
    a, _, z = t.partition("–")
    def sec(x):
        m, s = x.split(":")
        return int(m) * 60 + int(s)
    s0, s1 = sec(a), sec(z)
    bars.append(f'<a class="seg" href="#s{k + 1}" style="--l:{s0 / 30 * 100:.3f}%;--w:{(s1 - s0) / 30 * 100:.3f}%;--c:{col}" title="{esc(zh)} {t}"><span>{k + 1:02d}</span></a>')

cards = []
for k, b, t, en, zh, pic, mot, tr, snd, col in SHOTS:
    img = b64(os.path.join(SB, f"k{k:02d}.jpg"))
    cards.append(f"""
<article class="shot" id="s{k + 1}" style="--c:{col}">
  <figure class="frame"><img src="data:image/jpeg;base64,{img}" alt="第 {k + 1} 镜：{esc(zh)}" loading="lazy" width="1280" height="720"></figure>
  <div class="meta">
    <p class="tc"><span class="no">{k + 1:02d}</span><span>{t}</span><span>小节 {b}</span></p>
    <h3><span class="en">{esc(en)}</span><span class="zh">{esc(zh)}</span></h3>
    <dl>
      <dt>画面</dt><dd>{esc(pic)}</dd>
      <dt>动效</dt><dd>{esc(mot)}</dd>
      <dt>转场</dt><dd class="tr">{esc(tr)}</dd>
      <dt>声音</dt><dd>{esc(snd)}</dd>
    </dl>
  </div>
</article>""")

trs = "".join(f"<li><b>{esc(a)}</b><span>{esc(b)}</span></li>" for a, b in TRANSITIONS)
pal = "".join(f'<li><i style="background:{c}"></i><b>{esc(n)}</b><code>{c}</code></li>' for n, c in PALETTE)
ticks = "".join(f'<span style="left:{i / 15 * 100:.3f}%">{i + 1}</span>' for i in range(15))

page = f"""<title>PUNCTUM // SIGNAL</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500&display=swap">
<style>
@font-face {{ font-family: "Punctum Moderne"; src: url(data:font/woff2;base64,{FONT}) format("woff2"); font-weight: 100 900; }}
/* Layout: a film-studio proof sheet — HUD rail on top, a 15-bar beat timeline, then one row per shot (frame left, notes right). Single dark look on purpose: it is a screening room. */
:root {{
  --ink: #0B0A0D; --ink-2: #141218; --line: #2A2630; --paper: #EEEBE3; --dim: #9C97A3;
  --violet: #B9A4E8; --verm: #FF4B2B; --amber: #FFB347;
  --display: "Punctum Moderne", "Didot", "Bodoni 72", serif;
  --body: "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SF Mono", monospace;
  color-scheme: dark;
}}
* {{ box-sizing: border-box; }}
body {{ background: var(--ink); color: var(--paper); font: 15px/1.7 var(--body); margin: 0; }}
.wrap {{ max-width: 1240px; margin: 0 auto; padding-inline: clamp(16px, 4vw, 48px); padding-block: 28px 80px; }}
.rail {{ display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font: 500 11px/1 var(--mono); letter-spacing: .14em; color: var(--dim); text-transform: uppercase; padding-bottom: 18px; border-bottom: 1px solid var(--line); }}
.rail b {{ color: var(--verm); font-weight: 500; }}
header {{ padding-block: clamp(40px, 7vw, 88px) 36px; display: grid; gap: 24px; }}
h1 {{ font: 400 clamp(48px, 9vw, 120px)/0.95 var(--display); font-variation-settings: "wght" 520, "opsz" 120; margin: 0; letter-spacing: -0.01em; }}
h1 em {{ font-style: normal; color: var(--verm); }}
.lede {{ max-width: 46em; color: #D9D5DE; font-size: 17px; margin: 0; }}
.lede strong {{ color: var(--violet); font-weight: 500; }}
.specs {{ display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 0; list-style: none; font: 500 12px/1 var(--mono); letter-spacing: .06em; }}
.specs li {{ border: 1px solid var(--line); padding: 9px 12px; border-radius: 2px; color: var(--paper); }}
.specs li span {{ color: var(--dim); margin-right: 8px; }}
.timeline {{ margin-block: 28px 8px; }}
.track {{ position: relative; height: 46px; background: var(--ink-2); border: 1px solid var(--line); }}
.seg {{ position: absolute; left: var(--l); width: var(--w); top: 0; bottom: 0; border-right: 1px solid var(--ink); background: color-mix(in srgb, var(--c) 78%, var(--ink)); color: var(--ink); text-decoration: none; font: 500 11px/46px var(--mono); text-align: center; overflow: hidden; transition: filter .15s; }}
.seg:hover, .seg:focus-visible {{ filter: brightness(1.15); outline: 2px solid var(--paper); outline-offset: -2px; }}
.ticks {{ position: relative; height: 22px; font: 400 10px/22px var(--mono); color: var(--dim); }}
.ticks span {{ position: absolute; transform: translateX(4px); }}
.cap {{ font: 500 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--dim); margin: 0 0 10px; }}
section.sys {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 28px; padding-block: 40px; border-top: 1px solid var(--line); margin-top: 40px; }}
section.sys > div {{ min-width: 0; }}
.pal, .trs {{ list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }}
.pal li {{ display: grid; grid-template-columns: 22px 1fr auto; gap: 12px; align-items: center; }}
.pal i {{ width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--line); }}
.pal b, .trs b {{ font-weight: 500; }}
.pal code {{ font: 400 12px var(--mono); color: var(--dim); }}
.trs {{ grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }}
.trs li {{ display: grid; gap: 2px; padding: 10px 12px; border-left: 2px solid var(--verm); background: var(--ink-2); }}
.trs span {{ color: var(--dim); font-size: 13px; line-height: 1.5; }}
.idea {{ color: #D9D5DE; margin: 0; }}
.shots {{ display: grid; gap: 56px; padding-top: 24px; border-top: 1px solid var(--line); }}
.shot {{ display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: clamp(20px, 3vw, 40px); align-items: start; scroll-margin-top: 24px; }}
.frame {{ margin: 0; position: relative; }}
.frame img {{ display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; background: #000; }}
.frame::after {{ content: ""; position: absolute; inset: -8px; border: 1px solid var(--line); pointer-events: none;
  -webkit-mask: linear-gradient(#000 0 0) top left / 22px 22px no-repeat, linear-gradient(#000 0 0) top right / 22px 22px no-repeat, linear-gradient(#000 0 0) bottom left / 22px 22px no-repeat, linear-gradient(#000 0 0) bottom right / 22px 22px no-repeat;
          mask: linear-gradient(#000 0 0) top left / 22px 22px no-repeat, linear-gradient(#000 0 0) top right / 22px 22px no-repeat, linear-gradient(#000 0 0) bottom left / 22px 22px no-repeat, linear-gradient(#000 0 0) bottom right / 22px 22px no-repeat; }}
.meta {{ min-width: 0; }}
.tc {{ display: flex; gap: 14px; flex-wrap: wrap; font: 500 12px/1 var(--mono); color: var(--dim); margin: 4px 0 14px; letter-spacing: .04em; }}
.tc .no {{ color: var(--ink); background: var(--c); padding: 3px 6px; }}
h3 {{ margin: 0 0 16px; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }}
h3 .en {{ font: 400 34px/1 var(--display); font-variation-settings: "wght" 560, "opsz" 34; }}
h3 .zh {{ font-size: 16px; color: var(--dim); font-weight: 500; }}
dl {{ display: grid; grid-template-columns: 3.2em 1fr; gap: 8px 14px; margin: 0; font-size: 14px; line-height: 1.65; }}
dt {{ font: 500 11px/1.65 var(--mono); color: var(--dim); padding-top: 2px; letter-spacing: .08em; }}
dd {{ margin: 0; color: #DEDAE3; }}
dd.tr {{ color: var(--paper); border-left: 2px solid var(--c); padding-left: 10px; }}
footer {{ margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--line); display: grid; gap: 12px; }}
footer ol {{ margin: 0; padding-left: 1.2em; color: #D9D5DE; display: grid; gap: 6px; }}
@media (max-width: 760px) {{ .shot {{ grid-template-columns: 1fr; }} .seg span {{ display: none; }} .ticks span:nth-child(even) {{ display: none; }} }}
@media (prefers-reduced-motion: reduce) {{ .seg {{ transition: none; }} }}
</style>
<div class="wrap">
  <div class="rail"><span><b>●</b> PUNCTUM // SIGNAL — 分镜 v1</span><span>Punctum Moderne 形象片 · 第三版</span><span>待确认</span></div>
  <header>
    <h1>PUNCTUM <em>//</em> SIGNAL</h1>
    <p class="lede">点就是信号。这一版是一支按节拍剪的动感短片：一个点从<strong>摩尔斯电码</strong>出发，依次穿过灯泡招牌、孔版网点、机场翻牌、针式打印机和 CRT 荧光屏，这些都是点阵的老媒介。每一次转场都由点本身完成：甩镜、钻进灯泡、套色对准、翻牌、走纸、Z 轴爆散、像素融化。复古在材质里，前卫在剪辑和动效里。</p>
    <ul class="specs">
      <li><span>时长</span>30 s</li><li><span>节拍</span>120 BPM · 15 小节</li><li><span>画幅</span>1920×1080 · 60 fps</li><li><span>镜头</span>14</li><li><span>声音</span>合成配乐，逐拍对位</li>
    </ul>
  </header>
  <div class="timeline" aria-label="节拍时间线">
    <p class="cap">节拍时间线 · 每格 = 1 小节 = 2 s · 点击跳到镜头</p>
    <div class="track">{''.join(bars)}</div>
    <div class="ticks">{ticks}</div>
  </div>
  <section class="sys">
    <div><p class="cap">贯穿元素</p><p class="idea">全片保留一层 HUD：四角的印刷套准标、时间码、场次号和 BPM。它既像印刷厂的校样，又像监视器的取景框，把复古印刷和数字界面缝在一起。所有字都由真实的 Punctum Moderne 字形点构成。</p></div>
    <div><p class="cap">色彩</p><ul class="pal">{pal}</ul></div>
  </section>
  <section class="sys" style="margin-top:0">
    <div style="grid-column:1/-1"><p class="cap">转场系统 · 每一次都由点完成</p><ul class="trs">{trs}</ul></div>
  </section>
  <div class="shots">{''.join(cards)}</div>
  <footer>
    <p class="cap">请确认</p>
    <ol>
      <li>整体方向和 14 个镜头的顺序，有没有想删减或加入的老媒介（比如霓虹灯管、LED 计分牌、Lite-Brite 插钉板）？</li>
      <li>时长 30 秒、120 BPM 的节奏是否合适？还是需要再加一个 15 秒的首屏循环版？</li>
      <li>结尾语用“Retro signal. Modern type. / 复古的信号，前卫的字。”可以吗？</li>
    </ol>
    <p class="idea" style="color:var(--dim);font-size:13px">分镜帧为静态关键姿态，由真实字形数据绘制；成片会在此基础上加入运动、运动模糊、辉光和合成配乐。</p>
  </footer>
</div>
"""
out = os.path.join(SB, "storyboard.artifact.html")
open(out, "w").write(page)
print(out, round(len(page) / 1e6, 2), "MB")
