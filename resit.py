import cv2 as cv
import numpy as np
from dataclasses import dataclass
import argparse
import time

#  establishing the colour ranges to detect the colour on the resistor.
#  these colour values vary depending on the camera settings, white balance and lighting.
#  Vary these parameters to suit your use-case
#  Colours are thresholded in the HSV colour space. more can be found at (https://en.wikipedia.org/wiki/HSL_and_HSV)
Colour_Range = [
    [(0, 0, 0), (255, 255, 20), "BLACK", 0, (0, 0, 0)],
    [(0, 90, 10), (15, 250, 100), "BROWN", 1, (0, 51, 102)],
    [(0, 30, 80), (10, 255, 200), "RED", 2, (0, 0, 255)],
    [(5, 150, 150), (15, 235, 250), "ORANGE", 3, (0, 128, 255)],  # ok
    [(50, 100, 100), (70, 255, 255), "YELLOW", 4, (0, 255, 255)],
    [(45, 100, 50), (75, 255, 255), "GREEN", 5, (0, 255, 0)],  # ok
    [(100, 150, 0), (140, 255, 255), "BLUE", 6, (255, 0, 0)],  # ok
    [(120, 40, 100), (140, 250, 220), "VIOLET", 7, (255, 0, 127)],
    [(0, 0, 50), (179, 50, 80), "GRAY", 8, (128, 128, 128)],
    [(0, 0, 90), (179, 15, 250), "WHITE", 9, (255, 255, 255)],
]

Red_top_low = (160, 30, 80)
Red_top_high = (179, 255, 200)

@dataclass
class Config:
    # Resize the longest side to at most this many pixels (0 = no resize)
    max_dim: int = 900
    # Blur to reduce noise ("gaussian" or "bilateral"). Bilateral is slower.
    blur: str = "gaussian"
    # Kernel size for Gaussian blur (odd number)
    gaussian_ksize: int = 7
    # Bilateral params (used only if blur == "bilateral")
    bilateral_d: int = 9
    bilateral_sigma_color: int = 75
    bilateral_sigma_space: int = 75
    # Thresholding (adaptive is slower; Otsu is faster and usually good)
    use_adaptive: bool = False
    adaptive_block_size: int = 51
    adaptive_C: int = 2
    # Morphology kernel for mask cleanup
    morph_kernel: int = 3
    # Contour filtering
    min_area: int = 0  # 0 = auto based on image size
    # Show debug windows/contours
    debug: bool = False


# setting up other basic necessities such as font and minimum area for a valid contour #
FONT = cv.FONT_HERSHEY_SIMPLEX


# method to find bands of the resistor
def _estimate_min_area(h: int, w: int, cfg: Config) -> int:
    if cfg.min_area > 0:
        return cfg.min_area
    # Heuristic: 0.05% of image area, at least 50 px
    return max(50, int(0.0005 * h * w))


