#!/usr/bin/env python3
"""Audio pregenerado con Kokoro para el contenido de content/.

Modelo: Kokoro-82M (hexgrad, licencia Apache 2.0) ejecutado con kokoro-onnx (MIT). Voz: af_heart (inglés americano).

Recorre los cursos de idiomas, saca cada texto que la app lee en voz alta (la palabra y los ejemplos), lo genera una
vez y lo guarda como MP3 en apps/web/public/audio/<idioma>/<huella>.mp3, con un índice texto → archivo
(index.json). La app reproduce estos archivos y solo usa la voz del dispositivo si falta alguno.

Es reanudable: lo ya generado no se repite. Uso:
  pip install kokoro-onnx soundfile   (y ffmpeg en el sistema)
  descarga kokoro-v1.0.int8.onnx y voices-v1.0.bin (github.com/thewh1teagle/kokoro-onnx, releases model-files-v1.0)
  python3 tools/audio/generate.py --model DIR [--limit N]
"""
import argparse, glob, hashlib, json, os, re, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'apps', 'web', 'public', 'audio')
VOICE = {'en': ('af_heart', 'en-us')}  # voz y acento por idioma del curso
SPEED = 0.9  # algo más lento que lo natural: es para aprender

def norm(t: str) -> str:
    return re.sub(r'\s+', ' ', t).strip()

def texts() -> dict:
    """Textos por idioma, en el mismo orden que el curso (lo primero, antes)."""
    out: dict = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'content', '*', '*.json'))):
        data = json.load(open(f))
        lang = data['course'].get('contentLanguage')
        if lang not in VOICE or not data['course'].get('audio'):
            continue
        bag = out.setdefault(lang, [])
        for m in data['modules']:
            for u in m['units']:
                if u['type'] == 'term':
                    bag.append(u['text'])
                if u['type'] == 'pattern':
                    bag.append(' '.join(p['text'] for p in u['pieces'] if p['role'] == 'fixed'))
                for ex in u.get('examples', []):
                    bag.append(ex['text'])
                if (u.get('association') or {}).get('sceneTarget'):
                    bag.append(u['association']['sceneTarget'])
    return {k: list(dict.fromkeys(norm(t) for t in v if norm(t))) for k, v in out.items()}

def spoken(text: str) -> str:
    """Lo que se le pasa a la voz: las escenas resaltan palabras en MAYÚSCULAS, que se leerían letra a letra."""
    return re.sub(r"\b[A-Z][A-Z']+\b", lambda m: m.group(0).lower(), text) if sum(w.isupper() for w in text.split()) >= 1 and not re.search(r'\b(SQL|API|USB|PDF|CV|PC|TV|OK|IT|HTML|CSS|JSON|URL|DNS|IP|ID)\b', text) else text

def name(lang: str, text: str) -> str:
    return hashlib.sha1(f'{lang}|{VOICE[lang][0]}|{SPEED}|{text}'.encode()).hexdigest()[:16] + '.mp3'

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--list', action='store_true', help='solo cuenta lo que falta')
    a = ap.parse_args()
    todo = texts()
    for lang, items in todo.items():
        d = os.path.join(OUT, lang); os.makedirs(d, exist_ok=True)
        missing = [t for t in items if not os.path.exists(os.path.join(d, name(lang, t)))]
        print(f'{lang}: {len(items)} textos, faltan {len(missing)}', flush=True)
        if a.list:
            continue
        from kokoro_onnx import Kokoro
        import soundfile as sf
        k = Kokoro(os.path.join(a.model, 'kokoro-v1.0.int8.onnx'), os.path.join(a.model, 'voices-v1.0.bin'))
        voice, accent = VOICE[lang]
        for i, t in enumerate(missing[: a.limit or None]):
            samples, sr = k.create(spoken(t), voice=voice, speed=SPEED, lang=accent)
            with tempfile.NamedTemporaryFile(suffix='.wav') as w:
                sf.write(w.name, samples, sr)
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', w.name, '-ac', '1', '-ar', '24000', '-b:a', '32k', os.path.join(d, name(lang, t))], check=True)
            if i % 100 == 0:
                print(f'  {i + 1}/{len(missing)} {t}', flush=True)
                write_index(lang, items, d)
        print(f'{lang}: índice con {write_index(lang, items, d)} audios', flush=True)

def write_index(lang: str, items: list, d: str) -> int:
    """El índice solo lista lo que existe: la app nunca pide un archivo que no está."""
    index = {t: name(lang, t) for t in items if os.path.exists(os.path.join(d, name(lang, t)))}
    with open(os.path.join(d, 'index.json'), 'w') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    return len(index)

if __name__ == '__main__':
    main()
