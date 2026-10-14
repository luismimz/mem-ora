// Ajusta el enlace «Vista previa como alumno» de Studio a la URL de la app de esta instancia (APP_URL).
// Uso: node --env-file=backend/.env.production deploy/set-app-url.mjs
const B = process.env.DIRECTUS_URL, T = process.env.ADMIN_TOKEN, APP = process.env.APP_URL;
if (!B || !T || !APP) throw new Error('Faltan DIRECTUS_URL, ADMIN_TOKEN o APP_URL en el archivo de entorno.');
const h = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const field = (await (await fetch(`${B}/fields/units/preview`, { headers: h })).json()).data;
const links = field.meta.options.links.map((l) => ({ ...l, url: `${APP.replace(/\/$/, '')}/preview/{{id}}` }));
const r = await fetch(`${B}/fields/units/preview`, { method: 'PATCH', headers: h, body: JSON.stringify({ meta: { options: { ...field.meta.options, links } } }) });
console.log(r.ok ? `✓ Vista previa → ${APP}/preview/…` : `✗ HTTP ${r.status}`);
