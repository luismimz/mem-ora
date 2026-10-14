// EJEMPLOS DE PRUEBA (sin revisar) para ver el modo Asociaciones en dos materias: inglés y Java (POO).
// Solo local. El contenido real lo escribe y revisa el usuario desde Studio.
//   pnpm backend:seed-examples   (borra y vuelve a crear los cursos «ejemplo-ingles» y «ejemplo-java»)
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
const sources = [{ title: 'Ejemplo de prueba (sin revisar)' }];
const license = 'proprietary-own';

// [clave, texto, significado, pronunciación figurada, puente, escena ES, escena en el idioma del contenido, emoji, ejemplo, traducción]
const english = [
  ['play', 'play', 'jugar', 'PLÉI', 'PLAYA', 'Una PLAYA invade el salón cuando empiezas a JUGAR.', 'A BEACH invades the living room when you start to PLAY.', '🏖️🎮', 'I play with my dog.', 'Juego con mi perro.'],
  ['key', 'key', 'llave', 'KÍI', 'KIWI', 'Un KIWI gigante se convierte en la LLAVE de tu casa.', 'A giant KIWI turns into the KEY to your house.', '🥝🔑', 'Where is my key?', '¿Dónde está mi llave?'],
  ['borrow', 'borrow', 'pedir prestado', 'BÓ-rou', 'BURRO', 'Un BURRO entra en tu cuarto para PEDIR PRESTADO tu móvil.', 'A DONKEY comes into your room to BORROW your phone.', '🫏📱', 'Can I borrow your pen?', '¿Me prestas tu boli?'],
  ['lock', 'lock', 'cerradura', 'LOK', 'LOCO', 'Un LOCO se encierra y se come la CERRADURA de la puerta.', 'A MADMAN locks himself in and eats the LOCK.', '🤪🔒', 'The lock is broken.', 'La cerradura está rota.'],
  ['pocket', 'pocket', 'bolsillo', 'PÓ-ket', 'PAQUETE', 'Metes un PAQUETE enorme en el BOLSILLO y te arrastra el pantalón.', 'You stuff a huge PACKAGE into your POCKET.', '📦👖', 'My phone is in my pocket.', 'Mi móvil está en mi bolsillo.'],
  ['desk', 'desk', 'escritorio', 'DESK', 'DISCO', 'Un DISCO gira sin parar sobre tu ESCRITORIO y salen chispas.', 'A DISC spins nonstop on your DESK.', '💿🗄️', 'The book is on the desk.', 'El libro está en el escritorio.'],
  ['charger', 'charger', 'cargador', 'CHÁR-yer', 'CHARCO', 'Tu CARGADOR salta a un CHARCO y echa chispas.', 'Your CHARGER jumps into a PUDDLE and sparks.', '🔌💦', 'I need my charger.', 'Necesito mi cargador.'],
  ['battery', 'battery', 'batería', 'BÁ-te-ri', 'BATE', 'Un BATE de béisbol golpea el móvil y le saca la BATERÍA.', 'A baseball BAT hits the phone and knocks out the BATTERY.', '⚾🔋', 'My battery is low.', 'Me queda poca batería.'],
  ['receipt', 'receipt', 'recibo', 'ri-SÍIT', 'RECETA', 'El cajero te da una RECETA de paella en vez del RECIBO.', 'The cashier gives you a paella RECIPE instead of the RECEIPT.', '🧾🥘', 'Can I have the receipt?', '¿Me da el recibo?'],
  ['plug', 'plug', 'enchufe', 'PLAG', 'PLUMA', 'Metes una PLUMA en el ENCHUFE y se te ponen los pelos de punta.', 'You stick a FEATHER into the PLUG and your hair stands up.', '🪶🔌', 'Where is the plug?', '¿Dónde está el enchufe?'],
  ['actually', 'actually', 'en realidad', 'ÁK-chua-li', 'ACTOR', 'Un ACTOR se quita la máscara y grita: «EN REALIDAD soy tu vecino».', 'An ACTOR takes off his mask: «ACTUALLY, I am your neighbour».', '🎭😲', 'Actually, I like it.', 'En realidad, me gusta.'],
  ['find', 'find', 'encontrar', 'FÁIND', 'FIN', 'Al FIN de la búsqueda logras ENCONTRAR tus gafas en la nevera.', 'At the END of the search you FIND your glasses in the fridge.', '🏁👓', "I can't find my keys.", 'No encuentro mis llaves.'],
  ['run-out-of', 'run out of', 'quedarse sin', 'RAN ÁUT OV', 'RANA', 'Una RANA corre tanto que acaba por QUEDARSE SIN zapatillas.', 'A FROG runs so much that it RUNS OUT OF trainers.', '🐸👟', 'We ran out of milk.', 'Nos quedamos sin leche.'],
  ['cheap', 'cheap', 'barato', 'CHÍIP', 'CHIP', 'Venden un CHIP tan BARATO que lo regalan con el pan.', 'They sell a CHIP so CHEAP they give it away with bread.', '💾🥖', 'This hotel is cheap.', 'Este hotel es barato.'],
  ['bill', 'bill', 'factura', 'BIL', 'BILLETE', 'Pagas la FACTURA con un BILLETE del tamaño de una sábana.', 'You pay the BILL with a NOTE as big as a bedsheet.', '💵🧾', 'Can we have the bill?', '¿Nos trae la cuenta?'],
  ['phone', 'phone', 'teléfono', 'FÓUN', 'FONDO', 'Tu TELÉFONO cae al FONDO del mar y contesta un pulpo.', 'Your PHONE sinks to the BOTTOM of the sea and an octopus answers.', '📱🐙', 'My phone is ringing.', 'Me suena el teléfono.'],
  ['cup', 'cup', 'taza', 'KAP', 'COPA', 'Bebes café de una COPA de campeón: es tu nueva TAZA.', 'You drink coffee from a winner’s TROPHY: it is your new CUP.', '🏆☕', 'A cup of tea, please.', 'Una taza de té, por favor.'],
  ['door', 'door', 'puerta', 'DÓOR', 'DORADA', 'Una PUERTA DORADA se abre y sale nadando un pez.', 'A GOLDEN DOOR opens and a fish swims out.', '🚪🐟', 'Close the door, please.', 'Cierra la puerta, por favor.'],
  ['bed', 'bed', 'cama', 'BED', 'BEDUINO', 'Un BEDUINO duerme bajo tu CAMA con su camello.', 'A BEDOUIN sleeps under your BED with his camel.', '🛏️🐪', 'I go to bed at eleven.', 'Me acuesto a las once.'],
  ['pillow', 'pillow', 'almohada', 'PÍ-lou', 'PILLO', 'Un PILLO te roba la ALMOHADA mientras duermes.', 'A RASCAL steals your PILLOW while you sleep.', '🦹🛌', 'This pillow is soft.', 'Esta almohada es blanda.'],
  ['kitchen', 'kitchen', 'cocina', 'KÍ-chen', 'QUICHE', 'Una QUICHE gigante ocupa toda la COCINA y no te deja entrar.', 'A giant QUICHE fills the whole KITCHEN.', '🥧🍳', 'The kitchen is small.', 'La cocina es pequeña.'],
  ['how-much', 'How much is it?', 'cuánto cuesta', 'JAU MACH IS IT', '', 'Un LORO en la tienda solo sabe gritar «¿CUÁNTO CUESTA?».', 'A PARROT in the shop only shouts «HOW MUCH IS IT?».', '🦜💰', 'How much is it?', '¿Cuánto cuesta?'],
];

