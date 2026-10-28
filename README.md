# FlashMonkey

FlashMonkey es una aplicación web para organizar grupos de ahorro y cuadros
rotativos. Ayuda a administrar socios, aportes, comprobantes, turnos de pago y
movimientos financieros desde una interfaz con permisos según el rol.

## Funcionalidades

- **Cuentas y acceso:** registro e inicio de sesión con correo, recuperación de
  contraseña y opción de acceso con Google cuando el proveedor está configurado.
- **Verificación en dos pasos:** configuración de MFA con una aplicación
  autenticadora y flujos de restablecimiento administrados.
- **Grupos:** creación y configuración de grupos, invitaciones, solicitudes de
  ingreso, participantes y selección del grupo activo.
- **Cuadro rotativo:** visualización del orden de participación y de los pagos
  programados según el estado y configuración del grupo.
- **Aportes:** consulta de periodos, registro de pagos y carga de comprobantes.
  Administración y tesorería pueden revisar comprobantes; las actualizaciones
  en tiempo real dependen de que Realtime esté habilitado en Supabase.
- **Billetera:** consulta de saldo y movimientos propios, solicitud de depósitos
  y retiros, carga de comprobantes y revisión por administración o tesorería.
- **Tesorería:** resumen de grupos, pendientes de revisión, alertas operativas,
  historial financiero, conciliación manual y reportes exportables.
- **Administración:** gestión de grupos, cuentas, roles, documentos, solicitudes,
  configuración financiera y revisión de auditoría.
- **Notificaciones:** avisos de actividad y seguimiento de solicitudes dentro
  de la aplicación.
- **Reportes:** consulta de movimientos, filtros y exportación a Excel o PDF
  según el rol.
- **Préstamos:** sección reservada para una etapa posterior; las operaciones de
  préstamos no están habilitadas actualmente.

La disponibilidad de cada pantalla y operación depende del rol asignado y de
las políticas configuradas en el backend.

Para recopilar métricas de visitas, habilita **Web Analytics** en el panel del
proyecto de Vercel. El componente de Analytics solo envía datos en compilaciones
de producción; en desarrollo local no registra visitas.

## Tecnologías

- React y Vite
- Supabase Auth, PostgreSQL, Storage, Realtime y Edge Functions
- Vercel Web Analytics para métricas de visitas y páginas vistas
- Tailwind CSS
- ExcelJS para exportar reportes

## Requisitos

- Node.js compatible con la versión de Vite indicada en `package.json`.
- npm.
- Un proyecto de Supabase configurado para FlashMonkey.
- Acceso autorizado a las credenciales de desarrollo del proyecto.

## Instalación para desarrollo

1. Clona el repositorio y abre su carpeta:

   ```sh
   git clone <URL_DEL_REPOSITORIO>
   cd mi-cuadro
   ```

2. Instala las dependencias:

   ```sh
   npm install
   ```

3. Crea un archivo `.env` en la raíz a partir de `.env.example` y completa las
   variables públicas del cliente:

   ```dotenv
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```

   Obtén estos valores de la configuración del proyecto Supabase al que tengas
   autorización. La URL y la clave publicable (`anon`/publishable) se incluyen
   en el navegador; no son sustituto de las políticas RLS. **Nunca** pongas en
   variables `VITE_*` contraseñas, claves privadas o la clave `service_role`.

4. Inicia el servidor local:

   ```sh
   npm run dev
   ```

   Vite mostrará la dirección local, normalmente `http://localhost:5173`.

## Backend de Supabase

FlashMonkey necesita tablas, políticas de acceso, funciones de base de datos,
almacenamiento y funciones Edge configuradas en Supabase. Las migraciones de
`supabase/migrations` son cambios incrementales que presuponen el esquema base
de la aplicación; **no constituyen por sí solas una instalación inicial de una
base de datos vacía**.

Antes de modificar una base:

1. Usa un proyecto de pruebas y una copia de seguridad.
2. Confirma el proyecto enlazado y compara el historial local/remoto:

   ```sh
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase migration list
   ```

3. Revisa cada migración pendiente y sus efectos. Aplica cambios solo después de
   confirmar que el proyecto y el historial son los correctos:

   ```sh
   npx supabase db push
   ```

`db push` puede aplicar todas las migraciones pendientes del proyecto enlazado.
No borres migraciones ya versionadas, no las marques como aplicadas sin
comprobar la base y no uses `migration repair` como solución automática a un
desajuste. Para una base vacía, primero se necesita preparar y validar una
migración base compatible con el esquema de la aplicación.

### Funciones Edge y proveedores

