import argparse
import json
import math
import sys

import numpy as np
from PIL import Image, ImageFilter


def import_cv2():
    try:
        import cv2

        return cv2
    except Exception as exc:
        return None


def parse_box(value):
    parts = [float(part) for part in value.split(",")]
    if len(parts) != 4:
        raise ValueError("--box must be x,y,w,h")
    x, y, width, height = parts
    x = min(max(x, 0.0), 0.98)
    y = min(max(y, 0.0), 0.98)
    width = min(max(width, 0.04), 1.0 - x)
    height = min(max(height, 0.04), 1.0 - y)
    return x, y, width, height


def parse_size(value):
    parts = value.lower().replace("x", ",").split(",")
    if len(parts) != 2:
        raise ValueError("--size must be WIDTHxHEIGHT")
    width = int(parts[0])
    height = int(parts[1])
    if width <= 0 or height <= 0:
        raise ValueError("--size values must be positive")
    return width, height


def normalized_box_to_pixels(box, image_size):
    img_w, img_h = image_size
    x, y, width, height = box
    left = int(math.floor(x * img_w))
    top = int(math.floor(y * img_h))
    right = int(math.ceil((x + width) * img_w))
    bottom = int(math.ceil((y + height) * img_h))
    left = min(max(left, 0), img_w - 2)
    top = min(max(top, 0), img_h - 2)
    right = min(max(right, left + 2), img_w)
    bottom = min(max(bottom, top + 2), img_h)
    return left, top, right, bottom


def largest_component(cv2, mask):
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if count <= 1:
        return mask
    areas = stats[1:, cv2.CC_STAT_AREA]
    largest = int(np.argmax(areas)) + 1
    return labels == largest


def largest_component_numpy(mask):
    try:
        from scipy import ndimage

        labels, count = ndimage.label(mask)
        if count <= 1:
            return mask
        areas = np.bincount(labels.ravel())
        areas[0] = 0
        return labels == int(np.argmax(areas))
    except Exception:
        return mask


def soften_mask(cv2, mask, kind):
    min_dim = min(mask.shape[:2])
    kernel_size = 3 if min_dim < 120 else 5
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    refined = mask.astype(np.uint8) * 255
    refined = cv2.morphologyEx(refined, cv2.MORPH_CLOSE, kernel, iterations=1)
    refined = cv2.morphologyEx(refined, cv2.MORPH_OPEN, kernel, iterations=1)
    if kind in ("head", "body"):
        refined = largest_component(cv2, refined > 0).astype(np.uint8) * 255
    blur_size = 3 if min_dim < 180 else 5
    refined = cv2.GaussianBlur(refined, (blur_size, blur_size), 0)
    return refined