const java = [
  ['class', 'class', 'molde', 'KLAS', 'CLASE', 'Un MOLDE gigante de galletas grita: «soy una CLASE».', 'A giant cookie MOLD shouts: «I am a CLASS».', '🍪🧁', 'public class Dog { }', 'Una clase Perro: el molde de todos los perros.'],
  ['object', 'object', 'objeto', 'ÓB-yekt', '', 'Cada galleta que sale del molde es un OBJETO con su propio sabor.', 'Every cookie from the mold is an OBJECT with its own flavour.', '🍪✨', 'Dog rex = new Dog();', 'rex es un objeto: un perro concreto.'],
  ['new', 'new', 'crear', 'NIU', 'NIÑO', 'Un NIÑO aprieta el botón NEW y nace una galleta: acabas de CREAR.', 'A KID presses NEW and a cookie is born: you just CREATE.', '👶🆕', 'Dog rex = new Dog();', 'new crea un objeto nuevo.'],
  ['extends', 'extends', 'heredar', 'iks-TÉNDS', 'EXTENSO', 'Un abuelo deja un testamento EXTENSO: su nieto va a HEREDAR su bigote.', 'A grandpa leaves a LONG will: his grandson INHERITS his moustache.', '👴📜', 'class Puppy extends Dog { }', 'Cachorro hereda de Perro.'],
  ['abstract', 'abstract', 'incompleto', 'ÁBS-trakt', 'ABSTRACTO', 'Un cuadro ABSTRACTO está INCOMPLETO: solo sus hijas pueden terminarlo.', 'An ABSTRACT painting is UNFINISHED: only its daughters can complete it.', '🖼️🎨', 'abstract class Animal { }', 'Animal es una clase incompleta: no se crea directamente.'],
  ['private', 'private', 'privado', 'PRÁI-vet', 'PIRATA', 'Un PIRATA esconde su tesoro: es PRIVADO y nadie de fuera lo toca.', 'A PIRATE hides his treasure: it is PRIVATE, no outsider touches it.', '🏴‍☠️🔒', 'private int age;', 'age solo se usa dentro de la clase.'],
  ['public', 'public', 'visible para todos', 'PÁ-blik', 'PÚBLICO', 'Un estadio lleno de PÚBLICO: lo que haces es VISIBLE para todos.', 'A stadium full of PUBLIC: what you do is VISIBLE to everyone.', '🏟️👀', 'public void bark() { }', 'bark se puede usar desde cualquier clase.'],
  ['override', 'override', 'sobrescribir', 'óu-ver-RÁID', 'OVEROL', 'Un hijo con OVEROL tacha la receta del padre para SOBRESCRIBIR la suya.', 'A son in OVERALLS crosses out dad’s recipe to OVERRIDE it.', '👨‍🍳✍️', '@Override void bark() { }', 'El hijo sobrescribe el método del padre.'],
  ['polymorphism', 'polymorphism', 'muchas formas', 'po-li-MÓR-fi-sm', 'POLLO', 'Un POLLO adopta MUCHAS FORMAS: pato, pavo o águila, pero siempre cacarea.', 'A CHICKEN takes MANY FORMS: duck, turkey or eagle, but always clucks.', '🐔🦅', 'Animal a = new Dog();', 'Una variable Animal guarda un Perro: polimorfismo.'],
  ['interface', 'interface', 'contrato', 'ÍN-ter-feis', 'ENCHUFE', 'Un ENCHUFE universal firma un CONTRATO: quien lo cumple, encaja.', 'A universal PLUG signs a CONTRACT: whoever follows it, fits.', '🔌📜', 'class Dog implements Pet { }', 'Perro cumple el contrato Pet.'],
  ['constructor', 'constructor', 'inicializar', 'kons-TRÁK-tor', 'CONSTRUCTOR', 'Un CONSTRUCTOR con casco monta cada objeto al nacer para INICIALIZAR sus piezas.', 'A BUILDER in a helmet assembles each object at birth to INITIALIZE it.', '👷🧱', 'Dog(String name) { this.name = name; }', 'El constructor inicializa el nombre.'],
  ['static', 'static', 'compartido', 'STÁ-tik', 'ESTATUA', 'Una ESTATUA en un banco COMPARTIDO por todo el pueblo.', 'A STATUE on a bench SHARED by the whole town.', '🗽🪑', 'static int count;', 'count es compartido por todos los perros.'],
];

