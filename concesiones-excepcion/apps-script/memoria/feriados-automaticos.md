Feriados automáticos desde el calendario público de feriados de Chile de Google; nunca carga manual.

Tipo: corrección

Primero se implementó una pestaña «Feriados» con carga manual anual; la persona la rechazó por innecesaria y luego pidió feriados que
se actualicen solos. Solución (`Feriados.gs`): CalendarApp sobre `es.cl.official#holiday@…` (si existe) o `es.cl#holiday@…`
(filtrando conmemoraciones por descripción), cacheado en propiedades del script, renovado cada 30 días en la tarea diaria; si falla,
lista anterior; sin lista, lunes a viernes. Requiere el permiso `calendar.readonly` (reautorización única). Configuración muestra los
próximos feriados solo como información. No verificado aún contra el calendario real: revisar la lista tras el primer Diagnóstico.

**Por qué importa:** la persona no quiere tareas de mantenimiento anual; cualquier dato de referencia debe obtenerse solo o no existir.
