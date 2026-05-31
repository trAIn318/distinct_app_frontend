"""
compress_images.py
Comprime todas las imágenes en public/img/ (incluyendo public/img/courses/).

Estrategia:
  - JPG/JPEG: max 1200px de ancho, calidad 82, progressive, sin EXIF
  - PNG:      max 1200px de ancho, optimize=True, sin metadata

Output: archivos sobrescritos in-place + reporte de antes/después.

Antes de correr:
    pip install Pillow

Uso:
    python compress_images.py             # comprime todo
    python compress_images.py --dry-run   # solo simula
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow no está instalado. Corre: pip install Pillow")
    sys.exit(1)


MAX_WIDTH = 1200
JPG_QUALITY = 82
ALLOWED_EXTS = {".jpg", ".jpeg", ".png"}
ROOT_DIR = Path(__file__).parent / "public" / "img"


def human_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def compress_one(path: Path, dry_run: bool) -> tuple[int, int]:
    """Comprime una imagen in-place. Retorna (size_before, size_after)."""
    size_before = path.stat().st_size

    if dry_run:
        return size_before, size_before

    try:
        with Image.open(path) as img:
            # Modo seguro para PNG con transparencia
            keep_alpha = img.mode in ("RGBA", "LA") or "transparency" in img.info
            ext = path.suffix.lower()

            # Resize si es muy ancha
            if img.width > MAX_WIDTH:
                ratio = MAX_WIDTH / img.width
                new_size = (MAX_WIDTH, int(img.height * ratio))
                img = img.resize(new_size, Image.LANCZOS)

            # Strip EXIF: re-crear sin info
            if ext in (".jpg", ".jpeg"):
                if img.mode != "RGB":
                    img = img.convert("RGB")
                img.save(
                    path,
                    format="JPEG",
                    quality=JPG_QUALITY,
                    progressive=True,
                    optimize=True,
                )
            else:  # .png
                if keep_alpha and img.mode not in ("RGBA", "LA"):
                    img = img.convert("RGBA")
                img.save(path, format="PNG", optimize=True)
    except Exception as exc:  # noqa: BLE001
        print(f"  ⚠️  Error procesando {path.name}: {exc}")
        return size_before, size_before

    size_after = path.stat().st_size
    return size_before, size_after


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Solo reporte, sin escribir")
    args = parser.parse_args()

    if not ROOT_DIR.exists():
        print(f"ERROR: no existe {ROOT_DIR}")
        sys.exit(1)

    images = sorted(
        p for p in ROOT_DIR.rglob("*") if p.is_file() and p.suffix.lower() in ALLOWED_EXTS
    )

    if not images:
        print(f"No se encontraron imágenes en {ROOT_DIR}")
        return

    print(f"Encontradas {len(images)} imágenes en {ROOT_DIR}")
    print(f"Max width: {MAX_WIDTH}px, JPG quality: {JPG_QUALITY}")
    if args.dry_run:
        print("  → DRY RUN (sin escribir)\n")
    else:
        print()

    total_before = 0
    total_after = 0
    biggest_savings: list[tuple[int, str]] = []

    for path in images:
        size_before, size_after = compress_one(path, args.dry_run)
        total_before += size_before
        total_after += size_after
        saved = size_before - size_after
        rel = path.relative_to(ROOT_DIR.parent)

        if saved > 0 and not args.dry_run:
            pct = saved / size_before * 100
            print(f"  {rel}  {human_bytes(size_before)} → {human_bytes(size_after)}  (-{pct:.0f}%)")
            biggest_savings.append((saved, str(rel)))
        elif args.dry_run:
            print(f"  {rel}  {human_bytes(size_before)}")
        else:
            print(f"  {rel}  {human_bytes(size_before)}  (sin cambios)")

    print()
    print(f"Total antes:  {human_bytes(total_before)}")
    print(f"Total ahora:  {human_bytes(total_after)}")
    if total_before > 0:
        delta = total_before - total_after
        pct = delta / total_before * 100
        print(f"Ahorrado:     {human_bytes(delta)}  ({pct:.0f}%)")


if __name__ == "__main__":
    main()
