/**
 * Logica.gs · Concesiones Académicas de Excepción (CAE)
 * Reglas puras del sistema: sin acceso a Sheets, Drive ni Gmail.
 * Se comparten entre el servidor (Apps Script) y las pruebas en Node (tests/).
 */

/** Máquina de estados. `correo` = plantilla que se envía al entrar al estado ('' = sin correo). */
const ESTADOS = [
  { id: 'recibida',   etiqueta: 'Recibida',                                  fase: 'Admisibilidad', correo: 'recepcion',  siguientes: ['revision'] },
  { id: 'revision',   etiqueta: 'En revisión de admisibilidad',              fase: 'Admisibilidad', correo: '',           siguientes: ['aceptada', 'rechazada', 'no_procede'] },
  // El id se conserva («aceptada») para no alterar los datos guardados; lo visible es «Admisible para análisis».
  { id: 'aceptada',   etiqueta: 'Admisible para análisis',                   fase: 'Tramitación',   correo: 'aceptada',   siguientes: ['informe_rc'] },
  { id: 'informe_rc', etiqueta: 'Informe de Registro Curricular',            fase: 'Tramitación',   correo: '',           siguientes: ['programa'] },
  // El pronunciamiento se solicita al programa por STD (Sistema de Trazabilidad Documental): aquí solo se registra, sin correo.
  { id: 'programa',   etiqueta: 'Pronunciamiento del programa (solicitado vía STD)', fase: 'Tramitación', correo: '',     siguientes: ['vb'] },
  // Decisión del V°B°: CAE admisible o CAE rechazada (ambas siguen a Registro Curricular por STD, que elabora y distribuye la
  // resolución) con correo al estudiante que informa el estado; o devolución al programa. El cierre no envía correo.
  { id: 'vb',         etiqueta: 'V°B° Vicedecano/a a respuesta del Comité',  fase: 'Tramitación',   correo: 'vb',         siguientes: ['resolucion', 'rechazo_vb', 'programa'] },
  { id: 'resolucion', etiqueta: 'CAE admisible · resolución en tramitación', fase: 'Resolución', correo: 'cae_admisible', siguientes: ['resuelto', 'negado'] },
  { id: 'rechazo_vb', etiqueta: 'CAE rechazada · resolución en tramitación', fase: 'Resolución', correo: 'cae_rechazada', siguientes: ['negado'] },
  { id: 'resuelto',   etiqueta: 'Resuelto',                                  fase: 'Cierre',        correo: '',           siguientes: [] },
  { id: 'rechazada',  etiqueta: 'Presentación rechazada',                    fase: 'Cierre',        correo: 'rechazada',  siguientes: [] },
  { id: 'no_procede', etiqueta: 'No procede · vía Registro Curricular',      fase: 'Cierre',        correo: 'no_procede', siguientes: [] },
  { id: 'negado',     etiqueta: 'Negado',                                    fase: 'Cierre',        correo: '',           siguientes: [] }
];

/** Datos que la persona debe escribir en el diálogo: por correo (evento) o por transición sin correo ('desde>hacia'). */
const CAMPOS_REQUERIDOS = {
  rechazada: ['motivo'],
  'vb>programa': ['observacion'],
  vb: ['propuesta_comite']
  // Cierre (Resuelto / Negado): sin campos obligatorios; admite un comentario opcional para el registro (bitácora).
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
  if (desde === 'vb' && hacia === 'programa') return ''; // devolución al programa: también vía STD, solo se registra
  const e = estadoPorId(hacia);
  return e ? e.correo : '';
}

/** Estados que el estudiante no ve en su seguimiento (se le mostraría el indicado). Hoy ninguno: ve también la CAE rechazada. */
const OCULTOS_AL_ESTUDIANTE = {};

function camposRequeridos(desde, hacia) {
  return CAMPOS_REQUERIDOS[eventoTransicion(desde, hacia)] || CAMPOS_REQUERIDOS[desde + '>' + hacia] || [];
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
/** Cómo se puede mostrar un archivo en el visor del panel, según su nombre. '' = solo descarga. */
const TIPOS_VISTA = [[/\.pdf$/i, 'pdf'], [/\.(png|jpe?g|gif|webp)$/i, 'imagen'], [/\.txt$/i, 'texto'], [/\.(docx?|odt|rtf)$/i, 'word'], [/\.zip$/i, 'zip']];
function tipoVista(nombre) {
  const n = String(nombre || '');
  for (let i = 0; i < TIPOS_VISTA.length; i++) if (TIPOS_VISTA[i][0].test(n)) return TIPOS_VISTA[i][1];
  return '';
}
const MIME_POR_EXT = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf', zip: 'application/zip'
};
function mimePorNombre(nombre) {
  const e = (String(nombre || '').match(/\.([a-z0-9]+)$/i) || [])[1];
  return MIME_POR_EXT[String(e || '').toLowerCase()] || 'application/octet-stream';
}
/** Entradas de un ZIP que el visor lista: sin carpetas ni archivos de sistema (macOS, Windows). */
function entradaZipUtil(nombre) {
  const n = String(nombre || '');
  return !!n && !/\/$/.test(n) && !/(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|\._)/i.test(n);
}

