/**
 * Archivos.gs · Documentos del expediente en el Drive de la cuenta institucional.
 *
 * Estructura:  Plataforma CAE · NO COMPARTIR / Expedientes / AAAA / NN-AAAA /
 * Las carpetas llevan solo el folio (no el nombre del estudiante) y no se comparten con nadie.
 * Los antecedentes que el estudiante sube al Formulario quedan donde los deja Google Forms;
 * en la carpeta del caso se crea un acceso directo para no romper el vínculo con el Formulario.
 */

const CATEGORIAS_ARCHIVO = {
  antecedentes_formulario: 'Antecedentes (formulario)',
  informe_academico: 'Informe académico (Registro Curricular)',
  acta_comite: 'Acta / respuesta del Comité',
  resolucion: 'Resolución',
  archivo_cae: 'Archivo CAE',
  otro: 'Otro'
};

function carpetaRaiz_() {
  const id = parametros_().carpeta_raiz_id;
  if (!id) throw new Error('Falta la carpeta raíz. Ejecute la instalación.');
  return DriveApp.getFolderById(id);
}

function subcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

/** Carpeta del caso; la crea y la registra si no existe. */
function carpetaCaso_(sol) {
  if (sol.carpeta_id) {
    try { return DriveApp.getFolderById(sol.carpeta_id); } catch (e) { /* se recrea abajo */ }
  }
  const anio = String(sol.folio).split('/')[1] || String(new Date().getFullYear());
  const exp = subcarpeta_(carpetaRaiz_(), 'Expedientes');
  const c = subcarpeta_(subcarpeta_(exp, anio), String(sol.folio).replace('/', '-'));
  actualizar_(HOJAS.solicitudes, sol._fila, { carpeta_id: c.getId() });
  sol.carpeta_id = c.getId();
  return c;
}

/** Ids de Drive presentes en el campo de adjuntos del Formulario («https://drive.google.com/open?id=…», separados por coma). */
function idsDeAdjuntos_(texto) {
  const ids = [];
  String(texto || '').replace(/[?&]id=([\w-]{10,})/g, (m, id) => { ids.push(id); return m; });
  return ids;
}

/** Vincula los antecedentes del Formulario al expediente (acceso directo + registro). */
function vincularAntecedentes_(sol, textoAdjuntos) {
  const carpeta = carpetaCaso_(sol);
  idsDeAdjuntos_(textoAdjuntos).forEach(id => {
    try {
      const f = DriveApp.getFileById(id);
      carpeta.createShortcut(id);
      anexar_(HOJAS.archivos, {
        fecha: new Date(), folio: sol.folio, archivo_id: id, nombre: f.getName(), categoria: 'antecedentes_formulario',
        tamano_mb: Math.round(f.getSize() / 10485.76) / 100, subido_por: 'Formulario'
      });
    } catch (e) {
      anexar_(HOJAS.bitacora, { fecha: new Date(), folio: sol.folio, tipo: 'sistema', quien: 'Sistema', texto: 'ERROR · no se pudo vincular el adjunto ' + id + ': ' + e.message });
    }
  });
}

function archivosDe_(folio) {
  return leer_(HOJAS.archivos).filter(a => String(a.folio) === String(folio));
}

/** Sube un archivo al expediente. El navegador envía el contenido en base64. */
function api_subirArchivo(folio, nombre, mime, base64, categoria) {
  const u = requiere_('edicion');
  const sol = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, sol)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  if (!CATEGORIAS_ARCHIVO[categoria] || categoria === 'antecedentes_formulario') throw new Error('Categoría no válida.');
  const bytes = Utilities.base64Decode(base64);
  const mb = bytes.length / 1048576;
  const max = Number(parametros_().max_mb_archivo || 20);
  if (mb > max) throw new Error('El archivo pesa ' + mb.toFixed(1) + ' MB; el máximo es ' + max + ' MB.');
  const limpio = String(nombre || 'archivo').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 150);
  const f = carpetaCaso_(sol).createFile(Utilities.newBlob(bytes, mime || 'application/octet-stream', limpio));
  anexar_(HOJAS.archivos, {
    fecha: new Date(), folio: folio, archivo_id: f.getId(), nombre: limpio, categoria: categoria,
    tamano_mb: Math.round(mb * 100) / 100, subido_por: u.correo
  });
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: folio, tipo: 'archivo', quien: u.correo, texto: 'Archivo agregado: ' + limpio + ' (' + CATEGORIAS_ARCHIVO[categoria] + ')' });
  return { ok: true };
}

/**
 * Descarga a través del panel (el equipo no tiene acceso directo al Drive institucional).
 * Archivos sobre el máximo (p. ej. antecedentes de 100 MB del Formulario): se concede acceso de lectura
 * a ese único archivo a quien lo pide, y queda registrado en la bitácora.
 */
