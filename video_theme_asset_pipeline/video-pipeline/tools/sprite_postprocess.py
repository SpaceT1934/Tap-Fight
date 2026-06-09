import argparse
from collections import deque
import json
import math
import os
from PIL import Image, ImageDraw


def parse_size(value):
    text = str(value).lower().replace(" ", "")
    if "x" not in text:
        raise ValueError("size must be WIDTHxHEIGHT")
    width, height = text.split("x", 1)
    return int(width), int(height)


def parse_layout(value):
    width, height = parse_size(value)
    return width, height


def parse_hex_color(value, fallback):
    text = str(value or fallback).strip().lstrip("#")
    if len(text) != 6:
        text = fallback.lstrip("#")
    return tuple(int(text[index:index + 2], 16) for index in (0, 2, 4))


def ensure_dir(path):
    directory = os.path.dirname(os.path.abspath(path))
    if directory:
        os.makedirs(directory, exist_ok=True)


def remove_chroma_key(image, key_rgb, transparent_threshold, opaque_threshold):
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    kr, kg, kb = key_rgb
    max_distance = max(1.0, float(opaque_threshold - transparent_threshold))
    transparent = 0
    opaque = 0

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            distance = math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2)
            if distance <= transparent_threshold:
                pixels[x, y] = (0, 0, 0, 0)
                transparent += 1
                continue
            if distance < opaque_threshold:
                factor = max(0.0, min(1.0, (distance - transparent_threshold) / max_distance))
                new_alpha = int(a * factor)
                if kg > kr and kg > kb:
                    g = min(g, max(r, b) + 24)
                pixels[x, y] = (r, g, b, new_alpha)
                if new_alpha < 8:
                    transparent += 1
                else:
                    opaque += 1
                continue
            opaque += 1

    total = max(1, width * height)
    return rgba, {
        "transparent_ratio": round(transparent / total, 4),
        "opaque_ratio": round(opaque / total, 4)
    }


def trim_empty_border(image, padding):
    bbox = image.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def paste_contained(source, size, anchor="center"):
    target = Image.new("RGBA", size, (0, 0, 0, 0))
    work = source.copy()
    work.thumbnail((size[0] - 8, size[1] - 8), Image.Resampling.LANCZOS)
    x = (size[0] - work.width) // 2
    if anchor == "bottom":
        y = max(0, size[1] - work.height - 6)
    else:
        y = (size[1] - work.height) // 2
    target.alpha_composite(work, (x, y))
    return target


def expand_box(box, bleed_x, bleed_y, bounds):
    left, top, right, bottom = box
    max_w, max_h = bounds
    return (
        max(0, left - bleed_x),
        max(0, top - bleed_y),
        min(max_w, right + bleed_x),
        min(max_h, bottom + bleed_y)
    )


def overlap_area(a, b):
    left = max(a[0], b[0])
    top = max(a[1], b[1])
    right = min(a[2], b[2])
    bottom = min(a[3], b[3])
    if right <= left or bottom <= top:
        return 0
    return (right - left) * (bottom - top)


def box_area(box):
    return max(0, box[2] - box[0]) * max(0, box[3] - box[1])


def component_points_in_box(component, box):
    left, top, right, bottom = box
    count = 0
    for x, y in component["points"]:
        if x >= left and x < right and y >= top and y < bottom:
            count += 1
    return count


def component_touches_bounds(component, bounds, margin):
    left, top, right, bottom = component["bbox"]
    width, height = bounds
    return (
        left <= margin or top <= margin or
        right >= width - margin or bottom >= height - margin
    )


def inflate_box(box, dx, dy, bounds):
    return expand_box(box, dx, dy, bounds)


def find_alpha_components(image, alpha_threshold=8, min_area=8):
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = image.size
    visited = bytearray(width * height)
    components = []
    neighbors = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] <= alpha_threshold:
                continue

            queue = deque([(x, y)])
            visited[index] = 1
            area = 0
            left = right = x
            top = bottom = y
            sum_x = 0
            sum_y = 0
            points = []

            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                area += 1
                sum_x += cx
                sum_y += cy
                if cx < left:
                    left = cx
                if cx > right:
                    right = cx
                if cy < top:
                    top = cy
                if cy > bottom:
                    bottom = cy

                for dx, dy in neighbors:
                    nx = cx + dx
                    ny = cy + dy
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    next_index = ny * width + nx
                    if visited[next_index] or pixels[nx, ny] <= alpha_threshold:
                        continue
                    visited[next_index] = 1
                    queue.append((nx, ny))

            if area < min_area:
                continue
            components.append({
                "area": area,
                "bbox": (left, top, right + 1, bottom + 1),
                "center": (sum_x / float(area), sum_y / float(area)),
                "points": points
            })

    return components


