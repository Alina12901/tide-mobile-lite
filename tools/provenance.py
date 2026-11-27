"""Generate the public release fingerprint from the shipped runtime assets."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXT = {'.js', '.css', '.html', '.json'}
RUNTIME = TEXT | {'.webp'}


def fingerprint(path):
    data = path.read_bytes()
    if path.suffix in TEXT:
        data = data.replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()


def generate():
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    files = {p.name: fingerprint(p) for p in sorted(ROOT.iterdir())
             if p.is_file() and p.suffix in RUNTIME and p.name != 'provenance.json'}
    signature = hashlib.sha256(''.join(f'{name}\t{digest}\n' for name, digest in files.items()).encode()).hexdigest()
    record = {'author': manifest['author'], 'source': manifest['homePage'],
              'version': manifest['version'], 'code': f"XC-TIDE-{manifest['version']}-{signature[:12].upper()}",
              'sha256': files}
    (ROOT / 'provenance.json').write_bytes((json.dumps(record, indent=2, ensure_ascii=False) + '\n').encode())


if __name__ == '__main__':
    generate()