async function makeCourse(key, title, subject, perSession, contentLanguage, moduleNames, rows, audio = true, modes = ['associations', 'grammar', 'arcade', 'chat']) {
  for (const c of await api('GET', `/items/courses?filter[key][_eq]=${key}&fields=id`)) await api('DELETE', `/items/courses/${c.id}`);
  const course = await api('POST', '/items/courses', { key, title, subject, status: 'published', visibility: 'public', ui_language: 'es', learner_language: 'es', content_language: contentLanguage, new_per_session: perSession, audio_enabled: audio, modes });
  const modules = [];
  for (const [i, name] of moduleNames.entries()) modules.push(await api('POST', '/items/modules', { course: course.id, key: `m${i + 1}`, title: name, sort: i, status: 'published' }));
  for (const [i, [k, text, meaning, respelling, cue, scene, sceneTarget, emoji, ex, tr]] of rows.entries()) {
    const form = text.includes(' ') ? (text.endsWith('?') ? 'expression' : 'phrasal_verb') : 'word';
    const unit = await api('POST', '/items/units', {
      course: course.id, module: modules[Math.min(modules.length - 1, Math.floor(i / 5))].id, key: k, type: 'term', sort: i, sources, license,
      payload: { form, text, meaning, pronunciation: { respelling }, examples: [{ text: ex, translation: tr }] },
    });
    const a = await api('POST', '/items/associations', { unit: unit.id, technique: 'absurd_scene', cue: cue || null, text: scene, scene_target: sceneTarget, emoji, sources, license });
    await publish('associations', a.id);
    await publish('units', unit.id);
  }
  console.log(`✓ ${title}: ${rows.length} unidades, ${perSession} por sesión`);
}

for (const c of await api('GET', '/items/courses?filter[key][_eq]=demo-h22a&fields=id')) await api('DELETE', `/items/courses/${c.id}`);
await makeCourse('ejemplo-ingles', 'Inglés · La Casa Viva (ejemplo sin revisar)', 'idioma', 15, 'en', ['Dormitorio', 'Necesitas ayuda en el trabajo', 'La cocina', 'La tienda', 'Más'], english);
await makeCourse('ejemplo-java', 'Java · Programación orientada a objetos (ejemplo sin revisar)', 'programación', 10, 'en', ['Clases y objetos', 'Herencia y polimorfismo', 'Visibilidad y más'], java, false, ['associations', 'arcade']);
