/**
 * Flujo.gs · Recepción de solicitudes y tramitación.
 */

/** Solo puede ejecutarlo el propio sistema (disparadores) o la cuenta dueña, nunca alguien desde el panel. */
function soloSistema_() {
  const a = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (a && a !== duenia_()) throw new Error('SIN_ACCESO: función reservada al sistema.');
}

/**
 * Disparador «Al enviar el formulario» (instalable, sobre la planilla).
 * Asigna folio con bloqueo, asigna analista por programa, vincula antecedentes y envía recepción + asignación.
 */
function alRecibirFormulario(e) {
  if (!e || !e.range || typeof e.range.getRow !== 'function') throw new Error('Llamada inválida.');
  soloSistema_();
  const fila = e.range.getRow();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let sol;
  try {
    if (leer_(HOJAS.solicitudes).some(s => Number(s.fila_respuesta) === fila)) return; // ya procesada
    const r = leerRespuesta_(fila);
    const tipos = separarTipos(r.tipos);
    sol = crearSolicitud_({
      fila_respuesta: fila, fecha_recepcion: r.marca instanceof Date ? r.marca : new Date(), correo_verificado: String(r.correoVerificado || '').toLowerCase(),
      apellido1: r.apellido1, apellido2: r.apellido2, nombres: r.nombres, run: String(r.run || ''), correo: r.correo || r.correoVerificado,
      telefono: String(r.telefono || ''), programa: r.programa, anio: r.anio, semestre: r.semestre,
      tipo_catalogo: tipos.catalogo, tipo_texto_libre: tipos.libre, origen: 'Formulario de Google'
    });
    // El folio también se escribe en la columna A de las respuestas, donde el equipo lo buscaba antes.
    hojaRespuestas_().getRange(fila, 1).setNumberFormat('@').setValue(sol.folio);
  } finally {
    lock.releaseLock();
  }
  vincularAntecedentes_(sol, leerRespuesta_(sol.fila_respuesta).adjunto);
  avisosNuevaSolicitud_(sol);
}

/**
 * Registra una solicitud nueva (formulario web o de Google). Debe llamarse con el bloqueo tomado.
 * Asigna folio correlativo y, si el programa tiene analista con cuenta activa, la asigna.
 */
function crearSolicitud_(campos) {
  const marca = campos.fecha_recepcion || new Date();
  const folio = siguienteFolio(leer_(HOJAS.solicitudes).map(s => s.folio), marca.getFullYear());
  const prog = leer_(HOJAS.programas).find(p => p.programa === campos.programa);
  const sol = Object.assign({}, campos, {
    folio: folio, fecha_recepcion: marca, estado: 'recibida', estado_desde: marca,
    analista: analistaActiva_(prog && prog.analista), recordatorios: 0, actualizado: new Date()
  });
  anexar_(HOJAS.solicitudes, sol);
  anexar_(HOJAS.bitacora, { fecha: marca, folio: folio, tipo: 'estado', quien: campos.origen || 'Formulario', texto: 'Solicitud recibida (' + (campos.origen || 'formulario') + ').', estado_nuevo: 'recibida' });
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: folio, tipo: 'sistema', quien: 'Sistema',
    texto: sol.analista ? 'Asignada a ' + nombreDe_(sol.analista) + ' según el programa.'
      : (prog && prog.analista ? 'Sin analista: «' + prog.analista + '» (Programas) no tiene una cuenta activa con rol Analista.' : 'Sin analista: asignar desde el expediente.') });
  return buscarSolicitud_(folio);
}

/** Correos al llegar una solicitud: recepción (estudiante), aviso al equipo y, si corresponde, asignación. */
function avisosNuevaSolicitud_(sol) {
  enviarAutomatico_('recepcion', sol);
  enviarAutomatico_('nueva_solicitud', sol);
  if (sol.analista) enviarAutomatico_('asignacion', sol);
}

/** Correo de la analista solo si tiene una cuenta activa con rol Analista; si no, ''. */
function analistaActiva_(correo) {
  const c = String(correo || '').trim().toLowerCase();
  if (!c) return '';
  return leer_(HOJAS.cuentas).some(x => String(x.correo).trim().toLowerCase() === c && x.rol === 'Analista' && esSi(x.activo)) ? c : '';
}

