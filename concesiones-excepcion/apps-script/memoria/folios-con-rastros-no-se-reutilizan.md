# Un folio con rastros (bitácora, archivos o carpeta) sin solicitud no se vuelve a asignar; «Buscar rastros» y «Purgar» limpian pruebas

**Contexto (2026-10-27).** La persona pidió revisar «folios futuros no asociados a casos» (pruebas que no eliminaron todos sus rastros).
No se puede mirar la planilla desde la sesión; se construyó la revisión como herramienta del panel.

**Riesgo encontrado.** `siguienteFolio` solo miraba «Solicitudes». Al eliminar una prueba se conserva su bitácora (a propósito), así que
el siguiente caso real recibía el mismo número y heredaba ese historial en su ficha.

**Decisiones.** `foliosOcupados_()` = folios de Solicitudes ∪ Bitácora ∪ Archivos, usado al crear e importar. `rastrosFolios_()` lista
folios con filas o carpeta de expediente sin solicitud; `api_purgarRastros` (Administración, con motivo) los borra, manda la carpeta a
la papelera y anota una constancia general. El Diagnóstico los lista. La limpieza de la prueba de ACTIVACION pasa a hacerse por el panel.

**Regla.** Toda limpieza manual en la planilla deja rastros; ofrecer siempre la limpieza por el panel y nunca reutilizar un número con historia.