def component_score(component, cell_box):
    cx = (cell_box[0] + cell_box[2]) / 2.0
    cy = (cell_box[1] + cell_box[3]) / 2.0
    comp_cx, comp_cy = component["center"]
    distance = math.sqrt((comp_cx - cx) ** 2 + (comp_cy - cy) ** 2)
    overlap_points = component.get("cell_points")
    if overlap_points is None:
        overlap_points = component_points_in_box(component, cell_box)
    bbox_overlap = overlap_area(component["bbox"], cell_box)
    return overlap_points * 5.0 + bbox_overlap * 0.35 + component["area"] * 0.35 - distance * 7.0


def isolate_cell_subject(image, cell_box, padding, anchor):
    components = find_alpha_components(image)
    if not components:
        return image, {"component_count": 0, "kept_count": 0, "alpha_bbox": image.getbbox()}

    for component in components:
        cell_points = component_points_in_box(component, cell_box)
        component["cell_points"] = cell_points
        component["cell_ratio"] = cell_points / float(max(1, component["area"]))
        component["bbox_cell_overlap"] = overlap_area(component["bbox"], cell_box)
        component["bbox_cell_ratio"] = component["bbox_cell_overlap"] / float(max(1, box_area(component["bbox"])))

    main = max(components, key=lambda item: component_score(item, cell_box))
    bounds = image.size
    main_influence = inflate_box(main["bbox"], int((cell_box[2] - cell_box[0]) * 0.18), int((cell_box[3] - cell_box[1]) * 0.18), bounds)
    cell_center = ((cell_box[0] + cell_box[2]) / 2.0, (cell_box[1] + cell_box[3]) / 2.0)
    max_distance = max(cell_box[2] - cell_box[0], cell_box[3] - cell_box[1]) * 0.68
    min_area = max(12, int(main["area"] * 0.0025))

    kept = []
    rejected = 0
    for component in components:
        comp_center = component["center"]
        distance = math.sqrt((comp_center[0] - cell_center[0]) ** 2 + (comp_center[1] - cell_center[1]) ** 2)
        cell_ratio = component["cell_ratio"]
        bbox_cell_ratio = component["bbox_cell_ratio"]
        near_main = overlap_area(component["bbox"], main_influence) > 0
        touches_edge = component_touches_bounds(component, bounds, 2)
        enough_area = component["area"] >= min_area
        mostly_in_cell = cell_ratio >= 0.55 or bbox_cell_ratio >= 0.55
        related_to_main = near_main and cell_ratio >= 0.32 and distance <= max_distance
        edge_fragment = touches_edge and cell_ratio < 0.72 and component["area"] < main["area"] * 0.35

        if component is main:
            kept.append(component)
        elif enough_area and not edge_fragment and (mostly_in_cell or related_to_main):
            kept.append(component)
        else:
            rejected += 1

    cleaned = Image.new("RGBA", image.size, (0, 0, 0, 0))
    src = image.load()
    dst = cleaned.load()
    for component in kept:
        for x, y in component["points"]:
            dst[x, y] = src[x, y]

    trimmed = trim_empty_border(cleaned, padding)
    framed = paste_contained(trimmed, (cell_box[2] - cell_box[0], cell_box[3] - cell_box[1]), anchor)
    main_overflows_cell = (
        main["bbox"][0] < cell_box[0] or
        main["bbox"][1] < cell_box[1] or
        main["bbox"][2] > cell_box[2] or
        main["bbox"][3] > cell_box[3]
    )
    return framed, {
        "component_count": len(components),
        "kept_count": len(kept),
        "rejected_count": rejected,
        "main_bbox": main["bbox"],
        "main_cell_ratio": round(main["cell_ratio"], 4),
        "main_overflows_cell": main_overflows_cell,
        "main_touches_source_edge": component_touches_bounds(main, bounds, 2),
        "alpha_bbox": framed.getbbox()
    }


def analyze_frame_quality(frame, cleanup, edge_margin_ratio):
    bbox = frame.getbbox()
    width, height = frame.size
    threshold = int(min(width, height) * edge_margin_ratio)
    if not bbox:
        return {
            "status": "warn",
            "min_edge_margin": 0,
            "edge_margin_threshold": threshold,
            "issues": ["empty_frame"]
        }

    margins = {
        "left": bbox[0],
        "top": bbox[1],
        "right": width - bbox[2],
        "bottom": height - bbox[3]
    }
    min_margin = min(margins.values())
    issues = []
    if min_margin <= threshold:
        issues.append("visible_content_too_close_to_frame_edge")
    if cleanup.get("main_touches_source_edge"):
        issues.append("source_subject_touched_crop_edge")
    if cleanup.get("main_overflows_cell"):
        issues.append("source_subject_overflowed_cell")

    return {
        "status": "warn" if issues else "ok",
        "min_edge_margin": min_margin,
        "edge_margin_threshold": threshold,
        "margins": margins,
        "issues": issues
    }


