Visor de archivos del panel: PDF/imagen/texto en el navegador (pdf.js), Word → PDF en el servidor (Drive avanzado), ZIP por documento (Utilities.unzip). Pendiente verificar en producción.

Tipo: enfoque confirmado (pedido de la persona, 2026-10-09), con verificación pendiente

- Todo pasa por `api_verArchivo` (mismos permisos que «Descargar»: edición + programa + archivo del expediente). Nada sale a servicios
  externos: pdf.js solo dibuja en el navegador; la conversión es una copia en «Temporal» que se borra al terminar (la limpieza diaria
  es la red de seguridad).
- pdf.js 3.11.174 se carga sin Worker (el worker como script en la página), porque el marco de Apps Script puede bloquear Workers, y con
  `isEvalSupported: false` (CVE-2024-4367).
- Desde la nube no se pudo leer la documentación de Google (bloqueada): `Drive.Files.create(meta, blob)` y `Drive.Files.remove(id)` del
  servicio avanzado v3 se usaron de memoria; `remove` tiene respaldo con `setTrashed`. Si «Ver» falla con un Word, revisar esos nombres.

**Por qué importa:** si falla en producción, el primer sospechoso es el servicio avanzado (nombres de método o activación), no el visor.
