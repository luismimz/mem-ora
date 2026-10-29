// Asignaturas (D-091) con TOQUES REALES en un móvil emulado (390×844) y la API simulada: el selector de asignatura de
// Inicio (botón con la actual y una hoja con todas) y, en el perfil de administración, «Asignaturas de cada alumno»
// (para todos o solo para elegidos, y qué alumnos la ven). Un alumno normal no ve ese panel.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5202, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}e2e/harness-home.html`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const T = [['Inglés · 1.000 palabras (A1→B1)', 'idioma', 'en'], ['Programación · DAM', 'programación'], ['Bases de datos · DAM', 'bases de datos'], ['Acceso a datos · DAM', 'programación'],
  ['Desarrollo de interfaces · DAM', 'programación'], ['Sistemas de gestión empresarial · DAM', 'informática de gestión'], ['Inteligencia Artificial', 'inteligencia artificial'], ['Aprender a aprender', 'aprendizaje']];
const courses = T.map(([title, subject, lang], i) => ({ id: `c${i}`, key: `k${i}`, title, subject, content_language: lang ?? 'es', learner_language: 'es', ui_language: 'es', modes: ['flow', 'arcade'] }));
const access = { users: [{ id: 'u1', email: 'luis@example.com', name: 'Luis' }, { id: 'u2', email: 'vero@example.com', name: 'Vero' }],
  courses: courses.map((c, i) => ({ id: c.id, key: c.key, title: c.title, visibility: i === 0 ? 'public' : 'private', owner: 'u1', visibleTo: [] })) };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];
  async function open(admin, path = '') {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const asked = []; const posted = [];
    await page.route('**/api/**', (route) => {
      const u = new URL(route.request().url());
      const p = u.pathname.replace(/^\/api/, '');
      asked.push(`${p}${u.search}`);
      if (route.request().method() === 'POST') posted.push({ p, body: route.request().postDataJSON() });
      let data = {};
      if (p === '/users/me') data = { id: 'u1', first_name: 'Luis', email: 'luis@example.com' };
      else if (p === '/memora/me') data = { staff: admin, admin };
      else if (p === '/memora/courses') data = admin ? courses : courses.slice(0, 1);
      else if (p === '/memora/missions') data = { missions: [{ key: '01', title: 'Misión 1 · Inicio', index: 1, total: 10, worked: 2, learned: 1, due: 0, status: 'active' }], current: '01' };
      else if (p === '/memora/progress') data = { streak: 1, bestStreak: 1, shields: 0, todayAttempts: 0, failures: 0, today: { newUnits: 0, goal: 12 }, calendar: [], skills: [], units: [], associations: [] };
      else if (p === '/memora/access' && route.request().method() === 'GET') data = access;
      else if (p === '/memora/access') { const b = route.request().postDataJSON(); const c = access.courses.find((x) => x.id === b.course); if (b.visibility) c.visibility = b.visibility; if (b.email) c.visibleTo = b.on ? [...c.visibleTo, b.email] : c.visibleTo.filter((e) => e !== b.email); data = { visibility: c.visibility, visibleTo: c.visibleTo }; }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
    });
    await page.goto(`${base}${path}`);
    return { page, asked, posted };
  }

  // 1. El selector de Inicio.
  let { page, asked } = await open(true);
  await page.waitForSelector('.switcher');
  const sw = await page.evaluate(() => { const b = document.querySelector('.switcher'); const r = b.getBoundingClientRect(); return { text: b.textContent, h: Math.round(r.height), right: Math.round(r.right) }; });
  check(/Inglés · 1\.000 palabras/.test(sw.text) && /Cambiar/.test(sw.text) && sw.h >= 44 && sw.right <= 390, `Inicio dice qué asignatura tienes y deja cambiarla (${sw.h} px de alto)`);
  check(await page.locator('.courses').count() === 0, 'ya no está la tira de pastillas que escondía casi todas');
  if (shots) await page.screenshot({ path: `${shots}/asignaturas-inicio.png` });
  await page.locator('.switcher').tap();
  await page.waitForSelector('.sheet');
  const items = await page.locator('.picker button').evaluateAll((b) => b.map((x) => ({ t: x.textContent, h: Math.round(x.getBoundingClientRect().height), vis: x.getBoundingClientRect().bottom <= innerHeight + 400 })));
  check(items.length === courses.length && items.every((i) => i.h >= 44), `la hoja enseña las ${items.length} asignaturas, cada una tocable`);
  check(items[2].t.includes('🗄️') && items[2].t.includes('Bases de datos') && !items[2].t.includes('· DAM'), `cada una con su icono y el nombre corto («${items[2].t.trim()}»)`);
  check(await page.locator('.picker button.on').count() === 1, 'la actual sale marcada');
  if (shots) { await page.waitForTimeout(500); await page.screenshot({ path: `${shots}/asignaturas-hoja.png` }); }
  asked.length = 0;
  await page.locator('.picker button', { hasText: 'Bases de datos' }).tap();
  await page.waitForFunction(() => !document.querySelector('.sheet'));
  await page.waitForTimeout(300);
  check(/Bases de datos/.test(await page.locator('.switcher').textContent()) && asked.some((a) => a.includes('course=c2')), 'al elegir otra, Inicio cambia a esa asignatura y carga sus misiones');
  await page.locator('.switcher').tap();
  await page.waitForSelector('.sheet');
  await page.mouse.click(195, 40);
  await page.waitForTimeout(300);
  check(await page.locator('.sheet').count() === 0, 'tocar fuera de la hoja la cierra');
  await page.close();

  // 2. Con una sola asignatura, no hay nada que cambiar.
  ({ page } = await open(false));
  await page.waitForSelector('.switcher');
  check(await page.locator('.switcher-go').count() === 0 && await page.locator('.switcher').isDisabled(), 'con una sola asignatura no se ofrece cambiar');
  await page.close();

  // 3. Asignaturas de cada alumno (solo administración).
  let posted;
  ({ page, posted } = await open(true));
  await page.waitForSelector('.switcher');
  await page.evaluate(() => { history.pushState(null, '', '/perfil'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForSelector('.access-course');
  const n = await page.locator('.access-course').count();
  check(n === courses.length, `el panel lista las ${n} asignaturas`);
  const prog = page.locator('.access-course', { hasText: 'Programación' });
  check(await prog.locator('.seg button.on').textContent() === 'Solo elegidos' && await prog.locator('.access-users li').count() === 2, 'una privada enseña los alumnos que pueden verla');
  check(await prog.locator('label.owner input').isChecked() && await prog.locator('label.owner input').isDisabled(), 'el propietario la ve siempre (no se puede quitar)');
  await prog.locator('label', { hasText: 'Vero' }).locator('input').tap();
  await page.waitForTimeout(300);
  check(posted.some((x) => x.p === '/memora/access' && x.body.course === 'c1' && x.body.email === 'vero@example.com' && x.body.on === true) && await prog.locator('label', { hasText: 'Vero' }).locator('input').isChecked(), 'marcar a un alumno le da esa asignatura');
  const ingles = page.locator('.access-course', { hasText: 'Inglés' });
  check(await ingles.locator('.access-users').count() === 0 && await ingles.locator('.seg button.on').textContent() === 'Para todos', 'inglés está para todos (sin lista)');
  await ingles.locator('.seg button', { hasText: 'Solo elegidos' }).tap();
  await page.waitForTimeout(300);
  check(posted.some((x) => x.body.course === 'c0' && x.body.visibility === 'private') && await ingles.locator('.access-users li').count() === 2, '«Solo elegidos» la cierra y aparece la lista de alumnos');
  const btns = await page.locator('.access .seg button').evaluateAll((b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
  check(btns.every((h) => h >= 40) && !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'todo se toca con el dedo y nada se sale de la pantalla');
  if (shots) { await prog.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${shots}/asignaturas-panel.png` }); }
  await page.close();
  ({ page } = await open(false));
  await page.waitForSelector('.switcher');
  await page.evaluate(() => { history.pushState(null, '', '/perfil'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForSelector('.profile');
  check(await page.locator('.access').count() === 0, 'un alumno normal no ve el panel');
  await page.close();
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);
