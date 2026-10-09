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
    feriados: estadoFeriados_()
  });
}

function api_guardarPrograma(p, esNuevo) {
  const u = requiere_('administracion');
  const nombre = String(p.programa || '').trim();
  if (!nombre) throw new Error('Falta el nombre del programa.');
  const correo = String(p.correo_direccion || '').trim().toLowerCase();
  if (correo && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(correo)) throw new Error('Correo de dirección no válido.');
  const fila = { programa: nombre, correo_direccion: correo, analista: String(p.analista || '').toLowerCase(), activo: esSi(p.activo) ? 'SÍ' : 'NO' };
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
      return {
        folio: s.folio, programa: s.programa, anio: s.anio, semestre: s.semestre,
        tipo: [s.tipo_catalogo, s.tipo_texto_libre].filter(Boolean).join(', '),
        estado: visible, estadoEtiqueta: e.etiqueta, fecha_recepcion: s.fecha_recepcion,
        hitos: bit.filter(b => String(b.folio) === String(s.folio) && b.estado_nuevo && !OCULTOS_AL_ESTUDIANTE[b.estado_nuevo]).map(b => ({ fecha: b.fecha, estado: b.estado_nuevo })),
        analistaNombre: s.analista ? nombreDe_(s.analista, cuentas) : '', analistaCorreo: s.analista || ''
      };
    });
  return serializar_({ identidad: true, correo: correo, solicitudes: lista, estados: ESTADOS });
}