def process_sheet(args):
    target_size = parse_size(args.target_size)
    columns, rows = parse_layout(args.layout)
    frame_names = [item.strip() for item in args.frame_names.split(",") if item.strip()]
    if len(frame_names) != columns * rows:
        raise ValueError("frame_names count must equal layout columns * rows")

    source = Image.open(args.input).convert("RGBA")
    if source.size != target_size:
        source = source.resize(target_size, Image.Resampling.LANCZOS)

    key = parse_hex_color(args.chroma_key, "00ff00")
    sheet, alpha_stats = remove_chroma_key(source, key, args.transparent_threshold, args.opaque_threshold)

    os.makedirs(args.frames_dir, exist_ok=True)

    frame_width = target_size[0] // columns
    frame_height = target_size[1] // rows
    bleed_x = int(frame_width * max(0.0, args.cell_bleed_ratio))
    bleed_y = int(frame_height * max(0.0, args.cell_bleed_ratio))
    anchor = args.frame_anchor or ("bottom" if rows > 1 else "center")
    output_sheet = Image.new("RGBA", target_size, (0, 0, 0, 0))
    frames = []
    for index, name in enumerate(frame_names):
        col = index % columns
        row = index // columns
        box = (col * frame_width, row * frame_height, (col + 1) * frame_width, (row + 1) * frame_height)
        if args.no_auto_frame:
            frame = sheet.crop(box)
            cleanup = {
                "mode": "fixed_grid",
                "alpha_bbox": frame.getbbox()
            }
        else:
            expanded = expand_box(box, bleed_x, bleed_y, target_size)
            expanded_frame = sheet.crop(expanded)
            local_cell = (box[0] - expanded[0], box[1] - expanded[1], box[2] - expanded[0], box[3] - expanded[1])
            frame, cleanup = isolate_cell_subject(expanded_frame, local_cell, args.trim_padding, anchor)
            cleanup["mode"] = "component_center"
            cleanup["source_box"] = box
            cleanup["expanded_box"] = expanded
        frame_path = os.path.join(args.frames_dir, name + ".png")
        frame.save(frame_path)
        output_sheet.alpha_composite(frame, (col * frame_width, row * frame_height))
        quality = analyze_frame_quality(frame, cleanup, args.edge_margin_ratio)
        frames.append({
            "name": name,
            "path": frame_path.replace("\\", "/"),
            "width": frame_width,
            "height": frame_height,
            "alpha_bbox": frame.getbbox(),
            "cleanup": cleanup,
            "quality": quality
        })

    ensure_dir(args.sheet_output)
    output_sheet.save(args.sheet_output)

    if args.static_output:
        ensure_dir(args.static_output)
        first = Image.open(os.path.join(args.frames_dir, frame_names[0] + ".png")).convert("RGBA")
        first.save(args.static_output)

    risky_frames = [
        {"name": frame["name"], "issues": frame["quality"]["issues"]}
        for frame in frames
        if frame.get("quality", {}).get("status") != "ok"
    ]

    print(json.dumps({
        "status": "ok",
        "sheet_size": list(target_size),
        "frame_size": [frame_width, frame_height],
        "layout": [columns, rows],
        "alpha": alpha_stats,
        "quality": {
            "status": "warn" if risky_frames else "ok",
            "risky_frames": risky_frames
        },
        "frames": frames
    }, ensure_ascii=False))


