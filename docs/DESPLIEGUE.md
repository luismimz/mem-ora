# Despliegue en producción (Coolify)

Producción = código desde GitHub + base de datos limpia. **En GitHub no hay datos.** El contenido (cursos, misiones)
se vuelca desde el Mac con el conector `backend/.env.production` (ignorado por git), por la API de producción.

## 1. En Coolify (una vez)
1. **Nuevo recurso → Docker Compose** desde el repositorio `mem-ora` (rama `main`), archivo `deploy/docker-compose.prod.yml`.
2. **Dominios** (en cada servicio del recurso, campo «Domains»), **con el puerto del contenedor al final**:
   - `web` → `https://memora.luismontalvan.com:80`
   - `directus` → `https://studio.luismontalvan.com:8055`
   El puerto no se publica en internet: le dice a Coolify a qué puerto interno enviar el tráfico (HTTPS lo pone él).
   Si falta, Coolify usa el 80 y Directus responde «no available server».
3. **Variables de entorno** (secretas; generarlas largas y aleatorias):
   `DB_PASSWORD`, `SECRET`, `ADMIN_TOKEN`, `ADMIN_EMAIL` (tu correo), `ADMIN_PASSWORD`, `DIRECTUS_LICENSE_KEY`.
   Opcional: `STUDIO_URL` (por defecto `https://studio.luismontalvan.com`).
4. **DNS:** registros A de `memora` y `studio` apuntando a la IP del VPS.
5. **Desplegar.** La primera vez Directus crea las tablas del sistema y tu cuenta de administración.
6. Entra en `https://studio.luismontalvan.com/admin`, cambia la contraseña si quieres y **activa la verificación en
   dos pasos (2FA)**.

## 2. Desde el Mac (el conector)
```bash
cp backend/env.production.example backend/.env.production   # y pon ADMIN_TOKEN (el mismo de Coolify)
pnpm prod:schema    # aplica el esquema versionado y apunta la vista previa a la app de producción
pnpm prod:access    # roles, permisos y ajustes (registro por invitación, panel en español)
pnpm prod:content   # vuelca los cursos de private/dam/misiones (todo en borrador, privado y a tu nombre)
```
Se puede repetir sin duplicar: lo que ya existe se omite. Después, revisa y publica en **Studio → Revisar misiones**.

## Correo saliente (IONOS)
Directus envía los correos de restablecer contraseña e invitaciones por SMTP. En Coolify → mem-ora → Environment Variables:
- `EMAIL_SMTP_PASSWORD` = la contraseña del buzón `hola@luismontalvan.com` en IONOS (obligatoria; solo en Coolify).
- Opcionales (ya tienen valor por defecto): `EMAIL_FROM` y `EMAIL_SMTP_USER` (`hola@luismontalvan.com`),
  `EMAIL_SMTP_HOST` (`smtp.ionos.es`), `EMAIL_SMTP_PORT` (`587`), `EMAIL_SMTP_SECURE` (`false`, STARTTLS).
  Con el puerto `465`, poner `EMAIL_SMTP_SECURE=true`.
Después, **Redeploy**. Prueba: «¿Olvidaste la contraseña?» en studio.luismontalvan.com.

## Contenido desde git (D-080)
Los cursos propios de `content/<curso>/NN-*.json` van dentro de la imagen de Directus y el hook `memora-content` los
vuelca al arrancar: misiones y unidades nuevas se importan y se publican; lo que ya existe solo se actualiza si cambió
(conserva ids, habilidades y progreso); nunca borra. El resultado sale en los logs de Directus (`[memora-content]`).
En local no hace nada salvo que se defina `MEMORA_CONTENT_DIR`.

## 3. Copias de seguridad
- El servicio `backup` hace un `pg_dump` diario y guarda 14 días en el volumen `backups`.
- `pnpm prod:export` guarda en el Mac un JSON de cursos y eventos de alumnos (independiente de Directus).

## Si sale «no available server»
Es el proxy de Coolify diciendo que no hay un contenedor sano para ese dominio. Revisa, en este orden:
1. Que cada servicio tenga su dominio con el puerto (paso 2) y que, tras cambiarlo, se haya vuelto a desplegar.
2. El estado de los contenedores en Coolify: todos «running (healthy)». Si `directus` está reiniciándose, mira sus
   logs (suele ser `DIRECTUS_LICENSE_KEY` o alguna variable vacía).
3. Que los registros DNS apunten a la IP del VPS.

## Notas
- La licencia de Directus consume una activación en esta instancia.
- No hay cuentas de prueba en producción. Para más usuarios: invitación desde Studio (registro cerrado).

## Duración de la sesión
`SESSION_COOKIE_TTL` y `REFRESH_TOKEN_TTL` (por defecto 30d en el compose, D-071). Para pedir el código más a menudo, bájalos en Coolify y redespliega.
