/**
 * Cuentas.gs · Identidad y privilegios.
 * La identidad la da Google (cuenta USACH con sesión iniciada); los privilegios, la pestaña «Cuentas».
 * Cada llamada del panel vuelve a consultar la matriz: un cambio de nivel o una desactivación rige de inmediato.
 */

function duenia_() {
  return (propiedad_('DUENIA') || Session.getEffectiveUser().getEmail()).toLowerCase();
}

/** Usuario que usa el panel, o null si no tiene acceso. */
function usuarioActual_() {
  const correo = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!correo) return null;
  if (correo === duenia_()) {
    return { correo: correo, nombre: 'Cuenta institucional', rol: 'Vicedecano/a', nivel: 'administracion', programas: 'todos', esDuenia: true };
  }
  const c = leer_(HOJAS.cuentas).find(x => String(x.correo).trim().toLowerCase() === correo);
  if (!c || !esSi(c.activo) || c.nivel === 'sin_acceso') return { correo: correo, nivel: 'sin_acceso' };
  return { correo: correo, nombre: c.nombre, rol: c.rol, nivel: c.nivel, programas: c.programas || 'todos', esDuenia: false };
}

/** Exige un nivel mínimo. Lanza un error legible si no se cumple. */
function requiere_(nivel) {
  const u = usuarioActual_();
  if (!u) throw new Error('SIN_IDENTIDAD: Google no entregó su correo. Ingrese con su cuenta @usach.cl.');
  if (!nivelSuficiente(u.nivel, nivel)) throw new Error('SIN_ACCESO: su cuenta (' + u.correo + ') no tiene el nivel requerido.');
  return u;
}

function nombreDe_(correo, cuentas) {
  const c = (cuentas || leer_(HOJAS.cuentas)).find(x => String(x.correo).toLowerCase() === String(correo || '').toLowerCase());
  return c ? c.nombre : (correo || '');
}

function registrarCuenta_(quien, texto) {
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'cuenta', quien: quien, texto: texto });
}

/** Lista para la pantalla «Cuentas» (solo Administración). */
/** Contexto para resumenCuenta: programas, plantillas, eventos con copia a RC y cuentas. */
function contextoResumen_() {
  return { programas: leer_(HOJAS.programas), plantillas: leer_(HOJAS.plantillas), eventosRC: listaRoles(parametros_().eventos_copia_rc), cuentas: leer_(HOJAS.cuentas) };
}

/** Qué vería y qué recibiría una cuenta tal como está en el formulario (antes de guardar). */
function api_resumenCuenta(c) {
  requiere_('administracion');
  const cuenta = { correo: String((c || {}).correo || '').trim().toLowerCase(), rol: (c || {}).rol, nivel: (c || {}).nivel, programas: (c || {}).programas,
    activo: esSi((c || {}).activo) ? 'SÍ' : 'NO', recibe_eventos: listaRoles((c || {}).recibe_eventos).join(', ') };
  return serializar_(resumenCuenta(cuenta, contextoResumen_()));
}

function api_cuentas() {
  requiere_('administracion');
  const ctx = contextoResumen_();
  const resumenes = {};
  ctx.cuentas.forEach(c => { resumenes[String(c.correo).trim().toLowerCase()] = resumenCuenta(c, ctx); });
  const correos = ctx.cuentas.map(c => String(c.correo).trim().toLowerCase());
  return serializar_({
    resumenes: resumenes,
    // `fila` identifica la fila en la hoja: es lo que distingue dos registros con el mismo correo (duplicados por doble clic).
    cuentas: ctx.cuentas.map(c => { const o = Object.assign({}, c); o.fila = c._fila; delete o._fila; return o; }),
    duplicadas: unicos(correos.filter((x, i) => correos.indexOf(x) !== i)),
    duenia: duenia_(),
    roles: ROLES,
    niveles: NIVELES,
    eventos: leer_(HOJAS.plantillas).map(p => p.evento),
    eventosDesc: leer_(HOJAS.plantillas).reduce((m, p) => { m[p.evento] = p.descripcion; return m; }, {}),
    rolesRC: ROLES_RC,
    programas: leer_(HOJAS.programas).map(p => p.programa)
  });
}

