// El truco de la frase, a la vista (usuario, 5-nov-2026): un solo truco por frase; la palabra española se parte
// («gustaría» → «gust» + «aría») y la terminación vuela a su sitio en inglés («would like»). Debajo del verbo, su forma
// (base, -s, 2ª, 3ª, -ing) y la fórmula; el gancho para recordarlo solo las primeras veces (luego, que lo complete la cabeza).
import { useEffect, useState, type ReactNode } from 'react';
import { analyzeTrick, TRICK_INFO, type Analysis } from './trickParse';

const HOOK_TIMES = 3;
function hookViews(key: string): number {
  try { return Number(localStorage.getItem(`memora.trick.${key}`) ?? 0); } catch { return 0; }
}
function countHook(key: string) {
  try { localStorage.setItem(`memora.trick.${key}`, String(hookViews(key) + 1)); } catch { /* sin almacenamiento: se ve siempre */ }
}

const isTrickEnglish = (lang?: string) => !lang || lang.startsWith('en');

function EnRow({ a, animate }: { a: Analysis; animate: boolean }) {
  return (
    <span className="trk-en">
      {a.en.map((t, i) => (
        <span key={i} className={`trk-w${t.trick ? ` trk-on trk-${a.key}` : ''}${t.trick && a.jump && animate ? ' trk-jump' : ''}`}>
          <span className="trk-txt">{t.trick && !t.tail ? <b>{t.text}</b> : t.text}{t.tail && <b className="trk-tail">{t.tail}</b>}</span>
          {t.form && <small className="trk-form">{t.form}</small>}
        </span>
      ))}
    </span>
  );
}

function EsRow({ a, split }: { a: Analysis; split: boolean }) {
  // «gust» = like: el verbo inglés que corresponde a la raíz (el que lleva la forma, o el que lleva la cola -ed/-ing).
  const v = a.en.find((t) => t.form && !t.trick) ?? a.en.find((t) => t.tail);
  const rootEn = v?.text.replace(/[^A-Za-z']/g, '');
  return (
    <span className="trk-es">
      {a.es.map((w, i) => {
        if (a.split && i === a.split.index) {
          return (
            <span key={i} className={`trk-w trk-split${split ? ' is-split' : ''}`}>
              <span className="trk-txt"><span className="trk-root">{a.split.root}{split && rootEn && <small className="trk-form">= {rootEn}</small>}</span><b className={`trk-end trk-${a.key}`}>{a.split.ending}{split && <small className="trk-form">= {a.split.meaning}</small>}</b></span>
            </span>
          );
        }
        const inPhrase = a.phrase && i >= a.phrase[0] && i <= a.phrase[1];
        return <span key={i} className={`trk-w${inPhrase ? ` trk-on trk-${a.key}` : ''}`}><span className="trk-txt">{inPhrase ? <b>{w}</b> : w}</span></span>;
      })}
    </span>
  );
}

/**
 * Una frase inglesa con su truco. `full`: la tarjeta entera (español partido → inglés, fórmula y gancho); si no, solo la
 * frase con la pieza del truco en su color.
 */
export function TrickSentence({ text, translation, lang, full = false, after }: { text: string; translation?: string; lang?: string; full?: boolean; after?: ReactNode }) {
  const a = isTrickEnglish(lang) ? analyzeTrick(text, translation ?? '') : null;
  const [phase, setPhase] = useState(0);
  const [showHook] = useState(() => (a ? hookViews(a.key) < HOOK_TIMES : false));
  useEffect(() => {
    if (!a || !full) return;
    if (showHook) countHook(a.key);
    const t1 = setTimeout(() => setPhase(1), 700);
    const t2 = setTimeout(() => setPhase(2), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return <>{text}{after}</>;
  if (!full) return <span className={`trk-inline trk-${a.key}`}><EnRow a={a} animate={false} />{after}</span>;
  const info = TRICK_INFO[a.key];
  const hasEs = Boolean(a.split || a.phrase);
  return (
    <span className={`trk-card trk-${a.key}`} data-trick={a.key}>
      <span className="trk-name">🧩 {info.name}</span>
      {hasEs && <EsRow a={a} split={phase >= 1} />}
      {hasEs && <span className={`trk-arrow${phase >= 2 ? ' on' : ''}`}>{a.jump ? '↓ en inglés va DELANTE' : '↓ en inglés'}</span>}
      <span className={`trk-enwrap${!hasEs || phase >= 2 ? ' on' : ''}`}><EnRow a={a} animate={phase >= 2} />{after}</span>
      <span className="trk-formula">{info.formula}</span>
      {showHook && <span className="trk-hook">💡 {info.hook}</span>}
    </span>
  );
}

/** ¿Tiene esta frase un truco? (para dar la tarjeta entera solo al primer ejemplo que lo tenga). */
export const hasTrick = (text: string, translation?: string, lang?: string) => isTrickEnglish(lang) && analyzeTrick(text, translation ?? '') !== null;
