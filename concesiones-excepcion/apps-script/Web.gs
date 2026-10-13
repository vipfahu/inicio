/**
 * Web.gs · Puntos de entrada web.
 *   …/exec                 → Panel del equipo (según la matriz «Cuentas»)
 *   …/exec?v=solicitud     → Formulario de solicitud para estudiantes (requiere cuenta USACH)
 *   …/exec?v=seguimiento   → Seguimiento para estudiantes (ven solo sus propias solicitudes)
 * Publicación: «Ejecutar como: yo (cuenta institucional)» · «Quién tiene acceso: cualquier usuario de usach.cl».
 */

function doGet(e) {
  actualizarSiCorresponde_();
  const v = e && e.parameter && e.parameter.v;
  const rutas = {
    seguimiento: ['Seguimiento', 'Seguimiento · Solicitud CAE'],
    solicitud: ['Solicitud', 'Solicitud CAE · Vicedecanato de Investigación y Postgrado FAHU']
  };
  const r = rutas[v] || ['Panel', 'Panel CAE · Vicedecanato de Investigación y Postgrado'];
  const t = HtmlService.createTemplateFromFile(r[0]);
  t.folioInicial = (e && e.parameter && e.parameter.folio) || '';
  t.url = urlPanel_();
  return t.evaluate()
    .setTitle(r[1])
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Datos de arranque del panel. Si la persona no tiene acceso, lo dice sin revelar nada más. */
function api_inicio() {
  const u = usuarioActual_();
  if (!u) return { acceso: false, motivo: 'sin_identidad' };
  if (u.nivel === 'sin_acceso') return { acceso: false, motivo: 'sin_acceso', correo: u.correo };
  const cuentas = leer_(HOJAS.cuentas);
  return serializar_({
    acceso: true,
    usuario: u,
    estados: ESTADOS,
    camposRequeridos: CAMPOS_REQUERIDOS,
    categorias: CATEGORIAS_ARCHIVO,
    analistas: cuentas.filter(c => c.rol === 'Analista' && esSi(c.activo)).map(c => ({ correo: c.correo, nombre: c.nombre })),
    programas: leer_(HOJAS.programas).map(p => p.programa),
    maxMb: Number(parametros_().max_mb_archivo || 20),
    urlSeguimiento: urlPanel_() + '?v=seguimiento'
  });
}

/* ── Configuración (Administración) ── */

function api_config() {
  requiere_('consulta');
  return serializar_({
    programas: leer_(HOJAS.programas).map(p => { const o = Object.assign({}, p); delete o._fila; return o; }),
    parametros: leer_(HOJAS.parametros).filter(p => p.clave !== 'carpeta_raiz_id').map(p => ({ clave: p.clave, valor: p.valor, descripcion: p.descripcion })),
    feriados: estadoFeriados_(),
    analistasRC: leer_(HOJAS.cuentas).filter(c => c.rol === 'Analista de Registro Curricular' && esSi(c.activo)).map(c => ({ correo: String(c.correo).toLowerCase(), nombre: c.nombre })),
    cuentasRC: leer_(HOJAS.cuentas).filter(c => c.rol === 'Cuenta de Registro Curricular del programa' && esSi(c.activo)).map(c => ({ correo: String(c.correo).toLowerCase(), nombre: c.nombre })),
    vicedecano: vicedecano_()
  });
}

function api_guardarPrograma(p, esNuevo) {
  const u = requiere_('administracion');
  const nombre = String(p.programa || '').trim();
  if (!nombre) throw new Error('Falta el nombre del programa.');
  const correo = String(p.correo_direccion || '').trim().toLowerCase();
  if (correo && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(correo)) throw new Error('Correo de dirección no válido.');
  const fila = { programa: nombre, correo_direccion: correo, analista: String(p.analista || '').toLowerCase(), activo: esSi(p.activo) ? 'SÍ' : 'NO',
    analista_rc: String(p.analista_rc || '').trim().toLowerCase(), cuenta_rc: String(p.cuenta_rc || '').trim().toLowerCase() };
  const cuentas = leer_(HOJAS.cuentas);
  // «+ Añadir nueva…» en Configuración: crea (o reactiva) la cuenta de Registro Curricular y la asigna al programa.
  [['analista_rc', 'Analista de Registro Curricular'], ['cuenta_rc', 'Cuenta de Registro Curricular del programa']].forEach(([k, rol]) => {
    const n = p['nuevo_' + k];
    if (!n) return;
    fila[k] = asegurarCuentaRC_(cuentas, n.nombre, n.correo, rol, nombre, u);
  });
  [['analista_rc', 'Analista de Registro Curricular'], ['cuenta_rc', 'Cuenta de Registro Curricular del programa']].forEach(([k, rol]) => {
    if (fila[k] && !cuentas.some(c => String(c.correo).toLowerCase() === fila[k] && c.rol === rol && esSi(c.activo)))
      throw new Error('«' + fila[k] + '» no es una cuenta activa con rol «' + rol + '». Créela primero en Cuentas.');
  });
  const existentes = leer_(HOJAS.programas);
  const actual = existentes.find(x => x.programa === nombre);
  if (esNuevo) {
    if (actual) throw new Error('Ese programa ya existe.');
    anexar_(HOJAS.programas, fila);
  } else {
    if (!actual) throw new Error('El programa no existe.');
    actualizar_(HOJAS.programas, actual._fila, fila);
  }
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: u.correo, texto: 'Programa ' + (esNuevo ? 'agregado' : 'editado') + ': ' + nombre });
  return { ok: true };
}

