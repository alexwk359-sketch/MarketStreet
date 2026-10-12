#!/usr/bin/env python3
"""Descarga los sprites de Microsoft Fluent Emoji (3D, licencia MIT) a public/sprites/.

Uso: python3 scripts/fetch_assets.py
Los PNG originales son de 256 px; se reducen a 128 px para aligerar el juego.
Para añadir un sprite, añade una línea a SPRITES y vuelve a ejecutar el script.
"""
import io
import pathlib
import urllib.parse
import urllib.request

from PIL import Image

BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "sprites"
SIZE = 128

# destino (relativo a public/sprites) -> carpeta en el repositorio de Fluent Emoji
SPRITES = {
    # Artículos (el nombre coincide con el id de src/sim/catalog.ts)
    "items/tshirt": "T-shirt",
    "items/cap": "Billed cap",
    "items/jeans": "Jeans",
    "items/sneakers": "Running shoe",
    "items/dress": "Dress",
    "items/coat": "Coat",
    "items/hammer": "Hammer",
    "items/wrench": "Wrench",
    "items/screwdriver": "Screwdriver",
    "items/toolbox": "Toolbox",
    "items/headphones": "Headphone",
    "items/phone": "Mobile phone",
    "items/radio": "Radio",
    "items/camera": "Camera",
    "items/videogame": "Video game",
    "items/laptop": "Laptop",
    "items/teddy": "Teddy bear",
    "items/ball": "Soccer ball",
    "items/books": "Books",
    "items/kite": "Kite",
    # Decoración
    "decor/plant": "Potted plant",
    "decor/cactus": "Cactus",
    "decor/sunflower": "Sunflower",
    "decor/picture": "Framed picture",
    "decor/sofa": "Couch and lamp",
    "decor/tree": "Christmas tree",
    # Interfaz y efectos
    "ui/coin": "Coin",
    "ui/truck": "Delivery truck",
    "ui/moneybag": "Money bag",
    "ui/bags": "Shopping bags",
    "ui/package": "Package",
    "ui/star": "Glowing star",
    "ui/sparkles": "Sparkles",
    "ui/angry": "Pouting face",
    "ui/love": "Smiling face with heart-eyes",
    "ui/question": "Red question mark",
    "ui/build": "Construction",
    "ui/cart": "Shopping cart",
}

# Clientes: 3 figuras x 4 tonos de piel, caminando y de pie.
for figure in ("Person", "Woman", "Man"):
    for tone in ("Default", "Light", "Medium", "Dark"):
        for pose in ("walking", "standing"):
            SPRITES[f"people/{figure.lower()}-{tone.lower()}-{pose}"] = (f"{figure} {pose}", tone)


def url_for(spec):
    folder, tone = (spec, None) if isinstance(spec, str) else spec
    stem = folder.lower().replace(" ", "_")
    if tone:
        path = f"{folder}/{tone}/3D/{stem}_3d_{tone.lower()}.png"
    else:
        path = f"{folder}/3D/{stem}_3d.png"
    return f"{BASE}/{urllib.parse.quote(path)}"


def main():
    for dest, spec in SPRITES.items():
        target = OUT / f"{dest}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url_for(spec), timeout=30) as resp:
            img = Image.open(io.BytesIO(resp.read())).convert("RGBA")
        img.thumbnail((SIZE, SIZE), Image.LANCZOS)
        img.save(target, optimize=True)
        print(f"ok  {dest}")


if __name__ == "__main__":
    main()
