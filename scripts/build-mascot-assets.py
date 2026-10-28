import cv2
import numpy as np
from PIL import Image

def generate_assets():
    # 1. Load full mascot and logo
    full = cv2.imread('public/mascot/mascot-full.png', cv2.IMREAD_UNCHANGED)
    logo = cv2.imread('public/mascot/mascot-logo.png', cv2.IMREAD_UNCHANGED)

    # 2. Save mascot-halo.png & mascot-cuan.png
    cv2.imwrite('public/mascot/mascot-halo.png', logo)
    cv2.imwrite('public/mascot/mascot-cuan.png', full)

    # 3. Create a luxurious 512x512 PWA / App icon with Fin.IQ emerald background
    size = 512
    icon_canvas = np.zeros((size, size, 4), dtype=np.uint8)

    # Create radial/diagonal emerald gradient background: #059669 to #064E3B
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2.0 * size)
            r = int(5 * (1 - t) + 4 * t)
            g = int(150 * (1 - t) + 78 * t)
            b = int(105 * (1 - t) + 59 * t)
            icon_canvas[y, x] = [b, g, r, 255]

    # Create a smooth rounded rectangle mask (radius 112)
    corner_mask = np.zeros((size, size), dtype=np.uint8)
    radius = 112
    cv2.circle(corner_mask, (radius, radius), radius, 255, -1)
    cv2.circle(corner_mask, (size - radius - 1, radius), radius, 255, -1)
    cv2.circle(corner_mask, (radius, size - radius - 1), radius, 255, -1)
    cv2.circle(corner_mask, (size - radius - 1, size - radius - 1), radius, 255, -1)
    cv2.rectangle(corner_mask, (radius, 0), (size - radius, size), 255, -1)
    cv2.rectangle(corner_mask, (0, radius), (size, size - radius), 255, -1)

    # Subtle golden border stroke
    border_mask = np.zeros((size, size), dtype=np.uint8)
    cv2.circle(border_mask, (radius, radius), radius, 255, 6)
    cv2.circle(border_mask, (size - radius - 1, radius), radius, 255, 6)
    cv2.circle(border_mask, (radius, size - radius - 1), radius, 255, 6)
    cv2.circle(border_mask, (size - radius - 1, size - radius - 1), radius, 255, 6)
    cv2.line(border_mask, (radius, 3), (size - radius, 3), 255, 6)
    cv2.line(border_mask, (radius, size - 4), (size - radius, size - 4), 255, 6)
    cv2.line(border_mask, (3, radius), (3, size - radius), 255, 6)
    cv2.line(border_mask, (size - 4, radius), (size - 4, size - radius), 255, 6)

    icon_canvas[:, :, 3] = corner_mask

    # Blend golden highlight on the border
    gold_bgr = [110, 215, 250] # gold in BGR
    for c in range(3):
        blended = (gold_bgr[c] * 0.8 + icon_canvas[:, :, c].astype(float) * 0.2).astype(np.uint8)
        icon_canvas[:, :, c] = np.where(border_mask > 0, blended, icon_canvas[:, :, c])

    # Resize logo to fit inside the squircle
    target_logo_h = 410
    scale = target_logo_h / logo.shape[0]
    scaled_w = int(logo.shape[1] * scale)
    logo_resized = cv2.resize(logo, (scaled_w, target_logo_h), interpolation=cv2.INTER_LANCZOS4)

    pos_x = (size - scaled_w) // 2
    pos_y = (size - target_logo_h) // 2 + 15

    # Alpha blend logo on top of icon canvas
    alpha_s = (logo_resized[:, :, 3] / 255.0)[:, :, np.newaxis]
    alpha_l = 1.0 - alpha_s

    icon_roi = icon_canvas[pos_y:pos_y+target_logo_h, pos_x:pos_x+scaled_w, :3]
    blended_rgb = alpha_s * logo_resized[:, :, :3] + alpha_l * icon_roi
    icon_canvas[pos_y:pos_y+target_logo_h, pos_x:pos_x+scaled_w, :3] = blended_rgb.astype(np.uint8)

    cv2.imwrite('public/icon.png', icon_canvas)
    cv2.imwrite('public/icon-512.png', icon_canvas)
    cv2.imwrite('public/mascot/mascot-badge.png', icon_canvas)

    # Generate 192x192
    icon_192 = cv2.resize(icon_canvas, (192, 192), interpolation=cv2.INTER_LANCZOS4)
    cv2.imwrite('public/icon-192.png', icon_192)

    # Generate favicon.ico using PIL
    pil_img = Image.fromarray(cv2.cvtColor(icon_canvas, cv2.COLOR_BGRA2RGBA))
    pil_img.save('public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    # Generate public/icon.svg with embedded base64 mascot
    import base64
    with open('public/icon.png', 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    svg_content = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><image href="data:image/png;base64,{b64}" width="512" height="512"/></svg>'
    with open('public/icon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)

    print('Generated all icon and mascot assets successfully!')

if __name__ == '__main__':
    generate_assets()
