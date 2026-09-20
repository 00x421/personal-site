"""肖像图：从 1024×1536 母版生成一组响应式尺寸（WebP）。

为什么需要这个脚本
------------------
`personal-portrait-scribble.webp` 曾经是**单一** 768×1152 文件，用所有视口。
Lighthouse 实测它的 155 KB 里有 **135 KB（87%）是浪费**，原因是「尺寸过剩」：

    显示尺寸（Lighthouse 模拟移动端）  280×420
    实际文件                          768×1152

而更糟的是反过来的那一半——在高分屏上它是**不够用**的：

    视口 390   显示 319×432   DPR3 需要 956px   768 不够 → 被放大，发虚
    视口 1024  显示 323×576   DPR3 需要 969px   不够
    视口 1440  显示 420×576   DPR3 需要 1259px  不够

同一个文件对谁都不合适。所以生成一组宽度，交给 `srcset` + `sizes` 让浏览器自己挑。

    320 / 480 / 640 / 800 / 1024

1024 是母版上限，不再上采样（DPR3 @ 1440 需要 1259，超出母版，属已知上限）。

母版从哪来
----------
`images-src/` 已 gitignore（与 `fonts-src/` 同一惯例）。缺失时从 git 历史恢复：

    git cat-file blob b5ab11cb669d77f659f703ce0a080eaf3631cf99 > images-src/personal-portrait-scribble.jpg

用法：python scripts/optimize-portrait.py
"""

import os

from PIL import Image

MASTER = 'images-src/personal-portrait-scribble.jpg'
OUT_DIR = 'public'
STEM = 'personal-portrait-scribble'
WIDTHS = [320, 480, 640, 800, 1024]
QUALITY = 82   # 线稿 + 纸纹，q82 下肉眼与母版无差；再高只涨字节


def main() -> None:
    if not os.path.exists(MASTER):
        raise SystemExit(
            f'缺少母版 {MASTER}\n'
            '从 git 历史恢复：\n'
            '  git cat-file blob b5ab11cb669d77f659f703ce0a080eaf3631cf99 '
            f'> {MASTER}'
        )

    src = Image.open(MASTER).convert('RGB')
    sw, sh = src.size
    ratio = sh / sw
    print(f'母版 {sw}x{sh}  ({os.path.getsize(MASTER) / 1024:.0f} KB)  q{QUALITY}')

    total = 0
    for w in WIDTHS:
        h = round(w * ratio)
        # LANCZOS：线稿缩小时最不容易产生锯齿
        img = src.resize((w, h), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f'{STEM}-{w}.webp')
        img.save(path, 'WEBP', quality=QUALITY, method=6)
        size = os.path.getsize(path)
        total += size
        print(f'  {w:>4}x{h:<5} -> {path:<46} {size / 1024:>6.1f} KB')
    print(f'  合计 {total / 1024:.1f} KB（访客只会下载其中一张）')


if __name__ == '__main__':
    main()
