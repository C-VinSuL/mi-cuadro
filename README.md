# Mi Cuadro

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

## Grupos y sorteo

Antes de usar la gestión de grupos, aplica en orden las migraciones `supabase/migrations/202609300001_group_membership_and_draw.sql`, `supabase/migrations/202609300002_delete_draft_group.sql`, `supabase/migrations/202609300003_fix_create_group_rpc.sql`, `supabase/migrations/202609300004_fix_group_requests_rpc.sql` y `supabase/migrations/202609300005_fix_group_request_result_types.sql` en el SQL Editor de Supabase. Si las cuatro anteriores ya se aplicaron, ejecuta la quinta. Estas migraciones agregan códigos de acceso y solicitudes, permiten membresías en varios grupos y crean funciones RPC con validación de roles. La tercera refresca la caché de PostgREST y desvincula membresías antiguas del administrador; la cuarta y quinta corrigen la consulta de solicitudes. Conserva una copia de seguridad antes de aplicarlas en producción.

El administrador crea grupos y comparte el código. Un socio con cuenta confirmada solicita ingreso con ese código; administración o tesorería revisa la solicitud. Al iniciar, el cuadro debe estar completo y la función de base de datos asigna posiciones aleatorias y activa la primera ronda en una sola transacción. Cada usuario puede alternar entre sus grupos desde la barra lateral.

Mientras una cuenta de administrador o tesorero está conectada, la aplicación consulta solicitudes pendientes de todos sus grupos cada 20 segundos. Una solicitud nueva genera un aviso en el centro de notificaciones, con acceso directo a la lista para aprobar o rechazarla.

El administrador puede eliminar grupos en borrador que no tengan aportes, entregas, préstamos ni movimientos de fondo. La eliminación quita membresías y solicitudes, pero conserva las cuentas de los socios. Los grupos iniciados o con actividad financiera no se borran desde la app.

Los roles `administrador` y `tesorero` deben asignarse en Supabase por un proceso confiable. Las pantallas ya no contienen la simulación local de perfiles, pagos y préstamos.

## Validación

```sh
npm run build
npm run lint
```
