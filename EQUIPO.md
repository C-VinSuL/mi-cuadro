# Registro de cambios del equipo

**Responsable:** John Navarro
**Trabajo en conjunto:** Christopher Suárez
**Proyecto:** FlashMonkey
**Fecha:** 25 de octubre de 2026

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
- Se unificaron las tarjetas del dashboard con bordes de 12 px, sombras sutiles
  y elevación al pasar el cursor, además de una animación CSS de entrada y una
  respuesta de escala para botones. Las animaciones se desactivan cuando el
  dispositivo solicita movimiento reducido; no se añadió JavaScript ni
  dependencias para estos efectos.
- Se añadieron transiciones de entrada y salida entre páginas con `AnimatePresence`
  de `motion`, que ya forma parte del proyecto; no se instaló otra librería.
- El botón reutilizable incorpora una elevación discreta al pasar el cursor y
  vuelve a su posición al pulsarlo. Los botones también tienen respuesta CSS de
  escala al hacer clic.
- Las animaciones de tarjetas y navegación usan transformaciones y opacidad para
  limitar el trabajo de renderizado. Se respeta `prefers-reduced-motion` para
  desactivar o reducir el movimiento según la preferencia del dispositivo.
- Los diálogos existentes conservan sus transiciones CSS de entrada. Los efectos
  visuales descritos no requieren JavaScript adicional ni dependencias nuevas.

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

### Moki, navegación y publicación

- Se incorporó la experiencia de chat de Moki para socios y una bandeja de
  atención a socios y resumen operativo para administración.
- Se añadieron navegación inferior móvil, transiciones de página y mejoras de
  navegación adaptable para los distintos roles.
- Se asignan identificadores únicos a las suscripciones Realtime para evitar
  colisiones cuando los componentes se desmontan y vuelven a montarse.
- Vite usa `localhost` en desarrollo para coincidir con el origen local
  documentado para Supabase.
- Se documentó la publicación en Vercel y la configuración de URLs, secretos de
  Supabase y remitente de Brevo en `README.md`.

## Validación y despliegue

- La compilación de producción pasó después de los cambios de interfaz y
  notificaciones.
- La compilación de producción y ESLint focalizado pasaron para los nuevos
  estilos CSS y los componentes de dashboard modificados.
- La compilación de producción, ESLint focalizado para los componentes de
  navegación y botones, y las 15 pruebas automatizadas pasaron tras incorporar
  las transiciones entre páginas.
- Vite conserva una advertencia preexistente sobre el tamaño de algunos bloques
  JavaScript; la compilación finalizó correctamente.
- ESLint pasó para los módulos modificados que se revisaron de forma focalizada.
- La migración `202610240001_treasury_review_timestamps.sql` agrega el registro
  de fecha de envío del comprobante.
- La configuración de orígenes y el despliegue de `register-member` se realizan
  en el proyecto Supabase; no se consideran publicados por crear este documento
  o compilar el frontend.

## Pendiente antes de operar con datos o dinero reales

> **No habilitar operaciones financieras reales hasta completar y documentar
> estas verificaciones.** Hacerlas primero en un proyecto de pruebas aislado.

1. **Migraciones:** revisar el proyecto Supabase enlazado, respaldar la base y
   ejecutar una simulación (`npx supabase db push --dry-run`). Aplicar primero
   en pruebas y comprobar cada migración. No aplicar migraciones vacías ni
   marcar migraciones como ejecutadas sin verificar el esquema.
2. **RLS y permisos:** confirmar que RLS está habilitado en las tablas con datos
   privados y probar con cuentas de socio, tesorero y administrador que cada
   rol solo pueda acceder a las operaciones autorizadas. Un socio no debe poder
   aprobar comprobantes, cambiar saldos ni asignarse permisos.
3. **Storage:** verificar que los comprobantes y documentos estén en buckets
   privados; comprobar con cuentas de prueba que un socio no pueda consultar ni
   descargar archivos de otro.
4. **Flujos financieros:** con datos ficticios, probar envío, aprobación y
   rechazo de comprobantes; confirmar que una aprobación repetida o solicitudes
   simultáneas no dupliquen créditos y que el historial concilie con el saldo.
5. **Backups y restauración:** confirmar que haya una copia reciente y
   restaurarla en un proyecto separado. Verificar también la recuperación de
   archivos de Storage; no asumir que el backup de la base incluye esos archivos.
6. **Producción:** solo después de que las pruebas anteriores pasen, coordinar
   la ventana de despliegue, tomar un backup reciente y repetir las
   comprobaciones esenciales en el dominio y proyecto de producción.
