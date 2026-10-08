Desplegar = `node desplegar.js` (pruebas → `clasp push --force` → `clasp redeploy <deploymentId>`); la planilla se pone al día sola en la primera visita.

Tipo: diseño

`.despliegue.json` guarda el deploymentId fuera del repo. `actualizarSiCorresponde_` (Instalar.gs) compara una huella de columnas/parámetros/plantillas y aplica cambios una sola vez, con fila en Bitácora. La primera ejecución real de `redeploy` no estaba verificada al cierre de la sesión en la nube.

**Por qué importa:** La persona pidió eliminar pasos manuales.
