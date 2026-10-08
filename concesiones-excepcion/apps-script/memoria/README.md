# Memoria del proyecto CAE

Una lección por archivo; la primera línea de cada uno es su resumen. Leer este índice al iniciar una sesión.
Mantenimiento: actualizar la nota existente en vez de duplicar; borrar las que resulten erróneas; no guardar lo que ya dicen el código o el historial de git.

- [alcance-solo-equipo-vicedecanato](alcance-solo-equipo-vicedecanato.md) — El panel es solo para el equipo del Vicedecanato; direcciones de programa, Registro Curricular y estudiantes solo reciben correos.
- [aviso-nueva-solicitud-a-todo-el-panel](aviso-nueva-solicitud-a-todo-el-panel.md) — El aviso «Nueva solicitud CAE» va a toda cuenta activa con acceso al panel (consulta, edición, administración), no solo a Vicedecano/a y analistas.
- [flujo-cae-vigente](flujo-cae-vigente.md) — Flujo vigente: autorización de inicio (solo Vicedecano/a) → análisis → informe RC → V°B° informe → programa vía STD → analista solicita decisión → Vicedecano/a decide (exclusivo) → analista comunica → resolución.
- [programa-via-std-sin-correo](programa-via-std-sin-correo.md) — El pronunciamiento del programa se tramita en el STD (Sistema de Trazabilidad Documental): la plataforma no envía correo a la dirección de programa en ese paso.
- [pregunta-abierta-decision-en-panel-o-std](pregunta-abierta-decision-en-panel-o-std.md) — Pendiente de confirmar: si el Vicedecano/a registra su decisión en el panel (implementado) o firma en STD y la analista solo la anota.
- [declarar-lo-que-no-se-construyo](declarar-lo-que-no-se-construyo.md) — Decir explícitamente qué piezas del prototipo NO se construyeron o se reemplazaron: la persona asume que existe lo que vio en capturas.
- [nombres-gs-html-distintos](nombres-gs-html-distintos.md) — En Apps Script un `.gs` y un `.html` no pueden compartir nombre base; `clasp push` falla entero («A file with this name already exists»).
- [google-workspace-en-vez-de-supabase](google-workspace-en-vez-de-supabase.md) — Se eligió Sheets + Drive + Apps Script en lugar de Supabase/Netlify.
- [presentar-opciones-con-recomendacion](presentar-opciones-con-recomendacion.md) — Presentar decisiones numeradas con una recomendación argumentada; la persona suele aprobarlas en bloque y matiza solo lo que importa.
- [migracion-ultimo-estado](migracion-ultimo-estado.md) — Regla de migración: «el último estado es el definitivo» = columna no vacía más a la derecha (ESTADO ACTUAL → ESTADO → Estado de Presentación).
- [identidad-getactiveuser-verificada](identidad-getactiveuser-verificada.md) — Web App «ejecutar como yo» + acceso «dominio»: `Session.getActiveUser()` devuelve el correo de una analista del dominio; verificado en producción.
- [credenciales-solo-en-maquina-de-la-persona](credenciales-solo-en-maquina-de-la-persona.md) — La credencial institucional nunca sale del computador de la persona: clasp local; nada de tokens en la nube, GitHub Actions ni contraseñas compartidas.
- [desplegar-en-un-comando](desplegar-en-un-comando.md) — Desplegar = `node desplegar.js` (pruebas → `clasp push --force` → `clasp redeploy <deploymentId>`); la planilla se pone al día sola en la primera visita.
- [scriptid-vs-deploymentid](scriptid-vs-deploymentid.md) — `scriptId` (engranaje del editor; va en `.clasp.json`) ≠ `deploymentId` (`AKfycb…`, tramo de la URL entre /s/ y /exec; va en `desplegar.js`).
- [nueva-implementacion-cambia-url](nueva-implementacion-cambia-url.md) — «Nueva implementación» crea otra URL; para conservarla: editar la existente → «Nueva versión», o `clasp redeploy`.
- [no-se-pudo-abrir-el-archivo](no-se-pudo-abrir-el-archivo.md) — «No se pudo abrir el archivo en este momento» suele ser multicuenta de Google en el navegador o implementación inactiva, no un error del código.
- [menu-cae-ausente-push-no-llego](menu-cae-ausente-push-no-llego.md) — Si falta una opción del menú CAE, casi siempre el push no llegó: recargar la planilla, ver archivos en el editor, `clasp status`, revisar scriptId.
- [cuota-correo-y-activadores](cuota-correo-y-activadores.md) — La cuota diaria de correo es de la cuenta institucional y otros scripts la consumen. En Activadores deben existir solo `alRecibirFormulario` y `tareaDiaria`.
- [orden-instalacion-y-permisos](orden-instalacion-y-permisos.md) — Publicar el panel antes del paso 2 de instalación; cambios en `oauthScopes` exigen reautorización manual; los folios se tratan como texto.
- [planilla-privada-panel-unica-puerta](planilla-privada-panel-unica-puerta.md) — La planilla se comparte solo con la cuenta institucional; el equipo trabaja únicamente por el panel. No cambiar compartición sin consentimiento explícito.
- [cuentas-son-autorizaciones](cuentas-son-autorizaciones.md) — Una cuenta es una fila en «Cuentas» que autoriza un correo @usach.cl: sin contraseñas, nivel releído en cada llamada, se desactiva y no se borra.
- [correos-con-confirmacion](correos-con-confirmacion.md) — Ningún correo sale por editar una celda: cambio de estado = vista previa editable; el estado solo cambia si el envío funciona; un CC faltante advierte pero no bloquea.
- [repo-publico-sin-datos-personales](repo-publico-sin-datos-personales.md) — `vipfahu/inicio` es público: nada de datos personales, IDs reales de planillas/formularios ni credenciales; pruebas solo con datos sintéticos.
- [formulario-y-seguimiento](formulario-y-seguimiento.md) — Formulario propio en `URL?v=solicitud` y seguimiento en `URL?v=seguimiento` (identifica por la cuenta USACH); el estudiante no ve la decisión hasta que la analista la comunica.
- [entregar-instrucciones-verificables](entregar-instrucciones-verificables.md) — Instrucciones en fases numeradas: cuenta con que se hace cada paso, qué debe verse, qué hacer si falla y cierre; la persona las sigue literalmente y pega los errores tal cual.