function api_descargarArchivo(folio, archivoId) {
  const u = requiere_('edicion');
  const sol = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, sol)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  if (!archivosDe_(folio).some(a => a.archivo_id === archivoId)) throw new Error('El archivo no pertenece a este expediente.');
  const f = DriveApp.getFileById(archivoId);
  const max = Number(parametros_().max_mb_archivo || 20);
  if (f.getSize() / 1048576 <= max) {
    const b = f.getBlob();
    return { modo: 'descarga', nombre: f.getName(), mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
  }
  if (u.esDuenia) return { modo: 'enlace', url: f.getUrl() };
  f.addViewer(u.correo);
  anexar_(HOJAS.bitacora, { fecha: new Date(), folio: folio, tipo: 'archivo', quien: u.correo, texto: 'Acceso de lectura concedido a «' + f.getName() + '» (supera ' + max + ' MB).' });
  return { modo: 'enlace', url: f.getUrl() };
}

/** Apps Script no abre blobs de más de 50 MB: hasta aquí un ZIP se lista y se abre por partes en el servidor. */
const MAX_MB_ZIP = 45;

/**
 * Visor del panel: devuelve el archivo (o una entrada de un ZIP) listo para mostrarse, sin salir de la plataforma.
 * - ZIP sin «entrada»: lista su contenido. Con «entrada» (índice de esa lista): devuelve ese documento.
 * - Word (.doc, .docx, .odt, .rtf): se convierte a PDF en una copia temporal que se borra en el acto.
 * - Archivos sobre el máximo: mismo camino que «Descargar» (acceso de lectura en Drive, registrado en la bitácora).
 */
function api_verArchivo(folio, archivoId, entrada) {
  const u = requiere_('edicion');
  const sol = buscarSolicitud_(folio);
  if (!puedeVerSolicitud(u, sol)) throw new Error('SIN_ACCESO: la solicitud no pertenece a sus programas.');
  if (!archivosDe_(folio).some(a => a.archivo_id === archivoId)) throw new Error('El archivo no pertenece a este expediente.');
  const f = DriveApp.getFileById(archivoId);
  const max = Number(parametros_().max_mb_archivo || 20);
  let nombre = f.getName();
  const esZip = tipoVista(nombre) === 'zip';
  if (f.getSize() / 1048576 > (esZip ? Math.max(max, MAX_MB_ZIP) : max)) return api_descargarArchivo(folio, archivoId);
  let blob = f.getBlob();
  if (esZip) {
    const entradas = Utilities.unzip(blob).filter(b => entradaZipUtil(b.getName()));
    if (entrada === undefined || entrada === null || entrada === '') {
      return { modo: 'zip', nombre: nombre, entradas: entradas.map((b, i) => ({
        i: i, nombre: b.getName(), mb: Math.round(b.getBytes().length / 10485.76) / 100, vista: tipoVista(b.getName()) })) };
    }
    const e = entradas[Number(entrada)];
    if (!e) throw new Error('Ese documento ya no está en el ZIP.');
    nombre = e.getName();
    blob = Utilities.newBlob(e.getBytes(), mimePorNombre(nombre), nombre.split('/').pop());
  }
  const tipo = tipoVista(nombre);
  if (!tipo || tipo === 'zip') throw new Error('Este tipo de archivo no se puede mostrar aquí. Use «Descargar».');
  if (blob.getBytes().length / 1048576 > max) throw new Error('El documento supera ' + max + ' MB; descárguelo para verlo.');
  if (tipo === 'word') {
    const pdf = convertirAPdf_(blob, nombre);
    return { modo: 'ver', tipo: 'pdf', convertido: true, nombre: nombre.split('/').pop().replace(/\.[^.]+$/, '') + '.pdf',
      mime: 'application/pdf', base64: Utilities.base64Encode(pdf.getBytes()) };
  }
  return { modo: 'ver', tipo: tipo, nombre: nombre.split('/').pop(), mime: mimePorNombre(nombre), base64: Utilities.base64Encode(blob.getBytes()) };
}

/**
 * Word → PDF con el servicio avanzado de Drive (appsscript.json): se sube una copia convertida a Documento de Google en la
 * carpeta Temporal, se exporta a PDF y se borra. Si el borrado fallara, la limpieza diaria de Temporal la elimina.
 */
function convertirAPdf_(blob, nombre) {
  if (typeof Drive === 'undefined' || !Drive.Files) throw new Error('Para ver documentos Word falta el servicio avanzado de Drive (ver ACTIVACION.md).');
  const tmp = Drive.Files.create({ name: 'vista-temporal-' + Utilities.getUuid(), mimeType: 'application/vnd.google-apps.document',
    parents: [carpetaTemporal_().getId()] }, blob);
  try {
    return DriveApp.getFileById(tmp.id).getAs('application/pdf');
  } catch (e) {
    throw new Error('No se pudo convertir «' + nombre + '» a PDF: ' + e.message + '. Use «Descargar».');
  } finally {
    try { Drive.Files.remove(tmp.id); } catch (e) { try { DriveApp.getFileById(tmp.id).setTrashed(true); } catch (e2) { /* la limpieza diaria lo borra */ } }
  }
}
