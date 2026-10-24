from PIL import Image

raw_path = r"C:\Users\kaov8\.gemini\antigravity-ide\brain\87cd486a-02bb-4150-9a08-ef57a01cfe87\.user_uploaded\media_1792866371923.png"
orig = Image.open(raw_path).convert("RGBA")

# Bounding box of content: 278 158 751 243
# Let's add 6px padding on all sides for smooth rendering
pad_x = 6
pad_y = 6
x0 = max(0, 278 - pad_x)
y0 = max(0, 158 - pad_y)
x1 = min(orig.width, 751 + pad_x)
y1 = min(orig.height, 243 + pad_y)

crop = orig.crop((x0, y0, x1, y1))
w, h = crop.size

out_dark = Image.new("RGBA", (w, h), (0, 0, 0, 0))
out_orig = Image.new("RGBA", (w, h), (0, 0, 0, 0))

for y in range(h):
    for x in range(w):
        r, g, b, a = crop.getpixel((x, y))
        brightness = (r + g + b) / 3.0
        max_diff = max(abs(r - g), abs(r - b), abs(g - b))

        # Check background (white/off-white)
        if brightness > 235 and max_diff < 20:
            continue
        elif brightness > 210 and max_diff < 15:
            # Soft antialiased edge
            alpha = int((235 - brightness) / 25.0 * 255)
            alpha = max(0, min(255, alpha))
            out_orig.putpixel((x, y), (r, g, b, alpha))
            
            # Check if edge is green or dark
            if g > 100 and g > r * 1.15 and g > b * 1.15:
                out_dark.putpixel((x, y), (r, g, b, alpha))
            else:
                out_dark.putpixel((x, y), (255, 255, 255, alpha))
        else:
            # Logo content
            out_orig.putpixel((x, y), (r, g, b, 255))
            
            # Distinguish green vs dark text/lines
            is_green = g > 95 and g > r * 1.15 and g > b * 1.15
            if is_green:
                # Vibrant emerald green
                out_dark.putpixel((x, y), (r, g, b, 255))
            else:
                # The 'T', divider '|', and word 'TRADE' -> crisp white for dark mode
                out_dark.putpixel((x, y), (250, 250, 252, 255))

# Save as main logo.png for Dark Mode!
out_dark.save(r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo.png", "PNG")
out_dark.save(r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo-full-dark.png", "PNG")
out_orig.save(r"d:\Workspace\Trade Manage Syatem\tms-web\public\logo-full-orig.png", "PNG")

print(f"Processed full logo banner successfully! Dimensions: {w}x{h}")
