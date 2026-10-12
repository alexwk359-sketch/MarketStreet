#!/usr/bin/env python3
"""Reduce el peso de las hojas de personajes pasándolas a PNG con paleta (256 colores + alfa).

Uso: python3 scripts/optimize_sprites.py [carpeta]   (por defecto public/sprites/people)
El sombreado "toon" tiene pocos tonos, así que la paleta apenas se nota y el archivo pesa
unas 4-5 veces menos.
"""
import pathlib
import sys

from PIL import Image

folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "public/sprites/people")
before = after = 0
for path in sorted(folder.glob("*.png")):
    before += path.stat().st_size
    img = Image.open(path).convert("RGBA")
    img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
    after += path.stat().st_size
print(f"{folder}: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")
