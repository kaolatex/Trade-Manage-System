from PIL import Image

raw_path = r"C:\Users\kaov8\.gemini\antigravity-ide\brain\87cd486a-02bb-4150-9a08-ef57a01cfe87\.user_uploaded\media_1792866371923.png"
orig = Image.open(raw_path).convert("RGBA")

def process_image(img):
    w, h = img.size
    out_dark = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out_orig = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    for y in range(h):
        for x in range(w):
            r, g, b, a = img.getpixel((x, y))
            brightness = (r + g + b) / 3.0
            max_diff = max(abs(r - g), abs(r - b), abs(g - b))

            # Background detection
            if brightness > 235 and max_diff < 20:
                continue
            elif brightness > 210 and max_diff < 15:
                alpha = int((235 - brightness) / 25.0 * 255)
                alpha = max(0, min(255, alpha))
                out_orig.putpixel((x, y), (r, g, b, alpha))
                out_dark.putpixel((x, y), (r, g, b, alpha))
            else:
                out_orig.putpixel((x, y), (r, g, b, 255))
                # Distinguish green from dark
                is_green = g > 100 and g > r * 1.2 and g > b * 1.2
                if is_green:
                    out_dark.putpixel((x, y), (r, g, b, 255))
                else:
                    # Dark parts ('T', right bar, divider) -> crisp white in dark mode
                    out_dark.putpixel((x, y), (245, 245, 247, 255))
    return out_dark, out_orig

# 1. Crop TM Icon Only (NO TEXT)
tm_crop = orig.crop((273, 154, 409, 246))
tm_dark, tm_clean = process_image(tm_crop)

# Add small padding to make it a comfortable badge
pad = 6
tm_padded = Image.new("RGBA", (tm_dark.width + pad * 2, tm_dark.height + pad * 2), (0, 0, 0, 0))
tm_padded.paste(tm_dark, (pad, pad))

# Save TM icon as main logo.png and logo-mark.png
tm_padded.save(r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo.png", "PNG")
tm_padded.save(r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo-mark.png", "PNG")

# 2. Favicon (square)
size = max(tm_dark.width, tm_dark.height) + 16
fav = Image.new("RGBA", (size, size), (0, 0, 0, 0))
fav.paste(tm_dark, ((size - tm_dark.width) // 2, (size - tm_dark.height) // 2))
fav_scaled = fav.resize((64, 64), Image.Resampling.LANCZOS)
fav_scaled.save(r"d:\Workspace\Trade Manage Syatem\tms-web\public\favicon.png", "PNG")

# 3. Also process full logo with text just in case
full_crop = orig.crop((273, 154, 755, 246))
full_dark, _ = process_image(full_crop)
full_padded = Image.new("RGBA", (full_dark.width + pad * 2, full_dark.height + pad * 2), (0, 0, 0, 0))
full_padded.paste(full_dark, (pad, pad))
full_padded.save(r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo-full.png", "PNG")

print("Successfully cropped TM logo (text removed) and saved logo.png, logo-mark.png, favicon.png, logo-full.png!")
