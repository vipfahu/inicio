Desplegar = `node desplegar.js` (pruebas → `clasp push --force` → `clasp redeploy <deploymentId>`); la planilla se pone al día sola en la primera visita.

Tipo: diseño

`.despliegue.json` guarda el deploymentId fuera del repo. `actualizarSiCorresponde_` (Instalar.gs) compara una huella de columnas/parámetros/plantillas y aplica cambios una sola vez, con fila en Bitácora. `actualizar.command` (macOS, doble clic) agrega el `git pull` delante y se ubica por su propia carpeta, sin rutas fijas: la persona tiene el repositorio en Dropbox y su ruta incluye una carpeta `inicio` anidada. El ID no se pone en el script (repositorio público); lo recuerda `.despliegue.json`. La primera ejecución real de `redeploy` no estaba verificada al cierre de la sesión en la nube.

**Por qué importa:** La persona pidió eliminar pasos manuales.
