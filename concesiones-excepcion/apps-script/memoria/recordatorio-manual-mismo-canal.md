Un recordatorio manual usa la misma plantilla, destinatarios y contador que el automático del paso; en pasos sin espera ajena no existe.

Tipo: confirmado

Pedido de la persona (2026-10-13): «enviar recordatorio manualmente sobre espera de respuesta, según el paso». Decisiones:
- `RECORDATORIO_MANUAL` (Logica.gs) mapea paso → evento: los tres pasos con recordatorio automático reutilizan su plantilla, y la
  espera de Registro Curricular (informe, resolución) recibe dos plantillas nuevas al rol «Registro Curricular» con copia a la analista.
- El envío manual incrementa `recordatorios` y fija `ultimo_recordatorio`: la tarea diaria no duplica el aviso al día siguiente y el
  máximo de automáticos se respeta. El manual nunca se bloquea por el máximo: la persona decide.
- Vista previa editable y bitácora con quién lo envió y si editó el texto (misma forma que los cambios de estado).

**Por qué importa:** Dos canales paralelos (uno automático y otro manual con texto propio) producen avisos contradictorios y
contadores que no cuadran; un solo canal con dos disparadores no.