def fit_to_canvas(rgba, output_size):
    out_w, out_h = output_size
    src_w, src_h = rgba.size
    scale = min(out_w / src_w, out_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = rgba.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((out_w - new_w) // 2, (out_h - new_h) // 2))
    return canvas


def segment_crop_opencv(cv2, crop, output_size, kind):
    rgb = np.array(crop)
    crop_w, crop_h = crop.size
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    mask = np.zeros((crop_h, crop_w), np.uint8)

    margin_x = max(1, int(round(crop_w * 0.025)))
    margin_y = max(1, int(round(crop_h * 0.025)))
    rect_w = max(2, crop_w - margin_x * 2)
    rect_h = max(2, crop_h - margin_y * 2)
    rect = (margin_x, margin_y, rect_w, rect_h)

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, rect, bgd_model, fgd_model, 6, cv2.GC_INIT_WITH_RECT)
    foreground = np.logical_or(mask == cv2.GC_FGD, mask == cv2.GC_PR_FGD)
    coverage = float(np.mean(foreground))
    if coverage < 0.02:
        raise RuntimeError("segmentation produced an almost empty mask")

    alpha = soften_mask(cv2, foreground, kind)
    rgba = np.dstack([rgb, alpha]).astype(np.uint8)
    result = fit_to_canvas(Image.fromarray(rgba, "RGBA"), output_size)
    return result, "opencv_grabcut", coverage


def sample_border_colors(rgb):
    height, width = rgb.shape[:2]
    border = max(2, int(round(min(width, height) * 0.06)))
    samples = np.concatenate(
        [
            rgb[:border, :, :].reshape(-1, 3),
            rgb[-border:, :, :].reshape(-1, 3),
            rgb[:, :border, :].reshape(-1, 3),
            rgb[:, -border:, :].reshape(-1, 3),
        ],
        axis=0,
    ).astype(np.float32)
    if len(samples) > 384:
        step = max(1, len(samples) // 384)
        samples = samples[::step][:384]
    return samples


def min_color_distance(rgb, samples):
    pixels = rgb.reshape(-1, 3).astype(np.float32)
    best = np.full((pixels.shape[0],), np.inf, dtype=np.float32)
    chunk = 4096
    for start in range(0, pixels.shape[0], chunk):
        current = pixels[start : start + chunk]
        diff = current[:, None, :] - samples[None, :, :]
        dist = np.sum(diff * diff, axis=2)
        best[start : start + chunk] = np.min(dist, axis=1)
    return np.sqrt(best).reshape(rgb.shape[:2])


def otsu_threshold(values):
    scaled = np.clip(values * 255, 0, 255).astype(np.uint8)
    hist = np.bincount(scaled.ravel(), minlength=256).astype(np.float64)
    total = scaled.size
    sum_total = np.dot(np.arange(256), hist)
    weight_bg = 0.0
    sum_bg = 0.0
    best_var = -1.0
    threshold = 96
    for idx in range(256):
        weight_bg += hist[idx]
        if weight_bg <= 0:
            continue
        weight_fg = total - weight_bg
        if weight_fg <= 0:
            break
        sum_bg += idx * hist[idx]
        mean_bg = sum_bg / weight_bg
        mean_fg = (sum_total - sum_bg) / weight_fg
        between = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
        if between > best_var:
            best_var = between
            threshold = idx
    return threshold / 255.0


def binary_dilate(mask, iterations=1):
    result = mask.astype(bool)
    for _ in range(iterations):
        padded = np.pad(result, 1, mode="constant", constant_values=False)
        neighbors = []
        for yy in range(3):
            for xx in range(3):
                neighbors.append(padded[yy : yy + result.shape[0], xx : xx + result.shape[1]])
        result = np.logical_or.reduce(neighbors)
    return result


def binary_erode(mask, iterations=1):
    result = mask.astype(bool)
    for _ in range(iterations):
        padded = np.pad(result, 1, mode="constant", constant_values=False)
        neighbors = []
        for yy in range(3):
            for xx in range(3):
                neighbors.append(padded[yy : yy + result.shape[0], xx : xx + result.shape[1]])
        result = np.logical_and.reduce(neighbors)
    return result


def central_prior(shape, kind):
    height, width = shape
    yy, xx = np.mgrid[0:height, 0:width]
    cx = (width - 1) * 0.5
    cy = (height - 1) * (0.48 if kind == "head" else 0.54)
    sx = width * (0.42 if kind == "head" else 0.48)
    sy = height * (0.45 if kind == "head" else 0.52)
    return np.exp(-(((xx - cx) / max(1, sx)) ** 2 + ((yy - cy) / max(1, sy)) ** 2))


def fallback_shape_mask(shape, kind):
    height, width = shape
    prior = central_prior(shape, kind)
    threshold = 0.34 if kind in ("head", "body") else 0.44
    return prior > threshold


def segment_crop_numpy(crop, output_size, kind):
    rgb = np.array(crop.convert("RGB"))
    height, width = rgb.shape[:2]
    if width < 8 or height < 8:
        raise RuntimeError("crop is too small for segmentation")

    samples = sample_border_colors(rgb)
    distance = min_color_distance(rgb, samples)
    distance_score = np.clip(distance / 90.0, 0.0, 1.0)
    prior = central_prior((height, width), kind)
    threshold = otsu_threshold(distance_score)
    mask = np.logical_or(
        distance_score > max(0.20, threshold * 0.88),
        np.logical_and(prior > 0.48, distance_score > max(0.12, threshold * 0.52)),
    )

    border = max(1, int(round(min(width, height) * 0.025)))
    mask[:border, :] = False
    mask[-border:, :] = False
    mask[:, :border] = False
    mask[:, -border:] = False

    mask = binary_dilate(binary_erode(mask, 1), 1)
    if kind in ("head", "body"):
        mask = largest_component_numpy(mask)
    coverage = float(np.mean(mask))
    min_coverage = 0.11 if kind == "head" else 0.08 if kind == "body" else 0.025
    if coverage < min_coverage or coverage > 0.94:
        mask = fallback_shape_mask((height, width), kind)
        coverage = float(np.mean(mask))

    alpha = (mask.astype(np.uint8) * 255)
    alpha_image = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(radius=1.4))
    rgba = crop.convert("RGBA")
    rgba.putalpha(alpha_image)
    result = fit_to_canvas(rgba, output_size)
    return result, "numpy_border_foreground", coverage


def segment_crop(input_path, output_path, box, output_size, kind):
    image = Image.open(input_path).convert("RGB")
    crop_box = normalized_box_to_pixels(box, image.size)
    crop = image.crop(crop_box)
    crop_w, crop_h = crop.size
    if crop_w < 8 or crop_h < 8:
        raise RuntimeError("crop is too small for segmentation")

    cv2 = import_cv2()
    if cv2 is not None:
        result, method, coverage = segment_crop_opencv(cv2, crop, output_size, kind)
    else:
        result, method, coverage = segment_crop_numpy(crop, output_size, kind)

    result.save(output_path)

    alpha_array = np.array(result.getchannel("A"))
    output_coverage = float(np.mean(alpha_array > 8))
    print(
        json.dumps(
            {
                "status": "ok",
                "method": method,
                "crop_pixels": list(crop_box),
                "alpha_coverage": round(output_coverage, 4),
                "raw_alpha_coverage": round(coverage, 4),
                "output_size": list(output_size),
            },
            ensure_ascii=False,
        )
    )


def main():
    parser = argparse.ArgumentParser(description="Segment a normalized video-frame crop into a transparent PNG.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--box", required=True)
    parser.add_argument("--size", required=True)
    parser.add_argument("--kind", default="asset", choices=["head", "body", "prop", "asset"])
    args = parser.parse_args()

    try:
        segment_crop(args.input, args.output, parse_box(args.box), parse_size(args.size), args.kind)
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
