# FlashMonkey

Aplicación de gestión de grupos, socios, aportes, préstamos y cuadros rotativos.

## Requisitos

- Node.js compatible con Vite 8.
- Un proyecto Supabase con las tablas `perfiles`, `grupos`, `participantes`, `aportes`, `entregas` y las funciones RPC que ya consume la aplicación.
- Los perfiles se deben crear desde un proceso de servidor confiable. El rol no debe aceptarse desde los datos enviados por el formulario público de registro.

## Desarrollo local

Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`, instala dependencias e inicia Vite:

```sh
npm install
npm run dev
```

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

También se pueden ejecutar los archivos SQL en orden desde el SQL Editor de
Supabase. No vuelvas a ejecutar la migración 001 si ya se aplicó; ejecuta solo
la 002 pendiente.

### Funciones Edge y correo de invitación

Despliega las funciones después de aplicar la migración:

```sh
npx supabase functions deploy register-member --no-verify-jwt
npx supabase functions deploy group-invitations
npx supabase functions deploy send-welcome-email
```

Si el registro informó que la cuenta se creó pero no pudo guardar el perfil,
despliega nuevamente `register-member` con el comando anterior y vuelve a enviar
el formulario con el mismo correo y contraseña. La función comprueba la
contraseña antes de reparar un registro existente, sin crear otra cuenta.

Configura `APP_URL` con el origen de la aplicación (por ejemplo,
`https://mi-dominio.example`), `BREVO_API_KEY` con una clave API de Brevo y
`INVITATION_FROM` con un remitente de un dominio autenticado en Brevo:

```sh
npx supabase secrets set APP_URL=https://mi-dominio.example
npx supabase secrets set BREVO_API_KEY=xkeysib-xxxxxxxxx
npx supabase secrets set 'INVITATION_FROM=FlashMonkey <invitaciones@mi-dominio.example>'
npx supabase functions deploy group-invitations
```

Obtén la clave API desde la sección **SMTP & API > API Keys** de Brevo.
No la pongas en `.env`, en el frontend ni en GitHub: `group-invitations` la
lee únicamente desde los secretos de Edge Functions. Si ya habías configurado
Resend, la función ahora usa Brevo y deja de leer `RESEND_API_KEY`.

Si Brevo rechaza la clave API o devuelve HTTP 401, crea una clave nueva y
actualiza el secreto en el proyecto Supabase vinculado:

```sh
npx supabase secrets set BREVO_API_KEY=pega_aqui_la_clave_nueva
```

No guardes ni compartas la clave. Si sospechas que fue expuesta, revócala en
Brevo. Actualizar un secreto de Edge Functions no requiere reinstalar Deno ni
cambiar `APP_URL`; vuelve a intentar el envío después de que Supabase aplique
el secreto. Si Brevo rechaza el remitente, autentica el dominio en Brevo y
confirma que `INVITATION_FROM` use una dirección de ese dominio.

Para probar desde desarrollo local, configura temporalmente `APP_URL` con el
origen local exacto, por ejemplo `http://localhost:5173`. El enlace del correo
abrirá ese origen, por lo que solo servirá para pruebas en esa misma máquina.
En producción, reemplázalo por el dominio HTTPS publicado y autorizado en la
configuración de Auth/CORS de Supabase.

Si Brevo rechaza el mensaje, revisa **Edge Functions > Logs** en Supabase y el
registro de transacciones de Brevo. Comprueba que `BREVO_API_KEY` siga vigente
y que `INVITATION_FROM` use un remitente de un dominio autenticado. No pegues
la clave API en GitHub, en el código ni en mensajes de soporte.

### Inicio de sesión con Google y correo de bienvenida

1. En Google Cloud Console, crea un cliente OAuth de tipo **Aplicación web**.
   Agrega como URI de redirección autorizada
   `https://TU_PROJECT_REF.supabase.co/auth/v1/callback`.
2. En Supabase, abre **Authentication > Providers > Google**, habilítalo e
   ingresa el identificador y secreto del cliente OAuth de Google.
3. En **Authentication > URL Configuration**, agrega el dominio de la
   aplicación y `http://localhost:5173` a los redirect URLs permitidos.
4. Aplica la migración `202610110001_welcome_email.sql` y despliega
   `send-welcome-email`. La función usa `BREVO_API_KEY`, `APP_URL` e
   `INVITATION_FROM`, los mismos secretos seguros documentados arriba para
   Brevo.
5. Prueba el registro con correo y con Google. El mensaje profesional de
   FlashMonkey se envía una sola vez a cada cuenta nueva, en el primer acceso
   con sesión iniciada; los usuarios existentes no reciben un correo
   retroactivo. Si el envío falla, la función libera la reserva para volver a
   intentarlo en el siguiente acceso.

El botón de Google está disponible tanto en **Iniciar sesión** como en
**Crear cuenta**. Las cuentas nuevas creadas con Google reciben un perfil de
socio y completan sus datos personales desde el flujo de bienvenida de la
aplicación.

Supabase proporciona las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` a las funciones Edge. Nunca publiques la clave
`service_role` en el frontend ni en el repositorio. Configura también el envío
de confirmaciones de cuenta de Supabase Auth mediante SMTP y habilita TOTP/MFA
en la configuración de Auth del proyecto.

La invitación es de un solo uso y vence en 72 horas. El socio inicia sesión con
el correo invitado, acepta el enlace y espera la aprobación final de
administración. El correo de invitación lo envía Brevo mediante su API; las
confirmaciones de cuenta siguen usando el proveedor SMTP configurado para
Supabase Auth. Para enviar también las confirmaciones con Brevo, configura sus
datos SMTP en **Authentication > SMTP Settings** de Supabase; la clave API de
Brevo no reemplaza las credenciales SMTP.

## Grupos, periodicidad y sorteo

El administrador crea grupos con una capacidad, un aporte y una periodicidad
semanal, quincenal o mensual. Un socio solicita una invitación desde el
directorio; administración la aprueba y el socio acepta el enlace recibido por
correo. Luego administración o tesorería aprueba el ingreso definitivo. Al
iniciar, el cuadro debe estar completo y la función de base de datos asigna
posiciones aleatorias y activa el primer periodo en una sola transacción. La
periodicidad se usa para etiquetar las rondas; las fechas y recordatorios
automáticos de vencimiento aún no están implementados.

Mientras una cuenta de administrador o tesorero está conectada, la aplicación consulta solicitudes pendientes de todos sus grupos cada 20 segundos. Una solicitud nueva genera un aviso en el centro de notificaciones, con acceso directo a la lista para aprobar o rechazarla.

El administrador puede eliminar grupos solo cuando no tengan aportes, entregas,
préstamos ni movimientos de fondo. La eliminación conserva un evento de
auditoría y las cuentas de los socios. Las escrituras en grupos, membresías y
tablas financieras requieren una sesión con MFA verificado.

Los datos privados (cédula, dirección y fecha de nacimiento) no son públicos.
Tesorería registra la verificación documental y solo administración puede
asignar roles elevados. Esta revisión es manual y no sustituye un proveedor
KYC. Los reportes de auditoría se pueden exportar como CSV o imprimir/guardar
como PDF desde el navegador.

## Validación

```sh
npm run build
npm run lint
```
