Cada cambio de flujo va en su propio commit (código, plantillas, pruebas y documentación juntos) para poder revertirlo limpio.

Tipo: confirmado

La persona pidió volver a un estado anterior del flujo; la reversión fue posible porque cada cambio estaba aislado. Las herramientas
(desplegar.js, actualización automática, memoria) quedaron en commits aparte y se conservaron. Al revertir: restaurar los archivos del
flujo desde el commit previo, conservar la herramienta, y dejar que la actualización automática retire plantillas sobrantes y lleve
los casos en estados inexistentes a uno vigente marcado «Por revisar», sin enviar correos.

**Por qué importa:** el flujo institucional cambia por decisión de la autoridad; el código debe acompañar esos vaivenes sin perder datos.
