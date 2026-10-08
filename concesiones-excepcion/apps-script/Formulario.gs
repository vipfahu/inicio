/**
 * Formulario.gs · Formulario web para estudiantes (…/exec?v=solicitud).
 *
 * El estudiante ingresa con su cuenta USACH (la publicación web es solo para el dominio); ese correo verificado
 * es el que luego le permite ver su caso en «Seguimiento». Los antecedentes se suben uno a uno a una carpeta
 * temporal privada y, al enviar, se mueven a la carpeta del expediente. La tarea diaria borra lo que quede sin usar.
 */

const MAX_ARCHIVOS_SOLICITUD = 3;
const MAX_MB_SOLICITUD_TOTAL = 20;
const PREFIJO_TEMPORAL = 'CAE-TEMP:';

function correoEstudiante_() {
  const c = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!c) throw new Error('SIN_IDENTIDAD: ingrese con su cuenta @usach.cl para enviar una solicitud.');
  return c;
}

function carpetaTemporal_() {
  return subcarpeta_(carpetaRaiz_(), 'Temporal');
}

/** Datos para dibujar el formulario. */
function api_inicioSolicitud() {
  const correo = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const p = parametros_();
  return {
    identidad: !!correo,
    correo: correo,
    programas: leer_(HOJAS.programas).filter(x => esSi(x.activo)).map(x => x.programa).sort(),
    tipos: TIPOS_CATALOGO,
    anio: new Date().getFullYear(),
    semestre: new Date().getMonth() < 7 ? 'Semestre I' : 'Semestre II',
    maxMbArchivo: Number(p.max_mb_antecedente || 10),
    maxMbTotal: MAX_MB_SOLICITUD_TOTAL,
    maxArchivos: MAX_ARCHIVOS_SOLICITUD
  };
}

/** Sube un archivo de antecedentes a la carpeta temporal. Devuelve su id para incluirlo al enviar. */
function api_subirAntecedente(nombre, mime, base64) {
  const correo = correoEstudiante_();
  const bytes = Utilities.base64Decode(String(base64 || ''));
  const mb = bytes.length / 1048576;
  const max = Number(parametros_().max_mb_antecedente || 10);
  if (!bytes.length) throw new Error('El archivo está vacío.');
  if (mb > max) throw new Error('El archivo pesa ' + mb.toFixed(1) + ' MB; el máximo por archivo es ' + max + ' MB.');
  const limpio = String(nombre || 'antecedente').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 150);
  const f = carpetaTemporal_().createFile(Utilities.newBlob(bytes, mime || 'application/octet-stream', limpio));
  f.setDescription(PREFIJO_TEMPORAL + correo + ':' + Date.now());
  return { id: f.getId(), nombre: limpio, mb: Math.round(mb * 100) / 100 };
}

/** Registra la solicitud. `ids` = archivos devueltos por api_subirAntecedente en esta misma sesión. */
function api_enviarSolicitud(d, ids) {
  const correo = correoEstudiante_();
  const p = parametros_();
  const v = validarSolicitud(d, {
    programas: leer_(HOJAS.programas).filter(x => esSi(x.activo)).map(x => x.programa),
    anio: new Date().getFullYear()
  });
  if (v.error) throw new Error(v.error);

  // Antecedentes: deben ser archivos temporales subidos por esta misma cuenta.
  ids = (Array.isArray(ids) ? ids : []).slice(0, MAX_ARCHIVOS_SOLICITUD + 1);
  if (ids.length > MAX_ARCHIVOS_SOLICITUD) throw new Error('Puede adjuntar hasta ' + MAX_ARCHIVOS_SOLICITUD + ' archivos.');
  const temporal = carpetaTemporal_().getId();
  const archivos = ids.map(id => {
    let f;
    try { f = DriveApp.getFileById(id); } catch (e) { throw new Error('No se encontró un archivo adjunto. Vuelva a agregarlo.'); }
    const propio = String(f.getDescription() || '').indexOf(PREFIJO_TEMPORAL + correo + ':') === 0;
    const enTemporal = (() => { const it = f.getParents(); while (it.hasNext()) if (it.next().getId() === temporal) return true; return false; })();
    if (!propio || !enTemporal) throw new Error('Archivo adjunto no válido. Vuelva a agregarlo.');
    return f;
  });
  const total = archivos.reduce((s, f) => s + f.getSize(), 0) / 1048576;
  if (total > MAX_MB_SOLICITUD_TOTAL) throw new Error('Los antecedentes suman ' + total.toFixed(1) + ' MB; el máximo es ' + MAX_MB_SOLICITUD_TOTAL + ' MB.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let sol;
  try {
    const desde = Date.now() - 86400000;
    const recientes = leer_(HOJAS.solicitudes).filter(s => String(s.correo_verificado).toLowerCase() === correo &&
      s.fecha_recepcion instanceof Date && s.fecha_recepcion.getTime() > desde).length;
    if (recientes >= Number(p.max_solicitudes_dia || 3)) {
      throw new Error('Ya registró ' + recientes + ' solicitudes en las últimas 24 horas. Si necesita agregar información, escriba a la analista indicada en el correo de recepción.');
    }
    sol = crearSolicitud_(Object.assign({}, v.datos, {
      fila_respuesta: '', fecha_recepcion: new Date(), correo_verificado: correo, origen: 'Formulario web'
    }));
  } finally {
    lock.releaseLock();
  }

  const carpeta = carpetaCaso_(sol);
  archivos.forEach(f => {
    f.moveTo(carpeta);
    f.setDescription('Antecedente · solicitud ' + sol.folio);
    anexar_(HOJAS.archivos, {
      fecha: new Date(), folio: sol.folio, archivo_id: f.getId(), nombre: f.getName(), categoria: 'antecedentes_formulario',
      tamano_mb: Math.round(f.getSize() / 10485.76) / 100, subido_por: correo
    });
  });
  avisosNuevaSolicitud_(sol);
  return { folio: sol.folio, correo: sol.correo, archivos: archivos.length };
}

/** Borra los antecedentes temporales que nadie usó (más de 2 días). */
function limpiarTemporales_() {
  let carpeta;
  try { carpeta = carpetaTemporal_(); } catch (e) { return; }
  const limite = Date.now() - 2 * 86400000;
  const it = carpeta.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getDateCreated().getTime() < limite) f.setTrashed(true);
  }
}
