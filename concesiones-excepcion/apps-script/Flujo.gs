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
  // La fundamentación y los archivos (pueden contener datos de salud) solo para Edición o superior.
  out.verDetalle = nivelSuficiente(u.nivel, 'edicion');
  if (out.verDetalle) {
    out.fundamentacion = s.fundamentacion || (s.fila_respuesta ? leerRespuesta_(s.fila_respuesta).fundamentacion : '');
    out.archivos = archivosDe_(folio).map(a => ({ id: a.archivo_id, nombre: a.nombre, categoria: CATEGORIAS_ARCHIVO[a.categoria] || a.categoria, tamano_mb: a.tamano_mb, fecha: a.fecha, vista: tipoVista(a.nombre) }));
  } else {
    // La fundamentación (ahora también guardada en «Solicitudes») no debe llegar a Consulta.
    delete out.fundamentacion;
    out.run = ''; out.telefono = '';
  }
  return serializar_(out);
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
    const cambios = { estado: hacia, estado_desde: new Date(), recordatorios: 0, ultimo_recordatorio: '', actualizado: new Date() };
    if (campos.motivo) cambios.motivo = campos.motivo;
    if (campos.observacion) cambios.obs_vicedecano = campos.observacion;
    if (campos.propuesta_comite) cambios.propuesta_comite = campos.propuesta_comite;
    if (campos.resolucion) cambios.resolucion = campos.resolucion;
    const desdeEtiqueta = estadoPorId(s.estado).etiqueta, haciaEtiqueta = estadoPorId(hacia).etiqueta;
    let registroCorreo = {};
    if (evento) {
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
    actualizar_(HOJAS.solicitudes, s._fila, cambios);
    anexar_(HOJAS.bitacora, Object.assign({
      fecha: new Date(), folio: folio, tipo: 'estado', quien: u.correo,
      texto: desdeEtiqueta + ' → ' + haciaEtiqueta + (campos.motivo ? ' · Motivo: ' + campos.motivo : '') +
        (campos.observacion ? ' · Observación: ' + campos.observacion : '') + (campos.resolucion ? ' · Resolución: ' + campos.resolucion : '') + notaVb,
      estado_nuevo: hacia
    }, registroCorreo));
    return { ok: true, conCorreo: !!evento };
  } finally {
    lock.releaseLock();
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
    cambios.actualizado = new Date();
    actualizar_(HOJAS.solicitudes, s._fila, cambios);
    anexar_(HOJAS.bitacora, { fecha: new Date(), folio: folio, tipo: 'sistema', quien: u.correo, texto: 'Actualizado: ' + texto.join(', ') + (reasignada ? ' (→ ' + nombreDe_(cambios.analista) + ')' : '') });
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