/* ── Panel: bandeja y expediente ── */

function resumen_(s) {
  const e = estadoPorId(s.estado) || { etiqueta: s.estado, fase: '' };
  return {
    folio: s.folio, nombre: [s.nombres, s.apellido1, s.apellido2].filter(Boolean).join(' '), run: s.run, programa: s.programa,
    tipo: [s.tipo_catalogo, s.tipo_texto_libre].filter(Boolean).join(', '), estado: s.estado, estadoEtiqueta: e.etiqueta, fase: e.fase,
    analista: s.analista, fecha_recepcion: s.fecha_recepcion, estado_desde: s.estado_desde, revisar: s.revisar
  };
}

function api_bandeja() {
  const u = requiere_('consulta');
  const cuentas = leer_(HOJAS.cuentas);
  const lista = leer_(HOJAS.solicitudes).filter(s => puedeVerSolicitud(u, s)).map(s => {
    const r = resumen_(s);
    r.analistaNombre = s.analista ? nombreDe_(s.analista, cuentas) : '';
    return r;
  });
  return serializar_(lista);
}

/**
 * Panorama de avance: todos los casos que la cuenta puede ver, con su ruta de pasos (sin fundamentación ni archivos).
 * Disponible para todo nivel con acceso al panel: Vicedecanato y cuentas de Registro Curricular con nivel Consulta.
 */
function api_panorama() {
  const u = requiere_('consulta');
  const cuentas = leer_(HOJAS.cuentas);
  const bit = leer_(HOJAS.bitacora).filter(b => b.tipo === 'estado');
  const feriados = feriados_();
  const hoy = new Date();
  const casos = leer_(HOJAS.solicitudes).filter(s => s.folio && puedeVerSolicitud(u, s)).map(s => {
    const e = estadoPorId(s.estado) || {};
    const visitados = bit.filter(b => String(b.folio) === String(s.folio)).map(b => b.estado_nuevo);
    const desde = s.estado_desde ? new Date(s.estado_desde) : null;
    return {
      folio: s.folio, nombre: [s.nombres, s.apellido1, s.apellido2].filter(Boolean).join(' '), programa: s.programa,
      tipo: [s.tipo_catalogo, s.tipo_texto_libre].filter(Boolean).join(', '), estado: s.estado, etiqueta: e.etiqueta || s.estado,
      fase: e.fase || '', cerrado: !(e.siguientes || []).length, fecha_recepcion: s.fecha_recepcion, estado_desde: s.estado_desde,
      diasHabiles: desde && !isNaN(desde) ? diasHabilesEntre(desde, hoy, feriados) : null,
      analistaNombre: s.analista ? nombreDe_(s.analista, cuentas) : '',
      ruta: rutaProceso(s.estado, visitados).map(p => ({ id: p.id, etiqueta: p.etiqueta, fase: p.fase, situacion: p.situacion }))
    };
  });
  return serializar_({ casos: casos, fases: ['Admisibilidad', 'Tramitación', 'Resolución', 'Cierre'] });
}

/**
 * Fundamentación de una solicitud. Las del formulario web están en «Solicitudes»; las migradas se leen de su fila en la hoja de
 * respuestas, y antes de mostrarla se comprueba que esa fila siga siendo de la misma persona (si alguien ordenó o borró filas en la
 * hoja de respuestas, la fila apuntaría a otro estudiante y se mostrarían datos ajenos).
 */
