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


El administrador crea grupos y comparte el código. Un socio con cuenta confirmada solicita ingreso con ese código; administración o tesorería revisa la solicitud. Al iniciar, el cuadro debe estar completo y la función de base de datos asigna posiciones aleatorias y activa la primera ronda en una sola transacción. Cada usuario puede alternar entre sus grupos desde la barra lateral.

Mientras una cuenta de administrador o tesorero está conectada, la aplicación consulta solicitudes pendientes de todos sus grupos cada 20 segundos. Una solicitud nueva genera un aviso en el centro de notificaciones, con acceso directo a la lista para aprobar o rechazarla.

El administrador puede eliminar grupos en borrador que no tengan aportes, entregas, préstamos ni movimientos de fondo. La eliminación quita membresías y solicitudes, pero conserva las cuentas de los socios. Los grupos iniciados o con actividad financiera no se borran desde la app.

Los roles `administrador` y `tesorero` deben asignarse en Supabase por un proceso confiable. Las pantallas ya no contienen la simulación local de perfiles, pagos y préstamos.

## Validación

```sh
npm run build
npm run lint
```
