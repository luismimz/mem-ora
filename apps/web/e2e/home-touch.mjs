// Inicio en un móvil emulado (390×844) con TOQUES REALES y la API simulada: el mapa de misiones con sus cuatro estados
// (completada, en curso, por repasar, pendiente) y «Vacía tus fallos», que abre una ronda solo con los fallos.
//
// Uso: pnpm --filter @memora/web e2e
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5199, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-home.html`;

const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const course = { id: 'c1', key: 'ingles', title: 'Inglés', ui_language: 'es', content_language: 'en', learner_language: 'es', audio_enabled: false, new_per_session: 15, modes: ['flow'] };
const missions = [
  { key: '01', title: 'Misión 1 · Saludos', index: 1, total: 10, worked: 10, learned: 8, due: 4, status: 'done' },
  { key: '02', title: 'Misión 2 · Familia', index: 2, total: 10, worked: 6, learned: 3, due: 0, status: 'active' },
  { key: '03', title: 'Misión 3 · Comida', index: 3, total: 10, worked: 0, learned: 0, due: 0, status: 'pending' },
];
let failures = 5;
const term = (key, text, meaning) => ({ key, type: 'term', language: 'en', version: 1, skills: [{ key: `${key}:recall`, kind: 'recall' }], payload: { form: 'word', text, meaning, examples: [{ text: `My ${text}.`, translation: `Mi ${meaning}.` }] } });
const failSession = {
  state: { focus: 'fallos', index: 0, outcomes: {}, finished: false, plan: { mode: 'flow', sessionId: 'f1', courseId: 'c1', day: 1, createdAt: 0, scenes: [], steps: [
    { id: 'r1', kind: 'reel', unitKey: 'a', scene: -4, focus: 'errors' },
    { id: 'q1', kind: 'quick', unitKey: 'a', scene: -4, reverse: false, focus: 'errors' },
    { id: 'end', kind: 'summary', unitKey: '', scene: 0 },
  ] } },
  units: { a: term('a', 'brother', 'hermano'), b: term('b', 'sister', 'hermana') },
};
const requested = [];
const posted = [];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api/, '');
    requested.push(`${path}${u.search}`);
    if (route.request().method() === 'POST') posted.push({ path, body: route.request().postDataJSON() });
    const data =
      path === '/users/me' ? { id: 'u1', first_name: 'Luis', email: 'luis@example.com' }
      : path === '/memora/me' ? { staff: false }
      : path === '/memora/courses' ? [course]
      : path === '/memora/missions' ? { missions, current: '02', newToday: 15, newTarget: 15 }
      : path === '/memora/progress' ? { streak: 3, bestStreak: 8, shields: 0, todayAttempts: 12, failures, today: { newUnits: 10, goal: 35 }, calendar: Array.from({ length: 84 }, (_, i) => (i % 3 === 0 ? 0 : (i * 7) % 70)), skills: [],
          units: Array.from({ length: 20 }, (_, i) => ({ key: `u${i}`, level: i < 12 ? 'learned' : 'none', missing: [] })), associations: [] }
      : path === '/memora/session' ? failSession
      : path === '/memora/session/position' ? { saved: true }
      : path === '/memora/events' ? { accepted: [], duplicates: [], rejected: [] }
      : path === '/memora/report' ? { saved: true }
      : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await page.goto(url);
  await page.waitForSelector('.mission-grid .mission');
  await page.waitForSelector('.fails-btn');

  const states = await page.$$eval('.mission', (els) => els.map((e) => ({ cls: e.className, state: e.querySelector('.mission-state')?.textContent ?? '' })));
  check(states[0].cls.includes('fading') && states[0].state.startsWith('REPASAR · 4'), `la misión completada que se olvida sale «por repasar» (${states[0].state})`);
  check(states[1].state.includes('CONTINUAR') && !states[1].cls.includes('fading'), 'la misión actual dice «continuar»');
  check(states[2].cls.includes('pending') && states[2].state === 'PENDIENTE', 'la misión sin empezar sale pendiente');
  const legend = await page.$eval('.missions-legend', (e) => e.textContent ?? '');
  check(legend.includes('1 por repasar') && legend.includes('1 completada') && !legend.includes('1 completadas'), `la leyenda cuenta lo que hay que repasar (${legend})`);

  // Tu constancia: 84 días en 12 columnas de semana, hoy en su fila, y logros honestos (memoria, mejor racha, misiones).
  const cons = await page.$eval('.constancy', (e) => {
    const cells = [...e.querySelectorAll('.cal i')];
    const today = e.querySelector('.cal .cal-today');
    const row = Math.round((today.getBoundingClientRect().top - cells[0].getBoundingClientRect().top) / (cells[1].getBoundingClientRect().top - cells[0].getBoundingClientRect().top));
    return { days: e.querySelectorAll('.cal i:not(.cal-pad)').length, row, right: Math.round(e.getBoundingClientRect().right), tracks: [...e.querySelectorAll('.tracks li')].map((l) => l.textContent) };
  });
  const wd = (new Date().getDay() + 6) % 7;
  check(cons.days === 84 && cons.row === wd && cons.right <= 390, `el calendario tiene 12 semanas y hoy cae en su día de la semana (fila ${cons.row}, esperado ${wd})`);
  check(cons.tracks[0].includes('10 conceptos en tu memoria') && cons.tracks[0].includes('faltan 38') && cons.tracks[0].includes('1/6'), `memoria: cuenta solo lo aprendido (12 de 20) → ${cons.tracks[0]}`);
  check(cons.tracks[1].includes('7 días seguidos') && cons.tracks[1].includes('2/5') && cons.tracks[1].includes('faltan 11'), `racha: el logro con la mejor (8); lo que falta, desde la actual (3) → ${cons.tracks[1]}`);
  check(cons.tracks[2].includes('1 misión completada'), `misiones → ${cons.tracks[2]}`);

  const btn = await page.$eval('.fails-btn', (e) => ({ text: e.textContent ?? '', w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
  check(btn.text.includes('5') && btn.text.includes('Vacía tus fallos') && btn.h >= 44, `«Vacía tus fallos» muestra cuántos quedan y se puede tocar con el dedo (${Math.round(btn.h)}px de alto)`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'Inicio: nada se sale por los lados');
  await page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/home-fallos.png` : '/dev/null', fullPage: true }).catch(() => undefined);

  await page.locator('.fails-btn').tap();
  await page.waitForSelector('.slide');
  check(requested.some((r) => r.startsWith('/memora/session') && r.includes('focus=fallos')), 'al tocarlo pide una ronda solo de fallos (focus=fallos)');
  check(page.url().includes('foco=fallos'), 'la dirección guarda que es la ronda de fallos (se puede retomar)');
  const tag = await page.$eval('.slide .tag', (e) => e.textContent ?? '');
  check(tag.includes('TUS ERRORES'), `la ronda empieza por un fallo, marcado como tal (${tag})`);

  // «Reportar un error»: ⚑ arriba, el motivo con un toque, y la tarjeta sigue donde estaba.
  const header = await page.$eval('.feed-top', (e) => ({ right: e.getBoundingClientRect().right, scroll: e.scrollWidth > e.clientWidth }));
  check(!header.scroll && header.right <= 390, 'la barra del Flujo cabe con el botón ⚑');
  const before = await page.$eval('.slide', (e) => e.querySelector('h2, h3')?.textContent ?? '');
  await page.locator('.feed-flag').tap();
  await page.waitForSelector('.report-sheet');
  await page.waitForTimeout(450); // la hoja sube con una animación corta
  const sheet = await page.$eval('.report-sheet', (e) => ({ text: e.textContent ?? '', top: Math.round(e.getBoundingClientRect().top), bottom: Math.round(e.getBoundingClientRect().bottom), lastOption: Math.round(e.querySelector('.report-options button:last-child')?.getBoundingClientRect().bottom ?? 9999) }));
  check(sheet.text.includes('BROTHER') || sheet.text.toLowerCase().includes('brother'), `la hoja dice de qué tarjeta es (${sheet.text.slice(0, 60)})`);
  check(sheet.bottom >= 840 && sheet.bottom <= 845 && sheet.top > 0 && sheet.lastOption <= 844, `la hoja sale desde abajo y cabe entera, con todos los motivos a la vista (${sheet.top}–${sheet.bottom}px)`);
  await page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/reportar.png` : '/dev/null' }).catch(() => undefined);
  await page.locator('.report-options button', { hasText: 'asociación' }).tap();
  await page.waitForSelector('.report-toast');
  const sent = posted.find((x) => x.path === '/memora/report');
  check(sent?.body?.unit === 'a' && sent?.body?.reason === 'asociacion' && sent?.body?.course === 'c1', 'un toque envía el aviso con la tarjeta y el motivo');
  check(!(await page.$('.report-sheet')) && (await page.$eval('.report-toast', (e) => e.textContent ?? '')).includes('Gracias'), 'se cierra y da las gracias');
  check((await page.$eval('.slide', (e) => e.querySelector('h2, h3')?.textContent ?? '')) === before, 'la tarjeta sigue donde estaba (reportar no la pasa)');

  // «No estoy seguro»: en la pregunta, abajo, sin tapar respuestas; marcado antes de responder, el acierto llega dudoso.
  await page.waitForTimeout(2700); // se va el aviso de «Gracias»
  check(!(await page.$('.unsure')), 'en la ficha de aprender no sale «No estoy seguro»');
  const cdp = await context.newCDPSession(page);
  const swipeUp = async () => {
    const pt = (y) => [{ x: 195, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(650) });
    for (let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(650 - k * 45) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  for (let k = 0; k < 4 && !(await page.$('.unsure')); k++) { await swipeUp(); await page.waitForTimeout(600); }
  const layout = await page.evaluate(() => {
    const u = document.querySelector('.unsure')?.getBoundingClientRect();
    const opts = [...document.querySelectorAll('.slide button')].filter((b) => !b.classList.contains('say')).map((b) => b.getBoundingClientRect());
    const hit = u ? opts.some((r) => !(r.bottom <= u.top || r.top >= u.bottom || r.right <= u.left || r.left >= u.right)) : true;
    return { has: Boolean(u), hit, h: u ? Math.round(u.height) : 0, right: u ? Math.round(u.right) : 0 };
  });
  check(layout.has && !layout.hit && layout.h >= 36 && layout.right <= 390, `en la pregunta sale «No estoy seguro» abajo, sin tapar ninguna respuesta (${layout.h}px)`);
  await page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/no-seguro.png` : '/dev/null' }).catch(() => undefined);
  await page.locator('.unsure').tap();
  check((await page.$eval('.unsure', (e) => e.getAttribute('aria-pressed'))) === 'true', 'un toque lo marca');
  const right = page.locator('.slide button', { hasText: /hermano|brother/i }).first();
  await right.tap();
  await page.waitForTimeout(1500);
  const attempts = posted.filter((x) => x.path === '/memora/events').flatMap((x) => x.body.events).filter((e) => e.kind === 'attempt');
  check(attempts.length > 0 && attempts.at(-1).correct === true && attempts.at(-1).doubt === true, `el acierto llega marcado como dudoso (${JSON.stringify(attempts.at(-1) ?? null).slice(0, 80)}…)`);
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);
