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
    "items/socks": "Socks",
    "items/jeans": "Jeans",
    "items/scarf": "Scarf",
    "items/sneakers": "Running shoe",
    "items/dress": "Dress",
    "items/gloves": "Gloves",
    "items/coat": "Coat",
    "items/hammer": "Hammer",
    "items/wrench": "Wrench",
    "items/bolt": "Nut and bolt",
    "items/screwdriver": "Screwdriver",
    "items/flashlight": "Flashlight",
    "items/battery": "Battery",
    "items/magnet": "Magnet",
    "items/toolbox": "Toolbox",
    "items/axe": "Axe",
    "items/ladder": "Ladder",
    "items/headphones": "Headphone",
    "items/phone": "Mobile phone",
    "items/radio": "Radio",
    "items/camera": "Camera",
    "items/videogame": "Video game",
    "items/printer": "Printer",
    "items/tv": "Television",
    "items/laptop": "Laptop",
    "items/videocam": "Video camera",
    "items/desktop": "Desktop computer",
    "items/ball": "Soccer ball",
    "items/teddy": "Teddy bear",
    "items/yoyo": "Yo-yo",
    "items/books": "Books",
    "items/crayon": "Crayon",
    "items/puzzle": "Puzzle piece",
    "items/dice": "Game die",
    "items/kite": "Kite",
    "items/wand": "Magic wand",
    "items/lipstick": "Lipstick",
    "items/sunglasses": "Sunglasses",
    "items/necktie": "Necktie",
    "items/watch": "Watch",
    "items/handbag": "Handbag",
    "items/heels": "High-heeled shoe",
    "items/basketball": "Basketball",
    "items/fishing": "Fishing pole",
    "items/scooter": "Kick scooter",
    "items/guitar": "Guitar",
    "items/bicycle": "Bicycle",
    # Alimentación
    "items/apple": "Red apple",
    "items/banana": "Banana",
    "items/orange": "Tangerine",
    "items/grapes": "Grapes",
    "items/strawberry": "Strawberry",
    "items/pear": "Pear",
    "items/peach": "Peach",
    "items/cherries": "Cherries",
    "items/lemon": "Lemon",
    "items/pineapple": "Pineapple",
    "items/watermelon": "Watermelon",
    "items/mango": "Mango",
    "items/kiwi": "Kiwi fruit",
    "items/coconut": "Coconut",
    "items/blueberries": "Blueberries",
    "items/carrot": "Carrot",
    "items/tomato": "Tomato",
    "items/potato": "Potato",
    "items/lettuce": "Leafy green",
    "items/corn": "Ear of corn",
    "items/broccoli": "Broccoli",
    "items/cucumber": "Cucumber",
    "items/pepper": "Bell pepper",
    "items/onion": "Onion",
    "items/garlic": "Garlic",
    "items/eggplant": "Eggplant",
    "items/chili": "Hot pepper",
    "items/mushroom": "Mushroom",
    "items/avocado": "Avocado",
    "items/bread": "Bread",
    "items/baguette": "Baguette bread",
    "items/bagel": "Bagel",
    "items/croissant": "Croissant",
    "items/donut": "Doughnut",
    "items/pretzel": "Pretzel",
    "items/cookie": "Cookie",
    "items/cupcake": "Cupcake",
    "items/pie": "Pie",
    "items/shortcake": "Shortcake",
    "items/cake": "Birthday cake",
    "items/chicken": "Poultry leg",
    "items/steak": "Cut of meat",
    "items/burger": "Hamburger",
    "items/sausage": "Hot dog",
    "items/bacon": "Bacon",
    "items/ribs": "Meat on bone",
    "items/milk": "Glass of milk",
    "items/eggs": "Egg",
    "items/butter": "Butter",
    "items/juice": "Beverage box",
    "items/soda": "Cup with straw",
    "items/honey": "Honey pot",
    "items/bubbletea": "Bubble tea",
    "items/cava": "Bottle with popping cork",
    "items/icecream": "Ice cream",
    "items/softserve": "Soft ice cream",
    "items/ice": "Ice",
    "items/pizza": "Pizza",
    "items/dumplings": "Dumpling",
    "items/fish": "Fish",
    "items/shrimp": "Shrimp",
    "items/shavedice": "Shaved ice",
    # Decoración (la que es mueble se modela en 3D con scripts/render_furniture.mjs)
    "decor/plant": "Potted plant",
    "decor/cactus": "Cactus",
    "decor/sunflower": "Sunflower",
    "decor/tulip": "Tulip",
    "decor/picture": "Framed picture",
    "decor/bouquet": "Bouquet",
    "decor/dog": "Dog",
    "decor/palm": "Palm tree",
    "decor/moai": "Moai",
    "decor/statue": "Statue of liberty",
    "decor/balloons": "Balloon",
    "decor/pumpkin": "Jack-o-lantern",
    "decor/snowman": "Snowman",
    # Exterior
    "street/tree": "Deciduous tree",
    "street/pine": "Evergreen tree",
    "street/car": "Automobile",
    "street/taxi": "Taxi",
    "street/bus": "Bus",
    "street/suv": "Sport utility vehicle",
    "street/moto": "Motor scooter",
    # Interfaz y efectos
    "ui/coin": "Coin",
    "ui/gem": "Gem stone",
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
    "ui/crown": "Crown",
    "ui/clipboard": "Clipboard",
    "ui/fire": "Fire",
    "ui/party": "Party popper",
    "ui/gift": "Wrapped gift",
    "ui/sound": "Speaker high volume",
    "ui/mute": "Muted speaker",
    "ui/trash": "Wastebasket",
    "ui/rocket": "Rocket",
    "ui/megaphone": "Megaphone",
    "ui/check": "Check mark button",
    "ui/trophy": "Trophy",
    "ui/chart": "Chart increasing",
    "ui/store": "Department store",
    "ui/bell": "Bellhop bell",
    "ui/clock": "Alarm clock",
    "ui/gear": "Gear",
    "ui/bolt": "High voltage",
    "ui/heart": "Sparkling heart",
    "ui/brush": "Paintbrush",
    "ui/palette": "Artist palette",
    "ui/sun": "Sun",
    "ui/cloudsun": "Sun behind cloud",
    "ui/rain": "Cloud with rain",
    "ui/snow": "Cloud with snow",
    "ui/hot": "Hot face",
    "ui/moon": "Crescent moon",
    "ui/sunrise": "Sunrise",
    "ui/sunset": "Sunset",
    "ui/memo": "Memo",
    "ui/notepad": "Spiral notepad",
    "ui/siren": "Police car light",
    "ui/hourglass": "Hourglass not done",
    "ui/hundred": "Hundred points",
    "ui/flash": "Camera with flash",
}

# Clientes y cajeros ya no vienen de aquí: se modelan en 3D (scripts/furniture/characters.js).


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
