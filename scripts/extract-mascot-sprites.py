import os
import cv2
import numpy as np

def extract_and_remove_background():
    src_path = r"C:\Users\BRAVO\.gemini\antigravity-ide\brain\312231f7-36b8-403b-a9d4-84bfa4aedad1\.user_uploaded\media_1792053094362.jpg"
    out_dir = r"c:\Project Coding\Fin.IQ\public\mascot"
    os.makedirs(out_dir, exist_ok=True)

    img = cv2.imread(src_path)
    h, w = img.shape[:2]

    grid_names = [
        ["mascot-halo", "mascot-bicara", "mascot-boncos"],
        ["mascot-cuan", "mascot-bingung", "mascot-analisis"],
        ["mascot-hemat", "mascot-stabil", "mascot-sedih"],
    ]

    col_w = w / 3.0
    row_h = h / 3.0

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

            # Crop character area, excluding bottom text label
            char_crop = cell[2:int(ch * 0.835), 4:cw - 4]
            ch_h, ch_w = char_crop.shape[:2]

            # 1. Sample background color from outer borders
            corner_samples = [
                char_crop[2, 2], char_crop[2, ch_w - 3],
                char_crop[ch_h - 3, 2], char_crop[ch_h - 3, ch_w - 3]
            ]
            bg_color = np.median(corner_samples, axis=0)

            # 2. Flood fill from outer perimeter
            flood_mask = np.zeros((ch_h + 2, ch_w + 2), np.uint8)
            diff = (18, 18, 18)
            filled = char_crop.copy()

            for x in range(0, ch_w, 4):
                cv2.floodFill(filled, flood_mask, (x, 0), (0, 0, 0), diff, diff, flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8))
                cv2.floodFill(filled, flood_mask, (x, ch_h - 1), (0, 0, 0), diff, diff, flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8))
            for y in range(0, ch_h, 4):
                cv2.floodFill(filled, flood_mask, (0, y), (0, 0, 0), diff, diff, flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8))
                cv2.floodFill(filled, flood_mask, (ch_w - 1, y), (0, 0, 0), diff, diff, flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8))

            bg_mask = flood_mask[1:ch_h + 1, 1:ch_w + 1]

            # 3. Detect any enclosed background regions (e.g. between arms, between ears)
            dist_to_bg = np.linalg.norm(char_crop.astype(float) - bg_color.astype(float), axis=2)
            potential_bg = (dist_to_bg < 14).astype(np.uint8) * 255

            num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(potential_bg)
            for lbl in range(1, num_labels):
                comp_mask = (labels == lbl).astype(np.uint8)
                mean_c = np.mean(char_crop[labels == lbl], axis=0)
                # Ensure it's close to background and not pure white (muzzle/paws are pure white ~255)
                if np.linalg.norm(mean_c - bg_color) < 8:
                    bg_mask = cv2.bitwise_or(bg_mask, comp_mask * 255)

            # Invert to foreground
            fg_mask = cv2.bitwise_not(bg_mask)

            # Morphological close / slight antialiasing on outer contour
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            fg_clean = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)

            # Gaussian blur for soft natural antialiasing edge
            alpha_blurred = cv2.GaussianBlur(fg_clean.astype(float), (3, 3), 0)
            alpha_final = np.clip(alpha_blurred, 0, 255).astype(np.uint8)

            b, g, red = cv2.split(char_crop)
            rgba = cv2.merge([b, g, red, alpha_final])

            # Tight crop bounding box around foreground to eliminate unnecessary transparent whitespace
            fg_pts = np.where(alpha_final > 10)
            if len(fg_pts[0]) > 0:
                min_y, max_y = np.min(fg_pts[0]), np.max(fg_pts[0])
                min_x, max_x = np.min(fg_pts[1]), np.max(fg_pts[1])
                # Add 3px safety margin
                min_y = max(0, min_y - 3)
                max_y = min(ch_h, max_y + 4)
                min_x = max(0, min_x - 3)
                max_x = min(ch_w, max_x + 4)
                rgba_cropped = rgba[min_y:max_y, min_x:max_x]
            else:
                rgba_cropped = rgba

            out_file = os.path.join(out_dir, f"{name}.png")
            cv2.imwrite(out_file, rgba_cropped)
            print(f"Saved transparent {name}.png ({rgba_cropped.shape[1]}x{rgba_cropped.shape[0]})")

    print("All 9 transparent mascot sprites created successfully in public/mascot/!")

if __name__ == "__main__":
    extract_and_remove_background()
