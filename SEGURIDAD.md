# Seguridad de FlashMonkey

## Alcance y estado

Evaluación del código, las migraciones versionadas y la configuración del
repositorio al 17 de octubre de 2026. La aplicación aún no está desplegada; no
se pudieron inspeccionar los ajustes efectivos de Supabase ni probar políticas
contra un proyecto real. Los elementos que dependen de esos entornos siguen
marcados como pendientes, no como vulnerabilidades confirmadas.

La interfaz nunca es la frontera de autorización: cada lectura o cambio de
datos debe estar protegido también por RLS o por una función de base de datos
que valide identidad, rol, MFA y reglas de negocio.

## Controles incorporados al repositorio

- Supabase Auth usa el flujo PKCE. Las rutas de la aplicación exigen MFA TOTP
  AAL2 y varias RPC críticas también comprueban AAL2 y el rol en la base de
  datos.
- Las Edge Functions comparan el encabezado `Origin` con el origen HTTPS de
  `APP_URL`; ya no responden con CORS `*`. Las llamadas sin `Origin` siguen
  permitidas para clientes no navegador, y cada función conserva su propia
  autenticación/autorización.
- `vercel.json` configura CSP, HSTS, protección contra MIME sniffing y
  framing, política de referrer y permisos del navegador. La CSP permite
  avatares desde URLs HTTPS y conexiones al dominio estándar de Supabase; si
  se usa un dominio personalizado de Supabase, hay que ajustar `connect-src`.
- Las migraciones incorporan RLS y restringen el acceso directo en áreas como
  notificaciones, solicitudes/invitaciones, auditoría, datos personales
  privados, documentos de identidad y billetera. Esto no demuestra que las
  tablas principales ni las políticas desplegadas estén completas.
- `npm audit` se ejecutó para dependencias de producción y para el árbol
  completo; ambos reportaron cero vulnerabilidades en la fecha de revisión.
- `.env` está excluido por `.gitignore` y no está versionado. La clave pública
  de Supabase incluida en el bundle del navegador no es un secreto; la clave
  `service_role` y las claves de correo sí lo son y solo deben existir en los
  secretos de Supabase.

## Matriz OWASP

| Riesgo | Estado observado | Siguiente paso |
|---|---|---|
| **A01 Control de acceso roto** | Las migraciones aplican controles de RLS y RPC a varias áreas sensibles. No se pudo confirmar que las políticas de `perfiles`, `grupos`, `participantes`, `aportes`, préstamos y demás tablas existentes estén completas ni desplegadas. | Revisar todas las tablas expuestas por PostgREST en el proyecto Supabase; probar con usuarios de prueba de distintos grupos y roles. No confiar en `RoleRoute` como control de servidor. |
| **A02 Configuración de seguridad incorrecta** | `.env` no está versionado. Los encabezados para Vercel están definidos, pero aún no se han probado en un despliegue real. | Mantener los secretos fuera de Git/Vercel client env; comprobar encabezados después del primer despliegue y rotar cualquier secreto que se hubiera expuesto históricamente. |
| **A03 Cadena de suministro** | `npm audit --omit=dev --audit-level=high` y `npm audit --audit-level=high` reportaron cero vulnerabilidades. | Repetir la auditoría en CI y al actualizar dependencias. |
| **A04 Fallas criptográficas** | Se usa Supabase Auth con PKCE y no se guardan contraseñas propias. HTTPS/HSTS se configura para Vercel; todavía no hay dominio desplegado que validar. | Usar HTTPS en el dominio final y revisar ajustes de Auth, recuperación de cuenta y retención de sesiones. |
| **A05 Inyección** | No se observó uso de `innerHTML`, `dangerouslySetInnerHTML`, `eval` o `new Function` en las áreas inspeccionadas. | Mantener consultas parametrizadas/RPC, validar entradas en servidor y evitar renderizar HTML no confiable. |
| **A06 Diseño inseguro** | La app maneja importes, pertenencias y movimientos financieros; las reglas deben ejecutarse en RPC/transacciones y restricciones de base de datos. No se pudo probar el esquema desplegado. | Probar importes, IDs, roles, pertenencia, estados y reintentos manipulados desde un usuario de prueba no privilegiado. |
| **A07 Identificación y autenticación** | Las rutas de la app requieren MFA AAL2; la garantía depende también de Auth/RLS/RPC, pues un cliente puede llamar a Supabase directamente. `register-member` omite verificación JWT intencionalmente para permitir registros públicos. | En Supabase, establecer AAL2 como nivel requerido, habilitar protección de contraseñas filtradas, límites de Auth y CAPTCHA para registro si está disponible; mantener confirmación de correo y allow-list de redirects. |
| **A08 Integridad de software y datos** | Varias RPC elevadas usan `SECURITY DEFINER`, `search_path` explícito, validación de MFA/rol y permisos de ejecución restringidos. | Revisar permisos y autorización de cada nueva RPC/trigger antes de desplegar; probarla con anon, socio y rol administrativo. |
| **A09 Registro y alertas** | Hay una tabla de auditoría para ciertos cambios, pero no se revisaron la retención, alertas ni registros del proyecto Supabase. | Definir retención y alertas en Supabase; registrar acciones administrativas/financieras sin guardar credenciales ni tokens. |
| **A10 Manejo inadecuado de condiciones excepcionales** | Las migraciones agrupan varias operaciones financieras en RPC transaccionales; no se ejecutaron pruebas de integración ni de fallos porque no hay instancia Supabase disponible. | Probar errores, reintentos y concurrencia en un proyecto de prueba y confirmar que el saldo y el libro de movimientos siguen consistentes. |