def draw_character_cell(draw, cell, color, accent, role, pose_index):
    x0, y0, x1, y1 = cell
    width = x1 - x0
    height = y1 - y0
    cx = x0 + width // 2
    ground = y0 + int(height * 0.84)
    head_r = int(width * 0.075)
    body_w = int(width * 0.13)
    body_h = int(height * 0.26)
    lean = [0, 4, -12, 10, -8, 12, 0, -4, 18][pose_index % 9]
    lift = [0, 0, 0, 2, -4, 2, -34, 20, 0][pose_index % 9]

    head_c = (cx + lean, ground - body_h - head_r * 2 - 56 + lift)
    body_box = (
        cx - body_w + lean,
        ground - body_h - 54 + lift,
        cx + body_w + lean,
        ground - 54 + lift
    )
    draw.ellipse((head_c[0] - head_r, head_c[1] - head_r, head_c[0] + head_r, head_c[1] + head_r), fill=color)
    draw.rounded_rectangle(body_box, radius=max(4, body_w // 2), fill=color)
    draw.line((cx + lean - body_w, ground - 48 + lift, cx - 44, ground - 8), fill=color, width=10)
    draw.line((cx + lean + body_w, ground - 48 + lift, cx + 44, ground - 8), fill=color, width=10)
    draw.line((cx + lean - body_w, ground - body_h + lift, cx - 62, ground - body_h + 42 + lift), fill=color, width=10)

    if role == "ranged":
        arm_end = (cx + 92, ground - body_h + 32 + lift)
        draw.line((cx + lean + body_w, ground - body_h + 8 + lift, arm_end[0], arm_end[1]), fill=color, width=10)
        draw.ellipse((arm_end[0] + 16, arm_end[1] - 16, arm_end[0] + 52, arm_end[1] + 16), fill=accent)
    else:
        hand = (cx + 74, ground - body_h + 28 + lift)
        draw.line((cx + lean + body_w, ground - body_h + 8 + lift, hand[0], hand[1]), fill=color, width=10)
        draw.line((hand[0], hand[1], hand[0] + 80, hand[1] - 58), fill=accent, width=14)

    if pose_index == 8:
        draw.arc((cx + 12, ground - body_h - 20 + lift, cx + 180, ground + 90 + lift), 265, 35, fill=accent, width=12)


def make_placeholder(args):
    target_size = parse_size(args.target_size)
    columns, rows = parse_layout(args.layout)
    cell_w = target_size[0] // columns
    cell_h = target_size[1] // rows
    bg = parse_hex_color(args.chroma_key, "00ff00")
    color = parse_hex_color(args.color, "6b7280")
    accent = parse_hex_color(args.accent, "f59e0b")

    image = Image.new("RGBA", target_size, bg + (255,))
    draw = ImageDraw.Draw(image)
    if args.kind == "character":
        for index in range(columns * rows):
            col = index % columns
            row = index // columns
            cell = (col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)
            draw_character_cell(draw, cell, color, accent, args.role, index)
    else:
        for index in range(columns * rows):
            col = index % columns
            row = index // columns
            x0 = col * cell_w
            y0 = row * cell_h
            cx = x0 + cell_w // 2
            cy = y0 + cell_h // 2
            offset = (index % 4) * 9
            draw.ellipse((cx - 70, cy - 46, cx + 70, cy + 46), fill=accent + (255,))
            draw.line((cx - 120 - offset, cy, cx - 58, cy), fill=color + (255,), width=18)
            draw.arc((cx - 84, cy - 66, cx + 84, cy + 66), 210, 330, fill=color + (255,), width=10)

    ensure_dir(args.output)
    image.save(args.output)
    print(json.dumps({
        "status": "ok",
        "kind": args.kind,
        "output": args.output.replace("\\", "/"),
        "size": list(target_size),
        "layout": [columns, rows]
    }, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    process = subparsers.add_parser("process-sheet")
    process.add_argument("--input", required=True)
    process.add_argument("--sheet-output", required=True)
    process.add_argument("--frames-dir", required=True)
    process.add_argument("--layout", required=True)
    process.add_argument("--frame-names", required=True)
    process.add_argument("--target-size", required=True)
    process.add_argument("--static-output")
    process.add_argument("--chroma-key", default="00ff00")
    process.add_argument("--transparent-threshold", type=float, default=34.0)
    process.add_argument("--opaque-threshold", type=float, default=155.0)
    process.add_argument("--cell-bleed-ratio", type=float, default=0.14)
    process.add_argument("--trim-padding", type=int, default=14)
    process.add_argument("--edge-margin-ratio", type=float, default=0.02)
    process.add_argument("--frame-anchor", choices=["center", "bottom"])
    process.add_argument("--no-auto-frame", action="store_true")
    process.set_defaults(func=process_sheet)

    placeholder = subparsers.add_parser("make-placeholder")
    placeholder.add_argument("--kind", choices=["character", "projectile"], required=True)
    placeholder.add_argument("--output", required=True)
    placeholder.add_argument("--target-size", required=True)
    placeholder.add_argument("--layout", required=True)
    placeholder.add_argument("--role", default="melee")
    placeholder.add_argument("--color", default="6b7280")
    placeholder.add_argument("--accent", default="f59e0b")
    placeholder.add_argument("--chroma-key", default="00ff00")
    placeholder.set_defaults(func=make_placeholder)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