function fundamentacionDe_(s) {
  if (String(s.fundamentacion || '').trim()) return { texto: s.fundamentacion, origen: 'solicitud', alerta: '' };
  if (!s.fila_respuesta) return { texto: '', origen: '', alerta: '' };
  let r;
  try { r = leerRespuesta_(Number(s.fila_respuesta)); } catch (e) { return { texto: '', origen: 'respuestas', alerta: 'No se pudo leer la fila ' + s.fila_respuesta + ' de la hoja de respuestas: ' + e.message }; }
  const n = x => String(x === null || x === undefined ? '' : x).trim().toLowerCase();
  const coincide = (n(r.correoVerificado) && n(r.correoVerificado) === n(s.correo_verificado)) ||
    (n(r.apellido1) === n(s.apellido1) && n(r.nombres) === n(s.nombres));
  if (!coincide) return { texto: '', origen: 'respuestas', alerta: 'La fila ' + s.fila_respuesta + ' de la hoja de respuestas ya no corresponde a esta solicitud (¿se ordenaron o borraron filas?). Ejecute «Verificar migración» en Configuración.' };
  return { texto: r.fundamentacion || '', origen: 'respuestas', alerta: '' };
}

function api_expediente(folio) {
  const u = requiere_('consulta');
  const s = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  const cuentas = leer_(HOJAS.cuentas);
  const out = Object.assign({}, s);
  delete out._fila;
  out.analistaNombre = s.analista ? nombreDe_(s.analista, cuentas) : '';
  out.estadoEtiqueta = (estadoPorId(s.estado) || {}).etiqueta || s.estado;
  out.siguientes = ((estadoPorId(s.estado) || {}).siguientes || []).map(id => ({
    id: id, etiqueta: estadoPorId(id).etiqueta, evento: eventoTransicion(s.estado, id)
  }));
  out.bitacora = leer_(HOJAS.bitacora).filter(b => String(b.folio) === String(folio)).map(b => { const o = Object.assign({}, b); delete o._fila; return o; });
  // Pasos por los que ya pasó (para «Volver a un paso anterior»), en el orden del flujo.
  const visitados = estadosVisitados_(out.bitacora);
  out.anteriores = ESTADOS.filter(e => e.id !== s.estado && visitados.indexOf(e.id) >= 0).map(e => ({ id: e.id, etiqueta: e.etiqueta }));
  out.vbDado = visitados.indexOf('aviso_rc') >= 0 || visitados.indexOf('rechazo_vb') >= 0;
  // Recordatorio manual: solo en pasos donde se espera una respuesta ajena.
  const evRec = recordatorioManual(s.estado);
  if (evRec) {
    let desc = evRec; try { desc = plantilla_(evRec).descripcion; } catch (e) { /* plantilla aún no agregada */ }
    out.recordatorio = { evento: evRec, descripcion: desc, enviados: Number(s.recordatorios || 0), ultimo: s.ultimo_recordatorio || '' };
  }
  // La fundamentación y los archivos (pueden contener datos de salud) solo para Edición o superior.
  out.verDetalle = nivelSuficiente(u.nivel, 'edicion');
  if (out.verDetalle) {
    const f = fundamentacionDe_(s);
    out.fundamentacion = f.texto;
    if (f.alerta) out.alertaFundamentacion = f.alerta;
    out.archivos = archivosDe_(folio).map(a => ({ id: a.archivo_id, nombre: a.nombre, categoria: CATEGORIAS_ARCHIVO[a.categoria] || a.categoria, tamano_mb: a.tamano_mb, fecha: a.fecha, vista: tipoVista(a.nombre) }));
  } else {
    // La fundamentación (ahora también guardada en «Solicitudes») no debe llegar a Consulta.
    delete out.fundamentacion;
    out.run = ''; out.telefono = '';
  }
  return serializar_(out);
}

/** Estados por los que pasó una solicitud según su bitácora (siempre incluye «recibida»). */
function estadosVisitados_(bitacora) {
  const v = ['recibida'];
  bitacora.forEach(b => { if (b.tipo === 'estado' && b.estado_nuevo && v.indexOf(b.estado_nuevo) < 0) v.push(b.estado_nuevo); });
  return v;
}

/**
 * Vuelve a un paso anterior del trámite (uno por el que la solicitud ya pasó). No envía correo; exige motivo y queda en la bitácora.
 * Deshacer un V°B° ya dado (volver a «V°B°» o antes) solo lo puede hacer el Vicedecano/a o una cuenta de administración.
 * Los datos de gestión (STD, comentarios, observación, resolución) se conservan.
 */
