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
function api_cuentas() {
  requiere_('administracion');
  return serializar_({
    cuentas: leer_(HOJAS.cuentas).map(c => { const o = Object.assign({}, c); delete o._fila; return o; }),
    duenia: duenia_(),
    roles: ROLES,
    niveles: NIVELES,
    eventos: leer_(HOJAS.plantillas).map(p => p.evento),
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
