Grupos (público) y Comisiones (@usach.cl) son HTML y JS simples con `comun/vip.css` y `comun/vip.js`, fuera del espacio de diseño; su SQL queda en `supabase/migraciones/`.

Tipo: decisión de arquitectura del portal (2026-11-04)

- Razón: el espacio de diseño regenera carpetas enteras; módulos nuevos escritos a mano allí se perderían, y el runtime `support.js` depende de unpkg/Babel. HTML simple es más fácil de mantener y probar.
- Accesos: plataformas `grupos` y `comisiones` agregadas a la restricción de `accesos`/`invit_accesos` y a `PLATS` en los tres paneles del entorno de diseño (Normativa, Cursos, Trayectorias). Un módulo nuevo exige ambos cambios: si falta la restricción SQL, la matriz falla al guardar.
- Pruebas sin tocar la base: Playwright sustituye `esm.sh/@supabase/supabase-js` por un cliente simulado en memoria (ver historial de la sesión); la portada necesita React servido localmente porque unpkg puede estar bloqueado.
- Lo que se modela en Comisiones es la composición (integrantes con desde/hasta y resoluciones), nunca evaluaciones (pedido de la persona).

**Por qué importa:** quien regenere el portal desde el diseño no debe borrar `grupos-investigacion/`, `comisiones-evaluacion/`, `comun/` ni los cambios de `PLATS`.

**Grupos (2026-11-05):** instancias con `publicado` (borrador por defecto; el público solo ve lo publicado, `?previa=1` muestra borradores al equipo), integrantes en `gi_integrantes` (oficial = con resolución; declarados = del Excel de la instancia, se muestran aparte) y «Estado documental» interno con periodos de dirección vencidos. Las resoluciones con RUT se publican tachadas con PyMuPDF (`apply_redactions` quita el texto; verificar con `pdftotext`), marcadas `datos_personales`. Carga masiva sin clave de servicio: función de un solo uso con token aleatorio, llamada por RPC y eliminada después; subida de PDF con política temporal limitada a nombres exactos y retirada al terminar.

**«JWT issued at future» (2026-11-05):** los módulos comparten la sesión de Supabase por estar en el mismo sitio; un token recién emitido puede rechazarse unos segundos. Los catálogos públicos usan `conectar(url, { anonimo: true })` (sin sesión) y las lecturas con sesión pasan por `conReintento`. `nivelEn` lanza el error en vez de tratarlo como «sin perfil».