function api_retroceder(folio, hacia, motivo) {
  const u = requiere_('edicion');
  motivo = String(motivo || '').trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const s = buscarSolicitud_(folio);
    if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
    if (!estadoPorId(hacia)) throw new Error('Estado no válido.');
    if (hacia === s.estado) throw new Error('La solicitud ya está en ese paso.');
    if (!motivo) throw new Error('Indique el motivo del retroceso.');
    const bit = leer_(HOJAS.bitacora).filter(b => String(b.folio) === String(folio));
    const visitados = estadosVisitados_(bit);
    if (visitados.indexOf(hacia) < 0) throw new Error('Solo se puede volver a un paso por el que esta solicitud ya pasó.');
    const vbDado = visitados.indexOf('aviso_rc') >= 0 || visitados.indexOf('rechazo_vb') >= 0;
    const despuesDelVb = RUTA_PRINCIPAL.indexOf(hacia) > RUTA_PRINCIPAL.indexOf('vb') || hacia === 'rechazo_vb';
    const deshaceVb = vbDado && !despuesDelVb;
    if (deshaceVb && u.rol !== 'Vicedecano/a' && u.nivel !== 'administracion') throw new Error('Volver a un paso anterior al V°B° deshace el V°B° ya dado: solo puede hacerlo el Vicedecano/a o una cuenta de administración.');
    const ahora = new Date();
    actualizar_(HOJAS.solicitudes, s._fila, { estado: hacia, estado_desde: ahora, recordatorios: 0, ultimo_recordatorio: '', actualizado: ahora }, s.folio);
    anexar_(HOJAS.bitacora, {
      fecha: ahora, folio: folio, tipo: 'estado', quien: u.correo,
      texto: 'Retroceso: ' + estadoPorId(s.estado).etiqueta + ' → ' + estadoPorId(hacia).etiqueta + ' · Motivo: ' + motivo + (deshaceVb ? ' · Deshace el V°B° registrado' : '') + ' · Sin correo.',
      estado_nuevo: hacia
    });
    return { ok: true, deshaceVb: deshaceVb };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Elimina una solicitud (solo administración, con motivo). Se borra su fila de «Solicitudes» y sus registros de «Archivos»; la
 * carpeta del expediente va a la papelera de Drive (recuperable 30 días). La bitácora del folio se conserva como registro, con una
 * entrada final que resume lo eliminado. La fila de la hoja de respuestas (si la había) no se toca: queda «sin solicitud» y se
 * puede volver a importar.
 */
function api_eliminarSolicitud(folio, motivo) {
  const u = requiere_('administracion');
  motivo = String(motivo || '').trim();
  if (!motivo) throw new Error('Indique el motivo de la eliminación.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const s = buscarSolicitud_(folio);
    if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
    const archivos = archivosDe_(folio);
    borrarFilas_(HOJAS.archivos, archivos.map(a => a._fila));
    if (s.carpeta_id) { try { DriveApp.getFolderById(s.carpeta_id).setTrashed(true); } catch (e) { /* ya no estaba */ } }
    borrarFilas_(HOJAS.solicitudes, [s._fila]);
    anexar_(HOJAS.bitacora, {
      fecha: new Date(), folio: folio, tipo: 'sistema', quien: u.correo,
      texto: 'SOLICITUD ELIMINADA por administración · Motivo: ' + motivo + ' · Era: ' + [s.nombres, s.apellido1, s.apellido2].filter(Boolean).join(' ') + ' · ' + s.programa + ' · estado ' + s.estado +
        (s.fila_respuesta ? ' · fila de respuestas ' + s.fila_respuesta + ' (conservada)' : '') + ' · ' + archivos.length + ' archivo(s) registrados; carpeta del expediente en la papelera de Drive.'
    });
    return { ok: true, filaRespuesta: s.fila_respuesta || '' };
  } finally {
    lock.releaseLock();
  }
}

/** Vista previa del recordatorio manual del paso actual (no envía nada). */
function api_previsualizarRecordatorio(folio) {
  const u = requiere_('edicion');
  const s = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  const evento = recordatorioManual(s.estado);
  if (!evento) throw new Error('En el paso «' + estadoPorId(s.estado).etiqueta + '» no se espera respuesta de nadie: no hay recordatorio que enviar.');
  const c = componer_(evento, s, {});
  return serializar_({ evento: evento, descripcion: c.descripcion, estadoEtiqueta: estadoPorId(s.estado).etiqueta, enviados: Number(s.recordatorios || 0), ultimo: s.ultimo_recordatorio || '', correo: c });
}

/**
 * Envía a mano el recordatorio del paso actual (misma plantilla y destinatarios que el automático). Cuenta como recordatorio
 * enviado: la tarea diaria espera `recordatorio_cada_dias` días hábiles desde este envío y respeta `recordatorios_max`.
 */
function api_enviarRecordatorio(folio, envio) {
  const u = requiere_('edicion');
  envio = envio || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const s = buscarSolicitud_(folio);
    if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
    const evento = recordatorioManual(s.estado);
    if (!evento) throw new Error('En el paso «' + estadoPorId(s.estado).etiqueta + '» no hay recordatorio que enviar.');
    const c = componer_(evento, s, {});
    const editado = (envio.asunto && envio.asunto !== c.asunto) || (envio.cuerpo && envio.cuerpo !== c.cuerpo);
    if (envio.asunto) c.asunto = envio.asunto;
    if (envio.cuerpo) c.cuerpo = envio.cuerpo;
    enviar_(c, []);
    const ahora = new Date();
    actualizar_(HOJAS.solicitudes, s._fila, { recordatorios: Number(s.recordatorios || 0) + 1, ultimo_recordatorio: ahora, actualizado: ahora }, s.folio);
    anexar_(HOJAS.bitacora, { fecha: ahora, folio: folio, tipo: 'correo', quien: u.correo, texto: 'Recordatorio enviado a mano: ' + c.descripcion,
      evento: evento, para: c.para.join(', '), cc: c.cc.join(', '), asunto: c.asunto, editado: editado ? 'SÍ' : 'NO' });
    return { ok: true, para: c.para, cc: c.cc };
  } finally {
    lock.releaseLock();
  }
}

