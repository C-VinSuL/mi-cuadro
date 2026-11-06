# Registro de verificaciones de seguridad alineadas con OWASP

**Proyecto:** FlashMonkey  
**Fecha de registro:** 6 de noviembre de 2026  
**Alcance:** revisión acotada del código de la aplicación y pruebas automatizadas disponibles.

## Alcance y limitaciones

Este documento registra las verificaciones que sí constan en el trabajo del
proyecto y las relaciona con las categorías del **OWASP Top 10:2021**. No es
una certificación OWASP, una auditoría independiente ni el resultado de un
pentest completo. Las pruebas unitarias y la revisión de código no confirman
por sí solas que la configuración activa de Supabase, Vercel o sus proveedores
esté segura.

El registro del equipo deja constancia de una revisión acotada de los
componentes y servicios financieros, sin vulnerabilidades explotables de alta
confianza identificadas en ese alcance. También advierte que no reemplaza la
validación de permisos y despliegues en Supabase. Consulta
[EQUIPO.md](./EQUIPO.md).

## Verificaciones realizadas

- **Autorización por rol:** las pruebas comprueban permisos de administración,
  tesorería, auditoría y socio, así como restricciones sobre operaciones
  financieras. Referencias: `src/config/permissions.test.js` y
  `src/routes/accessGuards.test.js`.
- **Autenticación y MFA en rutas protegidas:** se comprueba que las rutas
  protegidas redirijan a inicio de sesión cuando no existe sesión y bloqueen
  el acceso hasta verificar MFA. Referencia: `src/routes/accessGuards.test.js`.
- **Validación de datos financieros:** las pruebas verifican montos positivos,
  precisión máxima de dos decimales, rechazo de formatos inválidos y uso de
  operaciones de backend para billetera. Referencia:
  `src/services/financial-services.test.js`.
- **Validación de archivos:** se comprueban los tipos admitidos, la detección
  por extensión cuando algunos navegadores móviles no entregan MIME y los
  mensajes para errores de formato, tamaño o permisos. Referencia:
  `src/utils/fileUpload.test.js`.
- **Reducción de datos sensibles en logs:** una prueba confirma que el
  registro operacional no exponga mensajes, detalles de respuesta ni
  contenido potencialmente privado. Referencia:
  `src/utils/logOperationalError.test.js`.
- **Calidad automatizada:** en la validación reciente del código se ejecutaron
  ESLint, 26 pruebas automatizadas y la compilación de producción. Pasaron. La
  compilación conserva una advertencia por tamaño de algunos bloques JavaScript;
  no es una verificación de seguridad.

Estas pruebas son unitarias y de código. No simulan por sí mismas solicitudes
maliciosas contra una base o un despliegue real.

## Relación con OWASP Top 10:2021

| Categoría | Evidencia disponible | Estado y límites |
|---|---|---|
| **A01: Broken Access Control** | Pruebas de permisos por rol y guardas de rutas. Las migraciones y documentación definen controles de RLS y MFA para datos y operaciones sensibles. | **Parcialmente verificado en código.** Falta probar en Supabase con cuentas separadas que no se puedan leer o modificar datos ajenos ni eludir RLS. |
| **A02: Cryptographic Failures** | Los documentos y comprobantes se diseñan para almacenarse en buckets privados; la documentación describe enlaces firmados de duración limitada. | **Configuración operativa no auditada.** No se verificaron en proveedor TLS, cifrado, región, retención ni gestión de llaves. |
| **A03: Injection** | Las operaciones financieras usan el cliente Supabase y llamadas RPC con parámetros; se validan montos y algunos identificadores en las pruebas de servicios. | **Verificación limitada.** No se ejecutó escáner de inyección ni una prueba dinámica contra el backend. |
| **A04: Insecure Design** | Hay separación de funciones por rol, límites para acciones financieras y acceso de solo lectura para ciertas tareas de auditoría. | **Revisión acotada.** No consta un modelado formal de amenazas ni una evaluación integral de todos los flujos. |
| **A05: Security Misconfiguration** | La documentación indica separar entornos, no exponer secretos en variables `VITE_*` y restringir orígenes permitidos. | **Pendiente en entornos activos.** No se inspeccionaron los ajustes reales de Supabase, Vercel, Auth, CORS ni Storage. |
| **A06: Vulnerable and Outdated Components** | La compilación de producción terminó correctamente. | **No verificado.** No consta una ejecución de `npm audit`, revisión de CVE ni análisis de dependencias de terceros. |
| **A07: Identification and Authentication Failures** | Pruebas de redirección de sesiones ausentes y bloqueo de rutas hasta completar MFA. | **Parcialmente verificado.** No se probó en producción el ciclo completo de recuperación, OAuth, configuración MFA, bloqueo o límites contra intentos automatizados. |
| **A08: Software and Data Integrity Failures** | Validaciones de montos y comprobaciones de servicios financieros en pruebas automatizadas. | **Parcialmente verificado.** No consta análisis de cadena de suministro, firma de artefactos, concurrencia ni pruebas de integridad completas de transacciones. |
| **A09: Security Logging and Monitoring Failures** | Una prueba confirma que el logger operacional omite mensajes y detalles potencialmente sensibles. | **Parcialmente verificado.** No se probó la cobertura de alertas, retención, acceso o respuesta a incidentes en los servicios desplegados. |
| **A10: Server-Side Request Forgery (SSRF)** | No consta en el registro una prueba dedicada de SSRF. | **No verificado.** Se requiere revisar rutas de servidor y funciones Edge que obtengan recursos a partir de URLs controladas por usuarios. |

## Validaciones pendientes antes de declarar cobertura

1. Probar RLS y permisos con cuentas ficticias de cada rol en un proyecto
   Supabase aislado, incluyendo intentos de acceder a registros y archivos de
   otros usuarios.
2. Revisar la configuración activa de Auth, MFA, Storage, CORS, redirecciones,
   secretos y dominios permitidos.
3. Ejecutar y documentar el análisis de dependencias, por ejemplo
   `npm audit`, investigando y corrigiendo los hallazgos aplicables.
4. Realizar pruebas dinámicas autorizadas sobre un entorno de pruebas; revisar
   inyección, SSRF, autorización, límites de carga y flujos financieros.
5. Revisar registros, alertas, backups y procedimientos de respuesta y
   recuperación con las personas responsables de los servicios.
6. Repetir las comprobaciones necesarias después de cambios importantes y
   antes de habilitar operaciones con datos o dinero reales.

## Comandos de validación local

Desde la raíz del proyecto:

```sh
npm run lint
npm test
npm run build
```

Estos comandos verifican calidad estática, pruebas del repositorio y
compilación. **No sustituyen** un análisis OWASP, una prueba de penetración ni
la validación del entorno desplegado.

## Referencias del repositorio

- [SEGURIDAD.md](./SEGURIDAD.md): recomendaciones de configuración y operación.
- [EQUIPO.md](./EQUIPO.md): registro de cambios y validaciones del equipo.
- `src/config/permissions.test.js`
- `src/routes/accessGuards.test.js`
- `src/services/financial-services.test.js`
- `src/utils/fileUpload.test.js`
- `src/utils/logOperationalError.test.js`
