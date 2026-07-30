#!/usr/bin/env python3
"""Generate a conservative visual-quality audit for MemeLab template assets.

This is a development utility, not part of the Vercel build. It compares
multiple center crops so alternate resolutions and lightly cropped versions
still become review candidates instead of silently entering the catalog.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError
from scipy.fft import dctn

CROP_MARGINS = (0.0, 0.04, 0.08, 0.14, 0.20)
REMOVED_IDS = {
    "142009471", "mg_woman-cat", "mg_reveal", "mg_captain", "mg_mordor",
    "mg_oprah", "mg_gb", "mg_cbb", "mg_yallgot", "mg_yodawg",
    "mg_rollsafe", "91998305", "mg_midwit", "mg_ds",
}


def normalized_name(value: str) -> str:
    return "".join(character for character in value.lower() if character.isalnum())


def center_crop(image: Image.Image, margin: float) -> Image.Image:
    if not margin:
        return image
    width, height = image.size
    x = round(width * margin)
    y = round(height * margin)
    return image.crop((x, y, width - x, height - y))


def phash(image: Image.Image, margin: float = 0.0) -> int:
    sample = center_crop(image, margin).convert("L").resize((32, 32), Image.Resampling.LANCZOS)
    coefficients = dctn(np.asarray(sample, dtype=np.float32), norm="ortho")[:8, :8]
    values = coefficients.flatten()
    median = np.median(values[1:])
    bits = values > median
    result = 0
    for bit in bits:
        result = (result << 1) | int(bit)
    return result


def descriptor(image: Image.Image, margin: float = 0.0) -> np.ndarray:
    sample = center_crop(image, margin).convert("L").resize((40, 40), Image.Resampling.LANCZOS)
    values = np.asarray(sample, dtype=np.float32) / 255.0
    gradient_x = np.diff(values, axis=1, append=values[:, -1:])
    gradient_y = np.diff(values, axis=0, append=values[-1:, :])
    combined = np.concatenate((values.flatten(), gradient_x.flatten(), gradient_y.flatten()))
    combined -= combined.mean()
    norm = np.linalg.norm(combined)
    return combined / norm if norm else combined


def color_histogram(image: Image.Image) -> np.ndarray:
    sample = image.convert("RGB").resize((96, 96), Image.Resampling.BILINEAR)
    values = np.asarray(sample)
    histograms = []
    for channel in range(3):
        histogram, _ = np.histogram(values[:, :, channel], bins=16, range=(0, 256))
        histograms.append(histogram.astype(np.float32))
    result = np.concatenate(histograms)
    norm = np.linalg.norm(result)
    return result / norm if norm else result


def hamming(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def cosine(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.dot(left, right))


def audit(rows: list[dict], image_directory: Path) -> tuple[list[dict], list[dict]]:
    records = []
    problems = []
    by_id = {str(row["id"]): row for row in rows if str(row["id"]) not in REMOVED_IDS}
    files = {path.name.split("-", 1)[1].rsplit(".", 1)[0]: path for path in image_directory.iterdir()}

    for template_id, row in by_id.items():
        path = files.get(template_id)
        if not path:
            problems.append({"id": template_id, "name": row["name"], "issue": "missing_file"})
            continue
        try:
            with Image.open(path) as source:
                source.load()
                image = source.convert("RGB")
        except (OSError, UnidentifiedImageError) as error:
            problems.append({"id": template_id, "name": row["name"], "issue": "invalid_image", "detail": str(error)})
            continue

        width, height = image.size
        if width < 300 or height < 200:
            problems.append({
                "id": template_id,
                "name": row["name"],
                "issue": "low_resolution",
                "width": width,
                "height": height,
            })

        records.append({
            "id": template_id,
            "name": row["name"],
            "rank": int(row.get("rank") or 0),
            "path": path,
            "width": width,
            "height": height,
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "hashes": [phash(image, margin) for margin in CROP_MARGINS],
            "descriptors": [descriptor(image, margin) for margin in (0.0, 0.08, 0.14, 0.20)],
            "histogram": color_histogram(image),
        })

    candidates = []
    for index, left in enumerate(records):
        for right in records[index + 1:]:
            exact = left["sha256"] == right["sha256"]
            hash_distance = min(hamming(a, b) for a in left["hashes"] for b in right["hashes"])
            scene_similarity = max(
                cosine(a, b) for a in left["descriptors"] for b in right["descriptors"]
            )
            histogram_similarity = cosine(left["histogram"], right["histogram"])
            name_similarity = SequenceMatcher(
                None, normalized_name(left["name"]), normalized_name(right["name"])
            ).ratio()
            same_aspect = abs(
                math.log((left["width"] / left["height"]) / (right["width"] / right["height"]))
            ) < 0.08

            score = 0
            reasons = []
            if exact:
                score += 100
                reasons.append("exact")
            if hash_distance <= 6:
                score += 55
                reasons.append(f"phash:{hash_distance}")
            elif hash_distance <= 10:
                score += 35
                reasons.append(f"phash:{hash_distance}")
            elif hash_distance <= 14:
                score += 15
            if scene_similarity >= 0.88:
                score += 35
                reasons.append(f"scene:{scene_similarity:.3f}")
            elif scene_similarity >= 0.76:
                score += 18
                reasons.append(f"scene:{scene_similarity:.3f}")
            if histogram_similarity >= 0.985:
                score += 12
            if name_similarity >= 0.72:
                score += 24
                reasons.append(f"name:{name_similarity:.3f}")
            elif name_similarity >= 0.50:
                score += 10
            if same_aspect:
                score += 5

            if score >= 42:
                candidates.append({
                    "left_id": left["id"],
                    "left_name": left["name"],
                    "left_rank": left["rank"],
                    "right_id": right["id"],
                    "right_name": right["name"],
                    "right_rank": right["rank"],
                    "score": score,
                    "hash_distance": hash_distance,
                    "scene_similarity": round(scene_similarity, 4),
                    "histogram_similarity": round(histogram_similarity, 4),
                    "name_similarity": round(name_similarity, 4),
                    "reasons": reasons,
                    "left_path": str(left["path"]),
                    "right_path": str(right["path"]),
                })

    candidates.sort(key=lambda item: (-item["score"], item["left_rank"], item["right_rank"]))
    return candidates, problems


def contact_sheet(candidates: list[dict], output: Path, limit: int, offset: int = 0) -> None:
    selected = candidates[offset:offset + limit]
    if not selected:
        return
    cell_width, image_height, label_height = 520, 260, 74
    sheet = Image.new("RGB", (cell_width * 2, (image_height + label_height) * len(selected)), "#0b0c10")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for row_index, candidate in enumerate(selected):
        for column, side in enumerate(("left", "right")):
            path = Path(candidate[f"{side}_path"])
            with Image.open(path) as source:
                image = source.convert("RGB")
            image.thumbnail((cell_width - 20, image_height - 16), Image.Resampling.LANCZOS)
            x = column * cell_width + (cell_width - image.width) // 2
            y = row_index * (image_height + label_height) + (image_height - image.height) // 2
            sheet.paste(image, (x, y))
            label = f'{candidate[f"{side}_id"]} · {candidate[f"{side}_name"]}'
            draw.text((column * cell_width + 12, y + image_height + 3), label[:76], fill="#f1eef9", font=font)
        metrics = (
            f'score {candidate["score"]} · pHash {candidate["hash_distance"]} · '
            f'scene {candidate["scene_similarity"]}'
        )
        draw.text((12, row_index * (image_height + label_height) + image_height + 43), metrics, fill="#a78bfa", font=font)

    sheet.save(output, quality=92)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--images", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sheet", type=Path)
    parser.add_argument("--sheet-limit", type=int, default=80)
    parser.add_argument("--sheet-offset", type=int, default=0)
    args = parser.parse_args()

    rows = json.loads(args.catalog.read_text())
    candidates, problems = audit(rows, args.images)
    result = {"candidates": candidates, "quality_problems": problems}
    args.output.write_text(json.dumps(result, indent=2))
    if args.sheet:
        contact_sheet(candidates, args.sheet, args.sheet_limit, args.sheet_offset)
    print(f"{len(rows) - len(REMOVED_IDS)} active rows · {len(candidates)} candidates · {len(problems)} quality flags")


if __name__ == "__main__":
    main()