/** Vista previa del correo de una transición (no envía nada). */
function api_previsualizar(folio, hacia, campos) {
  const u = requiere_('edicion');
  const s = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  if (!transicionValida(s.estado, hacia)) throw new Error('Transición no permitida: ' + s.estado + ' → ' + hacia + '.');
  const evento = eventoTransicion(s.estado, hacia);
  const base = { desde: s.estado, hacia: hacia, desdeEtiqueta: estadoPorId(s.estado).etiqueta, haciaEtiqueta: estadoPorId(hacia).etiqueta, evento: evento,
    requiereVicedecano: requiereVicedecano(s.estado), esVicedecano: u.rol === 'Vicedecano/a' };
  const requeridos = camposRequeridos(s.estado, hacia);
  if (!evento) return Object.assign(base, { conCorreo: false, requeridos: requeridos });
  const c = componer_(evento, s, campos || {});
  return Object.assign(base, { conCorreo: true, requeridos: requeridos, correo: c });
}

/**
 * Cambia el estado. Orden: validar → enviar correo → escribir estado → bitácora.
 * Si el correo falla, el estado no cambia.
 * envio = { campos: {...}, asunto, cuerpo, adjuntos: [ids] }
 */
function api_cambiarEstado(folio, hacia, envio) {
  const u = requiere_('edicion');
  envio = envio || {};
  const campos = envio.campos || {};
  let avisoVb = null;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const s = buscarSolicitud_(folio);
    if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
    if (!transicionValida(s.estado, hacia)) throw new Error('La solicitud cambió de estado mientras tanto (' + s.estado + '). Recargue el expediente.');
    // V°B°: solo el Vicedecano/a, o la analista si el Vicedecano/a lo dio por otro medio (queda registrado cuál).
    let notaVb = '';
    if (requiereVicedecano(s.estado)) {
      if (u.rol === 'Vicedecano/a') notaVb = ' · V°B° registrado por el Vicedecano/a';
      else {
        if (!envio.otroMedio) throw new Error('El V°B° lo registra el Vicedecano/a. Si lo dio por otro medio, marque «Vicedecano/a aprueba por otro medio».');
        const medio = String(campos.otro_medio || '').trim();
        if (!medio) throw new Error('Indique por qué medio y cuándo dio el V°B° el Vicedecano/a.');
        notaVb = ' · V°B° del Vicedecano/a por otro medio (' + medio + '), registrado por ' + u.correo;
      }
    }
    const evento = eventoTransicion(s.estado, hacia);
    camposRequeridos(s.estado, hacia).forEach(k => {
      if (!String(campos[k] || '').trim()) throw new Error('Falta completar «' + k.replace('_', ' ') + '».');
    });
    // Informe de Registro Curricular: exige el N° STD ya registrado y deja generado el PDF del formulario de solicitud.
    let pdfSolicitud = null;
    if (hacia === 'informe_rc') {
      if (!String(s.n_std || '').trim()) throw new Error('Antes de pasar a «Informe de Registro Curricular» registre el N° STD en «Gestión del trámite» y guarde.');
      pdfSolicitud = generarPdfSolicitud_(s, u, 'automático antes de Informe de Registro Curricular');
    }
    const cambios = { estado: hacia, estado_desde: new Date(), recordatorios: 0, ultimo_recordatorio: '', actualizado: new Date() };
    if (campos.motivo) cambios.motivo = campos.motivo;
    if (campos.observacion) cambios.obs_vicedecano = campos.observacion;
    if (campos.propuesta_comite) cambios.propuesta_comite = campos.propuesta_comite;
    if (campos.resolucion) cambios.resolucion = campos.resolucion;
    if (campos.notificacion_rc) cambios.notificacion_rc = campos.notificacion_rc;
    const desdeEtiqueta = estadoPorId(s.estado).etiqueta, haciaEtiqueta = estadoPorId(hacia).etiqueta;
    let registroCorreo = {};
    // «No notificar»: el cambio se registra como hecho, sin enviar el correo (queda constancia en la bitácora).
    const sinCorreo = !!(evento && envio.sinCorreo);
    const notaSinCorreo = sinCorreo ? ' · Sin notificación por correo (decidido por ' + u.correo + ')' +
      (String(envio.motivoSinCorreo || '').trim() ? ': ' + String(envio.motivoSinCorreo).trim() : '') : '';
    if (sinCorreo) {
      registroCorreo = { evento: evento, para: '', cc: '', asunto: '(no enviado)', editado: 'NO' };
    } else if (evento) {
      const c = componer_(evento, s, campos);
      const editado = (envio.asunto && envio.asunto !== c.asunto) || (envio.cuerpo && envio.cuerpo !== c.cuerpo);
      if (envio.asunto) c.asunto = envio.asunto;
      if (envio.cuerpo) c.cuerpo = envio.cuerpo;
      const validos = archivosDe_(folio).map(a => a.archivo_id);
      const adj = (envio.adjuntos || []).filter(id => validos.indexOf(id) >= 0);
      enviar_(c, adj); // si falla, lanza y no se toca el estado
      registroCorreo = { evento: evento, para: c.para.join(', '), cc: c.cc.join(', '), asunto: c.asunto, editado: editado ? 'SÍ' : 'NO' };
      if (adj.length) registroCorreo.asunto += ' · ' + adj.length + ' adjunto(s)';
    }
    actualizar_(HOJAS.solicitudes, s._fila, cambios, s.folio);
    anexar_(HOJAS.bitacora, Object.assign({
      fecha: new Date(), folio: folio, tipo: 'estado', quien: u.correo,
      texto: desdeEtiqueta + ' → ' + haciaEtiqueta + (campos.motivo ? ' · Motivo: ' + campos.motivo : '') +
        (campos.observacion ? ' · Observación: ' + campos.observacion : '') + (campos.resolucion ? ' · Resolución: ' + campos.resolucion : '') + (campos.comentario ? ' · Comentario: ' + campos.comentario : '') +
        (campos.notificacion_rc ? ' · Notificación a Registro Curricular: ' + campos.notificacion_rc : '') + notaVb + notaSinCorreo,
      estado_nuevo: hacia
    }, registroCorreo));
    // V°B° registrado: aviso automático a la analista del caso (o a quien pueda asignarla), salvo que ella misma lo haya registrado.
    if (requiereVicedecano(s.estado) && u.correo !== String(s.analista || '').toLowerCase()) {
      avisoVb = { sol: buscarSolicitud_(folio), campos: {
        decision_vb: hacia === 'aviso_rc' ? 'CAE admisible' : hacia === 'rechazo_vb' ? 'CAE rechazada' : 'Devolución al programa con observación',
        paso_siguiente: hacia === 'aviso_rc' ? 'notificar a Registro Curricular (pasos a seguir y pagos) y luego informar al estudiante' : hacia === 'rechazo_vb' ? 'registrar la resolución cuando vuelva de Registro Curricular' : 'registrar la nueva solicitud de pronunciamiento al programa vía STD',
        observacion: campos.observacion || '' } };
    }
    return { ok: true, conCorreo: !!evento && !sinCorreo, sinCorreo: sinCorreo, pdfSolicitud: pdfSolicitud, avisoAnalista: !!avisoVb };
  } finally {
    lock.releaseLock();
    if (avisoVb) enviarAutomatico_('vb_dado', avisoVb.sol, avisoVb.campos);
  }
}

