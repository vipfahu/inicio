/**
 * Diario.gs · Tarea diaria (disparador de tiempo, ~08:00).
 *  1. Recordatorios internos por plazo vencido (automáticos, sin confirmación humana): admisibilidad (caso «Recibida» sin
 *     revisión iniciada) y pronunciamiento del programa vencido (a la dirección de programa, con copia a la analista).
 *  2. Control de compartición: avisa si la planilla o la carpeta de la plataforma tienen accesos no autorizados.
 */

function tareaDiaria() {
  soloSistema_();
  actualizarSiCorresponde_();
  enviarRecordatorios_();
  limpiarTemporales_();
  controlarComparticion_();
}

function enviarRecordatorios_() {
  const p = parametros_();
  if (Number(p.recordatorios_max || 0) <= 0) return;
  const hoy = new Date();
  const fer = feriados_();
  leer_(HOJAS.solicitudes).forEach(s => {
    const evento = recordatorioPendiente(s, hoy, p, fer);
    if (!evento) return;
    if (enviarAutomatico_(evento, s)) {
      actualizar_(HOJAS.solicitudes, s._fila, { recordatorios: Number(s.recordatorios || 0) + 1, ultimo_recordatorio: hoy });
    }
  });
}

/** Correos con acceso directo que no están autorizados. */
function accesosNoAutorizados_() {
  const permitidos = String(parametros_().compartido_permitido || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  permitidos.push(duenia_());
  const revisar = [DriveApp.getFileById(libro_().getId())];
  try { revisar.push(carpetaRaiz_()); } catch (e) { /* sin carpeta aún */ }
  const hallazgos = [];
  revisar.forEach(item => {
    const nombre = item.getName();
    item.getEditors().concat(item.getViewers()).forEach(usr => {
      const c = String(usr.getEmail() || '').toLowerCase();
      if (c && permitidos.indexOf(c) < 0) hallazgos.push(nombre + ': ' + c);
    });
    const acceso = item.getSharingAccess();
    if (acceso !== DriveApp.Access.PRIVATE) hallazgos.push(nombre + ': compartido por enlace (' + acceso + ')');
  });
  return hallazgos;
}

function controlarComparticion_() {
  const h = accesosNoAutorizados_();
  if (!h.length) return;
  const clave = 'ULTIMO_AVISO_COMPARTICION';
  const firma = h.join('|');
  if (propiedad_(clave) === firma) return; // no repetir el mismo aviso cada día
  PropertiesService.getScriptProperties().setProperty(clave, firma);
  const admins = leer_(HOJAS.cuentas).filter(c => c.nivel === 'administracion' && esSi(c.activo)).map(c => c.correo);
  MailApp.sendEmail({
    to: [duenia_()].concat(admins).join(','),
    subject: 'Plataforma CAE · accesos no autorizados a datos confidenciales',
    body: 'La tarea diaria detectó accesos directos que no están autorizados:\n\n- ' + h.join('\n- ') +
      '\n\nEl acceso del equipo debe hacerse solo por el panel. Retire estos permisos desde Drive («Compartir»), ' +
      'o agréguelos al parámetro «compartido_permitido» si son intencionales.',
    name: parametros_().remitente_nombre
  });
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: 'Sistema', texto: 'Aviso de accesos no autorizados: ' + h.join('; ') });
}
