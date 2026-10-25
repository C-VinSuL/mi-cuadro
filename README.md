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

## Tecnologías

- React y Vite
- Supabase Auth, PostgreSQL, Storage, Realtime y Edge Functions
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

```sh
npx supabase functions deploy register-member
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

La función `register-member` valida el origen del navegador. Configura `APP_URL`
con la URL principal de la aplicación y, si también recibes registros desde
otros dominios (por ejemplo, una URL de previsualización o desarrollo),
añádelos como orígenes exactos separados por comas en `APP_ALLOWED_ORIGINS`.
Usa solo dominios controlados por el proyecto, con HTTPS en producción; para
desarrollo local se permiten `http://localhost` y `http://127.0.0.1`. Si solo
necesitas añadir el origen local, conserva `APP_URL` como está y agrega el
origen de Vite:

```powershell
npx supabase secrets set "APP_ALLOWED_ORIGINS=http://localhost:5173"
npx supabase functions deploy register-member
```

Para más de un origen, sepáralos con comas y configura el dominio público real
además del origen local. No incluyas rutas (`/registro`) ni comodines en la
lista.

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

El proyecto usa Vite: compila con `npm run build` y publica el contenido de
`dist`. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el entorno
de compilación del proveedor de hosting. Revisa `vercel.json` si despliegas en
Vercel. Configura también las URLs permitidas de Supabase Auth para el dominio
publicado.

No compartas archivos `.env`, copias de bases de datos ni capturas que muestren
tokens, cookies, datos personales o información financiera real.

## Documentación relacionada

- [SEGURIDAD.md](./SEGURIDAD.md): prácticas para proteger credenciales y
  configurar el entorno.
- [supabase/migrations](./supabase/migrations): cambios versionados del esquema
  y las funciones de base de datos.