/** Campos de gestión que no cambian el estado. Reasignar analista envía el aviso de asignación. */
function api_guardarGestion(folio, campos) {
  const u = requiere_('edicion');
  const permitidos = ['analista', 'n_std', 'comentarios_analista', 'obs_vicedecano', 'propuesta_comite', 'resolucion', 'revisar'];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let reasignada = false, s;
  try {
    s = buscarSolicitud_(folio);
    if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
    const cambios = {}, texto = [];
    permitidos.forEach(k => {
      if (campos[k] === undefined) return;
      const nuevo = k === 'analista' ? String(campos[k]).toLowerCase() : String(campos[k]);
      if (String(s[k] === null ? '' : s[k]) !== nuevo) { cambios[k] = nuevo; texto.push(k.replace('_', ' ')); }
    });
    if (cambios.analista) {
      const c = leer_(HOJAS.cuentas).find(x => String(x.correo).toLowerCase() === cambios.analista && esSi(x.activo));
      if (!c || c.rol !== 'Analista') throw new Error('La persona seleccionada no tiene una cuenta activa con rol Analista.');
      reasignada = true;
      // En «Recibida», la nueva analista recibe sus propios recordatorios de admisibilidad (el plazo sigue contando desde la recepción).
      if (s.estado === 'recibida') { cambios.recordatorios = 0; cambios.ultimo_recordatorio = ''; }
    }
    if (!texto.length) return { ok: true, sinCambios: true };
    const ahora = new Date();
    cambios.actualizado = ahora;
    actualizar_(HOJAS.solicitudes, s._fila, cambios, s.folio);
    // Campos de texto: una entrada por campo con el contenido (lo agregado, o antes → después). Lo demás, en una línea resumen.
    const detallados = Object.keys(ROTULOS_GESTION).filter(k => cambios[k] !== undefined);
    detallados.forEach(k => anexar_(HOJAS.bitacora, { fecha: ahora, folio: folio, tipo: 'gestion', quien: u.correo, texto: describirCambioTexto(k, s[k], cambios[k]) }));
    const resto = texto.filter(t => detallados.indexOf(t.replace(/ /g, '_')) < 0);
    if (resto.length) anexar_(HOJAS.bitacora, { fecha: ahora, folio: folio, tipo: 'sistema', quien: u.correo, texto: 'Actualizado: ' + resto.join(', ') + (reasignada ? ' (→ ' + nombreDe_(cambios.analista) + ')' : '') });
    s = buscarSolicitud_(folio);
  } finally {
    lock.releaseLock();
  }
  if (reasignada) enviarAutomatico_('asignacion', s);
  return { ok: true };
}

function api_anotar(folio, texto) {
  const u = requiere_('edicion');
  const s = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, s)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  const t = String(texto || '').trim();
  if (!t) throw new Error('La nota está vacía.');
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: folio, tipo: 'nota', quien: u.correo, texto: t.slice(0, 5000) });
  return { ok: true };
}