/**
 * «por especial encargo …» según cómo esté escrito el nombre del Vicedecano/a en su cuenta:
 * con grado académico → «del Dr. X» (o «de la Dra. X» si el grado es femenino); sin grado → «de X».
 * El género solo se toma del grado escrito (Dra., Profa.), nunca del nombre.
 */
const GRADOS_FEMENINOS = /^(dra|profa|mgtra|mtra)\.?$/i;
const GRADOS = /^(dr|dra|prof|profa|mg|mgtr|mgtra|mtro|mtra|mag|lic|ph\.?\s?d|phd|ing)\.?$/i;
function encargoDe(nombre) {
  nombre = String(nombre || '').trim();
  if (!nombre) return '';
  const primera = nombre.split(/\s+/)[0].replace(/,$/, '');
  if (GRADOS_FEMENINOS.test(primera)) return 'de la ' + nombre;
  if (GRADOS.test(primera)) return 'del ' + nombre;
  return 'de ' + nombre;
}

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
 * Devuelve { para, cc, faltantes, omitidos } con direcciones únicas y sin cuentas inactivas. Lo que falta en «Para» bloquea el
 * envío (faltantes); lo que falta en la copia, por ejemplo un programa sin correo de dirección, no lo bloquea (omitidos).
 */
function resolverDestinatarios(rolesPara, rolesCc, ctx) {
  const faltantes = [], omitidos = [];
  let registro = faltantes; // en la copia (CC) lo que falta no bloquea: se omite y se avisa
  const activas = (ctx.cuentas || []).filter(c => esSi(c.activo) && c.correo);
  const porRol = rol => {
    const s = ctx.solicitud || {};
    if (rol === 'Estudiante') {
      // La cuenta con que inició sesión (verificada por Google) y el correo que escribió en el formulario; si coinciden, una sola vez.
      const r = unicos([s.correo_verificado, s.correo].map(x => String(x || '').trim().toLowerCase()).filter(Boolean));
      if (!r.length) registro.push('correo del estudiante');
      return r;
    }
    if (rol === 'Analista') return s.analista ? [s.analista] : (registro.push('analista asignada/o'), []);
    if (rol === 'Equipo') {
      // Toda cuenta activa con acceso al panel (consulta, edición o administración).
      const r = activas.filter(c => c.nivel && c.nivel !== 'sin_acceso').map(c => c.correo);
      if (!r.length) registro.push('cuentas activas con acceso al panel');
      return r;
    }
    if (rol === 'Analista o equipo') {
      // La analista asignada; si aún no hay, quienes pueden asignarla (cuentas activas con nivel edición o administración).
      if (s.analista) return [s.analista];
      const r = activas.filter(c => c.nivel === 'edicion' || c.nivel === 'administracion').map(c => c.correo);
      if (!r.length) registro.push('cuentas activas con nivel edición o administración');
      return r;
    }
    if (rol === 'Analistas') {
      const r = activas.filter(c => c.rol === 'Analista').map(c => c.correo);
      if (!r.length) registro.push('cuentas activas con rol «Analista»');
      return r;
    }
    if (rol === 'Dirección de programa') {
      const p = (ctx.programas || []).find(x => x.programa === s.programa);
      return p && p.correo_direccion && p.correo_direccion.indexOf('@') > 0 ? [p.correo_direccion] : (registro.push('correo de dirección de «' + s.programa + '»'), []);
    }
    const r = activas.filter(c => c.rol === rol).map(c => c.correo);
    if (!r.length) registro.push('cuenta activa con rol «' + rol + '»');
    return r;
  };
  const para = [], cc = [];
  listaRoles(rolesPara).forEach(r => porRol(r).forEach(x => para.push(x)));
  registro = omitidos;
  listaRoles(rolesCc).forEach(r => porRol(r).forEach(x => cc.push(x)));
  if (ctx.evento) {
    activas.filter(c => listaRoles(c.recibe_eventos).indexOf(ctx.evento) >= 0).forEach(c => cc.push(c.correo));
  }
  const norm = x => String(x).trim().toLowerCase();
  const paraU = unicos(para.map(norm));
  const ccU = unicos(cc.map(norm)).filter(x => paraU.indexOf(x) < 0);
  return { para: paraU, cc: ccU, faltantes: unicos(faltantes), omitidos: unicos(omitidos) };
}

