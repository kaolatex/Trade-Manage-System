import os
from PIL import Image

raw_path = r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo-raw.png"
img = Image.open(raw_path).convert("RGBA")
width, height = img.size

# 1. Create transparent version
# Where white/near-white (R>230, G>230, B>230) becomes alpha = 0 with soft threshold
trans_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
dark_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))

for y in range(height):
    for x in range(width):
        r, g, b, a = img.getpixel((x, y))
        
        # Check if background (white/light grey)
        # Background is close to white
        brightness = (r + g + b) / 3.0
        max_diff = max(abs(r - g), abs(r - b), abs(g - b))
        
        if brightness > 230 and max_diff < 25:
            # Fully transparent
            continue
        elif brightness > 200 and max_diff < 20:
            # Smooth edge falloff
            alpha = int((230 - brightness) / 30.0 * 255)
            alpha = max(0, min(255, alpha))
            trans_img.putpixel((x, y), (r, g, b, alpha))
            dark_img.putpixel((x, y), (r, g, b, alpha))
        else:
            # Pixel is part of the logo
            trans_img.putpixel((x, y), (r, g, b, 255))
            
            # Determine if pixel is green or black/dark
            # Green part has significantly higher G than R and B
            is_green = g > 110 and g > r * 1.25 and g > b * 1.25
            
            if is_green:
                # Keep or enrich the green
                dark_img.putpixel((x, y), (min(255, int(r * 0.9)), min(255, int(g * 1.05)), min(255, int(b * 0.9)), 255))
            else:
                # It's the dark 'T' or the dark right leg
                # In dark mode, convert dark grey/black to clean white / zinc-100
                dark_img.putpixel((x, y), (245, 245, 247, 255))

trans_path = r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo-transparent.png"
dark_path = r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo.png"

trans_img.save(trans_path, "PNG")
dark_img.save(dark_path, "PNG")

# Also create favicon / icon
icon_img = dark_img.resize((64, 64), Image.Resampling.LANCZOS)
icon_img.save(r"d:\Workspace\Trade Manage Syatem\tms-web\public\favicon.png", "PNG")

print("Generated logo-transparent.png, logo.png (dark mode optimized), and favicon.png successfully!")
