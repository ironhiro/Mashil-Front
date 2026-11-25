"""Build the Seoul Namsan web fonts into public/fonts (not committed).

Seoul City's typeface is free to use, but its licence forbids selling,
paid transfer and unauthorised redistribution, so the files stay out of
git. Run once after cloning:

    pip install fonttools brotli
    python tool/make_fonts.py

Downloads the official zip from seoul.go.kr, keeps the M / B / EB weights,
and subsets each to all 11,172 Hangul syllables, compatibility jamo and
punctuation as woff2 (about 220 KB each). Latin and figures come from
Overpass (Google Fonts), so they are not needed here.
"""
import io
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

from fontTools import subset

ZIP_URL = "https://www.seoul.go.kr/upload/seoul/font/seoul_font3.zip"
WEIGHTS = ("SeoulNamsanM", "SeoulNamsanB", "SeoulNamsanEB")
OUT = Path(__file__).resolve().parent.parent / "public" / "fonts"

UNICODES = (
    list(range(0xAC00, 0xD7A4))  # Hangul syllables
    + list(range(0x3131, 0x318F))  # compatibility jamo
    + list(range(0x3000, 0x3020))  # CJK punctuation
    + list(range(0x2010, 0x2030))  # general punctuation
    + [0x00B7, 0x2026, 0xFF5E]
)


def main() -> int:
    if all((OUT / f"{w}.woff2").exists() for w in WEIGHTS) and "--force" not in sys.argv:
        print("fonts already built (use --force to rebuild)")
        return 0
    print("downloading", ZIP_URL)
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": "Mozilla/5.0"})
    # seoul.go.kr 은 해외에서 연결이 자주 끊긴다: 세 번까지 다시 시도한다 (CI 는 결과를 캐시해서 보통 여기까지 오지 않는다)
    for attempt in range(1, 4):
        try:
            data = urllib.request.urlopen(req, timeout=120).read()
            break
        except OSError as e:  # URLError, TimeoutError 모두 OSError
            if attempt == 3:
                raise
            print(f"download failed ({e}), retrying in {attempt * 15}s")
            time.sleep(attempt * 15)
    z = zipfile.ZipFile(io.BytesIO(data))
    OUT.mkdir(parents=True, exist_ok=True)
    for info in z.infolist():
        name = info.filename.rsplit("/", 1)[-1]
        stem = name.rsplit(".", 1)[0]
        if stem not in WEIGHTS or not name.endswith(".ttf"):
            continue
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        font = subset.load_font(io.BytesIO(z.read(info)), opts)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        dst = OUT / f"{stem}.woff2"
        subset.save_font(font, str(dst), opts)
        font.close()
        print(dst.relative_to(OUT.parent.parent), dst.stat().st_size)
    missing = [w for w in WEIGHTS if not (OUT / f"{w}.woff2").exists()]
    if missing:
        print("missing in zip:", missing)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
