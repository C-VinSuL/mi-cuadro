# Matriz de seguridad OWASP

## Alcance y estado de la revisión

Esta matriz es una evaluación preliminar del código y las migraciones presentes
en este repositorio al 5 de octubre de 2026. No se tuvo acceso al proyecto
desplegado de Supabase, a sus políticas RLS activas ni a sus registros. Por
tanto, los riesgos que dependen de esa configuración se marcan como pendientes
de comprobación y no como vulnerabilidades confirmadas.

La presencia de una consulta en el frontend no demuestra por sí sola que un
usuario pueda acceder a datos ajenos: la autorización debe verificarse en la
base de datos y en las políticas efectivamente desplegadas.

| Riesgo | ¿Aplica? / estado | Dónde | Cómo podría explotarse (escenario por verificar) | Solución o siguiente paso | Prioridad | Responsable |
|---|---|---|---|---|---|---|
| **A01 Control de acceso roto** | Pendiente de comprobar en Supabase. La migración activa RLS para `solicitudes_grupo`, pero no se pudo confirmar la configuración desplegada para las demás tablas. | Consultas a grupos, participantes y perfiles en `src/context/AuthContext.jsx`; migración `supabase/migrations/202609300001_group_membership_and_draw.sql`. | Si una política permite acceso más amplio del debido, un socio podría intentar leer o modificar filas de otro grupo mediante una petición directa a Supabase. | Revisar las políticas RLS desplegadas para perfiles, grupos, participantes, aportes, préstamos, cuotas y movimientos. Probar lecturas y escrituras entre dos usuarios de prueba de grupos distintos. | Alta, hasta verificar | Equipo |
| **A02 Configuración de seguridad incorrecta** | Hallazgo de higiene corregido en el repositorio: `.env` dejó de estar versionado y se agregó una plantilla sin valores. No se confirmó una clave privilegiada en la revisión. El cambio no elimina el archivo del historial de Git. | `.gitignore`, `.env.example`; commit `6d6f253`. | Si se hubiera incluido una clave privilegiada en el historial o en otra configuración publicada, alguien con acceso podría usarla para operaciones no autorizadas. | Mantener secretos fuera de Git. Revisar el historial y la configuración de despliegue; revocar/rotar cualquier clave privilegiada que se descubra. La clave publicable de Supabase está diseñada para el cliente, pero requiere políticas seguras. | Media | Equipo |
| **A03 Cadena de suministro** | Pendiente: no se ejecutó una auditoría de dependencias como parte de esta revisión. | `package.json`, `package-lock.json`. | Una dependencia vulnerable podría permitir ataques según la versión, la ruta de ejecución y el contexto de despliegue. | Ejecutar `npm audit`, revisar los avisos aplicables y actualizar dependencias con pruebas de regresión. | Media | Equipo |
| **A04 Fallas criptográficas** | No se confirmó una falla criptográfica. El proyecto utiliza Supabase Auth; no se verificaron ajustes de TLS, almacenamiento de credenciales ni configuración del proveedor desplegado. | `src/pages/auth/`, `src/context/AuthContext.jsx`, configuración de Supabase. | Una configuración débil o el almacenamiento propio e inseguro de contraseñas podría exponer credenciales o sesiones. | Mantener la autenticación en Supabase Auth, usar HTTPS y no almacenar contraseñas propias. Verificar la configuración del proyecto desplegado y no exponer claves privilegiadas. | Media | Equipo |
| **A05 Inyección** | No se confirmó una inyección. Se observan operaciones con el cliente Supabase; no se verificó toda entrada ni toda ruta de renderizado. | Formularios y consultas de `src/`; por ejemplo `src/pages/aportes/Aportes.jsx`. | Una entrada podría causar efectos no deseados si se incorpora a SQL dinámico, comandos o HTML sin tratamiento seguro. | Validar entradas también en el servidor/base de datos; evitar SQL dinámico no parametrizado y renderizado HTML inseguro. Revisar cualquier uso de `innerHTML` o `dangerouslySetInnerHTML`. | Media | Equipo |
| **A06 Diseño inseguro** | Superficie de riesgo observada, impacto pendiente de comprobar: el formulario de aportes envía campos de negocio desde el cliente. No se verificaron todas las restricciones ni reglas del esquema desplegado. | `src/pages/aportes/Aportes.jsx`; reglas de aportes, préstamos y grupos en Supabase. | Un usuario podría alterar monto, participante, grupo, semana o estado en una petición si la base de datos confía en los valores del cliente. | Validar permisos, importes, pertenencia y transiciones de estado en RPC/servidor; usar restricciones de base de datos y probar entradas manipuladas con una cuenta de prueba. | Alta, hasta verificar | Equipo |
| **A07 Fallas de identificación y autenticación** | Se observan flujos de acceso con Supabase Auth; no se confirmó una falla. No se verificaron límites de intentos, MFA ni ajustes de sesión desplegados. | `src/pages/auth/Login.jsx`, `src/pages/auth/Register.jsx`, `src/pages/auth/ForgotPassword.jsx`, `src/context/AuthContext.jsx`. | Un control insuficiente de intentos o sesiones podría facilitar abuso de cuentas, dependiendo de la configuración efectiva. | Revisar ajustes de Auth en Supabase, recuperación de cuentas, límites de intentos y protección de rutas; probar los flujos sin revelar si una cuenta existe cuando corresponda. | Media | Equipo |
| **A08 Fallas de integridad de software y datos** | Mitigación parcial observada: algunas RPC administrativas comprueban el rol en la base de datos. No se verificaron todas las operaciones ni si el rol puede modificarse indebidamente. | `supabase/migrations/202609300007_admin_group_management_and_full_group_purge.sql`; `supabase/migrations/202609300008_admin_group_configuration.sql`. | Si una operación confía en un rol o estado enviado por el cliente, un usuario podría intentar elevar permisos o alterar datos fuera de su función. | Mantener la autorización dentro de RPC/RLS, proteger los cambios de rol y verificar cada operación sensible con una sesión no privilegiada. | Alta, hasta revisar todas las operaciones | Equipo |
| **A09 Registro y alertas** | Pendiente: no se confirmó un mecanismo centralizado de auditoría para cambios sensibles ni se revisaron los registros de Supabase. | Operaciones de aportes, préstamos, grupos y cambios de roles; configuración de registros en Supabase. | Una modificación o eliminación indebida podría ser difícil de investigar si no quedan registros con actor, acción y fecha. | Definir retención y acceso a registros; auditar operaciones sensibles con actor, recurso, acción y fecha, evitando guardar secretos o datos innecesarios. | Media | Equipo |
| **A10 Manejo inadecuado de condiciones excepcionales** | Pendiente de comprobación integral. Hay operaciones implementadas mediante RPC, pero no se revisó cada flujo de varios pasos ni su manejo de errores. | RPC de `supabase/migrations/`; servicios en `src/services/`. | Un fallo parcial podría dejar estados inconsistentes o mostrar una operación como exitosa cuando no lo fue. | Agrupar cambios relacionados en operaciones transaccionales de base de datos, comprobar errores en cada paso y probar fallos y reintentos. | Media | Equipo |

## Validación prioritaria de A01 y A06

Realizar estas pruebas solo en un entorno de prueba con datos ficticios y
usuarios de prueba, usando las sesiones normales de Supabase Auth. No usar la
clave `service_role` desde el navegador ni compartirla.

1. Crear dos usuarios que pertenezcan a grupos distintos.
2. Con el usuario A, intentar consultar y modificar directamente registros del
   grupo del usuario B en las tablas protegidas.
3. Repetir con aportes y préstamos, intentando cambiar identificadores,
   importes y estados enviados por el cliente.
4. Confirmar que el resultado sea denegación o cero filas, y que ninguna
   modificación se haya aplicado.
5. Repetir las pruebas con los roles que correspondan y registrar el resultado
   sin incluir datos personales ni credenciales.

Hasta completar estas pruebas, A01 y A06 son riesgos pendientes de validación,
no vulnerabilidades confirmadas.
