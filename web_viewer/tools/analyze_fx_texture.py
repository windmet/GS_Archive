import os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from PIL import Image

# Analyze both original spritesheet and our extracted frames
orig = Image.open('E:/BaiduNetdiskDownload/SideM/GS_Res/ALL_PHOTOS/assets/resources/advbackground/effects/resources/fx_sheet_screen_shine.png')
print(f'=== Original spritesheet ===')
print(f'Size: {orig.size}')
print(f'Mode: {orig.mode}')

# The original is 600x600, 2x2 grid = 4 frames of ~300x300 each
# Analyze pixel content more carefully
w, h = orig.size
fw, fh = w//2, h//2  # frame size

# Get all unique pixel colors from frame 0
frame0 = orig.crop((0, 0, fw, fh))
frame1 = orig.crop((fw, 0, w, fh))
frame2 = orig.crop((0, fh, fw, h))
frame3 = orig.crop((fw, fh, w, h))

frames = [frame0, frame1, frame2, frame3]
for i, f in enumerate(frames):
    pixels = list(f.getdata())
    rgba_pixels = [p for p in pixels if len(p) == 4]

    # Count non-zero alpha pixels
    non_zero = sum(1 for p in rgba_pixels if p[3] > 0)
    max_rgb = max(p[:3] for p in rgba_pixels) if rgba_pixels else (0,0,0)
    min_rgb = min(p[:3] for p in rgba_pixels) if rgba_pixels else (0,0,0)

    # Check if all frames are identical
    print(f'\nFrame {i}: {f.size}')
    print(f'  Non-zero alpha pixels: {non_zero}/{len(rgba_pixels)} ({100*non_zero/len(rgba_pixels):.1f}%)')
    print(f'  RGB range: {min_rgb} - {max_rgb}')
    print(f'  Extrema (all channels): {f.getextrema()}')

    # Sample some specific pixels
    sample_positions = [(fw//2, fh//2), (10, 10), (fw-10, fh-10), (fw//4, fh//4)]
    for sx, sy in sample_positions:
        if sx < f.width and sy < f.height:
            print(f'  Pixel ({sx},{sy}): {f.getpixel((sx, sy))}')

# Check if frames differ
print('\n=== Frame comparison ===')
pixel_sets = [list(f.getdata()) for f in frames]
for i in range(4):
    for j in range(i+1, 4):
        same = pixel_sets[i] == pixel_sets[j]
        print(f'  Frame {i} vs {j}: {"IDENTICAL" if same else "DIFFERENT"}')

# Check what RGB values look like in additive context
print('\n=== Additive blending analysis ===')
# In additive mode, black (0,0,0) = transparent, colored pixels = visible glow
print('Frame 0 max RGB per channel:',
      max(p[0] for p in frames[0].getdata() if p[3]),
      max(p[1] for p in frames[0].getdata() if p[3]),
      max(p[2] for p in frames[0].getdata() if p[3]))

# Are there rainbow colors or just warm tones?
print('\n=== Color analysis (frame 0 non-zero pixels) ===')
colors = {}
for i, f in enumerate(frames):
    colors[i] = {}
    for p in list(f.getdata()):
        if len(p) == 4 and p[3] > 10:  # non-negligible alpha
            r, g, b, a = p
            if r > 30 or g > 30 or b > 30:
                dominant = 'R' if r > g and r > b else 'G' if g > r and g > b else 'B' if b > r and b > g else 'MIX'
                colors[i][dominant] = colors[i].get(dominant, 0) + 1
    total = sum(colors[i].values())
    print(f'  Frame {i}: R={colors[i].get("R",0)} G={colors[i].get("G",0)} B={colors[i].get("B",0)} MIX={colors[i].get("MIX",0)} (total bright px: {total})')
