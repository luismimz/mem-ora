// Viñetas de las asociaciones (D-114): archivos estáticos pregenerados con fal (como los audios Kokoro), en
// /img/<idioma>/ con un índice clave de unidad → archivo. Si una unidad no tiene imagen, se ve su emoji.
import { useEffect, useState } from 'react';

const indexes = new Map<string, Promise<Record<string, string>>>();
function indexFor(language: string): Promise<Record<string, string>> {
  let p = indexes.get(language);
  if (!p) {
    p = fetch(`/img/${language}/index.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    indexes.set(language, p);
  }
  return p;
}
const known = new Map<string, Record<string, string>>();

/** Dirección de la viñeta de una unidad, o null si no tiene (o aún no se sabe). */
export function useImage(unitKey: string, language: string): string | null {
  const [index, setIndex] = useState<Record<string, string> | null>(known.get(language) ?? null);
  useEffect(() => {
    let alive = true;
    void indexFor(language).then((i) => { known.set(language, i); if (alive) setIndex(i); });
    return () => { alive = false; };
  }, [language]);
  const file = index?.[unitKey];
  return file ? `/img/${language}/${file}` : null;
}