Las funciones de `supabase/functions` proporcionan operaciones de servidor
para registro, invitaciones, correo y administración. Después de preparar el
backend, despliega las funciones que usa tu entorno:

### Migraciones de Supabase

Aplica las migraciones de `supabase/migrations` en orden. La migración
`202610070001_persistent_notifications.sql` agrega el historial persistente de
notificaciones y las notificaciones automáticas para las solicitudes de ingreso
a grupos. Las notificaciones quedan asociadas a la cuenta, se sincronizan entre
sesiones y cada usuario solo puede leer, marcar o eliminar las propias.

La migración `202610070002_groups_invitations_profiles_audit.sql` agrega el
directorio e invitaciones de grupos, datos privados de perfil, roles, auditoría,
periodicidad de aportes y controles MFA para las operaciones sensibles.
La migración `202610080001_fix_available_groups_ambiguity.sql` corrige la
consulta del directorio de grupos disponibles para los socios. La migración
`202610080002_fix_admin_rpc_id_ambiguity.sql` corrige referencias ambiguas a
`id` en los listados administrativos de invitaciones, documentos y auditoría.
La migración `202610080003_admin_member_directory.sql` agrega el listado
paginado de cuentas, con correo y fecha de creación, visible solo para
administradores con MFA.
La migración `202610080004_admin_document_verification.sql` permite que
administración y tesorería realicen la verificación documental; solo
administración conserva la facultad de asignar roles.
La migración `202610080005_active_group_contributions_admin_members.sql`
impide registrar aportes antes de iniciar un grupo y agrega la consulta
administrativa protegida para refrescar sus participantes.
La migración `202610080006_welcome_wallet_and_identity_documents.sql` agrega
la bienvenida para socios nuevos, la carga privada del documento de identidad,
el saldo de garantía configurable, las solicitudes de depósito/retiro con
aprobación de administración o tesorería y el débito automático de aportes
vencidos. Los vencimientos se cuentan desde la fecha de inicio de cada grupo:
7 días, 14 días o un mes. También programa la tarea con `pg_cron`; verifica que
la extensión esté habilitada en el proyecto Supabase.
La migración `202610080007_wallet_roles_and_admin_queue.sql` limita la
consulta de saldos e historial a socios y corrige el listado administrativo de
solicitudes de billetera. Los socios usan “Mi billetera”; administración y
tesorería revisan solicitudes desde una pantalla aparte y no tienen billetera
personal en la aplicación.
La migración `202610080008_member_group_approved_count.sql` permite a cada
socio consultar solo el total de integrantes aprobados de los grupos a los que
pertenece, sin exponer la lista ni los datos de otros socios.
La migración `202610080009_assign_payment_positions_on_group_start.sql`
mantiene sin posición a los participantes de grupos en preparación y asigna
el orden de pago únicamente al sortear e iniciar el grupo.
La migración `202610120001_wallet_guarantee_reserve.sql` configura inicialmente
la garantía mínima de billetera en USD 20, editable por administración y
aplicable a todos los socios. La garantía permanece como saldo del socio,
queda protegida contra retiros y solo puede utilizarse para cubrir un aporte
que siga impago después de su vencimiento. Los nuevos aportes no cobran la
comisión fija anterior de USD 1 ni una comisión del 20%; los registros
históricos no se modifican.
La migración `202610220002_register_member_contribution.sql` agrega el registro
administrativo protegido de aportes para el periodo actual de un grupo activo,
con validación de rol, MFA, pertenencia del socio y duplicados.
La migración `202610220004_treasury_expenses.sql` agrega el registro y consulta
protegidos de egresos para administración y tesorería, con suma acumulada y
permisos de lectura/escritura validados mediante MFA.

Los proyectos Supabase nuevos no tienen las tablas base de `perfiles`, `grupos`,
`participantes` y `aportes`: las migraciones del repositorio son incrementales
y presuponen ese esquema. No ejecutes `db push` en un proyecto vacío hasta
preparar y revisar una migración base de esquema sin datos reales. Usa un
proyecto de pruebas y confirma siempre el `project-ref` enlazado antes de
aplicar migraciones.

Con Supabase CLI, vincula el proyecto y aplica las migraciones:

