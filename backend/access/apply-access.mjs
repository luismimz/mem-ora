// Roles, políticas, permisos y ajustes del proyecto, como código (D-028). Idempotente: se puede ejecutar
// cuantas veces haga falta; los permisos de cada política se sustituyen por los de este archivo.
//   pnpm backend:access
// Roles: Administrador (2FA obligatorio), Autor, Revisor y Alumno. El flujo de estados lo impone además la
// extensión `memora`, así que un permiso amplio aquí no permite saltarse la revisión.

const URL_BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) throw new Error('Falta ADMIN_TOKEN (ejecuta con --env-file=backend/.env).');

async function api(method, path, body) {
  const res = await fetch(`${URL_BASE}${path}`, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}
const q = (filter) => `filter=${encodeURIComponent(JSON.stringify(filter))}`;

const EDITABLE = { status: { _in: ['draft', 'rejected', 'needs_review'] } };
const OWN_DRAFT = { _and: [{ status: { _eq: 'draft' } }, { user_created: { _eq: '$CURRENT_USER' } }] };
const PARENT_EDITABLE = { unit: { status: { _in: ['draft', 'rejected'] } } };
const all = (collection, actions, extra = {}) => actions.map((action) => ({ collection, action, fields: ['*'], permissions: extra[action] ?? null }));

const authorPermissions = [
  ...all('courses', ['read']),
  ...all('modules', ['create', 'read', 'update']),
  ...all('units', ['create', 'read', 'update', 'delete'], { update: EDITABLE, delete: OWN_DRAFT }),
  ...all('skills', ['create', 'read', 'update', 'delete'], { update: PARENT_EDITABLE, delete: PARENT_EDITABLE }),
  ...all('associations', ['create', 'read', 'update', 'delete'], { update: EDITABLE, delete: OWN_DRAFT }),
  ...all('prerequisites', ['create', 'read', 'update', 'delete']),
  ...all('media', ['read']),
  ...all('review_events', ['read']),
  ...all('content_versions', ['read']),
  ...all('directus_files', ['create', 'read']),
  { collection: 'directus_users', action: 'read', fields: ['id', 'first_name', 'last_name', 'avatar'], permissions: null },
];

const reviewerPermissions = [
  ...all('courses', ['read', 'update']),
  ...all('modules', ['create', 'read', 'update']),
  ...all('units', ['create', 'read', 'update']),
  ...all('skills', ['create', 'read', 'update', 'delete'], { update: PARENT_EDITABLE, delete: PARENT_EDITABLE }),
  ...all('associations', ['create', 'read', 'update']),
  ...all('prerequisites', ['create', 'read', 'update', 'delete']),
  ...all('media', ['read', 'update']),
  ...all('review_events', ['read']),
  ...all('content_versions', ['read']),
  ...all('directus_files', ['create', 'read']),
  { collection: 'directus_users', action: 'read', fields: ['id', 'first_name', 'last_name', 'avatar'], permissions: null },
];

const ROLES = [
  { role: 'Autor', icon: 'edit_note', description: 'Crea y edita borradores y los envía a revisión.', policy: 'Memora · Autor', app_access: true, permissions: authorPermissions },
  { role: 'Revisor', icon: 'fact_check', description: 'Revisa, aprueba, rechaza y publica.', policy: 'Memora · Revisor', app_access: true, permissions: reviewerPermissions },
  // El alumno no usa el panel ni lee colecciones directamente: lo hará por los endpoints del H2.2a.
  { role: 'Alumno', icon: 'school', description: 'Estudia en la app. Sin acceso al panel.', policy: 'Memora · Alumno', app_access: false, permissions: [] },
];

async function ensurePolicy({ policy, icon, description, app_access }) {
  const [found] = await api('GET', `/policies?${q({ name: { _eq: policy } })}&fields=id`);
  const body = { name: policy, icon, description, admin_access: false, app_access, enforce_tfa: false };
  if (found) {
    await api('PATCH', `/policies/${found.id}`, body);
    return found.id;
  }
  return (await api('POST', '/policies', body)).id;
}

async function ensureRole({ role, icon, description }, policyId) {
  const [found] = await api('GET', `/roles?${q({ name: { _eq: role } })}&fields=id`);
  const id = found ? found.id : (await api('POST', '/roles', { name: role, icon, description })).id;
  const links = await api('GET', `/access?${q({ _and: [{ role: { _eq: id } }, { policy: { _eq: policyId } }] })}&fields=id`);
  if (!links.length) await api('POST', '/access', { role: id, policy: policyId });
  return id;
}

async function replacePermissions(policyId, permissions) {
  const existing = await api('GET', `/permissions?${q({ policy: { _eq: policyId } })}&fields=id&limit=-1`);
  if (existing.length) await api('DELETE', '/permissions', existing.map((p) => p.id));
  if (permissions.length) await api('POST', '/permissions', permissions.map((p) => ({ policy: policyId, validation: null, presets: null, ...p })));
}

for (const def of ROLES) {
  const policyId = await ensurePolicy(def);
  await ensureRole(def, policyId);
  await replacePermissions(policyId, def.permissions);
  console.log(`✓ ${def.role}: ${def.permissions.length} permisos`);
}

// Administración: 2FA obligatorio (D-025).
const adminPolicies = await api('GET', `/policies?${q({ admin_access: { _eq: true } })}&fields=id,name`);
for (const p of adminPolicies) await api('PATCH', `/policies/${p.id}`, { enforce_tfa: true });
console.log(`✓ 2FA obligatorio en ${adminPolicies.length} política(s) de administración`);

// Ajustes del proyecto: registro cerrado (solo por invitación) y panel en español.
await api('PATCH', '/settings', { project_name: 'Memora Studio', default_language: 'es-ES', public_registration: false, project_color: '#4F46E5' });
console.log('✓ Ajustes: registro por invitación, panel en español');