/**
 * Cuenta de Registro Curricular creada desde Configuración: nivel «Sin acceso» (solo copias) y el programa en «Programas que ve».
 * Si el correo ya tiene cuenta con ese rol, se reactiva y se le suma el programa; si tiene otro rol, se rechaza.
 */
function asegurarCuentaRC_(cuentas, nombreCuenta, correo, rol, programa, u) {
  correo = String(correo || '').trim().toLowerCase();
  nombreCuenta = String(nombreCuenta || '').trim();
  if (!/^[^@\s]+@usach\.cl$/.test(correo)) throw new Error('El correo de la ' + rol.toLowerCase() + ' debe ser una cuenta @usach.cl.');
  const existe = cuentas.find(c => String(c.correo).trim().toLowerCase() === correo);
  if (existe) {
    if (existe.rol !== rol) throw new Error('«' + correo + '» ya tiene una cuenta con rol «' + existe.rol + '». Cámbiela en Cuentas o elija otro correo.');
    const progs = String(existe.programas || '').trim();
    const nuevos = !progs || progs.toLowerCase() === 'todos' ? progs || 'todos'
      : progs.split(';').map(x => x.trim()).indexOf(programa) >= 0 ? progs : progs + '; ' + programa;
    actualizar_(HOJAS.cuentas, existe._fila, { activo: 'SÍ', programas: nuevos });
    registrarCuenta_(u.correo, 'Cuenta ' + correo + ' (' + rol + ') asignada a «' + programa + '» desde Configuración');
    existe.activo = 'SÍ';
    return correo;
  }
  if (!nombreCuenta) throw new Error('Falta el nombre de la ' + rol.toLowerCase() + '.');
  const nueva = { correo: correo, nombre: nombreCuenta, rol: rol, nivel: 'sin_acceso', programas: programa, activo: 'SÍ',
    recibe_eventos: '', creada_por: u.correo, creada_en: new Date(), notas: 'Creada desde Configuración para «' + programa + '»' };
  anexar_(HOJAS.cuentas, nueva);
  cuentas.push(nueva);
  registrarCuenta_(u.correo, 'Cuenta creada desde Configuración: ' + correo + ' · ' + rol + ' · «' + programa + '»');
  return correo;
}

/** Verificación de la migración desde el panel (Administración): resumen y diferencias; el detalle queda en la hoja. */
function api_verificarMigracion() {
  const u = requiere_('administracion');
  const v = verificarMigracion_();
  escribirVerificacion_(v);
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: u.correo, texto: 'Verificación de la migración: ' + v.resumen.diferencias + ' diferencia(s) (' + v.resumen.formulario + ' de formulario, ' + v.resumen.gestion + ' de gestión).' });
  return serializar_({ resumen: v.resumen, diferencias: v.diferencias.slice(0, 300), hoja: HOJA_VERIFICACION });
}

