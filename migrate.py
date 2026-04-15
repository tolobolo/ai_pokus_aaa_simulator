#!/usr/bin/env python3
"""
Migrate original ultrasound data to the cecilie_simulator backend format.

Run from the project root:
    python migrate.py

For each session in original_data/data/{hospital}/{patient_id}/{session_hash}/:
  - frame_N.raw  +  frame_N.mhd          →  backend/data/{patient_id}_frame{N}/image.png
  - frame_N.mhd  +  frame_N_calipers.json →  backend/data/{patient_id}_frame{N}/metadata.json
  - *.mp4                                 →  backend/data/{patient_id}_frame{N}/video.mp4

Requirements:  pip install Pillow numpy
"""

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ORIGINAL_DIR = Path("original_data/data")
OUTPUT_DIR   = Path("backend/data")


def parse_mhd(mhd_path: Path) -> dict:
    """Parse a MetaImage .mhd text header into a plain dict."""
    result = {}
    for line in mhd_path.read_text().splitlines():
        if "=" in line:
            key, _, value = line.partition("=")
            result[key.strip()] = value.strip()
    return result


def raw_to_png(raw_path: Path, width: int, height: int, out_path: Path) -> None:
    """Convert an uncompressed 8-bit grayscale .raw file to a PNG."""
    pixels = np.frombuffer(raw_path.read_bytes(), dtype=np.uint8).reshape((height, width))
    Image.fromarray(pixels, mode="L").save(out_path)


def build_metadata(mhd: dict, calipers: dict) -> dict:
    """Combine all .mhd fields and the full _calipers.json without filtering."""
    return {
        "mhd": mhd,          # every field from the .mhd header, unmodified
        "calipers": calipers, # full _calipers.json, unmodified
    }


def migrate_session(session_dir: Path, patient_id: str) -> None:
    files = list(session_dir.iterdir())

    mhd_file     = next(f for f in files if f.suffix == ".mhd")
    raw_file     = next(f for f in files if f.suffix == ".raw")
    mp4_file     = next(f for f in files if f.suffix == ".mp4")
    caliper_file = next(f for f in files if "_calipers" in f.name)

    mhd      = parse_mhd(mhd_file)
    calipers = json.loads(caliper_file.read_text())

    # Derive frame number and output name
    frame_file   = mhd["ElementDataFile"]
    frame_number = int(frame_file.split("_")[1].split(".")[0])
    out_name     = f"{patient_id}_frame{frame_number}"
    out_dir      = OUTPUT_DIR / out_name
    out_dir.mkdir(parents=True, exist_ok=True)

    # Convert .raw → image.png
    width, height = map(int, mhd["DimSize"].split())
    raw_to_png(raw_file, width, height, out_dir / "image.png")

    # Write metadata.json
    metadata = build_metadata(mhd, calipers)
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

    # Copy video
    shutil.copy2(mp4_file, out_dir / "video.mp4")

    print(f"  {session_dir.parent.parent.name}/{patient_id}/frame{frame_number}"
          f"  →  backend/data/{out_name}/")


def main() -> None:
    if not ORIGINAL_DIR.exists():
        raise SystemExit(f"Source directory not found: {ORIGINAL_DIR}\n"
                         "Run this script from the project root.")

    OUTPUT_DIR.mkdir(exist_ok=True)

    for hospital_dir in sorted(ORIGINAL_DIR.iterdir()):
        if not hospital_dir.is_dir():
            continue
        for patient_dir in sorted(hospital_dir.iterdir()):
            if not patient_dir.is_dir():
                continue
            print(f"\n{hospital_dir.name} / patient {patient_dir.name}")
            for session_dir in sorted(patient_dir.iterdir()):
                if not session_dir.is_dir():
                    continue
                migrate_session(session_dir, patient_dir.name)

    print(f"\nDone. Patients written to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
