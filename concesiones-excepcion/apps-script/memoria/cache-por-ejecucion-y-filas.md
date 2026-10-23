# La caché de lecturas vive solo dentro de una ejecución; toda escritura por fila va con cerrojo y comprueba el folio

**Contexto (2026-10-23).** Revisión de rendimiento y confiabilidad pedida por la persona. Hallazgos: `leer_` releía cada hoja
en cada uso (siete lecturas completas por expediente) y las herramientas de migración (Realinear, Importar, Reparar) borraban e
insertaban filas sin el cerrojo del script, con riesgo de escribir en la fila de otra solicitud o duplicar un folio.

**Decisiones.**
- Caché en `LECTURAS_` (Datos.gs), válida solo durante la ejecución: Apps Script no conserva globales entre llamadas, así que no
  puede mostrar datos viejos a nadie. `anexar_`, `actualizar_` y `borrarFilas_` invalidan; las escrituras directas (instalación,
  verificación) llaman `invalidarLecturas_`. `leer_` entrega copias para que mutar una fila no altere la caché.
- Se descartó `CacheService` (entre ejecuciones): una cuenta desactivada seguiría entrando hasta vencer el plazo y una edición
  manual de la hoja no lo invalidaría. La ganancia no compensa.
- `actualizar_` en «Solicitudes» recibe el folio esperado y rechaza la escritura si la fila ya no es la de ese folio.
- `conCerrojo_` para las tres herramientas de migración.

**Simulador.** Cada llamada de una prueba al script es una ejecución nueva (proxy que vacía la caché al entrar); las llamadas
internas comparten la caché. Las pruebas que editan `hoja.datos` directamente equivalen a otra ejecución, y por eso funcionan.
`estado.lecturas` cuenta lecturas por hoja y `estado.cerrojos` las tomas de cerrojo.

**Regla.** Ninguna escritura directa a una pestaña de `HOJAS` fuera de `Datos.gs`; toda escritura por número de fila o con folio
correlativo va con cerrojo.
