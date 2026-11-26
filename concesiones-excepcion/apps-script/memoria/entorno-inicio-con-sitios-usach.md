Las sesiones en la nube de este repositorio usan el entorno personal «inicio», que permite los sitios usach.cl donde están planes y resoluciones.

- **Qué pasó (2026-11-26):** al contrastar la oferta de Cursos con los planes de estudio, el entorno por omisión bloqueaba usach.cl
  (403 del proxy) y las búsquedas solo veían fragmentos. Se creó el entorno «inicio» con los hosts de siempre (vipfahu.netlify.app,
  el proyecto Supabase) más fahu, historia, linguisticayliteratura, postgrado(s), transparencia, www.transparenciaactiva,
  magistercomunicacion, periodismo, idea, doctamer, dep, magistereducacion, educacion, diplomadosidea, www y admision (.usach.cl).
- **Cómo aplicarlo:** si un documento usach.cl no abre, revisar con `get_environment` que la sesión esté en «inicio» antes de
  concluir que no existe; si falta un subdominio, proponer agregarlo. Las resoluciones están en www.transparenciaactiva.usach.cl
  (`/sites/default/files/paginas/<número>-<año>.pdf`) y se leen con `pdftotext -layout`.
- **Límite:** varios programas publican su plan en Google Drive (bloqueado) o como imagen: quedan sin verificar.
- **Por qué importa:** los subagentes con WebFetch no pasan por el proxy de la sesión; descargar con curl desde la sesión sí funciona.
