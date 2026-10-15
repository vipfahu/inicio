# Eliminar un antecedente del Formulario solo quita su registro; «Restaurar antecedentes» lo recupera sin tocar Drive

**Qué pasó (2026-10-15).** Administración eliminó por error un antecedente del Formulario (un ZIP enviado por el estudiante
desde el formulario web) y pidió deshacerlo recuperando el archivo.

**Por qué no había nada que recuperar en Drive.** `api_eliminarArchivo` trata distinto cada categoría: los archivos del equipo
y los PDF generados van a la papelera; los antecedentes del Formulario pertenecen al estudiante, así que solo se borra la fila de
«Archivos» y, si existe, el acceso directo de la carpeta del caso. Con el formulario web el archivo vive dentro de la carpeta del
caso (no es un acceso directo), por lo que quedó intacto y solo faltaba el registro.

**Solución.** `api_restaurarAntecedentes(folio)` (solo Administración, botón «Restaurar antecedentes» en la ficha): recorre la
carpeta del caso y registra lo que falte (archivos con descripción «Antecedente · solicitud N» y accesos directos), y para los
adjuntos de la hoja de respuestas sin acceso directo crea uno nuevo. Idempotente; cada recuperación queda en la bitácora.

**Regla.** Toda eliminación debe tener su reverso documentado antes de ofrecerla: la persona espera «deshacer» como primera
pregunta tras un borrado por error. Para archivos del equipo el reverso es manual (papelera de Drive de la cuenta institucional,
30 días, y volver a subir).