/** Realineación desde el panel (Administración): corrige fila_respuesta por identidad y devuelve el resultado. */
function api_realinearMigracion() {
  const u = requiere_('administracion');
  const r = realinearMigracion_(u.correo);
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: u.correo, texto: 'Realineación de filas migradas: ' + r.realineadas.length + ' corregida(s), ' + r.pendientes.length + ' sin resolver, filas sin solicitud: ' + (r.filasSinSolicitud.join(', ') || 'ninguna') + '.' });
  return serializar_(r);
}

/** Importación desde el panel (Administración) de las filas de la hoja de respuestas que no tienen solicitud. */
function api_importarFilasSinSolicitud() {
  const u = requiere_('administracion');
  return serializar_(importarFilasSinSolicitud_(u.correo));
}

/** Correo de la dirección de un programa: lo puede editar cualquier cuenta con nivel edición (analistas). */
function api_guardarCorreoPrograma(programa, correo) {
  const u = requiere_('edicion');
  const actual = leer_(HOJAS.programas).find(x => x.programa === String(programa || '').trim());
  if (!actual) throw new Error('El programa no existe.');
  const c = String(correo || '').trim().toLowerCase();
  if (c && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(c)) throw new Error('Correo de dirección no válido.');
  if (c === String(actual.correo_direccion || '').toLowerCase()) return { ok: true, sinCambios: true };
  actualizar_(HOJAS.programas, actual._fila, { correo_direccion: c });
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: u.correo,
    texto: 'Correo de dirección de «' + actual.programa + '»: ' + (actual.correo_direccion || '(vacío)') + ' → ' + (c || '(vacío)') });
  return { ok: true };
}

function api_guardarParametros(valores) {
  const u = requiere_('administracion');
  const filas = leer_(HOJAS.parametros);
  const cambiados = [];
  Object.keys(valores || {}).forEach(k => {
    if (k === 'carpeta_raiz_id') return;
    const f = filas.find(x => x.clave === k);
    if (f && String(f.valor) !== String(valores[k])) { actualizar_(HOJAS.parametros, f._fila, { valor: String(valores[k]) }); cambiados.push(k); }
  });
  if (cambiados.length) anexar_(HOJAS.bitacora, { fecha: new Date(), folio: '—', tipo: 'sistema', quien: u.correo, texto: 'Parámetros editados: ' + cambiados.join(', ') });
  return { ok: true };
}

/* ── Seguimiento (estudiantes) ── */

/** Solicitudes cuyo correo verificado por Google coincide con la persona que consulta. Sin notas internas. */
function api_misSolicitudes() {
  const correo = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!correo) return { identidad: false };
  const bit = leer_(HOJAS.bitacora).filter(b => b.tipo === 'estado');
  const cuentas = leer_(HOJAS.cuentas);
  const lista = leer_(HOJAS.solicitudes)
    .filter(s => String(s.correo_verificado || s.correo).trim().toLowerCase() === correo)
    .map(s => {
      // Lo que no se notifica al estudiante tampoco se muestra en su seguimiento.
      const visible = OCULTOS_AL_ESTUDIANTE[s.estado] || s.estado;
      const e = estadoPorId(visible) || {};
      const visitados = bit.filter(b => String(b.folio) === String(s.folio)).map(b => b.estado_nuevo);
      return {
        ruta: rutaProceso(visible, visitados),
        folio: s.folio, programa: s.programa, anio: s.anio, semestre: s.semestre,
        tipo: [s.tipo_catalogo, s.tipo_texto_libre].filter(Boolean).join(', '),
        estado: visible, estadoEtiqueta: e.estudiante || e.etiqueta, fase: e.fase, fecha_recepcion: s.fecha_recepcion,
        hitos: bit.filter(b => String(b.folio) === String(s.folio) && b.estado_nuevo && !OCULTOS_AL_ESTUDIANTE[b.estado_nuevo]).map(b => ({ fecha: b.fecha, estado: b.estado_nuevo })),
        analistaNombre: s.analista ? nombreDe_(s.analista, cuentas) : '', analistaCorreo: s.analista || ''
      };
    });
  return serializar_({ identidad: true, correo: correo, solicitudes: lista, estados: ESTADOS });
}