/** Crea (esNueva = true) o edita una cuenta. */
function api_guardarCuenta(c, esNueva) {
  const u = requiere_('administracion');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cuentas = leer_(HOJAS.cuentas);
    const limpia = {
      correo: String(c.correo || '').trim().toLowerCase(),
      nombre: String(c.nombre || '').trim(),
      rol: c.rol,
      nivel: c.nivel,
      programas: String(c.programas || 'todos').trim() || 'todos',
      activo: esSi(c.activo) ? 'SÍ' : 'NO',
      recibe_eventos: listaRoles(c.recibe_eventos).join(', '),
      notas: String(c.notas || '').trim()
    };
    const error = validarCuenta(limpia, cuentas, duenia_(), !!esNueva);
    if (error) throw new Error(error);
    if (esNueva) {
      limpia.creada_por = u.correo;
      limpia.creada_en = new Date();
      anexar_(HOJAS.cuentas, limpia);
      registrarCuenta_(u.correo, 'Cuenta creada: ' + limpia.correo + ' · ' + limpia.rol + ' · ' + limpia.nivel);
    } else {
      const antes = cuentas.find(x => String(x.correo).toLowerCase() === limpia.correo);
      const cambios = ['nombre', 'rol', 'nivel', 'programas', 'activo', 'recibe_eventos', 'notas']
        .filter(k => String(antes[k] === null ? '' : antes[k]) !== String(limpia[k]))
        .map(k => k + ': «' + antes[k] + '» → «' + limpia[k] + '»');
      if (!cambios.length) return { ok: true, sinCambios: true };
      const fila = {};
      ['nombre', 'rol', 'nivel', 'programas', 'activo', 'recibe_eventos', 'notas'].forEach(k => { fila[k] = limpia[k]; });
      actualizar_(HOJAS.cuentas, antes._fila, fila);
      registrarCuenta_(u.correo, 'Cuenta editada: ' + limpia.correo + ' · ' + cambios.join(' · '));
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Elimina una fila de «Cuentas» (p. ej., un registro duplicado). Se identifica por fila y correo, porque dos registros pueden
 * compartir el correo. No se elimina la cuenta dueña, la propia, ni la última administración activa. Queda en la bitácora.
 */
function api_eliminarCuenta(correo, fila) {
  const u = requiere_('administracion');
  correo = String(correo || '').trim().toLowerCase(); fila = Number(fila);
  if (correo === duenia_()) throw new Error('La cuenta institucional dueña no se elimina.');
  if (correo === u.correo) throw new Error('No puede eliminar su propia cuenta.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cuentas = leer_(HOJAS.cuentas);
    const c = cuentas.find(x => x._fila === fila && String(x.correo).trim().toLowerCase() === correo);
    if (!c) throw new Error('La cuenta ya no está en esa fila (¿se eliminó o cambió la hoja?). Recargue la lista.');
    const restantes = cuentas.filter(x => x !== c);
    if (!restantes.some(x => x.nivel === 'administracion' && esSi(x.activo) && String(x.correo).toLowerCase() !== duenia_()))
      throw new Error('Debe quedar al menos una cuenta activa con nivel Administración.');
    hoja_(HOJAS.cuentas).deleteRow(fila);
    registrarCuenta_(u.correo, 'Cuenta eliminada: ' + correo + ' · ' + c.nombre + ' · ' + c.rol + ' · ' + c.nivel + ' · programas «' + c.programas + '» · copias «' + (c.recibe_eventos || '') + '»' +
      (restantes.some(x => String(x.correo).trim().toLowerCase() === correo) ? ' (quedan otros registros con el mismo correo)' : ''));
    return { ok: true, quedan: restantes.filter(x => String(x.correo).trim().toLowerCase() === correo).length };
  } finally {
    lock.releaseLock();
  }
}

/** Envía a la persona el enlace al panel (opcional, al crear una cuenta). */
function api_avisarCuenta(correo) {
  const u = requiere_('administracion');
  const c = leer_(HOJAS.cuentas).find(x => String(x.correo).toLowerCase() === String(correo).toLowerCase());
  if (!c || !esSi(c.activo)) throw new Error('La cuenta no existe o está inactiva.');
  const p = parametros_();
  MailApp.sendEmail({
    to: c.correo,
    subject: 'Acceso a la plataforma CAE · Vicedecanato de Investigación y Postgrado',
    body: 'Estimado/a ' + c.nombre + ':\n\nSe le ha habilitado el acceso a la plataforma de Concesiones Académicas de Excepción (nivel: ' + c.nivel + ').\n\nIngrese con su cuenta USACH en: ' + ScriptApp.getService().getUrl() + '\n\n' + p.remitente_nombre,
    name: p.remitente_nombre,
    replyTo: u.correo
  });
  registrarCuenta_(u.correo, 'Aviso de acceso enviado a ' + c.correo);
  return { ok: true };
}

/**
 * Vicedecano/a vigente: la cuenta activa con rol «Vicedecano/a» en «Cuentas». Su nombre es el de los correos ({vicedecano}).
 * No se edita en Configuración: se cambia solo en la cuenta (nombre, rol, activo), donde queda registrado quién lo hizo.
 */
function vicedecano_(cuentas) {
  const activas = (cuentas || leer_(HOJAS.cuentas)).filter(x => x.rol === 'Vicedecano/a' && esSi(x.activo));
  const c = activas[0];
  return { nombre: c ? String(c.nombre || '').trim() : '', correo: c ? String(c.correo).toLowerCase() : '', activas: activas.length };
}
