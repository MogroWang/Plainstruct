"""生成符合 macOS 图标规范的 icon.icns。

macOS(Big Sur 起)的 Dock 图标画布为 1024x1024,内容只占约 824/1024(四周留白约 10%),
Windows/Linux 图标惯例是满铺——直接用同一张 icon.png 生成的 icns 在 Dock 中会显得过满。
本脚本把源图标(默认 src-tauri/icons/icon.png,512x512)放到规范留白画布上,
再按 ic07~ic14 条目手工编码为 icns,覆盖 src-tauri/icons/icon.icns。

用法:python scripts/gen-mac-icon.py
依赖:Pillow(pip install pillow)
"""
import io
import struct
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src-tauri" / "icons" / "icon.png"
OUT = ROOT / "src-tauri" / "icons" / "icon.icns"

CANVAS = 1024
# Apple 图标网格:内容区 824x824,居中(边距 100)
CONTENT = 824

src = Image.open(SRC).convert("RGBA")
content = src.resize((CONTENT, CONTENT), Image.LANCZOS)
# 放大后轻微锐化,补偿软边
content = content.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
canvas.alpha_composite(content, ((CANVAS - CONTENT) // 2, (CANVAS - CONTENT) // 2))

# icns 条目:ic07(128) ic08(256) ic09(512) ic10(512@2x=1024)
#           ic11(16@2x=32) ic12(32@2x=64) ic13(128@2x=256) ic14(256@2x=512)
entries = [
    ("ic07", 128),
    ("ic08", 256),
    ("ic09", 512),
    ("ic10", 1024),
    ("ic11", 32),
    ("ic12", 64),
    ("ic13", 256),
    ("ic14", 512),
]

body = b""
for code, size in entries:
    img = canvas if size == CANVAS else canvas.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    png = buf.getvalue()
    body += code.encode("ascii") + struct.pack(">I", len(png) + 8) + png

icns = b"icns" + struct.pack(">I", len(body) + 8) + body
OUT.write_bytes(icns)
print(f"icon.icns written: {len(icns)} bytes -> {OUT}")
