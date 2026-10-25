# Registro de cambios del equipo

**Responsable:** John Navarro  
**Proyecto:** FlashMonkey  
**Fecha:** 24 de octubre de 2026

## Cambios implementados

### Tesorería y control financiero

- Se mejoró el tablero para priorizar grupos con comprobantes por revisar y
  acceder directamente a las colas de aportes y solicitudes de billetera.
- Se incorporaron filtros de aportes por grupo, periodo, estado y antigüedad.
- Se solicita el motivo al rechazar un comprobante de aporte o una solicitud de
  billetera, y el socio puede consultar ese motivo en su historial.
- Se agregó la fecha de envío de comprobantes para ordenar pendientes por
  antigüedad y facilitar su seguimiento.
- El historial financiero muestra movimientos pendientes de conciliación y
  advierte cuando el saldo no coincide con ingresos menos egresos.
- Las confirmaciones de sorteo y cierre de ronda presentan más contexto antes
  de ejecutar la operación.
- Se corrigió el texto que describía el fondo comunitario como disponible para
  préstamos, ya que las operaciones de préstamo no están habilitadas.

### Diseño adaptable

- La pantalla **Socios y roles** presenta fichas legibles en pantallas pequeñas
  y medianas, y conserva la tabla desplazable en pantallas grandes.
- Se añadieron transiciones discretas en interacciones seleccionadas, respetando
  la preferencia de movimiento reducido del dispositivo.

### Registro de nuevos usuarios

- Se amplió la lista de orígenes web permitidos para `register-member`, con
  validación explícita de orígenes y soporte para `localhost` en desarrollo.
- Los errores de conexión con la función Edge muestran instrucciones más claras
  para distinguir un problema de red o despliegue de un rechazo del registro.
- Se documentó cómo agregar el origen local sin reemplazar `APP_URL`, que puede
  ser utilizado por otras funciones del backend.

### Notificaciones

- Se evita mostrar dos veces la misma alerta cuando una notificación creada
  desde la aplicación vuelve a recibirse por Realtime.
- El historial y la sincronización de notificaciones continúan actualizándose.

## Validación y despliegue

- La compilación de producción pasó después de los cambios de interfaz y
  notificaciones.
- ESLint pasó para los módulos modificados que se revisaron de forma focalizada.
- La migración `202610240001_treasury_review_timestamps.sql` agrega el registro
  de fecha de envío del comprobante.
- La configuración de orígenes y el despliegue de `register-member` se realizan
  en el proyecto Supabase; no se consideran publicados por crear este documento
  o compilar el frontend.
