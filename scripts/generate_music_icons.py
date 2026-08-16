import os
from PIL import Image, ImageDraw

out_dir = "/root/discord_mod_bot/assets/music_icons"
os.makedirs(out_dir, exist_ok=True)

size = (128, 128)
color = (245, 245, 245, 255) # Clean modern white

def create_play():
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Triangle (play)
    points = [(38, 26), (102, 64), (38, 102)]
    draw.polygon(points, fill=color)
    img.save(os.path.join(out_dir, "music_play.png"))

def create_pause():
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Two bars
    bar_w = 20
    h = 76
    top = 26
    draw.rounded_rectangle([32, top, 32 + bar_w, top + h], radius=6, fill=color)
    draw.rounded_rectangle([76, top, 76 + bar_w, top + h], radius=6, fill=color)
    img.save(os.path.join(out_dir, "music_pause.png"))

def create_stop():
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Square
    draw.rounded_rectangle([30, 30, 98, 98], radius=10, fill=color)
    img.save(os.path.join(out_dir, "music_stop.png"))

def create_skip_next():
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Triangle + bar
    points = [(28, 28), (82, 64), (28, 100)]
    draw.polygon(points, fill=color)
    draw.rounded_rectangle([88, 28, 100, 100], radius=4, fill=color)
    img.save(os.path.join(out_dir, "music_skip_next.png"))

def create_skip_prev():
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Bar + Triangle
    draw.rounded_rectangle([28, 28, 40, 100], radius=4, fill=color)
    points = [(100, 28), (46, 64), (100, 100)]
    draw.polygon(points, fill=color)
    img.save(os.path.join(out_dir, "music_skip_prev.png"))

def create_repeat():
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Loop arrows
    draw.arc([24, 28, 104, 100], start=0, end=360, fill=color, width=12)
    # arrow heads
    draw.polygon([(64, 16), (82, 28), (64, 40)], fill=color)
    draw.polygon([(64, 88), (46, 100), (64, 112)], fill=color)
    img.save(os.path.join(out_dir, "music_repeat.png"))

def create_shuffle():
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.line([(24, 38), (56, 38), (76, 90), (104, 90)], fill=color, width=10)
    draw.line([(24, 90), (56, 90), (76, 38), (104, 38)], fill=color, width=10)
    draw.polygon([(96, 26), (114, 38), (96, 50)], fill=color)
    draw.polygon([(96, 78), (114, 90), (96, 102)], fill=color)
    img.save(os.path.join(out_dir, "music_shuffle.png"))

create_play()
create_pause()
create_stop()
create_skip_next()
create_skip_prev()
create_repeat()
create_shuffle()

print("Icons generated successfully in", out_dir)
