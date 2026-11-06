La administración ve los casos con plazo vencido o por vencer de cada analista y les envía un recordatorio por correo (pestaña «Plazos de analistas», `Plazos.gs`).

Tipo: confirmado (pedido de la persona, 2026-11-06)

- Plazo por paso en `PLAZOS_ANALISTA` (`Logica.gs`): «Recibida» desde la recepción (`plazo_admisibilidad_dias`), programa (`plazo_programa_dias`), resto `plazo_analista_dias` desde `estado_desde`. Los pasos de V°B° no se incluyen: son del Vicedecano/a y ya tienen recordatorio propio.
- Un correo por analista con todos los casos marcados (no uno por caso), plantilla `recordatorio_analista` con variables propias ({analista}, {cantidad}, {casos}, {remitente}), vista previa editable y `replyTo` = quien envía.
- El registro del envío es la bitácora de cada caso (`evento = recordatorio_analista`); no se agregó columna en «Solicitudes». No toca el contador `recordatorios`, que es de los recordatorios a terceros.
- Solo nivel administración (vista y envío); probado en `tests/flujo.test.js`.

**Por qué importa:** si se agregan pasos al flujo, hay que decidir si son de la analista y sumarlos a `PLAZOS_ANALISTA`; si no, quedan fuera de la vista sin aviso.
