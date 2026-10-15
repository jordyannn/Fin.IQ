import os
import cv2
import numpy as np
from scipy.ndimage import binary_fill_holes

def extract_tech_sprites():
    src_path = r"C:\Users\BRAVO\.gemini\antigravity-ide\brain\312231f7-36b8-403b-a9d4-84bfa4aedad1\.user_uploaded\media_1792056658765.jpg"
    out_dir = r"c:\Project Coding\Fin.IQ\public\mascot"
    os.makedirs(out_dir, exist_ok=True)

    img = cv2.imread(src_path)
    h, w = img.shape[:2]

    col_w = w / 3.0
    row_h = h / 3.0

    # Exact gap row between character/props and bottom text label for each cell
    gap_rows = [
        [234, 235, 240], # Row 0: halo, penjelasan, analisis
        [227, 230, 226], # Row 1: warning, teori, berpikir
        [218, 214, 215]  # Row 2: solusi, acc, rumit
    ]

    grid_names = [
        ["mascot-tech-halo", "mascot-tech-penjelasan", "mascot-tech-analisis"],
        ["mascot-tech-warning", "mascot-tech-teori", "mascot-tech-berpikir"],
        ["mascot-tech-solusi", "mascot-tech-acc", "mascot-tech-rumit"],
    ]

    print(f"Source size: {w}x{h}, Col: {col_w:.1f}, Row: {row_h:.1f}")

    for r in range(3):
        for c in range(3):
            name = grid_names[r][c]
            x1 = int(c * col_w)
            x2 = int((c + 1) * col_w)
            y1 = int(r * row_h)
            y2 = int((r + 1) * row_h)

            cell = img[y1:y2, x1:x2]
            ch, cw = cell.shape[:2]

            gap_y = gap_rows[r][c]
            char_crop = cell[0:gap_y, 0:cw].copy()
            c_h, c_w = char_crop.shape[:2]

            # Checkerboard background detection:
            # Low saturation (R=G=B within 6) and high brightness (>= 215)
            c_diff = np.max(char_crop, axis=2) - np.min(char_crop, axis=2)
            c_min = np.min(char_crop, axis=2)
            is_checker = (c_diff <= 6) & (c_min >= 215)

            # Connected components of checkerboard
            num_l, lbls, stats, cents = cv2.connectedComponentsWithStats(is_checker.astype(np.uint8) * 255)

            # Background labels are ONLY those connected to outer image borders
            border_lbls = set()
            border_lbls.update(lbls[0, :])
            border_lbls.update(lbls[-1, :])
            border_lbls.update(lbls[:, 0])
            border_lbls.update(lbls[:, -1])
            border_lbls.discard(0)

            bg_mask = np.isin(lbls, list(border_lbls))
            fg_bool = ~bg_mask

            # Fill ALL internal holes so glasses, clothes, paper, eyes, teeth NEVER have holes!
            fg_solid = binary_fill_holes(fg_bool).astype(np.uint8) * 255

            # Antialiasing on outer edge
            alpha = cv2.GaussianBlur(fg_solid.astype(float), (3, 3), 0.5)
            alpha = np.clip(alpha, 0, 255).astype(np.uint8)

            # Bounding box crop around character
            pts = np.where(alpha > 15)
            if len(pts[0]) > 0:
                min_y, max_y = np.min(pts[0]), np.max(pts[0])
                min_x, max_x = np.min(pts[1]), np.max(pts[1])
                min_y = max(0, min_y - 2)
                max_y = min(c_h, max_y + 3)
                min_x = max(0, min_x - 2)
                max_x = min(c_w, max_x + 3)

                char_crop = char_crop[min_y:max_y, min_x:max_x]
                alpha = alpha[min_y:max_y, min_x:max_x]

            b, g, red = cv2.split(char_crop)
            rgba = cv2.merge([b, g, red, alpha])

            out_file = os.path.join(out_dir, f"{name}.png")
            cv2.imwrite(out_file, rgba)
            print(f"Saved {name}.png ({rgba.shape[1]}x{rgba.shape[0]}) with clean transparent background & intact clothes!")

    print("All 9 transparent tech mascot sprites created successfully!")

if __name__ == "__main__":
    extract_tech_sprites()
