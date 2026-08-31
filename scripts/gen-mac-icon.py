"""生成 macOS 26+(Tahoe)规范的 icon.icns。

macOS 26 起,Dock 与系统界面对所有应用图标统一应用新的连续曲率形状裁切与
Liquid Glass 效果:图标资产应为满铺(full-bleed)的 1024x1024 方形内容,圆角交给系统,
不再沿用 Big Sur 时代「内容 824/1024 + 自带透明留白」的画布规范(自带留白会让图标
在新系统中显示偏小、与新图标不协调)。

本脚本把源图标(默认 src-tauri/icons/icon.png)缩放为满铺 1024x1024,
按 ic07~ic14 条目手工编码为 icns,覆盖 src-tauri/icons/icon.icns。

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

src = Image.open(SRC).convert("RGBA")
canvas = src.resize((CANVAS, CANVAS), Image.LANCZOS)
# 源为 512px 时上采样,轻微锐化补偿软边
canvas = canvas.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))

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