## Configuración antes del primer despliegue

### Vercel

1. Importar el proyecto y usar `mi-cuadro` como raíz de proyecto, con el build
   `npm run build` y salida `dist`.
2. Definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el entorno de
   compilación. Son valores visibles para el navegador; nunca añadir
   `SUPABASE_SERVICE_ROLE_KEY` ni claves de Brevo a variables `VITE_*`.
3. Tras desplegar, comprobar que la respuesta HTML incluye las cabeceras
   declaradas en `vercel.json` y que Login, OAuth de Google, MFA, QR de TOTP,
   avatares y llamadas a Supabase funcionan bajo la CSP.
4. Mantener HTTPS en el dominio. Si se habilitan imágenes o servicios bajo
   dominios distintos, agregar solo los orígenes necesarios a la CSP.

### Supabase

1. Configurar `APP_URL` como el origen exacto de la app (sin rutas), por
   ejemplo `https://app.example.com`; para desarrollo local se permite
   `http://localhost` o `http://127.0.0.1`. Las Edge Functions rechazan
   orígenes diferentes; las vistas previas de Vercel no funcionarán con otro
   origen hasta definir una estrategia de allow-list por entorno.
2. Verificar que `SUPABASE_SERVICE_ROLE_KEY` esté disponible solo como secreto
   de Edge Function (Supabase normalmente lo provee); configurar
   `BREVO_API_KEY` e `INVITATION_FROM` como secretos si se despliegan las
   funciones de correo.
3. En Auth, configurar el dominio y URLs de redirección permitidos, confirmar
   correo, nivel AAL2 requerido, protección contra contraseñas filtradas y
   límites de intentos. Habilitar CAPTCHA/Turnstile para registro si se activa
   en el proyecto.
4. Aplicar las migraciones y auditar en el SQL Editor los permisos/RLS de cada
   tabla expuesta. Probar accesos cruzados usando sesiones normales; nunca
   usar `service_role` en el navegador.
5. Desplegar las Edge Functions y probar una llamada desde el dominio
   autorizado y otra desde un origen distinto; la última debe devolver 403.

## Validación de autorización

Realizar estas pruebas solo con datos ficticios en un proyecto de prueba:

1. Crear dos socios de grupos distintos y un usuario para cada rol.
2. Desde el cliente Supabase de cada socio, intentar leer y modificar filas
   ajenas en grupos, participantes, aportes, billetera y documentos.
3. Repetir con identificadores, importes, estado, rol y nivel AAL manipulados.
4. Confirmar denegación o cero filas y que no haya cambios persistidos.
5. Probar las RPC privilegiadas con sesión AAL1, AAL2 sin rol y AAL2 con rol;
   solo la última combinación autorizada debe completar la operación.

Hasta completar estas comprobaciones en el proyecto desplegado, el control de
acceso de las tablas principales y la configuración de Auth se consideran
pendientes de verificación.
