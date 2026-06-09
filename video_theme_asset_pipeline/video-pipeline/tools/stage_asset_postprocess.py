import argparse
from collections import deque
import json
import os
from PIL import Image


def ensure_dir(path):
    directory = os.path.dirname(os.path.abspath(path))
    if directory:
        os.makedirs(directory, exist_ok=True)


def is_matte_candidate(pixel, min_rgb, max_spread):
    r, g, b, a = pixel
    if a <= 8:
        return True
    if min(r, g, b) < min_rgb:
        return False
    return max(r, g, b) - min(r, g, b) <= max_spread


def alpha_for_matte(pixel, soft_min_rgb, hard_min_rgb):
    r, g, b, a = pixel
    if a <= 8:
        return 0
    low = min(r, g, b)
    if low >= hard_min_rgb:
        return 0
    if low <= soft_min_rgb:
        return a
    factor = float(hard_min_rgb - low) / float(max(1, hard_min_rgb - soft_min_rgb))
    return int(max(0, min(a, a * factor)))


def remove_border_matte(input_path, output_path, min_rgb, soft_min_rgb, hard_min_rgb, max_spread):
    image = Image.open(input_path).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    visited = set()
    queue = deque()

    def enqueue(x, y):
        if x < 0 or y < 0 or x >= width or y >= height:
            return
        key = (x, y)
        if key in visited:
            return
        if not is_matte_candidate(pixels[x, y], min_rgb, max_spread):
            return
        visited.add(key)
        queue.append(key)

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    removed = 0
    softened = 0
    while queue:
        x, y = queue.popleft()
        r, g, b, a = pixels[x, y]
        new_alpha = alpha_for_matte((r, g, b, a), soft_min_rgb, hard_min_rgb)
        if new_alpha <= 8:
            pixels[x, y] = (r, g, b, 0)
            removed += 1
        elif new_alpha < a:
            pixels[x, y] = (r, g, b, new_alpha)
            softened += 1

        enqueue(x + 1, y)
        enqueue(x - 1, y)
        enqueue(x, y + 1)
        enqueue(x, y - 1)

    transparent = 0
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] <= 8:
                transparent += 1

    ensure_dir(output_path)
    image.save(output_path)
    total = max(1, width * height)
    print(json.dumps({
        "status": "ok",
        "size": [width, height],
        "border_matte_pixels": len(visited),
        "removed_pixels": removed,
        "softened_pixels": softened,
        "matte_ratio": round(len(visited) / total, 4),
        "transparent_ratio": round(transparent / total, 4)
    }, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--min-rgb", type=int, default=205)
    parser.add_argument("--soft-min-rgb", type=int, default=205)
    parser.add_argument("--hard-min-rgb", type=int, default=238)
    parser.add_argument("--max-spread", type=int, default=60)
    args = parser.parse_args()
    remove_border_matte(
        args.input,
        args.output,
        args.min_rgb,
        args.soft_min_rgb,
        args.hard_min_rgb,
        args.max_spread
    )


if __name__ == "__main__":
    main()
