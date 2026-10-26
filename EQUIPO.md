# Registro de cambios del equipo

**Responsable:** John Navarro
**Trabajo en conjunto:** Christopher Suárez
**Proyecto:** FlashMonkey
**Fecha:** 25 de octubre de 2026

## Cambios implementados

### Actualización reciente: tesorería, fondos y egresos

- Se modernizaron las tarjetas de resumen y el formulario de egresos con una
  jerarquía visual más clara, gradientes sutiles, estados de foco, animación
  escalonada y búsqueda instantánea.
- Se añadieron validaciones del lado del cliente y del servicio para el UUID del
  grupo, la categoría, el concepto, la fecha y los montos con hasta dos
  decimales.
- Los montos se convierten a centavos enteros para validar y sumar; se envían a
  la base como decimales de dos posiciones. Los totales del servidor se
  conservan como decimales para mostrarlos sin convertirlos a punto flotante.
- Se mantienen las protecciones del servidor: RLS exige MFA y limita la lectura
  y creación de egresos a administración o tesorería; PostgreSQL valida grupo,
  concepto, categoría y monto positivo `numeric(12,2)`.
- Se realizó una revisión de seguridad acotada de los componentes y servicios
  financieros: no se identificaron vulnerabilidades explotables de alta
  confianza. Esto no reemplaza verificar permisos y despliegues en Supabase.
- Se ejecutaron las 16 pruebas automatizadas, la compilación de producción y
  ESLint focalizado; todos pasaron después de los cambios financieros.

### Video de bienvenida FlashMonkey

- Se agregó el video local `public/flashmonkey-welcome.mp4`, copiado desde el
  archivo proporcionado, para que su ruta no dependa de la carpeta Descargas.
- La pantalla de inicio de sesión reproduce el video en silencio y en bucle, con
  el logo local como poster y una alternativa si el navegador no admite video.
  La reproducción se pausa cuando el sistema solicita movimiento reducido.
- Se creó la extensión fuente `flashmonkey-vscode-welcome/` para abrir el video
  en un panel de bienvenida al iniciar VS Code con el workspace FlashMonkey.
  Usa `workspaceContains` para activarse solo cuando el workspace contiene el
  video, carga los recursos desde el disco local y aplica una Content Security
  Policy restrictiva. Se puede reabrir mediante
  **FlashMonkey: Abrir bienvenida con video**.
- Para instalar la extensión en VS Code: desde PowerShell, instalar una vez el
  empaquetador con `npm install --global @vscode/vsce`; entrar a
  `flashmonkey-vscode-welcome` y ejecutar `vsce package`; instalar el `.vsix`
  generado desde **Extensions: Install from VSIX...** o con
  `code --install-extension .\flashmonkey.flashmonkey-video-welcome-0.1.0.vsix`.
  Abrir después la carpeta del proyecto FlashMonkey en VS Code. La extensión
  abre una pestaña Webview; para ocultar la bienvenida predeterminada, configurar
  `"workbench.startupEditor": "none"` en los ajustes de usuario de VS Code.
- No se modifica la autenticación existente ni se requieren librerías runtime
  para la extensión; el video se reproduce en silencio para permitir autoplay y
  dispone de controles para pausarlo.

### Tesorería y control financiero

- Se mejoró el tablero para priorizar grupos con comprobantes por revisar y
  acceder directamente a las colas de aportes y solicitudes de billetera.
- Se rediseñó **Control de aportes** con tarjetas KPI en tonos azul, esmeralda y
  ámbar, búsqueda inmediata por socio, grupo, periodo, estado, monto y fecha, y
  filtros con estados de foco visibles.
- El formulario de registro de aportes ahora presenta una jerarquía visual más
  clara, campos con foco accesible y un botón de acción con estados de envío.
- Las tarjetas aparecen escalonadas y sus valores se animan al actualizarse
  usando `motion`, que ya está instalado; no se añadieron dependencias.
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
- El encabezado conserva el logotipo PNG original y aplica un balanceo
  automático entre -5 y 5 grados mediante CSS, sin depender del hover. La
  animación respeta `prefers-reduced-motion`. Al ser una imagen aplanada, no
  permite animar el brazo ni el ojo por separado sin modificar la ilustración.
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
- En móvil, el acceso y la recuperación de contraseña incluyen estados de carga
  animados, un indicador de tres pasos y una confirmación visual de éxito al
  guardar la contraseña.
- El indicador de seguridad de contraseña es orientativo y se muestra solo en
  móvil; la validación y los requisitos de Supabase no se reemplazan. El flujo
  conserva la recuperación mediante enlace de correo existente, sin añadir ni
  simular verificación por PIN, nuevas rutas o pasos de autenticación.
- Las nuevas animaciones CSS están limitadas a pantallas móviles y se desactivan
  si el dispositivo solicita movimiento reducido. No se añadieron dependencias.

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
- La compilación de producción y ESLint focalizado pasaron para el rediseño de
  **Control de aportes** y su nueva búsqueda en tiempo real.
- La compilación, ESLint focalizado y las pruebas de servicios financieros
  pasaron tras los cambios de egresos; se verifican UUID y precisión de montos
  con dos decimales antes de enviar la operación.
- Las 16 pruebas automatizadas, la compilación de producción y ESLint focalizado
  pasaron tras añadir la conversión exacta a centavos y el formato de importes
  decimales del servidor.
- La compilación, ESLint focalizado para el acceso y recuperación de contraseña
  y las 15 pruebas automatizadas pasaron tras los ajustes móviles del flujo de
  autenticación.
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
