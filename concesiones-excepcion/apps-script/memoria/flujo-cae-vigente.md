Flujo vigente: recibida → revisión de admisibilidad → admisible para análisis (id `aceptada`) / rechazada / no procede → informe RC → programa (vía STD, solo registro; rechazada y no procede también desde estos tres pasos, 2026-10-27) → V°B° Comité: CAE admisible / CAE rechazada (ambas a Registro Curricular vía STD; correo al estudiante con el estado) / devolución vía STD → proyecto de resolución enviado a Decanato para firma (fecha y N° STD, 2026-10-27) → resolución recibida de RC (N° y fecha, 2026-10-14) → resuelto / negado. Cada V°B° avisa a la analista (`vb_dado`).

Tipo: corrección

Por pedido de la persona (2026-10-08) se volvió al flujo anterior a la «autorización de inicio por el Vicedecano/a». Se revirtieron
dos versiones: (1) autorización de inicio y V°B° exclusivos del Vicedecano/a, con la aceptación al final; (2) pronunciamiento del programa
vía STD, decisión del Vicedecano/a con aviso interno y comunicación por la analista. Siguen en el historial de git (commits a5a698c y
d7154af) por si se retoman. Luego (mismo día) la persona pidió: eliminar el V°B° del Vicedecano/a al informe y que la analista registre directamente que solicitó
el pronunciamiento al programa por STD, sin notificación; el estudiante ve ese estado en su seguimiento. La devolución al programa
también se registra sin correo (exige observación). El recordatorio de plazo vencido (2 días hábiles) va a la dirección de programa con copia a la analista y pide responder por el STD (pedido posterior de la persona); el registro del envío sigue sin correo. El V°B° a la
respuesta del Comité lo registraba cualquier cuenta con edición hasta el 2026-10-09; desde entonces es exclusivo del Vicedecano/a (ver `vb-exclusivo-con-otro-medio.md`). La admisibilidad se declara tras la revisión. El estado «aceptada» se muestra como «Admisible para análisis» (pedido de la persona): deja claro que aún no hay resolución sobre lo solicitado.

Fase de resolución (pedidos sucesivos de la persona): en el V°B°, «CAE admisible» y «CAE rechazada» se tratan igual: ambas siguen a
Registro Curricular por STD, que **elabora y distribuye** la resolución (esta unidad no la elabora). Primero se quitaron todos los
correos de la fase; luego la persona pidió **reintegrar** un correo al estudiante en ambos casos (`cae_admisible`, `cae_rechazada`) que
indica el estado y que la resolución está en elaboración para su distribución desde Registro Curricular. El cierre (Resuelto/Negado)
sigue sin correo: comentario opcional para el registro (antes se exigía N° y fecha; la persona lo quitó el 2026-10-09) y se puede cargar el archivo de la resolución.

Requisitos agregados (2026-10-09): pasar a Informe RC exige N° STD registrado y genera antes el PDF del formulario de solicitud (si falla,
no cambia el estado); al registrar Resuelto/Negado se recuerda en negrita enviar la resolución de inmediato a la Unidad de Registro
Curricular para su distribución.

CAE admisible (2026-10-13): V°B° → `aviso_rc` (notificar a Registro Curricular) → `rc_notificado` (exige fecha y medio; RC informa al
estudiante pasos a seguir y pagos) → `resolucion` (recién ahí el correo `cae_admisible`). CAE rechazada no cambió.

**Por qué importa:** no reintroducir la autorización de inicio (la exclusividad en el V°B° del Comité sí está vigente), ni correos al programa, sin que la persona lo pida.

Cambio 2026-10-14 (pedido de la persona): (a) al registrar el V°B° en cualquiera de sus salidas, correo automático `vb_dado` a la
analista del caso con decisión, propuesta, observación y paso siguiente (no si ella misma lo registró por «otro medio»); (b) antes de
Resuelto / Negado se registra la resolución que vuelve de Registro Curricular con su número y fecha (`res_recibida` tras CAE admisible,
`res_rechazo_recibida` tras CAE rechazada), con archivo opcional. El recordatorio «envíe la resolución a RC» del cierre se reemplazó
por «verifique que RC la distribuyó»: Registro Curricular numera y distribuye; el Vicedecanato registra el retorno y cierra. El
flujograma publicado anterior a esta fecha no incluye el paso nuevo.

Cambio 2026-10-27 (tras el reporte de una analista que tuvo que retroceder paso a paso para rechazar un caso ya admisible): «Presentación
rechazada» y «No procede» (motivo obligatorio en ambas desde estos pasos) se ofrecen también desde Admisible para análisis, Informe RC y Pronunciamiento del
programa. Después del V°B° la salida negativa sigue siendo solo la del Comité (`rechazo_vb`). El Panorama muestra la ruta hasta el
último paso recorrido antes del cierre negativo.

Cambio 2026-10-27 (pedido de una analista): entre la notificación al estudiante y la resolución recibida existe el paso «Proyecto de
resolución enviado a Decanato (firma)», en ambas ramas (`firma_decanato`, `rechazo_firma_decanato`): el Vicedecanato redacta el
proyecto y lo despacha por STD a Decanato para la firma de la Decana; se registran fecha y N° STD (columna `envio_decanato`), sin
correo; el recordatorio manual a Registro Curricular sigue disponible en ese paso. Corrige la premisa anterior de que Registro
Curricular «elaboraba» la resolución: Registro Curricular numera, devuelve y distribuye.

Precisión 2026-10-27 (la analista): «primero confeccionamos, enviamos a Decana, Decana firma y envía a Registro, Registro pone folio,
fecha y despacha por mail y finaliza STD». La resolución no «vuelve» al Vicedecanato: el paso `res_recibida` se llama «Resolución
numerada y despachada por Registro Curricular» y registra número y fecha; el cierre pide verificar despacho y STD finalizado.

Cambio 2026-10-30 (pedido de la persona): rechazo propuesto antes del Comité, opcional. Desde revisión, admisible, informe RC y
programa: `vb_rechazo` (motivo; correo al Vicedecano/a; nada al estudiante, que ve «En revisión por el Vicedecanato»). Salidas: V°B° →
`rechazada` (correo al estudiante) o no aprobado → paso de origen (observación; sin correo: `eventoTransicion` lo bloquea para no
reenviar, p. ej., «Admisible para análisis»). Avisos `vb_rechazo_dado` a la analista; recordatorio `recordatorio_vb_rechazo`.
