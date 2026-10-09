Los plazos cuentan días hábiles de lunes a viernes, sin feriados: la persona pidió quitar el registro de feriados por innecesario.

Tipo: corrección

Se había implementado una pestaña «Feriados» (fijos precargados, móviles a mano cada año), una tarjeta en Configuración y un aviso en
el Diagnóstico, para que los plazos en «días hábiles» no contaran feriados. La persona indicó que no es necesario para la operación.
Se quitó todo (hoja, precarga, tarjeta, diagnóstico); las funciones puras `diasHabilesEntre`/`sumarDiasHabiles` aceptan aún una
lista opcional, pero la plataforma no la pasa. Efecto aceptado: un recordatorio puede salir en un feriado.

**Por qué importa:** no agregar mantenimiento anual que el equipo no pidió; preguntar antes de sumar datos que alguien debe cargar a mano.
