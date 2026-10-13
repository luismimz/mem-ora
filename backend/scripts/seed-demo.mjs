// Contenido de DEMOSTRACIÓN para la prueba humana del H2.2a (solo local). Los textos son ejemplos de prueba SIN
// REVISAR: el contenido real de la habitación lo escribe y revisa el usuario desde el panel (H2.4).
//   pnpm backend:seed-demo        (borra y vuelve a crear el curso «demo-h22a»)
const BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) throw new Error('Falta ADMIN_TOKEN.');
async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${(json.errors ?? []).map((e) => e.message).join(' ')}`);
  return json.data;
}
const publish = async (collection, id) => { for (const status of ['needs_review', 'approved', 'published']) await api('PATCH', `/items/${collection}/${id}`, { status }); };
const sources = [{ title: 'Ejemplo de prueba del H2.2a (sin revisar)' }];
const license = 'proprietary-own';

const old = await api('GET', '/items/courses?filter[key][_eq]=demo-h22a&fields=id');
for (const c of old) await api('DELETE', `/items/courses/${c.id}`);
const course = await api('POST', '/items/courses', { key: 'demo-h22a', title: 'Demo H2.2a · contenido de ejemplo sin revisar', subject: 'idioma', status: 'published', visibility: 'public', ui_language: 'es', learner_language: 'es', content_language: 'en' });

const units = [
  { key: 'borrow', type: 'term', payload: { form: 'word', text: 'borrow', meaning: 'pedir prestado', partOfSpeech: 'verbo', examples: [{ text: 'Can I borrow your charger?', translation: '¿Me prestas tu cargador?' }, { text: 'She borrowed my bike.', translation: 'Me pidió prestada la bici.' }] },
    association: { technique: 'phonetic_bridge', cue: 'burro', text: 'Un BURRO te PIDE PRESTADO el móvil.', evidence: { familiarMeaning: 'animal de carga', soundRelation: 'BÁ-rou recuerda a BU-rro', differences: 'la primera vocal y la erre cambian' } } },
  { key: 'charger', type: 'term', payload: { form: 'word', text: 'charger', meaning: 'cargador', partOfSpeech: 'sustantivo', examples: [{ text: 'My charger is in the car.', translation: 'Mi cargador está en el coche.' }] },
    association: { technique: 'absurd_scene', text: 'Un CARGADOR gigante CARGA tu móvil a la espalda.' } },
  { key: 'i-cant-find', type: 'term', payload: { form: 'expression', text: 'I can’t find…', meaning: 'no encuentro…', examples: [{ text: "I can't find my keys.", translation: 'No encuentro mis llaves.' }] } },
  { key: 'can-i', type: 'pattern', payload: { goal: 'Pedir permiso o algo prestado', rule: '«Can» va primero en la pregunta y el verbo no cambia.', pieces: [{ text: 'Can I', role: 'fixed' }, { text: 'verbo', role: 'slot', hint: 'borrow, use, take…' }, { text: 'objeto', role: 'slot' }], examples: [{ text: 'Can I borrow your pen?', translation: '¿Me prestas tu boli?' }, { text: 'Can I use your phone?', translation: '¿Puedo usar tu móvil?' }, { text: 'Can I take a photo?', translation: '¿Puedo hacer una foto?' }], pitfalls: ['Tras «Can» el verbo no lleva «to»: Can I go?, no Can I to go?'] } },
];
for (const u of units) {
  const unit = await api('POST', '/items/units', { course: course.id, key: u.key, type: u.type, payload: u.payload, sources, license });
  if (u.association) {
    const a = await api('POST', '/items/associations', { unit: unit.id, ...u.association, sources, license });
    await publish('associations', a.id);
  }
  await publish('units', unit.id);
  console.log(`✓ ${u.key}`);
}
console.log('Curso «Demo H2.2a» publicado. Entra en http://127.0.0.1:5173 como alumno@example.com.');
