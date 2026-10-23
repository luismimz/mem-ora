// Simulacro de examen en un móvil emulado (390×844) con TOQUES REALES y la API simulada: desde Inicio, responder,
// marcar dudosa, entregar con preguntas sin responder, ver la nota y los fallos con su explicación, repasar los fallos;
// y que se entregue solo al acabarse el tiempo.
//
// Uso: pnpm --filter @memora/web e2e
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5202, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-home.html`;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const course = { id: 'dam', key: 'prog', title: 'Programación', subject: 'programacion', ui_language: 'es', content_language: 'es', learner_language: 'es', audio_enabled: false, new_per_session: 15, modes: ['flow'] };
const concept = (k, n) => ({ key: k, type: 'concept', language: 'es', version: 1, skills: [{ key: `${k}.recall`, kind: 'recall' }, { key: `${k}.apply`, kind: 'apply' }],
  payload: { name: `Concepto ${n}`, gist: 'g', definition: 'd', examples: [], exercises: [{ kind: 'apply_case', prompt: `¿Qué imprime el programa ${n}?`, code: n === 0 ? 'int x = 3;\nSystem.out.println(x + 1);' : undefined, answer: `R${n}`, distractors: [`F${n}a`, `F${n}b`, `F${n}c`], explanation: `Porque sí, explicación ${n}.` }] } });
const N = 12;
const units = Object.fromEntries(Array.from({ length: N }, (_, n) => [`c${n}`, concept(`c${n}`, n)]));
const questions = Array.from({ length: N }, (_, n) => ({ id: `ex1-${n}`, unitKey: `c${n}`, skillKey: `c${n}.apply`, exercise: 0, options: [`F${n}a`, `R${n}`, `F${n}b`, `F${n}c`] }));
const stats = { taken: 2, best: { examId: 'old', grade: 6.5, correct: 13, total: 20, ms: 1000, at: 1 }, last: null };

async function open(page, examOverride = {}) {
  const posted = [], requested = [];
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api/, '');
    requested.push(`${path}${u.search}`);
    if (route.request().method() === 'POST') posted.push({ path, body: route.request().postDataJSON() });
    const data =
      path === '/users/me' ? { id: 'u1', first_name: 'Luis', email: 'l@example.com' }
      : path === '/memora/me' ? { staff: false }
      : path === '/memora/courses' ? [course]
      : path === '/memora/missions' ? { missions: [{ key: 'm1', title: 'Misión 1 · Bases', index: 1, total: 12, worked: 12, learned: 4, due: 0, status: 'done' }], current: 'm1' }
      : path === '/memora/progress' ? { streak: 1, failures: 0, today: { newUnits: 3, goal: 45 }, calendar: [], skills: [], units: [], associations: [], exam: stats }
      : path === '/memora/exam' && u.searchParams.get('modo') === 'guiado' ? { examId: 'g1-abcdef', guided: true, available: true, need: 10, worked: 0, questions: questions.slice(0, 3).map((q) => ({ ...q, id: q.id.replace('ex1', 'g1') })), units, minutes: 60, pass: 7, stats }
      : path === '/memora/exam' ? { examId: 'ex1-abcdef', available: true, need: 10, worked: 12, questions, units, minutes: 60, pass: 7, stats, ...examOverride }
      : path === '/memora/exam/result' ? { saved: true, grade: Math.round((route.request().postDataJSON().correct / route.request().postDataJSON().total) * 100) / 10, stats: { ...stats, taken: 3 } }
      : path === '/memora/events' ? { accepted: [], duplicates: [], rejected: [] }
      : path === '/memora/session' ? { state: { focus: 'fallos', index: 0, outcomes: {}, finished: false, plan: { mode: 'flow', sessionId: 'f', courseId: 'dam', day: 1, createdAt: 0, scenes: [], steps: [{ id: 'r', kind: 'reel', unitKey: 'c1', scene: -4, focus: 'errors' }, { id: 'e', kind: 'summary', unitKey: '', scene: 0 }] } }, units: { c1: units.c1 } }
      : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await page.goto(url);
  return { posted, requested };
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { posted, requested } = await open(page);
  const shot = (name) => page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/${name}.png` : '/dev/null' }).catch(() => undefined);

  await page.waitForSelector('.exam-card');
  check((await page.$eval('.exam-card', (e) => e.textContent)).includes('6,5'), 'Inicio (curso DAM) ofrece el simulacro con la mejor nota (6,5)');
  check((await page.$eval('.exam-card .exam-mode', (e) => e.textContent)).includes('Aprende y resuelve'), 'Inicio ofrece primero el modelo guiado («Aprende y resuelve») y después el simulacro');
  await page.$eval('.exam-card', (e) => e.scrollIntoView({ block: 'center' }));
  await shot('inicio-modelos');
  await page.locator('.exam-card .exam-mode:not(.main)').tap();
  await page.waitForSelector('.exam-intro');
  check(page.url().includes('/simulacro?curso=dam'), 'abre el simulacro en su propia dirección');
  check((await page.$eval('.exam-intro', (e) => e.textContent)).includes('60 minutos'), 'la portada explica las reglas (12 preguntas, 60 minutos, sin ayudas, se aprueba con un 7)');
  await shot('simulacro-portada');
  await page.locator('.exam-intro .primary').tap();
  await page.waitForSelector('.exam-run');
  check(/⏱️ (60:00|59:5\d)/.test(await page.$eval('.exam-clock', (e) => e.textContent)), 'empieza la cuenta atrás de 60 minutos');
  check(Boolean(await page.$('.exam-code')), 'el código de la pregunta se ve como código');

  // Responde: aciertos en 0–7, la 1 marcada dudosa, fallo en la 8, sin responder 9–11.
  for (let n = 0; n < N; n++) {
    if (n <= 8) await page.locator('.exam-options button', { hasText: n === 8 ? 'F8a' : `R${n}` }).tap();
    if (n === 1) await page.locator('.unsure-inline').tap();
    if (n === 0) {
      const lay = await page.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, picked: document.querySelector('.exam-options button.on')?.textContent, feedback: Boolean(document.querySelector('.is-right, .is-wrong, .exam-right')) }));
      check(!lay.over && lay.picked?.includes('R0') && !lay.feedback, 'al elegir se marca la opción, sin decir si está bien (sin ayudas) y sin salirse por los lados');
      await shot('simulacro-pregunta');
    }
    if (n < N - 1) await page.locator('.exam-nav .primary').tap();
  }
  check((await page.$eval('.exam-left', (e) => e.textContent)).includes('9 de 12'), 'cuenta las respondidas (9 de 12)');
  await page.locator('.exam-nav .primary').tap();
  check((await page.$eval('.exam-nav .primary', (e) => e.textContent)).includes('3 sin responder'), 'al entregar con huecos, avisa de cuántas quedan sin responder');
  await page.locator('.exam-nav .primary').tap();
  await page.waitForSelector('.exam-done');
  await page.waitForTimeout(500);
  const done = await page.evaluate(() => ({ grade: document.querySelector('.exam-grade')?.textContent, review: [...document.querySelectorAll('.exam-review li')].map((l) => l.textContent), over: document.documentElement.scrollWidth > innerWidth }));
  check(done.grade.includes('6,7') && done.grade.includes('SUSPENSO'), `nota 8 de 12 = 6,7 → suspenso (${done.grade})`);
  check(done.review.length === 4 && done.review.some((t) => t.includes('Sin responder')) && done.review.some((t) => t.includes('Tu respuesta: F8a') && t.includes('R8') && t.includes('explicación 8')), 'se ven solo los 4 fallos, con tu respuesta, la correcta y su explicación');
  const ev = posted.filter((p) => p.path === '/memora/events').flatMap((p) => p.body.events);
  check(ev.length === 12 && ev.every((e) => e.format === 'recognition_choice' && e.contextId.endsWith('#exam')) && ev.find((e) => e.unitKey === 'c1')?.doubt === true && ev.find((e) => e.unitKey === 'c8')?.correct === false
    && ev.filter((e) => e.correct === false).length === 4,
    'todo cuenta como reconocimiento (peso bajo), la dudosa va marcada y el fallo y lo que quedó en blanco, como fallo (4)');
  const res = posted.find((p) => p.path === '/memora/exam/result')?.body;
  check(res?.correct === 8 && res?.total === 12 && res?.examId === 'ex1-abcdef', 'guarda la nota en el servidor (8 de 12)');
  check(!done.over, 'el resultado no se sale por los lados');
  await shot('simulacro-resultado');
  await page.locator('.exam-done .fails-btn').tap();
  await page.waitForSelector('.slide');
  check(requested.some((r) => r.startsWith('/memora/session') && r.includes('focus=fallos')), '«Repasa tus fallos ahora» abre la ronda de fallos');

  // Se entrega solo al acabarse el tiempo.
  const p2 = await context.newPage();
  p2.on('pageerror', (e) => errors.push(String(e)));
  const r2 = await open(p2, { minutes: 0.04 });
  await p2.waitForSelector('.exam-card');
  await p2.locator('.exam-card .exam-mode:not(.main)').tap();
  await p2.locator('.exam-intro .primary').tap();
  await p2.locator('.exam-options button', { hasText: 'R0' }).tap();
  await p2.waitForSelector('.exam-done', { timeout: 8000 }).catch(() => undefined);
  check(Boolean(await p2.$('.exam-done')) && r2.posted.some((p) => p.path === '/memora/exam/result' && p.body.correct === 1), 'al acabarse el tiempo se entrega solo, con lo respondido');

  // Sin bastante trabajado: lo dice y no empieza.
  const p3 = await context.newPage();
  await open(p3, { available: false, worked: 4, questions: [] });
  await p3.waitForSelector('.exam-card');
  await p3.locator('.exam-card .exam-mode:not(.main)').tap();
  await p3.waitForSelector('.exam-intro');
  check((await p3.$eval('.exam-intro', (e) => e.textContent)).includes('Llevas 4'), 'si aún no hay bastante trabajado, lo explica en vez de hacer un examen corto');
  check((await p3.$eval('.exam-intro .primary', (e) => e.textContent)).includes('Aprende y resuelve'), 'y ofrece el modelo guiado, que enseña antes de preguntar');

  // Modelo guiado: primero la ficha, después la pregunta, con la corrección al momento.
  const p4 = await context.newPage();
  p4.on('pageerror', (e) => errors.push(String(e)));
  const r4 = await open(p4);
  const cdp4 = await context.newCDPSession(p4);
  const shot4 = (name) => p4.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/${name}.png` : '/dev/null' }).catch(() => undefined);
  await p4.waitForSelector('.exam-card');
  await p4.locator('.exam-card .exam-mode.main').tap();
  await p4.waitForSelector('.guided .slide');
  const learn = await p4.evaluate(() => ({ url: location.href, tag: document.querySelector('.slide .tag')?.textContent, h: document.querySelector('.concept-face h2')?.textContent, def: document.querySelector('.face-learn')?.textContent, options: document.querySelectorAll('.options .option').length, over: document.documentElement.scrollWidth > innerWidth }));
  check(learn.url.includes('modo=guiado') && /PRIMERO APRENDE/.test(learn.tag) && learn.h?.includes('CONCEPTO 0') && learn.def?.includes('QUÉ ES') && learn.options === 0,
    'el modelo guiado empieza ENSEÑANDO: la ficha del tema (qué es) y todavía sin la pregunta');
  await shot4('guiado-ficha');
  await p4.locator('.guided .go').tap();
  const ask = await p4.evaluate(() => ({ tag: document.querySelector('.slide .tag')?.textContent, q: document.querySelector('.guided-q')?.textContent, code: Boolean(document.querySelector('.guided-code')), n: document.querySelectorAll('.options .option').length }));
  check(/RESUÉLVELO/.test(ask.tag) && ask.q === '¿Qué imprime el programa 0?' && ask.code && ask.n === 4, 'después llega la pregunta (con su código y 4 opciones)');
  await p4.locator('.options .option', { hasText: /^R0$/ }).tap();
  await p4.waitForSelector('.guided-why.ok');
  check(Boolean(await p4.$('.option.is-right')), 'al acertar se corrige al momento (en verde)');
  await p4.waitForTimeout(450);
  await shot4('guiado-acierto');
  await p4.locator('.guided .go').tap();
  // Segunda: vuelve a mirar la ficha (cuenta como más ayuda) y falla: ve la correcta y el porqué.
  await p4.waitForSelector('.guided .slide .concept-face');
  await p4.locator('.guided .go').tap();
  await p4.locator('.guided .more-btn').tap();
  const back = await p4.$eval('.slide .tag', (e) => e.textContent);
  await p4.locator('.guided .go').tap();
  await p4.locator('.options .option', { hasText: /^F1a$/ }).tap();
  await p4.waitForSelector('.guided-why.ko');
  const why = await p4.$eval('.guided-why', (e) => e.textContent);
  check(/PRIMERO APRENDE/.test(back) && why.includes('Era «R1»') && why.includes('explicación 1'), '«Ver la ficha otra vez» vuelve a enseñar; al fallar, se ve la respuesta y su explicación');
  await p4.waitForTimeout(450);
  await shot4('guiado-fallo');
  await p4.locator('.guided .go').tap();
  await p4.locator('.guided .go').tap();
  // La tercera, con el dedo de verdad (CDP) sobre la opción correcta.
  const box = await p4.locator('.options .option', { hasText: /^R2$/ }).boundingBox();
  await cdp4.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await cdp4.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p4.waitForSelector('.guided-why.ok');
  await p4.locator('.guided .go').tap();
  await p4.waitForSelector('.guided-end');
  const end = await p4.evaluate(() => ({ score: document.querySelector('.end-xp')?.textContent, over: document.documentElement.scrollWidth > innerWidth }));
  check(end.score === '2/3' && !end.over && !learn.over, `al final, cuántas (2/3) y sin salirse por los lados`);
  await shot4('guiado-final');
  const gev = r4.posted.filter((p) => p.path === '/memora/events').flatMap((p) => p.body.events);
  check(gev.length === 3 && gev.every((e) => e.format === 'recognition_choice' && e.contextId.endsWith('#exam-guided')) && gev[0].hint === 1 && gev[1].hint === 2 && gev[1].correct === false,
    'cada respuesta cuenta poco (reconocimiento con pista 1; con pista 2 si se volvió a mirar la ficha)');
  check(!r4.posted.some((p) => p.path === '/memora/exam/result'), 'el modelo guiado no cuenta como nota de simulacro');
  await p4.locator('.guided-end .go').tap();
  await p4.waitForSelector('.exam-intro');
  check(!p4.url().includes('modo=guiado'), 'desde el final se pasa al simulacro sin ayudas');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);
