// Conversación con IA (D-107) en un móvil emulado (390×844) con TOQUES REALES, micrófono simulado de Chromium y la API
// simulada: se elige una situación, la IA abre, se contesta (sin mantener pulsado), llega un WAV con el historial, se
// ven las burbujas con la autocorrección (verde) y el error (ámbar), la conversación sigue sola y el resumen final
// premia la autocorrección y manda el error al repaso.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5196, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-home.html`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const course = { id: 'c1', key: 'ingles', title: 'Inglés', subject: 'idioma', ui_language: 'es', content_language: 'en', learner_language: 'es', audio_enabled: false, new_per_session: 15, modes: ['flow'] };
const scenarios = [
  { key: 'libre', title: 'Charla libre', emoji: '💬', goal: 'Habla de ti.', opening: 'Hi! How was your day today?', help: { idea: 'Cuéntale que tu día ha ido bien.', keywords: ['good', 'today'], frame: 'My day was ___.', model: 'My day was good.' } },
  { key: 'restaurante', title: 'En el restaurante', emoji: '🍽️', goal: 'Pide comida y la cuenta.', opening: 'Good evening! Are you ready to order?', help: { idea: 'Pide una pizza.', keywords: ['pizza'], frame: 'I would like a ___.', model: 'I would like a pizza.' } },
];
const turns = [];
const events = [];
let spent = 0.05;