```sh
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

Si ejecutaste la migración 001 directamente desde el SQL Editor y ahora usarás
CLI, registra primero ese hecho en el historial remoto para que `db push` no
intente volver a aplicarla:

```sh
npx supabase migration repair --status applied 202610070001
npx supabase db push
```

También se pueden ejecutar los archivos SQL pendientes en orden desde el SQL
Editor de Supabase. No vuelvas a ejecutar migraciones que ya estén aplicadas.

### Funciones Edge y correo de invitación

Despliega las funciones después de aplicar la migración:

```sh
npx supabase functions deploy register-member --no-verify-jwt
npx supabase functions deploy group-invitations
npx supabase functions deploy send-welcome-email
npx supabase functions deploy admin-reset-mfa
npx supabase functions deploy admin-delete-user
npx supabase functions deploy admin-set-user-status
```

Algunas funciones dependen de proveedores externos y de secretos de servidor.
Configura esos valores en **Supabase Edge Function Secrets** o en el mecanismo
seguro de secretos del entorno, nunca en este README, el código del navegador,
el historial de Git o mensajes. Consulta la configuración de cada proveedor
antes de habilitar correo o OAuth.

Las funciones Edge verifican el origen del navegador. Configura `APP_URL` con
el origen exacto de la aplicación que corresponda al proyecto Supabase (local
en un proyecto de desarrollo; HTTPS estable en producción). `register-member`
también admite orígenes exactos en `APP_ALLOWED_ORIGINS`; las demás funciones
deben recibir solicitudes desde el origen configurado en `APP_URL`. No uses
URLs de preview con funciones de correo o administración si no están
configuradas expresamente. Para desarrollo, Vite usa
`http://localhost:5173`:

```powershell
npx supabase secrets set "APP_URL=http://localhost:5173"
npx supabase functions deploy register-member --no-verify-jwt
```

Usa proyectos Supabase separados para desarrollo y producción. No cambies
`APP_URL` de producción para habilitar pruebas locales. En producción, define
`APP_URL` con el dominio estable de Vercel y despliega las funciones Edge con
esa configuración. No incluyas rutas (`/registro`) ni comodines en los
orígenes permitidos.

Para probar OAuth, Auth, MFA, Storage y Realtime, configura en Supabase los
dominios de desarrollo y producción que realmente uses. Limita los orígenes y
URLs de redirección a esos dominios.

## Comandos útiles

```sh
npm run dev       # Desarrollo local
npm run lint      # Revisión de estilo y errores estáticos
npm run build     # Compilación de producción
npm run preview   # Vista previa de la compilación
```

## Despliegue del frontend

Para publicar en Vercel:

1. Sube el repositorio a GitHub sin incluir `.env` ni credenciales.
2. En Vercel, crea un proyecto e importa el repositorio. Selecciona **Vite**;
   el comando de compilación es `npm run build` y el directorio de salida es
   `dist`. `vercel.json` configura el fallback de rutas para que enlaces
   directos como `/login` funcionen con React Router.
3. En **Settings → Environment Variables**, configura
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para Production (y Preview si
   vas a probar previews). Usa la URL y la clave publicable de Supabase; nunca
   configures `service_role`, `BREVO_API_KEY` u otros secretos como variables
   `VITE_*`.
4. Despliega y asigna un dominio estable, por ejemplo
   `https://tu-dominio.vercel.app` o un dominio propio. Vercel sirve el sitio
   por HTTPS.
5. En Supabase **Authentication → URL Configuration**, establece el dominio
   principal de Vercel como **Site URL** y añade los dominios usados por
   Production y Preview a **Redirect URLs**. Limita la lista a dominios
   controlados por el proyecto.
6. En los secretos de Supabase Edge Functions, configura `APP_URL` con el
   origen exacto de producción (sin ruta), además de `APP_ALLOWED_ORIGINS` para
   los orígenes de desarrollo o preview que realmente usarás. Configura allí
   también `BREVO_API_KEY`, `INVITATION_FROM` y los demás secretos requeridos.
   Después despliega las Edge Functions para que reciban la nueva configuración.
7. En Brevo, verifica el dominio/remitente autorizado y revisa sus registros
   DNS. Los correos de confirmación/invitación deben usar el dominio estable
   de la app para sus enlaces y redirecciones.
8. Prueba registro, login, recuperación de contraseña, MFA, invitaciones,
   correo de bienvenida, Moki, archivos y redirecciones desde el dominio HTTPS
   publicado. No uses información financiera real para estas pruebas.

Para el desarrollo local, usa `http://localhost:5173` (Vite está fijado a
`localhost` para que coincida con el origen local documentado/configurado).
Si cambias el dominio de producción, actualiza `APP_URL`, las URLs de Auth y
los orígenes permitidos; no uses `*` para CORS.

No compartas archivos `.env`, copias de bases de datos ni capturas que muestren
tokens, cookies, datos personales o información financiera real.

## Documentación relacionada

- [SEGURIDAD.md](./SEGURIDAD.md): prácticas para proteger credenciales y
  configurar el entorno.
- [supabase/migrations](./supabase/migrations): cambios versionados del esquema
  y las funciones de base de datos.
