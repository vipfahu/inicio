Quien no tiene cuenta @usach.cl solicita por correo con un PDF rellenable; no se abrió el formulario web a otros dominios.

Tipo: decisión de la persona (2026-11-20)

- Se descartó abrir la Web App a «cualquier persona»: Google no entrega el correo de cuentas externas y se pierden el seguimiento por identidad, el límite por cuenta y el correo verificado. El caso real son personas con tiempo fuera de la Universidad, pocas.
- Solución: página pública `cae/sin-cuenta.html` (enlace en la tarjeta de Concesiones del portal y en `cae/abrir.html`) + `cae/formulario-solicitud-cae.pdf`, que se envía a viceinvestigacionfahu@usach.cl; la Unidad de Análisis registra el caso.
- El PDF sale de `herramientas/formulario_sin_cuenta.py` (reportlab, campos AcroForm). La lista de tipos está copiada de `TIPOS_CATALOGO`: si cambia, regenerar. El programa es texto libre porque la lista vive en la planilla.
- Pendiente conocido: el panel no tiene «ingresar solicitud a nombre de otra persona»; hoy se hace con el formulario web + «Cambiar correo» (administración), y la plantilla `registro_estudiante` habla de «cuenta USACH» aunque el correo sea externo.

**Por qué importa:** si vuelve el pedido de abrir el formulario a todos los dominios, exige verificación por código al correo y límites de envío; no es un cambio de configuración.