def _preprocess(img: np.ndarray, cfg: Config):
    h, w = img.shape[:2]
    scale = 1.0
    if cfg.max_dim and max(h, w) > cfg.max_dim:
        scale = cfg.max_dim / float(max(h, w))
        img = cv.resize(img, (int(w * scale), int(h * scale)), interpolation=cv.INTER_AREA)

    if cfg.blur == "bilateral":
        img_blur = cv.bilateralFilter(img, cfg.bilateral_d, cfg.bilateral_sigma_color, cfg.bilateral_sigma_space)
    else:
        k = max(3, cfg.gaussian_ksize | 1)  # ensure odd
        img_blur = cv.GaussianBlur(img, (k, k), 0)

    gray = cv.cvtColor(img_blur, cv.COLOR_BGR2GRAY)
    hsv = cv.cvtColor(img_blur, cv.COLOR_BGR2HSV)

    if cfg.use_adaptive:
        b = max(3, cfg.adaptive_block_size | 1)
        th = cv.adaptiveThreshold(gray, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, b, cfg.adaptive_C)
    else:
        # Fallback to Otsu threshold
        _, th = cv.threshold(gray, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    th = cv.bitwise_not(th)
    return img_blur, gray, hsv, th


def _resistor_roi_mask(gray: np.ndarray, th: np.ndarray, cfg: Config) -> np.ndarray:
    # Combine edges and threshold to isolate the resistor body region
    h, w = gray.shape[:2]
    edges = cv.Canny(gray, 50, 150)
    # Merge with thresholded foreground
    merged = cv.bitwise_or(edges, th)
    k = max(3, cfg.morph_kernel)
    kernel = cv.getStructuringElement(cv.MORPH_RECT, (k, k))
    closed = cv.morphologyEx(merged, cv.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv.findContours(closed, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    if not contours:
        return np.ones_like(gray, dtype=np.uint8) * 255  # no ROI found; allow full image

    # Choose largest elongated contour as resistor body
    best = None
    best_score = -1.0
    for c in contours:
        area = cv.contourArea(c)
        if area < 0.001 * h * w:
            continue
        x, y, ww, hh = cv.boundingRect(c)
        ar = max(ww, hh) / max(1.0, float(min(ww, hh)))
        score = area * (ar if ar > 1.5 else 1.0)
        if score > best_score:
            best = c
            best_score = score

    mask = np.zeros_like(gray, dtype=np.uint8)
    if best is not None:
        cv.drawContours(mask, [best], -1, 255, thickness=cv.FILLED)
    else:
        mask[:, :] = 255
    return mask


def findBands(img: np.ndarray, cfg: Config = Config()):
    t0 = time.perf_counter()
    img1, img_gray, img_hsv, thresh = _preprocess(img, cfg)
    h, w = img1.shape[:2]
    min_area = _estimate_min_area(h, w, cfg)

    bandpos = []

    # Precompute red wrap-around mask once
    pre_red_mask = cv.inRange(img_hsv, Red_top_low, Red_top_high)

    kernel = cv.getStructuringElement(cv.MORPH_RECT, (cfg.morph_kernel, cfg.morph_kernel))

    # Limit search to resistor region for accuracy and speed
    roi_mask = _resistor_roi_mask(img_gray, thresh, cfg)

    for clr in Colour_Range:  # check with the pre-defined colour spaces
        mask = cv.inRange(img_hsv, clr[0], clr[1])
        if clr[2] == 'RED':
            mask = cv.bitwise_or(pre_red_mask, mask)

        # Use threshold to suppress background and clean with morphology
        mask = cv.bitwise_and(mask, thresh)
        # Apply ROI
        mask = cv.bitwise_and(mask, roi_mask)
        if cfg.morph_kernel > 1:
            mask = cv.morphologyEx(mask, cv.MORPH_OPEN, kernel, iterations=1)

        contours, _ = cv.findContours(mask, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

        # Collect valid bands from contours
        for cont in contours:
            if not validContours(cont, min_area=min_area):
                continue
            # finds the left most point of each valid contour
            idx = np.argmin(cont[:, :, 0])
            lmp = tuple(cont[idx][0])
            bandpos.append(lmp + tuple(clr[2:]))

        if cfg.debug:
            cv.drawContours(img1, contours, -1, clr[-1], 2)

    if cfg.debug:
        cv.imshow('Contour Display', img1)
        cv.imshow('ROI', roi_mask)
    t1 = time.perf_counter()
    if cfg.debug:
        print(f"findBands time: {(t1 - t0)*1000:.1f} ms")
    return sorted(bandpos, key=lambda tup: tup[0])


# method to check the validity of the contours
def validContours(cont, min_area: int = 0):
    if cv.contourArea(cont) < min_area:  # filters out all the tiny contours
        return False
    x, y, w, h = cv.boundingRect(cont)
    # Reject very elongated horizontal blobs (likely non-band)
    if h == 0 or float(w) / h > 0.40:
        return False
    return True


def displayResults(sortedbands):
    strvalue = ""
    if len(sortedbands) in [3, 4, 5]:
        for band in sortedbands[:-1]:
            strvalue += str(band[3])  # calculates the value of resistance
        intvalue = int(strvalue)
        intvalue *= 10 ** sortedbands[-1][3]  # applies the correct multiplier and stores the final resistance value
        print("The Resistance is ", intvalue, "ohms")
    return


# main method, here we accept the image.
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Detect resistor color bands and compute value')
    parser.add_argument('-i', '--image', type=str, default='testresistor.jpg', help='Path to input image')
    parser.add_argument('--debug', action='store_true', help='Show debug windows and timings')
    parser.add_argument('--max-dim', type=int, default=900, help='Resize longest image side to this (0 to disable)')
    parser.add_argument('--adaptive', action='store_true', help='Use adaptive threshold (slower, sometimes more robust)')
    args = parser.parse_args()

    image = cv.imread(args.image)
    if image is None:
        raise SystemExit(f'Error: Could not load image {args.image}.')
    cfg = Config(debug=args.debug, max_dim=args.max_dim, use_adaptive=args.adaptive)
    sortedbands = findBands(image, cfg=cfg)
    displayResults(sortedbands)
    cv.waitKey(0)
    cv.destroyAllWindows()
