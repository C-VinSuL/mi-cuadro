# Seguridad de FlashMonkey

Este documento ofrece recomendaciones para desarrollar, configurar y operar
FlashMonkey de forma segura. No contiene credenciales ni sustituye la
configuración de seguridad del proyecto Supabase o del proveedor de hosting.

## Protección de credenciales

- No guardes contraseñas, tokens, claves privadas, archivos de servicio ni
  credenciales de proveedores en el repositorio.
- Mantén `.env` local fuera de Git; el archivo está excluido por `.gitignore`.
- Usa únicamente variables `VITE_*` para valores que pueden ser públicos en el
  navegador, como la URL de Supabase y su clave publicable.
- La clave `service_role`, claves de correo y otros secretos deben permanecer
  en el almacén seguro del servidor o de Supabase Edge Functions. Nunca deben
  exponerse al cliente.
- Si un secreto se publica accidentalmente, revócalo y rótalo inmediatamente.
  Eliminarlo de un archivo no lo borra de versiones anteriores del repositorio.
- Antes de compartir capturas o registros, oculta tokens, cookies, correos,
  nombres, documentos e información financiera.

## Autorización y datos

- La interfaz no es una frontera de seguridad. Valida permisos en el backend y
  aplica políticas de acceso a las tablas, archivos y funciones.
- Mantén habilitadas y revisadas las políticas de Row Level Security (RLS) para
  los datos expuestos al cliente.
- Limita cada rol a las operaciones que necesita. Las acciones financieras y
  administrativas deben validarse en el servidor y quedar auditables cuando
  corresponda.
- No uses datos reales para pruebas de acceso, migraciones o cambios de
  permisos; crea cuentas y grupos ficticios en un proyecto separado.
- Protege los comprobantes y documentos personales con almacenamiento privado
  y acceso autorizado.

## Configuración de entornos

- Separa desarrollo, pruebas y producción; verifica cuidadosamente el proyecto
  Supabase seleccionado antes de aplicar cambios.
- Revisa el historial remoto y local de migraciones antes de ejecutar `db push`.
  Las migraciones del repositorio son incrementales y pueden modificar datos o
  permisos; respáldalos y pruébalos primero.
- Limita los dominios de Auth, OAuth, CORS y redirección a los orígenes
  necesarios. Usa HTTPS en producción.
- Configura las variables de entorno y secretos desde el panel seguro del
  proveedor correspondiente; evita pegarlos en comandos que queden guardados en
  el historial de terminal.
- Mantén dependencias y herramientas actualizadas. Revisa los resultados de
  `npm audit` y analiza cualquier actualización antes de desplegarla.

## Si sospechas una exposición

1. Revoca o rota la credencial afectada en el proveedor que la emitió.
2. Revisa los registros de acceso y las acciones recientes del servicio.
3. Identifica en qué entornos se usó y actualiza sus secretos.
4. Elimina la credencial del repositorio y, si estuvo en el historial, sigue el
   procedimiento del proveedor Git para sanearlo; la rotación sigue siendo
   obligatoria.
5. Notifica a las personas responsables del proyecto por un canal privado.

Para reportar un problema de seguridad, contacta a las personas mantenedoras de
forma privada. No publiques credenciales, datos personales ni instrucciones
para explotar sistemas en un issue público.
