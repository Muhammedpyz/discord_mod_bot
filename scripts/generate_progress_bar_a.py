import os
from PIL import Image, ImageDraw

out_dir = "/root/discord_mod_bot/assets/progress_bar"
os.makedirs(out_dir, exist_ok=True)

size = (128, 128)
filled_color = (255, 255, 255, 255)       # Saf Parlak Beyaz
empty_color = (75, 78, 86, 255)           # Discord Slate Koyu Gri

bar_top = 48
bar_bottom = 80
radius = 16

def create_left(name, color):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Sol yuvarlak uç (x: 16 -> 128)
    draw.rounded_rectangle([16, bar_top, 128 + radius, bar_bottom], radius=radius, fill=color)
    img.save(os.path.join(out_dir, f"{name}.png"))

def create_mid(name, color):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Orta düz çubuk (x: 0 -> 128)
    draw.rectangle([0, bar_top, 128, bar_bottom], fill=color)
    img.save(os.path.join(out_dir, f"{name}.png"))

def create_right(name, color):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Sağ yuvarlak uç (x: 0 -> 112)
    draw.rounded_rectangle([-radius, bar_top, 112, bar_bottom], radius=radius, fill=color)
    img.save(os.path.join(out_dir, f"{name}.png"))

# 6 Parçanın Üretimi
create_left("bar_l_filled", filled_color)
create_left("bar_l_empty", empty_color)

create_mid("bar_m_filled", filled_color)
create_mid("bar_m_empty", empty_color)

create_right("bar_r_filled", filled_color)
create_right("bar_r_empty", empty_color)

print("Progress bar A pieces generated in:", out_dir)
