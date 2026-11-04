#!/usr/bin/env python3
"""Pasa las viñetas generadas (JPEG 512 px, ~300 kB) a WebP de 384 px (~20 kB) en apps/web/public/img/<idioma>/ y
fusiona su índice. Uso: python3 tools/images/pack.py DIR_GENERADO [--lang en] [--skip k1,k2]"""
import json, os, sys
from PIL import Image
src = sys.argv[1]
lang = sys.argv[sys.argv.index('--lang') + 1] if '--lang' in sys.argv else 'en'
skip = set(sys.argv[sys.argv.index('--skip') + 1].split(',')) if '--skip' in sys.argv else set()
out = os.path.join(os.path.dirname(__file__), '..', '..', 'apps', 'web', 'public', 'img', lang)
os.makedirs(out, exist_ok=True)
idx_path = os.path.join(out, 'index.json')
index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
n = 0
for key, file in json.load(open(os.path.join(src, 'index.json'))).items():
    if key in skip: index.pop(key, None); continue
    p = os.path.join(src, file)
    if not os.path.exists(p): continue
    name = file.rsplit('.', 1)[0] + '.webp'
    Image.open(p).convert('RGB').resize((384, 384), Image.LANCZOS).save(os.path.join(out, name), 'WEBP', quality=72, method=6)
    index[key] = name; n += 1
json.dump(dict(sorted(index.items())), open(idx_path, 'w'), separators=(',', ':'))
print(f'{n} viñetas · {len(index)} en el índice')
