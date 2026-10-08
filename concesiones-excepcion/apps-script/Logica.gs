/**
 * Logica.gs · Concesiones Académicas de Excepción (CAE)
 * Reglas puras del sistema: sin acceso a Sheets, Drive ni Gmail.
 * Se comparten entre el servidor (Apps Script) y las pruebas en Node (tests/).
 */

/** Máquina de estados. `correo` = plantilla que se envía al entrar al estado ('' = sin correo). */
const ESTADOS = [
  { id: 'recibida',   etiqueta: 'Recibida',                                  fase: 'Admisibilidad', correo: 'recepcion',  siguientes: ['revision'] },
  { id: 'revision',   etiqueta: 'En revisión de admisibilidad',              fase: 'Admisibilidad', correo: '',           siguientes: ['aceptada', 'rechazada', 'no_procede'] },
  { id: 'aceptada',   etiqueta: 'Presentación aceptada',                     fase: 'Tramitación',   correo: 'aceptada',   siguientes: ['informe_rc'] },
  { id: 'informe_rc', etiqueta: 'Informe de Registro Curricular',            fase: 'Tramitación',   correo: '',           siguientes: ['vb_informe'] },
  { id: 'vb_informe', etiqueta: 'V°B° Vicedecano/a al informe',              fase: 'Tramitación',   correo: 'vb_informe', siguientes: ['programa'] },
  { id: 'programa',   etiqueta: 'Pronunciamiento del programa',              fase: 'Tramitación',   correo: 'programa',   siguientes: ['vb'] },
  { id: 'vb',         etiqueta: 'V°B° Vicedecano/a a respuesta del Comité',  fase: 'Tramitación',   correo: 'vb',         siguientes: ['resolucion', 'programa'] },
  { id: 'resolucion', etiqueta: 'Resolución en trámite',                     fase: 'Resolución',    correo: 'registro',   siguientes: ['resuelto', 'negado'] },
  { id: 'resuelto',   etiqueta: 'Resuelto',                                  fase: 'Cierre',        correo: 'resuelto',   siguientes: [] },
  { id: 'rechazada',  etiqueta: 'Presentación rechazada',                    fase: 'Cierre',        correo: 'rechazada',  siguientes: [] },
  { id: 'no_procede', etiqueta: 'No procede · vía Registro Curricular',      fase: 'Cierre',        correo: 'no_procede', siguientes: [] },
  { id: 'negado',     etiqueta: 'Negado',                                    fase: 'Cierre',        correo: 'negado',     siguientes: [] }
];

/** Datos que la persona debe escribir en el diálogo antes de enviar cada correo. */
const CAMPOS_REQUERIDOS = {
  rechazada: ['motivo'],
  devolucion: ['observacion'],
  vb: ['propuesta_comite'],
  resuelto: ['resolucion'],
  negado: ['resolucion']
};

const TIPOS_CATALOGO = [
  'Reincorporación Simple', 'Reincorporación para Requisito de Graduación', 'Prórroga de Periodo Lectivo',
  'Retiro Temporal sin expresión de causa', 'Retiro Temporal con expresión de causa', 'Convalidación de Asignaturas',
  'Cursar Asignatura Sin o Junto con el Requisito', 'Cursar Asignatura por Tutoría', 'Renuncia'
];

const NIVELES = ['sin_acceso', 'consulta', 'edicion', 'administracion'];
const ROLES = ['Analista', 'Vicedecano/a', 'Registro Curricular', 'Consulta'];

function estadoPorId(id) {
  return ESTADOS.find(e => e.id === id) || null;
}

function esCierre(id) {
  const e = estadoPorId(id);
  return !!e && e.siguientes.length === 0;
}

function transicionValida(desde, hacia) {
  const e = estadoPorId(desde);
  return !!e && e.siguientes.indexOf(hacia) >= 0;
}

/** Plantilla que dispara una transición. Devolver al programa desde el V°B° no reenvía la remisión inicial. */
function eventoTransicion(desde, hacia) {
  if (desde === 'vb' && hacia === 'programa') return 'devolucion';
  const e = estadoPorId(hacia);
  return e ? e.correo : '';
}

/** Folio canónico NN/AAAA. Acepta '01 /2025', '8 / 2026' o una fecha (Sheets convierte '01/2026' en 1-ene-2026). */
function normalizarFolio(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return pad2(v.getMonth() + 1) + '/' + v.getFullYear();
  }
  const m = String(v).match(/^\s*(\d+)\s*\/\s*(\d{4})\s*$/);
  return m ? pad2(Number(m[1])) + '/' + m[2] : String(v).trim();
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Siguiente correlativo del año, a partir de los folios existentes. */
function siguienteFolio(folios, anio) {
  let max = 0;
  folios.forEach(f => {
    const m = String(f || '').match(/^(\d+)\/(\d{4})$/);
    if (m && Number(m[2]) === Number(anio)) max = Math.max(max, Number(m[1]));
  });
  return pad2(max + 1) + '/' + anio;
}

