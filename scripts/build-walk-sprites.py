import cv2
import numpy as np

def extract_walk_sprites():
    src = r'C:\Users\BRAVO\.gemini\antigravity-ide\brain\28f4bece-7e0b-4364-a15c-0c340d35c354\.user_uploaded\media_1793180539134.jpg'
    img = cv2.imread(src)
    h, w = img.shape[:2]
    mid_x = w // 2

    left_img = img[:, :mid_x]
    right_img = img[:, mid_x:]

    # =========================================================================
    # 1. EXTRACT LEFT CHARACTER (Step 1, facing left -> will flip to face right)
    # =========================================================================
    hh, hw = left_img.shape[:2]
    mask_left = np.full((hh, hw), cv2.GC_PR_FGD, dtype=np.uint8)

    # Floodfill background seeds
    filled_mask = np.zeros((hh + 2, hw + 2), np.uint8)
    filled = left_img.copy()
    flags = cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8)

    # Top & wall
    for x in range(0, hw, 8):
        cv2.floodFill(filled, filled_mask, (x, 0), (0, 0, 0), (12, 12, 12), (12, 12, 12), flags=flags)
        cv2.floodFill(filled, filled_mask, (x, 20), (0, 0, 0), (12, 12, 12), (12, 12, 12), flags=flags)
    for y in range(0, 260, 8):
        cv2.floodFill(filled, filled_mask, (0, y), (0, 0, 0), (12, 12, 12), (12, 12, 12), flags=flags)
        cv2.floodFill(filled, filled_mask, (hw - 1, y), (0, 0, 0), (12, 12, 12), (12, 12, 12), flags=flags)

    # Floor seeds
    for y in range(270, hh, 8):
        for x in [0, 15, 30, hw - 1, hw - 15]:
            cv2.floodFill(filled, filled_mask, (x, y), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
    for x in range(0, hw, 8):
        cv2.floodFill(filled, filled_mask, (x, hh - 1), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
        cv2.floodFill(filled, filled_mask, (x, hh - 15), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)

    # Specific seed in the pocket above tail
    cv2.floodFill(filled, filled_mask, (375, 300), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
    cv2.floodFill(filled, filled_mask, (380, 280), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
    cv2.floodFill(filled, filled_mask, (360, 320), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
    # Seed in front of belly/paw
    cv2.floodFill(filled, filled_mask, (150, 300), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)

    bg_left = filled_mask[1:hh+1, 1:hw+1]
    mask_left[bg_left > 0] = cv2.GC_BGD
    mask_left[478:, :] = cv2.GC_BGD

    # Foreground seeds
    mask_left[90:130, 230:290] = cv2.GC_FGD
    mask_left[170:220, 210:290] = cv2.GC_FGD
    mask_left[260:340, 210:300] = cv2.GC_FGD
    mask_left[320:360, 165:195] = cv2.GC_FGD
    mask_left[370:410, 370:430] = cv2.GC_FGD

    bgdModel = np.zeros((1, 65), np.float64)
    fgdModel = np.zeros((1, 65), np.float64)
    cv2.grabCut(left_img, mask_left, None, bgdModel, fgdModel, 8, cv2.GC_INIT_WITH_MASK)

    fg_left = np.where((mask_left == cv2.GC_FGD) | (mask_left == cv2.GC_PR_FGD), 255, 0).astype('uint8')
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(fg_left)
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    fg_left = np.where(labels == largest, 255, 0).astype('uint8')

    # Fill internal holes (e.g. jacket)
    holes = cv2.bitwise_not(fg_left)
    n_h, l_h, s_h, _ = cv2.connectedComponentsWithStats(holes)
    for i in range(1, n_h):
        if s_h[i, cv2.CC_STAT_AREA] < 800:
            fg_left[l_h == i] = 255

    # Antialiasing
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    fg_eroded = cv2.erode(fg_left, kernel, iterations=1)
    edge_zone = cv2.bitwise_xor(fg_left, fg_eroded)
    alpha = fg_left.astype(float)
    alpha_blur = cv2.GaussianBlur(alpha, (3, 3), 0.6)
    alpha[edge_zone > 0] = alpha_blur[edge_zone > 0]
    alpha_left = np.clip(alpha, 0, 255).astype(np.uint8)

    pts = np.where(alpha_left > 20)
    min_y, max_y = np.min(pts[0]), np.max(pts[0])
    min_x, max_x = np.min(pts[1]), np.max(pts[1])
    pad = 6
    y1 = max(0, min_y - pad)
    y2 = min(hh, max_y + pad)
    x1 = max(0, min_x - pad)
    x2 = min(hw, max_x + pad)

    b, g, r = cv2.split(left_img)
    rgba_left = cv2.merge([b, g, r, alpha_left])[y1:y2, x1:x2]
    # Flip left character horizontally so it faces RIGHT (standard for direction = 1)
    step1_right = cv2.flip(rgba_left, 1)

    # =========================================================================
    # 2. EXTRACT RIGHT CHARACTER (Step 2, already facing right)
    # =========================================================================
    mask_right = np.full((hh, hw), cv2.GC_PR_FGD, dtype=np.uint8)
    filled_mask_r = np.zeros((hh + 2, hw + 2), np.uint8)
    filled_r = right_img.copy()

    # Top & wall
    for x in range(0, hw, 8):
        cv2.floodFill(filled_r, filled_mask_r, (x, 0), (0, 0, 0), (12, 12, 12), (12, 12, 12), flags=flags)
        cv2.floodFill(filled_r, filled_mask_r, (x, 20), (0, 0, 0), (12, 12, 12), (12, 12, 12), flags=flags)
    for y in range(0, 260, 8):
        cv2.floodFill(filled_r, filled_mask_r, (0, y), (0, 0, 0), (12, 12, 12), (12, 12, 12), flags=flags)
        cv2.floodFill(filled_r, filled_mask_r, (hw - 1, y), (0, 0, 0), (12, 12, 12), (12, 12, 12), flags=flags)

    # Floor seeds
    for y in range(270, hh, 8):
        for x in [0, 15, 30, hw - 1, hw - 15]:
            cv2.floodFill(filled_r, filled_mask_r, (x, y), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
    for x in range(0, hw, 8):
        cv2.floodFill(filled_r, filled_mask_r, (x, hh - 1), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
        cv2.floodFill(filled_r, filled_mask_r, (x, hh - 15), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)

    # Specific seed in the pocket above tail in right_img (tail is on the left: x ~ 80..170, y ~ 320..420)
    cv2.floodFill(filled_r, filled_mask_r, (120, 300), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
    cv2.floodFill(filled_r, filled_mask_r, (130, 280), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
    cv2.floodFill(filled_r, filled_mask_r, (140, 320), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)
    # Seed in front of belly/right side
    cv2.floodFill(filled_r, filled_mask_r, (360, 300), (0, 0, 0), (16, 16, 16), (16, 16, 16), flags=flags)

    bg_right = filled_mask_r[1:hh+1, 1:hw+1]
    mask_right[bg_right > 0] = cv2.GC_BGD
    mask_right[478:, :] = cv2.GC_BGD

    # Foreground seeds inside right cat
    mask_right[90:130, 220:280] = cv2.GC_FGD
    mask_right[170:220, 220:300] = cv2.GC_FGD
    mask_right[260:340, 210:300] = cv2.GC_FGD
    mask_right[360:420, 90:150] = cv2.GC_FGD # tail on left side

    bgdModel_r = np.zeros((1, 65), np.float64)
    fgdModel_r = np.zeros((1, 65), np.float64)
    cv2.grabCut(right_img, mask_right, None, bgdModel_r, fgdModel_r, 8, cv2.GC_INIT_WITH_MASK)

    fg_right = np.where((mask_right == cv2.GC_FGD) | (mask_right == cv2.GC_PR_FGD), 255, 0).astype('uint8')
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(fg_right)
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    fg_right = np.where(labels == largest, 255, 0).astype('uint8')

    holes_r = cv2.bitwise_not(fg_right)
    n_h, l_h, s_h, _ = cv2.connectedComponentsWithStats(holes_r)
    for i in range(1, n_h):
        if s_h[i, cv2.CC_STAT_AREA] < 800:
            fg_right[l_h == i] = 255

    fg_eroded_r = cv2.erode(fg_right, kernel, iterations=1)
    edge_zone_r = cv2.bitwise_xor(fg_right, fg_eroded_r)
    alpha_r = fg_right.astype(float)
    alpha_blur_r = cv2.GaussianBlur(alpha_r, (3, 3), 0.6)
    alpha_r[edge_zone_r > 0] = alpha_blur_r[edge_zone_r > 0]
    alpha_right = np.clip(alpha_r, 0, 255).astype(np.uint8)

    pts_r = np.where(alpha_right > 20)
    min_y_r, max_y_r = np.min(pts_r[0]), np.max(pts_r[0])
    min_x_r, max_x_r = np.min(pts_r[1]), np.max(pts_r[1])
    y1_r = max(0, min_y_r - pad)
    y2_r = min(hh, max_y_r + pad)
    x1_r = max(0, min_x_r - pad)
    x2_r = min(hw, max_x_r + pad)

    b_r, g_r, r_r = cv2.split(right_img)
    step2_right = cv2.merge([b_r, g_r, r_r, alpha_right])[y1_r:y2_r, x1_r:x2_r]

    # =========================================================================
    # 3. NORMALIZE SIZES (Align heights to 400px and consistent canvas)
    # =========================================================================
    target_h = 400
    
    def normalize_sprite(img_rgba):
        h_cur, w_cur = img_rgba.shape[:2]
        scale = target_h / float(h_cur)
        new_w = int(w_cur * scale)
        resized = cv2.resize(img_rgba, (new_w, target_h), interpolation=cv2.INTER_LANCZOS4)
        return resized

    s1 = normalize_sprite(step1_right)
    s2 = normalize_sprite(step2_right)

    # Put both into consistent width canvas (e.g. 340px)
    max_w = max(s1.shape[1], s2.shape[1], 340)
    canvas_w = max_w + 20
    canvas_h = target_h + 10

    def fit_canvas(sprite):
        sh, sw = sprite.shape[:2]
        canvas = np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8)
        off_x = (canvas_w - sw) // 2
        off_y = canvas_h - sh - 5 # align paws to bottom baseline
        canvas[off_y:off_y+sh, off_x:off_x+sw] = sprite
        return canvas

    final_step1 = fit_canvas(s1)
    final_step2 = fit_canvas(s2)

    # Save to public/mascot/
    cv2.imwrite('public/mascot/mascot-rpg-walk-1.png', final_step1)
    cv2.imwrite('public/mascot/mascot-rpg-walk-2.png', final_step2)
    cv2.imwrite('public/mascot/mascot-rpg-walk.png', final_step1)
    # Also update sad walk with the new 3D walk sprites
    cv2.imwrite('public/mascot/mascot-rpg-walk-sad-1.png', final_step1)
    cv2.imwrite('public/mascot/mascot-rpg-walk-sad-2.png', final_step2)

    print('Successfully generated mascot-rpg-walk-1.png and mascot-rpg-walk-2.png with shape:', final_step1.shape)

if __name__ == '__main__':
    extract_walk_sprites()