function unicos(a) {
  return a.filter((x, i) => x && a.indexOf(x) === i);
}

/** Días hábiles (lunes a viernes) transcurridos después de `desde` hasta `hasta`. `feriados`: lista 'AAAA-MM-DD' (automática, ver Feriados.gs). */
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

/**
 * Feriados ('AAAA-MM-DD', ordenados, sin repetir) a partir de los eventos de día completo de un calendario de feriados.
 * Cada evento: { inicio: 'AAAA-MM-DD', fin: 'AAAA-MM-DD' (exclusivo), titulo, descripcion }. Se excluyen las conmemoraciones u
 * observancias que el calendario marca en la descripción (no son días inhábiles).
 */
function feriadosDesdeEventos(eventos) {
  const noFeriado = /observance|observancia|celebraci[oó]n|conmemoraci[oó]n/i;
  const out = [];
  (eventos || []).forEach(e => {
    if (!e || !e.inicio || noFeriado.test(String(e.descripcion || ''))) return;
    const [a, m, d] = e.inicio.split('-').map(Number);
    const dia = new Date(a, m - 1, d);
    const iso = () => dia.getFullYear() + '-' + pad2(dia.getMonth() + 1) + '-' + pad2(dia.getDate());
    const fin = e.fin && e.fin > e.inicio ? e.fin : ''; // exclusivo; eventos de varios días
    do { out.push(iso()); dia.setDate(dia.getDate() + 1); } while (fin && iso() < fin);
  });
  return unicos(out).sort();
}

/** Fecha que resulta de sumar n días hábiles (lunes a viernes) a una fecha. */
function sumarDiasHabiles(desde, n, feriados) {
  const f = new Set(feriados || []);
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  let k = 0;
  while (k < n) {
    d.setDate(d.getDate() + 1);
    const iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    if (d.getDay() !== 0 && d.getDay() !== 6 && !f.has(iso)) k++;
  }
  return d;
}

/**
 * Recordatorios internos (días hábiles desde que el caso entró al estado). `primero` es el parámetro con los días
 * del primer aviso; `alCumplir` = el aviso sale al cumplirse esos días (si no, al superarlos, es decir, plazo vencido).
 *  - recibida: primer aviso al día hábil siguiente a la recepción (primer_aviso_admisibilidad_dias), antes de que venza
 *    el plazo de admisibilidad (plazo_admisibilidad_dias);
 *  - programa: pronunciamiento pendiente (solicitado por STD), una vez vencido plazo_programa_dias: a la dirección de
 *    programa, con copia a la analista.
 */
const RECORDATORIOS = {
  recibida: { evento: 'recordatorio_admisibilidad', primero: 'primer_aviso_admisibilidad_dias', porDefecto: 1, alCumplir: true },
  programa: { evento: 'recordatorio', primero: 'plazo_programa_dias', porDefecto: 2, alCumplir: false },
  vb: { evento: 'recordatorio_vb', primero: 'plazo_vb_dias', porDefecto: 2, alCumplir: false }
};

/** Las salidas del V°B° (admisible, rechazada, devolución) las registra solo el Vicedecano/a, salvo V°B° dado por otro medio. */
function requiereVicedecano(desde) {
  return desde === 'vb';
}

/** Evento de recordatorio que corresponde enviar hoy, o '' si ninguno. */
function recordatorioPendiente(sol, hoy, p, feriados) {
  const r = RECORDATORIOS[sol.estado];
  return r && necesitaRecordatorio(sol, hoy, p, feriados) ? r.evento : '';
}