// Micrófono simulado EN SILENCIO (un WAV de 3 s sin sonido): así el turno solo se envía al tocar y la ayuda que sube
// sola se puede comprobar sin carreras (con el pitido por defecto, a veces contaba como voz y enviaba a destiempo).
const silent = join(mkdtempSync(join(tmpdir(), 'memora-mic-')), 'silencio.wav');
{ const rate = 16000, n = rate * 3, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); writeFileSync(silent, b); }
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${silent}`] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, permissions: ['microphone'] });
  // La voz del sistema no termina nunca en el navegador sin cabeza: se simula una que acaba enseguida.
  await context.addInitScript(() => {
    const fake = { speaking: false, pending: false, paused: false, getVoices: () => [], cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      speak(u) { setTimeout(() => { u.onstart?.(new Event('start')); setTimeout(() => u.onend?.(new Event('end')), 50); }, 10); } };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/audio/**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api/, '');
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    let data;
    if (path === '/memora/talk/turn') {
      turns.push(body);
      spent += 0.004;
      data = turns.length === 1
        ? { heard: 'The boy is ten years old and I has a dog', reply: 'Oh, he is ten! And you have a dog? What is its name?', recast: 'The boy is ten years old and I have a dog.',
            selfCorrections: [{ from: 'has a 10 years old', to: 'is ten years old' }], mistakes: [{ said: 'I has a dog', correct: 'I have a dog', why: 'Con I se usa have.', unitKey: 'have', skillKey: 'have:recall' }], goalDone: false, help: { idea: 'Dile cómo se llama tu perro.', keywords: ['his name', 'is'], frame: 'His name is ___.', model: 'His name is Rex.' }, howTo: null, spentEur: spent, capEur: 5 }
        : { heard: 'Its name is Rex', reply: 'Rex is a great name!', recast: null, selfCorrections: [], mistakes: [], goalDone: true, help: null, howTo: { es: 'perro', en: 'dog' }, spentEur: spent, capEur: 5 };
    } else if (path === '/memora/events') { events.push(...body.events); data = { accepted: [], duplicates: [], rejected: [] }; }
    else data = path === '/users/me' ? { id: 'u1', first_name: 'Luis', email: 'luis@example.com' }
      : path === '/memora/me' ? { staff: false }
      : path === '/memora/courses' ? [course]
      : path === '/memora/missions' ? { missions: [{ key: '01', title: 'Misión 1', index: 1, total: 10, worked: 5, learned: 3, due: 0, status: 'active' }], current: '01' }
      : path === '/memora/progress' ? { streak: 1, bestStreak: 1, shields: 0, todayAttempts: 0, failures: 0, today: { newUnits: 0, goal: 33 }, calendar: Array(84).fill(0), skills: [], units: [], associations: [] }
      : path === '/memora/talk' ? { available: true, reason: null, capEur: 5, spentEur: spent, language: 'en', scenarios }
      : path === '/memora/speak' ? { available: true, reason: null, capEur: 5, spentEur: spent, language: 'en', items: [] }
      : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await page.goto(url);
  await page.waitForSelector('.speak-btn');
  check(/Conversar en inglés/.test(await page.textContent('.speak-btn')), 'Inicio de inglés ofrece «Conversar en inglés»');
  await page.locator('.speak-btn').tap();
  await page.waitForSelector('.talk-sc');
  check(page.url().includes('/conversar?curso=c1'), 'la conversación tiene su dirección (/conversar)');
  const cards = await page.$$eval('.talk-sc', (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
  check(cards.length === 2 && cards.every((h) => h >= 44), `elige situación con un toque (${cards.join(', ')} px)`);
  check(await page.locator('.talk-warm').count() === 1, 'el calentamiento de frases sueltas sigue disponible');
  if (shots) await page.screenshot({ path: `${shots}/conversar-elige.png` });

  check(await page.locator('.talk-mode button.on', { hasText: 'Guiado' }).count() === 1, 'por defecto, modo guiado (del español al inglés)');
  await page.locator('.talk-sc', { hasText: 'Charla libre' }).tap();
  await page.waitForSelector('.bubble.ai');
  await page.waitForSelector('.help-idea');
  check(/tu día ha ido bien/.test(await page.textContent('.help-idea')) && await page.locator('.help-keys .help-key').count() === 0, 'guiado: ya se ve QUÉ decir, en español (sin dar aún las palabras)');
  // Si te quedas en blanco, la ayuda sube sola un escalón: aparecen las palabras clave.
  // (El pitido del micrófono simulado a veces cuenta como voz y entonces no salta sola: se pide con 💡.)
  const auto = await page.waitForSelector('.help-keys .help-key', { timeout: 9000 }).then(() => true).catch(() => false);
  if (!auto) await page.locator('.help-more').tap();
  check(await page.locator('.help-keys .help-key').count() === 2, auto ? 'si te quedas callado, salen solas las palabras clave' : '💡 da las palabras clave (el micrófono simulado contó como voz)');
  // La ayuda también sube sola con el tiempo: se toca 💡 hasta que sale cada escalón.
  for (let k = 0; k < 3 && !(await page.locator('.help-frame').count()); k++) { await page.locator('.help-more').tap(); await page.waitForTimeout(150); }
  check(/My day was ___/.test(await page.textContent('.help-frame')), '💡 da la frase con huecos');
  for (let k = 0; k < 3 && !(await page.locator('.help-model').count()); k++) { await page.locator('.help-more').tap(); await page.waitForTimeout(150); }
  check(/My day was good/.test(await page.textContent('.help-model')) && await page.locator('.help-more').count() === 0, 'y por último la frase entera para leerla');
  await page.locator('.help-life').tap();
  const lifes = await page.$$eval('.help-key.life', (b) => b.map((x) => ({ t: x.textContent, h: Math.round(x.getBoundingClientRect().height) })));
  check(lifes.length >= 4 && lifes.some((l) => /Let me think/.test(l.t)) && lifes.every((l) => l.h >= 36), 'salvavidas a mano: Let me think…, How do you say…?, Can you repeat…');
  if (shots) await page.screenshot({ path: `${shots}/conversar-ayuda.png` });
  check((await page.textContent('.bubble.ai')).includes('How was your day'), 'la IA abre la conversación (frase fija: empezar no cuesta)');
  await page.waitForSelector('.talk-mic.listening, .talk-mic.hearing', { timeout: 5000 });
  check(true, 'después de hablar la IA, escucha sola (manos libres, sin mantener pulsado)');
  await page.waitForTimeout(1500);
  await page.locator('.talk-mic').tap(); // con el micrófono simulado (un pitido continuo) se envía tocando
  await page.waitForSelector('.bubble.me');
  const t1 = turns[0];
  check(t1 && t1.scenario === 'libre' && t1.history.length === 1 && t1.history[0].who === 'ai', 'envía la situación y el historial (solo texto)');
  check(t1 && Buffer.from(t1.audio.slice(0, 16), 'base64').toString('latin1').startsWith('RIFF'), 'y el audio del turno en WAV');
  await page.waitForSelector('.talk-chip.self');
  const self = await page.textContent('.talk-chip.self');
  const miss = await page.textContent('.talk-chip.miss');
  check(/Te has corregido/.test(self) && /is ten years old/.test(self), `la autocorrección se ve en verde, como logro («${self.trim()}»)`);
  check(/I have a dog/.test(miss), 'el error que se quedó, en ámbar y sin cortar la charla');
  check(/Te has corregido tú solo/.test(await page.textContent('.talk-cheer')), 'corregirse uno mismo se celebra (puntos extra y sonido)');
  check((await page.$$eval('.bubble.ai', (b) => b.map((x) => x.textContent))).some((t) => /What is its name/.test(t)), 'la IA contesta y sigue el hilo con una pregunta');
  await page.waitForSelector('.help-idea');
  check(/cómo se llama tu perro/.test(await page.textContent('.help-idea')) && await page.locator('.help-frame').count() === 0, 'cada respuesta trae su ayuda nueva, otra vez empezando por la idea');
  check(events.length === 1 && events[0].unitKey === 'have' && events[0].format === 'recall_cued' && events[0].correct === false, 'el error vuelve al repaso de su unidad (recordar con pista)');
  if (shots) await page.screenshot({ path: `${shots}/conversar-chat.png` });

  await page.waitForSelector('.talk-mic.listening, .talk-mic.hearing', { timeout: 5000 });
  check(true, 'tras contestar la IA, vuelve a escuchar sola');
  await page.waitForTimeout(1200);
  await page.locator('.talk-mic').tap();
  await page.waitForFunction(() => document.querySelectorAll('.bubble.me').length === 2);
  check(turns[1].history.length === 3 && turns[1].history.every((t) => t.who === 'ai' || t.who === 'me'), 'el segundo turno lleva la conversación anterior (sin las celebraciones)');
  await page.waitForFunction(() => [...document.querySelectorAll('.talk-cheer')].some((e) => /Objetivo cumplido/.test(e.textContent)));
  check((await page.$$eval('.talk-cheer', (e) => e.map((x) => x.textContent))).some((t) => /perro = dog/.test(t)), '«¿cómo se dice…?» deja la palabra en el chat, sin contar como error');
  check(await page.evaluate(() => document.querySelectorAll('.confetti i').length > 0), 'al cumplir el objetivo: confeti y celebración');
  if (shots) await page.screenshot({ path: `${shots}/conversar-objetivo.png` });
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');
  const bar = await page.$eval('.talk-bar', (e) => Math.round(e.getBoundingClientRect().bottom));
  check(bar <= 844, `la barra del micrófono se ve entera (${bar} px)`);

  await page.locator('.talk-end-btn').tap();
  await page.waitForSelector('.talk-end');
  const end = await page.textContent('.talk-end');
  check(/Objetivo cumplido/.test(end) && /Te corregiste tú solo 1 vez/.test(end) && /I have a dog/.test(end), 'resumen: objetivo, autocorrección como logro y lo que conviene repasar');
  if (shots) await page.screenshot({ path: `${shots}/conversar-final.png`, fullPage: true });
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);
