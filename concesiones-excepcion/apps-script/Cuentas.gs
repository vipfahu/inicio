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
  let aviso = null;
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
      aviso = { cuenta: limpia, cambios: [] };
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
      // Cambio de perfil (rol, nivel, programas, estado o copias): se avisa a la persona. Nombre y notas no cambian el perfil.
      const perfil = CAMPOS_PERFIL.filter(k => String(antes[k] === null ? '' : antes[k]) !== String(limpia[k]));
      if (perfil.length) aviso = { cuenta: limpia, cambios: perfil.map(k => ({ campo: k, antes: antes[k], despues: limpia[k] })) };
    }
  } finally {
    lock.releaseLock();
  }
  // El aviso sale después de soltar el cerrojo; si falla, la cuenta queda guardada igual y el error queda en la bitácora.
  const notificada = aviso ? notificarCuenta_(aviso.cuenta, aviso.cambios, u) : false;
  return { ok: true, notificada: notificada };
}

/** Campos que definen el perfil de una cuenta: un cambio en cualquiera de ellos se notifica a la persona. */
const CAMPOS_PERFIL = ['rol', 'nivel', 'programas', 'activo', 'recibe_eventos'];
const ROTULO_NIVEL = {
  sin_acceso: 'Sin acceso al panel (solo recibe copias de correos)',
  consulta: 'Consulta (solo lectura: bandeja, panorama e indicadores, sin datos sensibles)',
  edicion: 'Edición (tramita solicitudes)',
  administracion: 'Administración (tramita y además gestiona cuentas, programas y parámetros)'
};
const ROTULO_CAMPO_PERFIL = { rol: 'Rol', nivel: 'Nivel', programas: 'Programas', activo: 'Cuenta activa', recibe_eventos: 'Copias de correos' };

/** Texto del aviso de perfil: perfil vigente y, si los hay, los cambios (antes → ahora). */
function mensajeCuenta_(c, cambios) {
  const activa = esSi(c.activo);
  const url = urlPanel_();
  const nuevo = !cambios || !cambios.length;
  const lineas = [
    'Estimado/a ' + (String(c.nombre || '').trim() || c.correo) + ':', '',
    nuevo ? 'Se le asignó un perfil en la plataforma de Concesiones Académicas de Excepción (CAE) del Vicedecanato de Investigación y Postgrado.'
      : (activa ? 'Se modificó su perfil en la plataforma de Concesiones Académicas de Excepción (CAE) del Vicedecanato de Investigación y Postgrado.'
        : 'Se desactivó su cuenta en la plataforma de Concesiones Académicas de Excepción (CAE) del Vicedecanato de Investigación y Postgrado.'), ''
  ];
  if (!nuevo) {
    lineas.push('Cambios:');
    cambios.forEach(x => lineas.push('- ' + (ROTULO_CAMPO_PERFIL[x.campo] || x.campo) + ': ' + valorPerfil_(x.campo, x.antes) + ' → ' + valorPerfil_(x.campo, x.despues)));
    lineas.push('');
  }
  if (activa) {
    lineas.push('Perfil vigente:', '- Rol: ' + c.rol, '- Nivel: ' + (ROTULO_NIVEL[c.nivel] || c.nivel), '- Programas: ' + valorPerfil_('programas', c.programas));
    if (String(c.recibe_eventos || '').trim()) lineas.push('- Copias de correos: ' + c.recibe_eventos);
    lineas.push('');
    if (c.nivel !== 'sin_acceso' && url) lineas.push('Ingrese con su cuenta USACH en: ' + url, '');
  } else {
    lineas.push('Desde ahora no podrá ingresar al panel ni recibirá copias de correos de la plataforma. Si cree que se trata de un error, responda a este mensaje.', '');
  }
  lineas.push(parametros_().remitente_nombre || 'Vicedecanato de Investigación y Postgrado · FAHU');
  return lineas.join('\n');
}
function valorPerfil_(campo, v) {
  v = String(v === null || v === undefined ? '' : v).trim();
  if (campo === 'nivel') return ROTULO_NIVEL[v] ? ROTULO_NIVEL[v].replace(/ \(.*$/, '') : v;
  if (campo === 'programas') return !v || v.toLowerCase() === 'todos' ? 'Todos' : v.split(';').map(x => x.trim()).join(', ');
  if (campo === 'activo') return esSi(v) ? 'Sí' : 'No';
  return v || '—';
}

/** Envía el aviso de perfil a la persona de la cuenta. Devuelve true si salió. Nunca lanza: el fallo queda en la bitácora. */
function notificarCuenta_(c, cambios, u) {
  const correo = String(c.correo || '').trim().toLowerCase();
  if (!correo || correo === duenia_()) return false;
  const nuevo = !cambios || !cambios.length;
  const asunto = 'Plataforma CAE · ' + (nuevo ? 'perfil asignado' : esSi(c.activo) ? 'cambio en su perfil' : 'cuenta desactivada');
  try {
    MailApp.sendEmail({ to: correo, subject: asunto, body: mensajeCuenta_(c, cambios), name: parametros_().remitente_nombre, replyTo: u.correo });
    registrarCuenta_(u.correo, 'Aviso de perfil enviado a ' + correo + ' (' + asunto.replace('Plataforma CAE · ', '') + ')');
    return true;
  } catch (e) {
    registrarCuenta_(u.correo, 'ERROR · no se envió el aviso de perfil a ' + correo + ': ' + e.message);
    return false;
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
    borrarFilas_(HOJAS.cuentas, [fila]);
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
  if (!notificarCuenta_(c, [], u)) throw new Error('No se pudo enviar el aviso (ver la bitácora).');
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
