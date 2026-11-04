«No se pudo abrir el archivo en este momento» suele ser multicuenta de Google en el navegador o implementación inactiva, no un error del código.

Tipo: técnico

Probar en incógnito solo con la cuenta @usach.cl; para uso diario, un perfil de navegador dedicado. Afecta también a estudiantes: incluir la indicación al difundir el formulario.

2026-11-03: la persona pidió que, en vez del error, el enlace lleve a iniciar sesión con la cuenta institucional. Como el error lo
muestra Google antes de que el script corra, no se puede interceptar: los enlaces de los correos ({enlace_panel}, {enlace}) pasan
ahora por `vipfahu.netlify.app/cae/abrir.html` (parámetro `url_puente`; vacío = enlace directo), que ofrece elegir la cuenta con
AccountChooser y luego abre la ficha, más instrucciones de incógnito. Solo acepta destinos `script.google.com/a/…usach.cl…/exec`
(sin redirección abierta) y la URL del panel viaja en el enlace, no en el repositorio. [Probable] AccountChooser no siempre evita
la falla de Google con varias cuentas: por eso la página conserva la vía de incógnito.

**Por qué importa:** Evita depurar código que no tiene el problema.

**Diagnóstico confirmado (2026-11-04, «las fichas no cargan»):** si en Apps Script → Ejecuciones la función (`api_expediente`) aparece «Completada», el servidor respondió bien y el fallo está en el navegador. Antes de tocar código o implementaciones: abrir en incógnito solo con la cuenta USACH. Así se resolvió; las claves (`.clasp.json`, `.despliegue.json`, `clasp deployments`) estaban correctas. El aviso de consola «iframe … allow-scripts and allow-same-origin … can escape its sandboxing» lo produce el marco de Google en toda Web App: no es un error.