/**
 * Regla de migración (decisión del Vicedecanato, 08.10.2026): vale el último estado registrado,
 * leyendo de derecha a izquierda ESTADO ACTUAL → ESTADO → Estado de Presentación.
 */
function estadoMigrado(presentacion, estado, actual, comentarios) {
  const crudo = [actual, estado, presentacion].map(x => String(x === null || x === undefined ? '' : x).trim()).find(x => x !== '') || '';
  const k = crudo.toLowerCase();
  const mapa = {
    'resuelto': 'resuelto', 'negado': 'negado', 'no procede': 'no_procede', 'rechazado': 'rechazada',
    'programa': 'programa', 'aprobado': 'aceptada', 'aprobado con observación': 'aceptada', 'en revisión': 'revision'
  };
  const notas = [];
  let id = crudo === '' ? 'recibida' : mapa[k];
  let revisar = false;
  if (!id) {
    // «En trámite» u otro valor que no dice en qué fase está.
    id = String(presentacion || '').trim().toLowerCase().indexOf('aprobado') === 0 ? 'aceptada' : 'revision';
    revisar = true;
    notas.push('«' + crudo + '» no distingue la fase; se asignó «' + id + '» provisoriamente.');
  }
  const txt = String(comentarios || '').toLowerCase();
  if (id === 'rechazada' && (txt.indexOf('registro') >= 0 || /\brc\b/.test(txt))) {
    revisar = true;
    notas.push('Por regla queda «rechazada», pero los comentarios indican derivación a Registro Curricular («no_procede»).');
  }
  return { estado: id, revisar: revisar, nota: notas.join(' ') };
}

/** Separa lo marcado en «Solicito autorización para» entre tipos del catálogo y texto libre. */
function separarTipos(texto, catalogo) {
  const cat = catalogo || TIPOS_CATALOGO;
  const partes = String(texto || '').split(',').map(t => t.trim()).filter(Boolean);
  return {
    catalogo: partes.filter(t => cat.indexOf(t) >= 0).join(', '),
    libre: partes.filter(t => cat.indexOf(t) < 0).join(', ')
  };
}

/** Reemplaza {variables}. Las variables sin valor quedan visibles para que nadie envíe un correo incompleto sin notarlo. */
function rellenar(texto, vars) {
  return String(texto || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null && vars[k] !== '') ? String(vars[k]) : m);
}

function variablesSinResolver(texto) {
  const out = [];
  String(texto || '').replace(/\{(\w+)\}/g, (m, k) => { if (out.indexOf(k) < 0) out.push(k); return m; });
  return out;
}

function listaRoles(s) {
  return String(s || '').split(',').map(x => x.trim()).filter(Boolean);
}

function esSi(v) {
  return String(v || '').trim().toUpperCase().replace('Í', 'I') === 'SI';
}

/**
 * Traduce roles a direcciones. ctx = { solicitud, cuentas, programas, evento }.
 * Devuelve { para, cc, faltantes } con direcciones únicas y sin cuentas inactivas.
 */
function resolverDestinatarios(rolesPara, rolesCc, ctx) {
  const faltantes = [];
  const activas = (ctx.cuentas || []).filter(c => esSi(c.activo) && c.correo);
  const porRol = rol => {
    const s = ctx.solicitud || {};
    if (rol === 'Estudiante') return s.correo ? [s.correo] : (faltantes.push('correo del estudiante'), []);
    if (rol === 'Analista') return s.analista ? [s.analista] : (faltantes.push('analista asignada/o'), []);
    if (rol === 'Equipo') {
      // Toda cuenta activa con acceso al panel (consulta, edición o administración).
      const r = activas.filter(c => c.nivel && c.nivel !== 'sin_acceso').map(c => c.correo);
      if (!r.length) faltantes.push('cuentas activas con acceso al panel');
      return r;
    }
    if (rol === 'Analistas') {
      const r = activas.filter(c => c.rol === 'Analista').map(c => c.correo);
      if (!r.length) faltantes.push('cuentas activas con rol «Analista»');
      return r;
    }
    if (rol === 'Dirección de programa') {
      const p = (ctx.programas || []).find(x => x.programa === s.programa);
      return p && p.correo_direccion && p.correo_direccion.indexOf('@') > 0 ? [p.correo_direccion] : (faltantes.push('correo de dirección de «' + s.programa + '»'), []);
    }
    const r = activas.filter(c => c.rol === rol).map(c => c.correo);
    if (!r.length) faltantes.push('cuenta activa con rol «' + rol + '»');
    return r;
  };
  const para = [], cc = [];
  listaRoles(rolesPara).forEach(r => porRol(r).forEach(x => para.push(x)));
  listaRoles(rolesCc).forEach(r => porRol(r).forEach(x => cc.push(x)));
  if (ctx.evento) {
    activas.filter(c => listaRoles(c.recibe_eventos).indexOf(ctx.evento) >= 0).forEach(c => cc.push(c.correo));
  }
  const norm = x => String(x).trim().toLowerCase();
  const paraU = unicos(para.map(norm));
  const ccU = unicos(cc.map(norm)).filter(x => paraU.indexOf(x) < 0);
  return { para: paraU, cc: ccU, faltantes: unicos(faltantes) };
}

