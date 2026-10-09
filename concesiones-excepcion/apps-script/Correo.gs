/**
 * Correo.gs · Plantillas, variables, destinatarios y envío.
 * Todo correo sale desde la cuenta dueña (institucional) con respuesta dirigida a la analista del caso.
 */

const MAX_MB_CORREO = 24; // Gmail admite 25 MB por mensaje; se deja margen.

function urlPanel_() {
  return ScriptApp.getService().getUrl() || '';
}

function variables_(sol, campos, cuentas) {
  const p = parametros_();
  campos = campos || {};
  const tipo = [sol.tipo_catalogo, sol.tipo_texto_libre].filter(Boolean).join(', ');
  const analista = sol.analista ? nombreDe_(sol.analista, cuentas) : '';
  return {
    nombre: [sol.nombres, sol.apellido1, sol.apellido2].filter(Boolean).join(' '),
    folio: sol.folio,
    programa: sol.programa,
    tipo: tipo,
    analista: analista || 'Vicedecanato de Investigación y Postgrado',
    // Frases que se leen bien con o sin analista asignada (ver plantillas «aceptada», «recordatorio» y la firma).
    contacto: analista ? 'La analista a cargo, ' + analista + ',' : 'El equipo del Vicedecanato',
    destino_respuesta: analista ? 'a la analista a cargo, ' + analista : 'al equipo del Vicedecanato',
    firmante: (analista ? analista + '\n' : '') + 'Vicedecanato de Investigación y Postgrado · FAHU',
    analista_asignada: analista || 'sin asignar (asígnela desde el expediente)',
    std: campos.n_std || sol.n_std || '',
    vicedecano: vicedecano_().nombre,
    motivo: campos.motivo || sol.motivo || '',
    observacion: campos.observacion || sol.obs_vicedecano || '',
    propuesta_comite: campos.propuesta_comite || sol.propuesta_comite || '',
    resolucion: campos.resolucion || sol.resolucion || '',
    plazo: p.plazo_programa_dias,
    plazo_admisibilidad: p.plazo_admisibilidad_dias || 2,
    accion_admisibilidad: sol.analista ? 'abrir la revisión de admisibilidad' : 'asignar analista y abrir la revisión de admisibilidad',
    fecha_recepcion: fechaCorta_(sol.fecha_recepcion),
    fecha_solicitud_programa: sol.estado === 'programa' ? fechaCorta_(sol.estado_desde) : '',
    vence_programa: sol.estado === 'programa' && sol.estado_desde ? fechaCorta_(sumarDiasHabiles(new Date(sol.estado_desde), Number(p.plazo_programa_dias || 2), feriados_())) : '',
    fecha_solicitud_vb: sol.estado === 'vb' ? fechaCorta_(sol.estado_desde) : '',
    vence_admisibilidad: sol.fecha_recepcion ? fechaCorta_(sumarDiasHabiles(new Date(sol.fecha_recepcion), Number(p.plazo_admisibilidad_dias || 2), feriados_())) : '',
    enlace_rc: p.enlace_rc && p.enlace_rc !== 'COMPLETAR' ? p.enlace_rc : '',
    enlace: urlPanel_() ? urlPanel_() + '?v=seguimiento' : '',
    enlace_panel: urlPanel_() ? urlPanel_() + '?folio=' + encodeURIComponent(sol.folio) : ''
  };
}

function fechaCorta_(f) {
  const d = f ? new Date(f) : null;
  return d && !isNaN(d) ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MM-yyyy') : '';
}

function plantilla_(evento) {
  const t = leer_(HOJAS.plantillas).find(x => x.evento === evento);
  if (!t) throw new Error('No existe la plantilla «' + evento + '».');
  return t;
}

/** Arma el correo de un evento para una solicitud. No envía. */
function componer_(evento, sol, campos) {
  const cuentas = leer_(HOJAS.cuentas);
  const t = plantilla_(evento);
  const v = variables_(sol, campos, cuentas);
  const dest = resolverDestinatarios(t.para, t.cc, {
    solicitud: sol, cuentas: cuentas, programas: leer_(HOJAS.programas), evento: evento
  });
  return {
    evento: evento,
    descripcion: t.descripcion,
    para: dest.para,
    cc: dest.cc,
    faltantes: dest.faltantes,
    omitidos: dest.omitidos || [],
    asunto: rellenar(t.asunto, v),
    cuerpo: rellenar(t.cuerpo, v),
    replyTo: sol.analista || ''
  };
}

