Toda lista desplegable de la planilla (rol, nivel, activo) se vuelve a aplicar en cada actualización automática: una lista del código que crece no actualiza la validación de la celda.

Tipo: corrección

Síntoma real (2026-10-13): al crear una analista de Registro Curricular desde Configuración, «Exception: Los datos que ingresaste en la
celda C15 infringen las reglas de validación de datos… Ingresa uno de los siguientes valores: Analista, Vicedecano/a, Registro
Curricular, Consulta». La instalación había fijado la lista de roles de ese momento; los tres roles de RC se agregaron después en
`ROLES` y nadie renovó la validación. Respuesta: `validacionesListas_()` se aplica en la instalación y en `aplicarActualizacion_`,
y `ROLES`/`NIVELES` forman parte de la huella de estructura, así que un rol nuevo dispara la actualización en la primera visita.
El simulador ahora valida celdas (y escribe de forma atómica, como Sheets), para que este tipo de error aparezca en las pruebas.

**Por qué importa:** Un error de validación de celda no se ve en el código ni en las pruebas sin simular la planilla real; y
bloquea justo la acción nueva que se quiso habilitar.