function unicos(a) {
  return a.filter((x, i) => x && a.indexOf(x) === i);
}

/** Días hábiles transcurridos después de `desde` hasta `hasta` (lunes a viernes, sin feriados 'AAAA-MM-DD'). */
function diasHabilesEntre(desde, hasta, feriados) {
  const f = new Set(feriados || []);
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  let n = 0;
  while (d < fin) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    const iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    if (dia !== 0 && dia !== 6 && !f.has(iso)) n++;
  }
  return n;
}

/** ¿Corresponde enviar un recordatorio al programa? */
function necesitaRecordatorio(sol, hoy, p, feriados) {
  if (sol.estado !== 'programa' || !sol.estado_desde) return false;
  const enviados = Number(sol.recordatorios || 0);
  if (enviados >= Number(p.recordatorios_max || 0)) return false;
  const desdeUltimo = sol.ultimo_recordatorio ? new Date(sol.ultimo_recordatorio) : null;
  if (!desdeUltimo) return diasHabilesEntre(new Date(sol.estado_desde), hoy, feriados) > Number(p.plazo_programa_dias || 2);
  return diasHabilesEntre(desdeUltimo, hoy, feriados) >= Number(p.recordatorio_cada_dias || 2);
}

function nivelSuficiente(nivel, requerido) {
  return NIVELES.indexOf(nivel) >= NIVELES.indexOf(requerido) && NIVELES.indexOf(requerido) >= 0;
}

/** Una cuenta con programas = 'todos' (o vacío) ve todo; si no, solo los programas listados. */
function puedeVerSolicitud(cuenta, sol) {
  const p = String(cuenta.programas || '').trim().toLowerCase();
  if (!p || p === 'todos') return true;
  return String(cuenta.programas).split(';').map(x => x.trim()).indexOf(sol.programa) >= 0;
}

/**
 * Valida una cuenta nueva o editada. `cuentas` es la matriz actual, `duenia` el correo fijo de administración.
 * Devuelve un mensaje de error o ''.
 */
function validarCuenta(c, cuentas, duenia, esNueva) {
  const correo = String(c.correo || '').trim().toLowerCase();
  if (!/^[^@\s]+@usach\.cl$/.test(correo)) return 'El correo debe ser una cuenta @usach.cl.';
  if (!String(c.nombre || '').trim()) return 'Falta el nombre.';
  if (ROLES.indexOf(c.rol) < 0) return 'Rol no válido.';
  if (NIVELES.indexOf(c.nivel) < 0) return 'Nivel no válido.';
  const existe = cuentas.some(x => String(x.correo).toLowerCase() === correo);
  if (esNueva && existe) return 'Ya existe una cuenta con ese correo.';
  if (!esNueva && !existe) return 'La cuenta no existe.';
  if (correo === String(duenia).toLowerCase()) return 'La cuenta institucional dueña no se edita desde la matriz.';
  // No dejar el sistema sin administración humana activa.
  const adminsTras = cuentas
    .map(x => String(x.correo).toLowerCase() === correo ? c : x)
    .concat(esNueva ? [c] : [])
    .filter(x => x.nivel === 'administracion' && esSi(x.activo) && String(x.correo).toLowerCase() !== String(duenia).toLowerCase());
  if (!adminsTras.length) return 'Debe quedar al menos una cuenta activa con nivel Administración.';
  return '';
}

if (typeof module !== 'undefined') {
  module.exports = {
    ESTADOS, CAMPOS_REQUERIDOS, TIPOS_CATALOGO, NIVELES, ROLES, estadoPorId, esCierre, transicionValida, eventoTransicion,
    normalizarFolio, siguienteFolio, estadoMigrado, separarTipos, rellenar, variablesSinResolver, resolverDestinatarios,
    diasHabilesEntre, necesitaRecordatorio, nivelSuficiente, puedeVerSolicitud, validarCuenta, esSi, listaRoles
  };
}