/** Envía. `adjuntos` = ids de archivos de Drive del expediente. Lanza error si algo impide el envío. */
function enviar_(c, adjuntos) {
  if (!c.para.length) throw new Error('El correo no tiene destinatarios.');
  if (c.faltantes && c.faltantes.length) throw new Error('No se puede enviar: falta ' + c.faltantes.join('; ') + '.');
  const pend = variablesSinResolver(c.asunto + ' ' + c.cuerpo);
  if (pend.length) throw new Error('El correo tiene variables sin completar: {' + pend.join('}, {') + '}.');
  const blobs = (adjuntos || []).map(id => DriveApp.getFileById(id).getBlob());
  const mb = blobs.reduce((s, b) => s + b.getBytes().length, 0) / 1048576;
  if (mb > MAX_MB_CORREO) throw new Error('Los adjuntos suman ' + mb.toFixed(1) + ' MB; el máximo por correo es ' + MAX_MB_CORREO + ' MB.');
  const p = parametros_();
  const msg = { to: c.para.join(','), subject: c.asunto, body: c.cuerpo, name: p.remitente_nombre };
  if (c.cc.length) msg.cc = c.cc.join(',');
  if (c.replyTo) msg.replyTo = c.replyTo;
  if (blobs.length) msg.attachments = blobs;
  MailApp.sendEmail(msg);
}

/** Envío automático (recepción, asignación, recordatorio): un fallo se anota en la bitácora en vez de detener el flujo. */
function enviarAutomatico_(evento, sol) {
  try {
    const c = componer_(evento, sol, {});
    enviar_(c, []);
    anexar_(HOJAS.bitacora, {
      fecha: new Date(), folio: sol.folio, tipo: 'correo', quien: 'Sistema', texto: c.descripcion,
      evento: evento, para: c.para.join(', '), cc: c.cc.join(', '), asunto: c.asunto, editado: 'NO'
    });
    return true;
  } catch (err) {
    anexar_(HOJAS.bitacora, {
      fecha: new Date(), folio: sol.folio, tipo: 'sistema', quien: 'Sistema',
      texto: 'ERROR · no se envió «' + evento + '»: ' + err.message, evento: evento
    });
    avisarFalloCorreo_(evento, sol, err);
    return false;
  }
}

/** Avisa de inmediato a la analista del caso y a la administración que un correo automático no salió. */
function avisarFalloCorreo_(evento, sol, err) {
  try {
    const admins = leer_(HOJAS.cuentas).filter(c => c.nivel === 'administracion' && esSi(c.activo)).map(c => String(c.correo).toLowerCase());
    const para = unicos([sol.analista].concat(admins, [duenia_()]).filter(Boolean));
    const enlace = urlPanel_() ? urlPanel_() + '?folio=' + encodeURIComponent(sol.folio) : '(panel no publicado)';
    MailApp.sendEmail({
      to: para.join(','),
      subject: 'Plataforma CAE · no se envió un correo automático · ' + sol.folio,
      body: 'El sistema no pudo enviar el correo «' + evento + '» de la solicitud ' + sol.folio + '.\n\nMotivo: ' + err.message +
        '\n\nRevise el expediente y, si corresponde, avise directamente a quien debía recibirlo: ' + enlace,
      name: parametros_().remitente_nombre
    });
  } catch (e) {
    // Si tampoco sale el aviso (p. ej., cuota agotada), el error ya quedó en la bitácora.
  }
}

/* ── Pantalla «Plantillas» ── */

function api_plantillas() {
  requiere_('consulta');
  return serializar_(leer_(HOJAS.plantillas).map(t => { const o = Object.assign({}, t); delete o._fila; return o; }));
}

function api_guardarPlantilla(evento, asunto, cuerpo) {
  const u = requiere_('edicion');
  const t = plantilla_(evento);
  actualizar_(HOJAS.plantillas, t._fila, { asunto: asunto, cuerpo: cuerpo, actualizado_por: u.correo, actualizado_en: new Date() });
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: u.correo, texto: 'Plantilla «' + evento + '» editada.' });
  return { ok: true };
}

function api_restaurarPlantilla(evento) {
  const u = requiere_('edicion');
  const t = plantilla_(evento);
  actualizar_(HOJAS.plantillas, t._fila, { asunto: t.asunto_original, cuerpo: t.cuerpo_original, actualizado_por: u.correo, actualizado_en: new Date() });
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: u.correo, texto: 'Plantilla «' + evento + '» restaurada al original.' });
  return { ok: true };
}
