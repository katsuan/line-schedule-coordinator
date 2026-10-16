#!/usr/bin/env python3
"""くるかな（QuruKana）のアイコン・ロゴ・OGP を作る。

名前は「くるかな」。「来るかな？」を ○△× で聞いて、みんなの来れる日をそろえる日程調整。
英字は QuruKana（おくるん＝OQRN・キロっく＝kiloQ と同じ作り方で、「く」を Q にする）。
アイコンはおくるんと同じ角の丸い四角に、空色のグラデーション（おくるん・くろのすの紫と分ける）。
Q はカレンダー：輪の上に綴じ具を2本、輪の中に日付の点を並べ、真ん中の1日だけ ○（来れる日）。
Q のしっぽは ✓（短い腕は輪の右下の内側から、長い腕は輪の外へ右上に跳ねる）で「この日に決まり」。

  icon.svg・icon-32.png・apple-touch-icon.png・icon-512.png・icon-maskable-512.png … アイコン
  logo.svg … 横長のロゴ「QuruKana」（Q はアイコンと同じ形、u・r・u・K・a・n・a は Jua）
  ogp.png  … 共有したときの画像（1200×630）

使い方: python3 tools/icon.py（となりのおくるん（q-oqrn）の tools/brandkit.py を使う）
"""
from pathlib import Path

import brandkit_path  # noqa: F401（となりのおくるん（q-oqrn）の tools/brandkit.py を読めるようにする）
from brandkit import Brand, centered

ROOT = Path(__file__).resolve().parent.parent
BRAND = Brand(light=(56, 189, 248), dark=(2, 132, 199))  # 空色（index.html の --primary #0284C7）

C = (46, 46)  # 輪の中心
R, RING_W = 24, 10  # 輪の半径（線の真ん中）・太さ
CHECK = [(53, 61), (62, 71), (84, 51)]  # ✓ のしっぽ（短い腕の始まり → 曲がり → 長い腕の先）

SHAPES = [
    {"t": "circle", "c": C, "r": R, "alpha": 0.16},  # 輪の内側（うっすら）
    {"t": "ring", "c": C, "r": R, "w": RING_W},
    # 綴じ具（まわりを背景の色で削ってから、白い棒）
    {"t": "line", "p": [(38, 14), (38, 24)], "w": 5, "fill": "bg"},
    {"t": "line", "p": [(54, 14), (54, 24)], "w": 5, "fill": "bg"},
    {"t": "line", "p": [(38, 15), (38, 23)], "w": 3.2},
    {"t": "line", "p": [(54, 15), (54, 23)], "w": 3.2},
    # 日付の点（3 × 2）。真ん中の下の1日だけ ○
    *[{"t": "circle", "c": (36 + 10 * i, 40 + 10 * j), "r": 2.3, "alpha": 0.9} for j in range(2) for i in range(3) if (i, j) != (1, 1)],
    {"t": "ring", "c": (46, 50), "r": 3.4, "w": 2.4},
    # ✓ のしっぽ（輪と重なるところを背景の色で削ってから描く）
    {"t": "line", "p": CHECK, "w": 15, "fill": "bg"},
    {"t": "line", "p": CHECK, "w": 9},
]
# 重心をそろえる：外形（綴じ具・✓ のしっぽを含む）の真ん中だけでそろえると、重い輪が左に寄って見える。
# 輪の中心と外形の真ん中の、ちょうど中間をアイコンの真ん中にする（ロゴも同じ形を使う）
_SHAPES, (_DX, _DY) = centered(SHAPES)
_RING = (C[0] + _DX, C[1] + _DY)
SHAPES, (_DX, _DY) = centered(SHAPES, target=(50 + (50 - _RING[0]) / 2, 50 + (50 - _RING[1]) / 2))
C = (C[0] + _DX, C[1] + _DY)
RING_OUTER = R + RING_W / 2


def decorate(d, s):
    """OGP の背景：うっすらカレンダーのます目"""
    for col in range(5):
        for row in range(3):
            x, y = 860 + col * 64, 60 + row * 64
            d.rounded_rectangle((x * s, y * s, (x + 48) * s, (y + 48) * s), radius=10 * s, fill=(255, 255, 255, 26))


def main():
    BRAND.write_icons(ROOT, SHAPES)
    logo, ratio = BRAND.logo_svg("QuruKana", SHAPES, C, RING_OUTER, "QuruKana（くるかな）")
    (ROOT / "logo.svg").write_text(logo, encoding="utf-8")
    BRAND.write_ogp(
        ROOT / "ogp.png", SHAPES, "くるかな", "QuruKana",
        ["候補の日を送って、○△× で答えてもらう", "LINE でできる日程調整"], decorate,
        copy="来れる日を、○△×でそろえよう",
    )
    print(f"アイコン・logo.svg（高さ 28px なら幅 {28 * ratio:.0f}px）・ogp.png を書き出しました")


if __name__ == "__main__":
    main()
