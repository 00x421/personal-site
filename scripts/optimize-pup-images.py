"""把导航吉祥物 PNG 转成 WebP（缩小尺寸 + 现代编码）。

依据（浏览器实测）：
  自然尺寸 256x256，渲染 54x54 CSS px
  3x DPR 需要 162px → 取 192px（覆盖到 3.5x）
  4 张会随状态轮播，全部都会被加载，合计 291 KB —— 首页的图片开销主要在这里

用法：python scripts/optimize-pup-images.py
"""
import os
from PIL import Image

PUP_FILES = [
    "xwsx-air-pup-nav.png",
    "xwsx-air-pup-thinking-nav.png",
    "xwsx-air-pup-happy-nav.png",
    "xwsx-air-pup-sleeping-nav.png",
]
SIZE = 192
QUALITY = 88
PUBLIC = "public"


def main() -> None:
    total_before = 0
    total_after = 0
    for name in PUP_FILES:
        src = os.path.join(PUBLIC, name)
        if not os.path.exists(src):
            print(f"跳过（不存在）: {name}")
            continue
        dest = os.path.join(PUBLIC, name.replace(".png", ".webp"))
        before = os.path.getsize(src)
        total_before += before

        image = Image.open(src).convert("RGBA")
        image = image.resize((SIZE, SIZE), Image.LANCZOS)
        image.save(dest, "WEBP", quality=QUALITY, method=6)

        after = os.path.getsize(dest)
        total_after += after
        print(f"{name:38} {before/1024:6.1f} KB → {after/1024:5.1f} KB")
        os.remove(src)

    print(f"\n合计 {total_before/1024:.1f} KB → {total_after/1024:.1f} KB "
          f"（降 {(1 - total_after/total_before)*100:.0f}%）")


if __name__ == "__main__":
    main()
