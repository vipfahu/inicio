La URL de los enlaces y correos la fija `desplegar.js` (genera `Implementacion.gs` con `URL_IMPLEMENTACION` al subir y lo borra después); `ScriptApp.getService().getUrl()` es solo respaldo.

Tipo: técnico (corrección confirmada en producción, 2026-11-04)

- Hallazgo: con dos implementaciones activas, `getUrl()` devolvía la **antigua** (`AKfycby6…`) aunque el portal y `desplegar.js` usaban la vigente (`AKfycbwQ…`). Los correos (p. ej. recordatorios) llevaban a la antigua: código viejo o «No se pudo abrir el archivo».
- Arreglo: `urlPanel_()` prefiere `URL_IMPLEMENTACION` (formato validado); Diagnóstico avisa si no está fijada. No compara con `getUrl()`: desde el menú de la planilla sigue informando la implementación archivada (`AKfycby6…`, confirmado 2026-11-04 con `clasp deployments`), lo que daba un falso «otra implementación activa». Las activas se ven con `clasp deployments`.
- Archivar las antiguas: `./actualizar.command --archivar-antiguas` (o `node desplegar.js --archivar-antiguas`); nunca toca la vigente, la que enlaza el portal (`index.html`) ni `@HEAD`; si `.despliegue.json` no coincide con el portal, no archiva nada. Sin la opción, solo las lista.
- Los correos ya enviados con la URL antigua siguen funcionando si pasaron por `cae/abrir.html`: esa página lleva todo enlace válido a la implementación vigente (constante `VIGENTE`). Los enlaces directos anteriores a la página intermedia dejan de abrir al archivar.
- Si alguna vez se crea una implementación nueva (cambia la URL): actualizar `VIGENTE` en `cae/abrir.html` y los enlaces de `index.html`.

**Por qué importa:** `clasp push` sin `desplegar.js` no genera el archivo; entonces vuelve el respaldo `getUrl()` y el riesgo de enlaces a una implementación antigua.