function necesitaRecordatorio(sol, hoy, p, feriados) {
  const r = RECORDATORIOS[sol.estado];
  if (!r || !sol.estado_desde) return false;
  const enviados = Number(sol.recordatorios || 0);
  if (enviados >= Number(p.recordatorios_max || 0)) return false;
  const desdeUltimo = sol.ultimo_recordatorio ? new Date(sol.ultimo_recordatorio) : null;
  if (!desdeUltimo) {
    const dias = diasHabilesEntre(new Date(sol.estado_desde), hoy, feriados);
    const n = p[r.primero] === undefined || p[r.primero] === '' ? r.porDefecto : Number(p[r.primero]);
    return r.alCumplir ? dias >= n : dias > n;
  }
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

/**
 * Valida y normaliza una solicitud enviada desde el formulario web.
 * ctx = { programas: [nombres activos], anio: año actual }. Devuelve { error } o { datos }.
 */
/**
 * RUN chileno: valida el dígito verificador (módulo 11) y devuelve el formato «12.345.678-9», o '' si no es válido.
 * Acepta puntos, guion, espacios y «k» minúscula.
 */
function normalizarRun(v) {
  const s = String(v || '').toUpperCase().replace(/[^0-9K]/g, '');
  const cuerpo = s.slice(0, -1), dv = s.slice(-1);
  if (!/^\d{7,8}$/.test(cuerpo) || !/^[0-9K]$/.test(dv) || /^0/.test(cuerpo)) return '';
  let suma = 0, m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (suma % 11);
  const esperado = r === 11 ? '0' : r === 10 ? 'K' : String(r);
  return dv === esperado ? cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv : '';
}

/** Pasaporte: letras y números (5 a 20), sin espacios ni guiones; '' si no es válido. */
function normalizarPasaporte(v) {
  const s = String(v || '').toUpperCase().replace(/[\s.\-]/g, '');
  return /^[A-Z0-9]{5,20}$/.test(s) ? s : '';
}

function validarSolicitud(d, ctx) {
  d = d || {};
  const t = (k, max) => String(d[k] === undefined || d[k] === null ? '' : d[k]).trim().slice(0, max || 200);
  const datos = {
    apellido1: t('apellido1', 80), apellido2: t('apellido2', 80), nombres: t('nombres', 120), run: t('run', 30),
    telefono: t('telefono', 30), correo: t('correo', 120).toLowerCase(), programa: t('programa', 200),
    anio: Number(d.anio), semestre: t('semestre', 20), otro: t('otro', 300), fundamentacion: t('fundamentacion', 8000)
  };
  const tipos = (Array.isArray(d.tipos) ? d.tipos : []).map(x => String(x).trim()).filter(x => TIPOS_CATALOGO.indexOf(x) >= 0);
  datos.tipo_catalogo = unicos(tipos).join(', ');
  datos.tipo_texto_libre = datos.otro;
  const faltan = [['apellido1', 'primer apellido'], ['apellido2', 'segundo apellido'], ['nombres', 'nombres'], ['run', 'RUN o pasaporte'],
    ['telefono', 'teléfono'], ['correo', 'correo electrónico'], ['programa', 'programa'], ['fundamentacion', 'fundamentación']]
    .filter(x => !datos[x[0]]).map(x => x[1]);
  if (faltan.length) return { error: 'Complete: ' + faltan.join(', ') + '.' };
  datos.tipo_documento = String(d.tipo_documento || 'RUN') === 'Pasaporte' ? 'Pasaporte' : 'RUN';
  if (datos.tipo_documento === 'RUN') {
    const run = normalizarRun(datos.run);
    if (!run) return { error: 'El RUN no es válido. Revise los números y el dígito verificador (ej.: 12.345.678-5). Si no tiene RUN, elija «Pasaporte».' };
    datos.run = run;
  } else {
    const pas = normalizarPasaporte(datos.run);
    if (!pas) return { error: 'El número de pasaporte no es válido (solo letras y números, entre 5 y 20 caracteres).' };
    datos.run = pas;
  }
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(datos.correo)) return { error: 'El correo electrónico no es válido.' };
  if ((ctx.programas || []).indexOf(datos.programa) < 0) return { error: 'Seleccione un programa de la lista.' };
  if (!(datos.anio >= ctx.anio - 1 && datos.anio <= ctx.anio + 1)) return { error: 'El año debe estar entre ' + (ctx.anio - 1) + ' y ' + (ctx.anio + 1) + '.' };
  if (['Semestre I', 'Semestre II'].indexOf(datos.semestre) < 0) return { error: 'Seleccione el semestre.' };
  if (!datos.tipo_catalogo && !datos.tipo_texto_libre) return { error: 'Indique al menos una autorización solicitada o complete «Otros».' };
  if (datos.fundamentacion.length < 20) return { error: 'La fundamentación es demasiado breve.' };
  delete datos.otro;
  return { datos: datos };
}

if (typeof module !== 'undefined') {
  module.exports = { tipoVista, mimePorNombre, entradaZipUtil, encargoDe, requiereVicedecano, normalizarRun, normalizarPasaporte, feriadosDesdeEventos, OCULTOS_AL_ESTUDIANTE, sumarDiasHabiles, recordatorioPendiente, RECORDATORIOS, camposRequeridos,
    ESTADOS, CAMPOS_REQUERIDOS, TIPOS_CATALOGO, NIVELES, ROLES, estadoPorId, esCierre, transicionValida, eventoTransicion,
    normalizarFolio, siguienteFolio, estadoMigrado, separarTipos, rellenar, variablesSinResolver, resolverDestinatarios,
    diasHabilesEntre, necesitaRecordatorio, nivelSuficiente, puedeVerSolicitud, validarCuenta, esSi, listaRoles, validarSolicitud
  };
}
