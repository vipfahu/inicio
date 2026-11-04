Grupos (público) y Comisiones (@usach.cl) son HTML y JS simples con `comun/vip.css` y `comun/vip.js`, fuera del espacio de diseño; su SQL queda en `supabase/migraciones/`.

Tipo: decisión de arquitectura del portal (2026-11-04)

- Razón: el espacio de diseño regenera carpetas enteras; módulos nuevos escritos a mano allí se perderían, y el runtime `support.js` depende de unpkg/Babel. HTML simple es más fácil de mantener y probar.
- Accesos: plataformas `grupos` y `comisiones` agregadas a la restricción de `accesos`/`invit_accesos` y a `PLATS` en los tres paneles del entorno de diseño (Normativa, Cursos, Trayectorias). Un módulo nuevo exige ambos cambios: si falta la restricción SQL, la matriz falla al guardar.
- Pruebas sin tocar la base: Playwright sustituye `esm.sh/@supabase/supabase-js` por un cliente simulado en memoria (ver historial de la sesión); la portada necesita React servido localmente porque unpkg puede estar bloqueado.
- Lo que se modela en Comisiones es la composición (integrantes con desde/hasta y resoluciones), nunca evaluaciones (pedido de la persona).

**Por qué importa:** quien regenere el portal desde el diseño no debe borrar `grupos-investigacion/`, `comisiones-evaluacion/`, `comun/` ni los cambios de `PLATS`.
